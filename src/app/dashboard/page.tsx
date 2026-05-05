import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import PromptCard from './PromptCard'

function calculateStreak(dates: string[]): number {
  if (!dates.length) return 0
  const unique = [...new Set(dates)].sort().reverse()

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const mostRecent = new Date(unique[0] + 'T00:00:00Z')
  const diffFromToday = Math.round((today.getTime() - mostRecent.getTime()) / 86400000)
  if (diffFromToday > 1) return 0

  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] + 'T00:00:00Z')
    const curr = new Date(unique[i] + 'T00:00:00Z')
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diff === 1) streak++
    else break
  }
  return streak
}

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

  // Fetch all entries (used for prompt selection + stats)
  const [{ data: allEntries }, { data: allCategories }] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('prompt_id, created_at, prompts(category_id)')
      .eq('user_id', user.id),
    supabase
      .from('prompt_categories')
      .select('id, name'),
  ])

  const entries = allEntries ?? []
  const catMap = new Map((allCategories ?? []).map(c => [c.id, c.name]))

  const usedIds = entries
    .filter(e => e.prompt_id)
    .map(e => e.prompt_id as string)

  // Streak + totals
  const totalEntries = entries.length
  const streak = calculateStreak(entries.map(e => e.created_at.slice(0, 10)))

  // Category breakdown
  const categoryCounts: Record<string, number> = {}
  for (const entry of entries) {
    const catId = (entry.prompts as unknown as { category_id: string } | null)?.category_id
    if (catId) {
      const name = catMap.get(catId) ?? 'Other'
      categoryCounts[name] = (categoryCounts[name] ?? 0) + 1
    }
  }
  const categoryBreakdown = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])

  // Fetch the first unused prompt by display_order
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
      <nav className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-serif text-stone-800">The Good Grief Journal</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/journal/history"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            Past entries
          </Link>
          <span className="text-stone-200 select-none hidden sm:inline">|</span>
          <Link
            href="/photos"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors hidden sm:inline"
          >
            Photos
          </Link>
          <span className="text-stone-200 select-none hidden sm:inline">|</span>
          <span className="text-sm text-stone-400 hidden sm:inline">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <p className="text-sm text-stone-400 mb-1">Journaling for</p>
        <h2 className="text-3xl font-serif text-stone-800 mb-8 sm:mb-10">{lovedOne.name}</h2>

        {promptRow && promptText ? (
          <PromptCard
            initialPrompt={{ id: promptRow.id, text: promptText, category }}
            lovedOneName={lovedOne.name}
            usedIds={usedIds}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
            <p className="text-stone-500 text-sm">No prompts available yet.</p>
          </div>
        )}

        {totalEntries > 0 && (
          <div className="mt-8 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <p className="text-xs text-stone-400 mb-2">Day streak</p>
                <p className="text-2xl font-serif text-stone-800">
                  {streak}
                  <span className="text-sm font-sans font-normal text-stone-400 ml-1.5">
                    {streak === 1 ? 'day' : 'days'}
                  </span>
                </p>
              </div>
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <p className="text-xs text-stone-400 mb-2">Total entries</p>
                <p className="text-2xl font-serif text-stone-800">
                  {totalEntries}
                  <span className="text-sm font-sans font-normal text-stone-400 ml-1.5">
                    {totalEntries === 1 ? 'entry' : 'entries'}
                  </span>
                </p>
              </div>
            </div>

            {categoryBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <p className="text-xs text-stone-400 uppercase tracking-widest mb-4">Topics explored</p>
                <div className="space-y-3">
                  {categoryBreakdown.map(([name, count]) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-sm text-stone-600 w-36 shrink-0 truncate">{name}</span>
                      <div className="flex-1 bg-stone-100 rounded-full h-1.5 min-w-0">
                        <div
                          className="bg-stone-300 h-1.5 rounded-full"
                          style={{ width: `${Math.round((count / totalEntries) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-stone-400 shrink-0 w-5 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
