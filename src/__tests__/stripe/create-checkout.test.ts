/**
 * Tests for POST /api/stripe/create-checkout
 *
 * Route behaviour:
 *  - Returns 401 when there is no authenticated user
 *  - Returns { url } from the Stripe session when a user is present
 */

// ── Mocks (must be declared before any imports that use them) ────────────────

// Mock server-only so the import in @/lib/stripe doesn't throw in Jest
jest.mock('server-only', () => ({}))

// Mock the Stripe library
const mockSessionsCreate = jest.fn()
jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockSessionsCreate,
      },
    },
  },
}))

// Mock the Supabase server client
const mockGetUser = jest.fn()
const mockSupabase = {
  auth: {
    getUser: mockGetUser,
  },
}
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { POST } from '@/app/api/stripe/create-checkout/route'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/create-checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const req = new Request('http://localhost/api/stripe/create-checkout', {
      method: 'POST',
    })

    const res = await POST(req)

    expect(res.status).toBe(401)
    const text = await res.text()
    expect(text).toBe('Unauthorized')
  })

  it('returns the Stripe checkout URL when a user is authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
      },
    })
    mockSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    })

    const req = new Request('http://localhost/api/stripe/create-checkout', {
      method: 'POST',
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ url: 'https://checkout.stripe.com/test' })

    // Verify Stripe was called in subscription mode with the user's email
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer_email: 'test@example.com',
        metadata: { supabase_user_id: 'user-123' },
      }),
    )
  })
})
