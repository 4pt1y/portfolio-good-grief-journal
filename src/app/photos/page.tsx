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

  const { data: photos } = await supabase
    .from('photos')
    .select('id, url, caption, taken_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-serif text-stone-800">The Good Grief Journal</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/journal/history"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            Past entries
          </Link>
          <span className="text-stone-200 select-none">|</span>
          <Link
            href="/dashboard"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-stone-200 select-none hidden sm:inline">|</span>
          <span className="text-sm text-stone-400 hidden sm:inline">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <p className="text-sm text-stone-400 mb-1">Photos for</p>
        <h2 className="text-3xl font-serif text-stone-800 mb-8">{lovedOne.name}</h2>

        <PhotoUploader
          userId={user.id}
          lovedOneId={lovedOne.id}
          lovedOneName={lovedOne.name}
          initialPhotos={(photos ?? []) as Photo[]}
        />
      </main>
    </div>
  )
}
