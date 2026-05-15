import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

// Service-role client bypasses RLS — safe for webhook use only
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: Request) {
  // Must use request.text() (raw body string) — Stripe signature verification requires the exact bytes Stripe sent; request.json() would re-serialize and break the HMAC check
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    // constructEvent validates the HMAC signature against STRIPE_WEBHOOK_SECRET; it throws if the payload was tampered with or the secret is wrong, preventing spoofed events
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  // Service role client bypasses Row Level Security — needed here because the webhook runs server-side with no authenticated user session
  const db = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      // Fires when a Stripe Checkout session finishes successfully (covers both subscriptions and one-time payments)
      const session = event.data.object
      // supabase_user_id is set in session.metadata when creating the checkout session so we can link back to the correct user
      const userId = session.metadata?.supabase_user_id
      if (!userId) break

      if (session.mode === 'subscription') {
        // Subscription checkout completed — mark the user as active and store their Stripe customer ID for future subscription events
        await db
          .from('profiles')
          .update({
            subscription_status: 'active',
            stripe_customer_id: typeof session.customer === 'string'
              ? session.customer
              : null,
          })
          .eq('id', userId)
      } else if (session.mode === 'payment') {
        // One-time payment checkout completed — this is the Memory Book purchase, so unlock that feature for the user
        await db
          .from('profiles')
          .update({ memory_book_unlocked: true })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      // Fires when a subscription is cancelled or expires — look up by stripe_customer_id because there is no user session in this event
      const subscription = event.data.object
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : null
      if (!customerId) break

      // Revoke journal access by marking the subscription inactive
      await db
        .from('profiles')
        .update({ subscription_status: 'inactive' })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'invoice.payment_failed': {
      // Fires when Stripe cannot collect a recurring payment — signals a billing problem without yet cancelling the subscription
      const invoice = event.data.object
      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : null
      if (!customerId) break

      // Set status to past_due so the UI can prompt the user to update their payment method
      await db
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  return new Response('OK', { status: 200 })
}
