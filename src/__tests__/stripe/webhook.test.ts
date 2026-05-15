/**
 * Tests for POST /api/stripe/webhook
 *
 * Route behaviour:
 *  - Returns 400 when stripe-signature header is missing
 *  - Returns 400 when stripe.webhooks.constructEvent throws
 *  - checkout.session.completed (mode=subscription) → profiles.update({ subscription_status: 'active', stripe_customer_id })
 *  - checkout.session.completed (mode=payment)      → profiles.update({ memory_book_unlocked: true })
 *  - customer.subscription.deleted                  → profiles.update({ subscription_status: 'inactive' })
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('server-only', () => ({}))

// Track the chain: db.from('profiles').update(...).eq(...)
const mockEq = jest.fn().mockResolvedValue({ error: null })
const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate })

const mockAdminClient = { from: mockFrom }

// The webhook creates its own Supabase admin client via @supabase/supabase-js directly
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue(mockAdminClient),
}))

// Mock stripe — we only need constructEvent here
const mockConstructEvent = jest.fn()
jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { POST } from '@/app/api/stripe/webhook/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: string, signature: string | null = 'valid-sig'): Request {
  const headers: Record<string, string> = {}
  if (signature !== null) headers['stripe-signature'] = signature
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset the eq/update/from mocks each test
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  // ── Signature / parsing errors ─────────────────────────────────────────────

  it('returns 400 when the stripe-signature header is missing', async () => {
    const req = makeRequest('{}', null)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).toContain('Missing stripe-signature header')
  })

  it('returns 400 when constructEvent throws (invalid signature)', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })

    const req = makeRequest('{}')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).toContain('Webhook signature verification failed')
  })

  // ── checkout.session.completed — subscription ──────────────────────────────

  it('updates subscription_status to active when checkout.session.completed (subscription)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_abc123',
          metadata: { supabase_user_id: 'user-abc' },
        },
      },
    })

    const req = makeRequest('{}')
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_status: 'active', stripe_customer_id: 'cus_abc123' }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'user-abc')
  })

  // ── checkout.session.completed — payment (Memory Book) ────────────────────

  it('sets memory_book_unlocked to true when checkout.session.completed (payment)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          customer: 'cus_abc123',
          metadata: { supabase_user_id: 'user-abc' },
        },
      },
    })

    const req = makeRequest('{}')
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalledWith({ memory_book_unlocked: true })
    expect(mockEq).toHaveBeenCalledWith('id', 'user-abc')
  })

  // ── customer.subscription.deleted ─────────────────────────────────────────

  it('sets subscription_status to inactive when customer.subscription.deleted', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_xyz789',
        },
      },
    })

    const req = makeRequest('{}')
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive' })
    expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_xyz789')
  })
})
