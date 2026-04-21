import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-serif text-stone-800">The Good Grief Journal</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-serif text-stone-800 mb-2">Your journal</h2>
        <p className="text-stone-500">You're signed in. More coming soon.</p>
      </main>
    </div>
  )
}
