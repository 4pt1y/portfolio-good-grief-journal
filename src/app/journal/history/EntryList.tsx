'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export type EntryData = {
  id: string
  content: string
  word_count: number
  created_at: string
  promptText: string | null
  category: string | null
}

type Props = {
  entries: EntryData[]
  categories: string[]
}

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

export default function EntryList({ entries, categories }: Props) {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const filtered = entries.filter(entry => {
    const q = debouncedQuery.toLowerCase()
    const matchesQuery =
      !q ||
      entry.content.toLowerCase().includes(q) ||
      !!entry.promptText?.toLowerCase().includes(q)

    const matchesCategory = !selectedCategory || entry.category === selectedCategory

    return matchesQuery && matchesCategory
  })

  const isFiltering = !!debouncedQuery || !!selectedCategory

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search entries…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"
        />
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white sm:w-44"
          >
            <option value="">All topics</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
          {isFiltering ? (
            <>
              <p className="text-stone-400 text-sm">No entries match your search.</p>
              <button
                onClick={() => { setQuery(''); setSelectedCategory('') }}
                className="mt-3 text-sm text-stone-500 hover:text-stone-800 transition-colors"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-stone-500 text-sm">No entries yet.</p>
              <Link
                href="/dashboard"
                className="inline-block mt-4 text-sm text-stone-800 font-medium hover:underline"
              >
                Write your first entry →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <details
              key={entry.id}
              className="group bg-white rounded-2xl border border-stone-200 shadow-sm"
            >
              <summary className="cursor-pointer list-none px-5 sm:px-6 py-5 flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1.5">
                    <time className="text-xs text-stone-400">
                      {formatDate(entry.created_at)}
                    </time>
                    <span className="text-stone-200 select-none">·</span>
                    <span className="text-xs text-stone-400">
                      {entry.word_count} {entry.word_count === 1 ? 'word' : 'words'}
                    </span>
                    {entry.category && (
                      <>
                        <span className="text-stone-200 select-none">·</span>
                        <span className="text-xs text-stone-400">{entry.category}</span>
                      </>
                    )}
                  </div>
                  {entry.promptText && (
                    <p className="text-xs text-stone-400 italic mb-2">
                      &ldquo;{truncate(entry.promptText, 80)}&rdquo;
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

              <div className="px-5 sm:px-6 pb-6 border-t border-stone-100 pt-5">
                {entry.promptText && (
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-4">
                    {entry.promptText}
                  </p>
                )}
                <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
