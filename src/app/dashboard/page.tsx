import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardPage() {
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

  // Get prompt IDs the user has already journaled with
  const { data: usedEntries } = await supabase
    .from('journal_entries')
    .select('prompt_id')
    .eq('user_id', user.id)
    .not('prompt_id', 'is', null)

  const usedIds = (usedEntries ?? []).map(e => e.prompt_id as string)

  // Fetch the first unused prompt by display_order. The prompt_categories join is
  // omitted here because PostgREST's schema cache doesn't index that FK; category
  // is fetched separately below.
  let promptRow: { id: string; text: string; category_id: string } | null = null

  if (usedIds.length > 0) {
    const { data } = await supabase
      .from('prompts')
      .select('id, text, category_id')
      .not('id', 'in', `(${usedIds.join(',')})`)
      .order('display_order')
      .limit(1)
    promptRow = data?.[0] ?? null
  }

  // If no unused prompt found (or no entries yet), take the first by display_order
  if (!promptRow) {
    const { data } = await supabase
      .from('prompts')
      .select('id, text, category_id')
      .order('display_order')
      .limit(1)
    promptRow = data?.[0] ?? null
  }

  const promptText = promptRow
    ? promptRow.text.replace(/\{name\}/g, lovedOne.name)
    : null

  let category: string | null = null
  if (promptRow) {
    const { data: cat } = await supabase
      .from('prompt_categories')
      .select('name')
      .eq('id', promptRow.category_id)
      .single()
    category = cat?.name ?? null
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-serif text-stone-800">The Good Grief Journal</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/journal/history"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            Past entries
          </Link>
          <span className="text-stone-200 select-none">|</span>
          <span className="text-sm text-stone-400">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-stone-400 mb-1">Journaling for</p>
        <h2 className="text-3xl font-serif text-stone-800 mb-10">{lovedOne.name}</h2>

        {promptRow && promptText ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-widest">
                Today's prompt
              </span>
              {category && (
                <>
                  <span className="text-stone-200 select-none">·</span>
                  <span className="text-xs text-stone-400">{category}</span>
                </>
              )}
            </div>
            <p className="text-lg font-serif text-stone-700 leading-relaxed mb-8">
              {promptText}
            </p>
            <Link
              href={`/journal?prompt_id=${promptRow.id}`}
              className="inline-block px-6 py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              Start journaling
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
            <p className="text-stone-500 text-sm">No prompts available yet.</p>
          </div>
        )}
      </main>
    </div>
  )
}
