import Nav from '@/components/Nav'
import CheckoutButton from './CheckoutButton'
import { createClient } from '@/lib/supabase/server'

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { subscription } = await searchParams
  const showUpsell = subscription === 'success'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-white">
      <Nav
        desktopLinks={[
          { href: '/dashboard', label: 'Dashboard' },
        ]}
        userEmail={user?.email}
      />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-serif text-brand-navy mb-4">
            Simple, honest pricing
          </h1>
          <p className="text-brand-slate text-lg leading-relaxed max-w-md mx-auto">
            One plan. Everything you need to journal, reflect, and remember.
          </p>
        </div>

        {/* Subscription card */}
        <div className="rounded-3xl border-2 border-brand-periwinkle bg-brand-blush shadow-sm overflow-hidden">
          {/* Badge */}
          <div className="bg-brand-mauve/30 border-b border-brand-periwinkle/50 px-8 py-3 flex items-center justify-center gap-2">
            <span className="text-xs font-medium text-brand-navy uppercase tracking-widest">
              30-day money-back guarantee
            </span>
          </div>

          <div className="px-8 py-10">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-serif text-brand-navy">$9.99</span>
              <span className="text-brand-slate text-base">/month</span>
            </div>
            <p className="text-brand-slate text-sm mb-8">
              The Good Grief Journal — cancel anytime
            </p>

            <ul className="space-y-3 mb-10">
              {[
                'Daily guided prompts',
                'AI-powered reflections',
                'Photo memory uploads',
                'Crisis support resources',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-brand-slate">
                  <span className="w-5 h-5 rounded-full bg-brand-mauve/40 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-brand-navy" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <CheckoutButton
              endpoint="/api/stripe/create-checkout"
              label="Subscribe now"
              className="w-full rounded-xl bg-brand-navy text-white font-medium py-3.5 text-sm hover:bg-brand-slate transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Memory Book upsell — shown after successful subscription */}
        {showUpsell && (
          <div className="mt-10 rounded-2xl border border-brand-periwinkle bg-white px-8 py-8 text-center">
            <p className="text-xs font-medium text-brand-mauve uppercase tracking-widest mb-3">
              One more thing
            </p>
            <h2 className="text-2xl font-serif text-brand-navy mb-3">
              Unlock your Memory Book
            </h2>
            <p className="text-brand-slate text-sm leading-relaxed mb-6 max-w-sm mx-auto">
              Turn your journal entries and photos into a beautiful keepsake PDF —
              yours to print, share, or treasure. One-time payment.
            </p>
            <div className="flex items-baseline justify-center gap-1.5 mb-6">
              <span className="text-3xl font-serif text-brand-navy">$27</span>
              <span className="text-brand-slate text-sm">one time</span>
            </div>
            <CheckoutButton
              endpoint="/api/stripe/create-memory-book-checkout"
              label="Unlock Memory Book"
              className="rounded-xl border-2 border-brand-mauve text-brand-navy font-medium px-8 py-3 text-sm hover:bg-brand-blush transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        )}
      </main>
    </div>
  )
}
