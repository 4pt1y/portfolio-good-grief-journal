import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import PhotoUploader, { type Photo } from './PhotoUploader'

export default async function PhotosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: lovedOne } = await supabase
    .from('loved_ones')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .maybeSingle()

  if (!lovedOne) redirect('/onboarding')

  const [{ data: allLovedOnes }, { data: photos }] = await Promise.all([
    supabase
      .from('loved_ones')
      .select('id, name')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false }),
    supabase
      .from('photos')
      .select('id, url, caption, taken_at, created_at, loved_one_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const lovedOnes = allLovedOnes ?? []

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-brand-blush border-b border-brand-periwinkle px-4 sm:px-6 py-4 flex justify-between items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo-nav.png" alt="The Good Grief Journal" className="h-12 w-auto object-contain" style={{ clipPath: 'inset(0 8px 0 0)' }} />
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/journal/history"
            className="text-sm text-brand-slate hover:text-brand-navy transition-colors"
          >
            Past entries
          </Link>
          <span className="text-brand-periwinkle select-none">|</span>
          <Link
            href="/dashboard"
            className="text-sm text-brand-slate hover:text-brand-navy transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-brand-periwinkle select-none hidden sm:inline">|</span>
          <span className="text-sm text-brand-slate hidden sm:inline">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {lovedOnes.length > 1 ? (
          <h2 className="text-3xl font-serif text-brand-navy mb-8">Photos</h2>
        ) : (
          <>
            <p className="text-sm text-brand-slate mb-1">Photos for</p>
            <h2 className="text-3xl font-serif text-brand-navy mb-8">{lovedOne.name}</h2>
          </>
        )}

        <PhotoUploader
          userId={user.id}
          lovedOneId={lovedOne.id}
          lovedOneName={lovedOne.name}
          initialPhotos={(photos ?? []) as Photo[]}
          lovedOnes={lovedOnes}
        />
      </main>
    </div>
  )
}
