import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import EntryList from './EntryList'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: rawEntries }, { data: allCategories }] = await Promise.all([
    supabase
      .from('journal_entries')
      .select(`
        id,
        content,
        word_count,
        created_at,
        prompts ( text, category_id )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('prompt_categories')
      .select('id, name'),
  ])

  const catMap = new Map((allCategories ?? []).map(c => [c.id, c.name]))

  const entries = (rawEntries ?? []).map(entry => {
    const prompt = entry.prompts as unknown as { text: string; category_id: string } | null
    return {
      id: entry.id,
      content: entry.content,
      word_count: entry.word_count,
      created_at: entry.created_at,
      promptText: prompt?.text ?? null,
      category: prompt?.category_id ? (catMap.get(prompt.category_id) ?? null) : null,
    }
  })

  const categories = [...new Set(
    entries.map(e => e.category).filter((c): c is string => c !== null)
  )].sort()

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-brand-blush border-b border-brand-periwinkle px-4 sm:px-6 py-4 flex justify-between items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo-nav.png" alt="The Good Grief Journal" className="h-12 w-auto object-contain" style={{ clipPath: 'inset(0 8px 0 0)' }} />
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/journal/history"
            className="text-sm text-brand-navy font-medium"
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
          <Link
            href="/photos"
            className="text-sm text-brand-slate hover:text-brand-navy transition-colors hidden sm:inline"
          >
            Photos
          </Link>
          <span className="text-brand-periwinkle select-none hidden sm:inline">|</span>
          <span className="text-sm text-brand-slate hidden sm:inline">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <h2 className="text-3xl font-serif text-brand-navy mb-8">Past entries</h2>
        <EntryList entries={entries} categories={categories} />
      </main>
    </div>
  )
}
