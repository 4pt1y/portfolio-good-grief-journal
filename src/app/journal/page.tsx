import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import JournalEditor from './JournalEditor'

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { prompt_id } = await searchParams

  if (!prompt_id || typeof prompt_id !== 'string') redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: prompt }, { data: lovedOne }] = await Promise.all([
    supabase
      .from('prompts')
      .select('id, text')
      .eq('id', prompt_id)
      .single(),
    supabase
      .from('loved_ones')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .maybeSingle(),
  ])

  if (!prompt) redirect('/dashboard')
  if (!lovedOne) redirect('/onboarding')

  const promptText = prompt.text.replace(/\{name\}/g, lovedOne.name)

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-brand-blush border-b border-brand-periwinkle px-4 sm:px-6 py-4 flex justify-between items-center">
        <a href="/dashboard" className="text-sm text-brand-slate hover:text-brand-navy transition-colors">
          ← Back
        </a>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/photos"
            className="text-sm text-brand-slate hover:text-brand-navy transition-colors hidden sm:inline"
          >
            Photos
          </Link>
          <span className="text-brand-periwinkle select-none hidden sm:inline">|</span>
          <span className="text-sm text-brand-slate hidden sm:block">{user.email}</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-6 py-5 mb-8">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-widest mb-2">
            Today's prompt
          </p>
          <p className="text-base font-serif text-stone-700 leading-relaxed">
            {promptText}
          </p>
        </div>

        <JournalEditor
          userId={user.id}
          lovedOneId={lovedOne.id}
          promptId={prompt.id}
          promptText={promptText}
          lovedOneName={lovedOne.name}
        />
      </main>
    </div>
  )
}
