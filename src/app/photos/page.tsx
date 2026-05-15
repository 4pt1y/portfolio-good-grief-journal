import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import PhotoUploader, { type Photo } from './PhotoUploader'
import PaywallGuard from '@/components/PaywallGuard'

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
    <PaywallGuard>
    <div className="min-h-screen bg-white">
      <Nav
        desktopLinks={[
          { href: '/journal/history', label: 'Past entries' },
          { href: '/dashboard', label: 'Dashboard' },
        ]}
        userEmail={user.email}
      />

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
    </PaywallGuard>
  )
}
