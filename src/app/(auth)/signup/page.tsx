'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-2xl shadow-sm border border-brand-periwinkle">
        <div className="w-full flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/logo-horizontal.svg" alt="The Good Grief Journal" className="w-3/4 max-w-xs h-auto" />
        </div>
        <h1 className="text-2xl font-serif text-brand-navy mb-2">Begin your journey</h1>
        <p className="text-brand-slate text-sm mb-8">Create your grief journal</p>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-brand-periwinkle text-sm focus:outline-none focus:ring-2 focus:ring-brand-periwinkle"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-brand-periwinkle text-sm focus:outline-none focus:ring-2 focus:ring-brand-periwinkle"
          />
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full py-3 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-slate disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </div>

        <p className="text-center text-sm text-stone-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-navy font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
