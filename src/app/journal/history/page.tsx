import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
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
      <Nav
        desktopLinks={[
          { href: '/journal/history', label: 'Past entries', active: true },
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/photos', label: 'Photos' },
        ]}
        userEmail={user.email}
      />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <h2 className="text-3xl font-serif text-brand-navy mb-8">Past entries</h2>
        <EntryList entries={entries} categories={categories} />
      </main>
    </div>
  )
}
