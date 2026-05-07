'use client'

import { useState } from 'react'

export type MemoryBookItem = {
  id: string
  name: string
  relationship: string | null
  photo_url: string | null
  entry_count: number
  photo_count: number
  downloadUrl: string | null
  lastGeneratedAt: string | null
  // True when the most recent generation attempt failed AND there is no
  // earlier complete book to fall back to.
  latestFailed: boolean
}

type Props = {
  userId: string
  items: MemoryBookItem[]
}

type Status =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'ready'; downloadUrl: string; generatedAt: string | null }
  | { kind: 'failed' }
  | { kind: 'error'; message: string }

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(iso))
}

export default function MemoryBookList({ userId, items }: Props) {
  const [statusById, setStatusById] = useState<Record<string, Status>>(() => {
    const m: Record<string, Status> = {}
    for (const it of items) {
      if (it.downloadUrl) {
        m[it.id] = {
          kind: 'ready',
          downloadUrl: it.downloadUrl,
          generatedAt: it.lastGeneratedAt,
        }
      } else if (it.latestFailed) {
        m[it.id] = { kind: 'failed' }
      } else {
        m[it.id] = { kind: 'idle' }
      }
    }
    return m
  })

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
        <p className="text-sm text-stone-500">No loved ones yet.</p>
      </div>
    )
  }

  async function generate(it: MemoryBookItem) {
    setStatusById((prev) => ({ ...prev, [it.id]: { kind: 'generating' } }))

    try {
      const res = await fetch('/api/memory-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, loved_one_id: it.id }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        setStatusById((prev) => ({
          ...prev,
          [it.id]: { kind: 'error', message: payload.error ?? 'Could not generate memory book.' },
        }))
        return
      }

      const data = (await res.json()) as { download_url: string }
      setStatusById((prev) => ({
        ...prev,
        [it.id]: {
          kind: 'ready',
          downloadUrl: data.download_url,
          generatedAt: new Date().toISOString(),
        },
      }))
    } catch {
      setStatusById((prev) => ({
        ...prev,
        [it.id]: { kind: 'error', message: 'Network error. Please try again.' },
      }))
    }
  }

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const status = statusById[it.id] ?? { kind: 'idle' as const }
        const hasContent = it.entry_count > 0 || it.photo_count > 0
        const cannotGenerate = !hasContent || status.kind === 'generating'

        return (
          <div
            key={it.id}
            className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 sm:p-6 flex items-center gap-4 sm:gap-5"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-stone-100 shrink-0">
              {it.photo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={it.photo_url} alt={it.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300 text-xl font-serif">
                  {it.name[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-stone-800 text-lg leading-tight truncate">
                {it.name}
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                {it.entry_count} {it.entry_count === 1 ? 'entry' : 'entries'} ·{' '}
                {it.photo_count} {it.photo_count === 1 ? 'photo' : 'photos'}
              </p>
              {status.kind === 'ready' && status.generatedAt && (
                <p className="text-xs text-stone-400 mt-1">
                  Generated {formatDate(status.generatedAt)}
                </p>
              )}
              {status.kind === 'error' && (
                <p className="text-xs text-red-500 mt-1.5">{status.message}</p>
              )}
              {status.kind === 'failed' && (
                <p className="text-xs text-stone-500 mt-1.5">
                  Last attempt didn&apos;t finish.
                </p>
              )}
              {!hasContent && status.kind === 'idle' && (
                <p className="text-xs text-stone-400 mt-1 italic">
                  Add an entry or photo first
                </p>
              )}
            </div>

            <div className="shrink-0">
              {status.kind === 'generating' ? (
                <span className="text-sm text-stone-500 flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating…
                </span>
              ) : status.kind === 'ready' ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <a
                    href={status.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-slate transition-colors text-center"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => generate(it)}
                    disabled={cannotGenerate}
                    className="px-3 py-2 text-xs text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-50 disabled:hover:text-stone-500"
                  >
                    Regenerate
                  </button>
                </div>
              ) : status.kind === 'failed' ? (
                <button
                  onClick={() => generate(it)}
                  disabled={cannotGenerate}
                  className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-slate disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Try again
                </button>
              ) : (
                <button
                  onClick={() => generate(it)}
                  disabled={cannotGenerate}
                  className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-slate disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Generate
                </button>
              )}
            </div>
          </div>
        )
      })}

    </div>
  )
}
