import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      id,
      content,
      word_count,
      created_at,
      prompts ( text )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-serif text-stone-800">The Good Grief Journal</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/journal/history"
            className="text-sm text-stone-800 font-medium"
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
          <span className="text-stone-200 select-none">|</span>
          <span className="text-sm text-stone-400">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-serif text-stone-800 mb-8">Past entries</h2>

        {!entries || entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
            <p className="text-stone-500 text-sm">No entries yet.</p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 text-sm text-stone-800 font-medium hover:underline"
            >
              Write your first entry →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const promptText = (entry.prompts as unknown as { text: string } | null)?.text ?? null

              return (
                <details
                  key={entry.id}
                  className="group bg-white rounded-2xl border border-stone-200 shadow-sm"
                >
                  <summary className="cursor-pointer list-none px-6 py-5 flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <time className="text-xs text-stone-400">
                          {formatDate(entry.created_at)}
                        </time>
                        <span className="text-stone-200 select-none">·</span>
                        <span className="text-xs text-stone-400">
                          {entry.word_count} {entry.word_count === 1 ? 'word' : 'words'}
                        </span>
                      </div>
                      {promptText && (
                        <p className="text-xs text-stone-400 italic mb-2">
                          "{truncate(promptText, 80)}"
                        </p>
                      )}
                      <p className="text-sm text-stone-600 leading-relaxed">
                        {truncate(entry.content, 100)}
                      </p>
                    </div>
                    <span className="text-stone-300 text-sm shrink-0 mt-0.5 transition-transform group-open:rotate-180">
                      ↓
                    </span>
                  </summary>

                  <div className="px-6 pb-6 border-t border-stone-100 pt-5">
                    {promptText && (
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-4">
                        {promptText}
                      </p>
                    )}
                    <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </p>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
