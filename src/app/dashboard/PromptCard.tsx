'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { fetchNextPrompt, type PromptData } from './actions'

type Props = {
  initialPrompt: PromptData
  lovedOneName: string
  usedIds: string[]
}

export default function PromptCard({ initialPrompt, lovedOneName, usedIds }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [seenIds, setSeenIds] = useState<string[]>([initialPrompt.id])
  const [isPending, startTransition] = useTransition()

  function handleNextPrompt() {
    const excludeIds = [...new Set([...usedIds, ...seenIds])]
    startTransition(async () => {
      const next = await fetchNextPrompt(excludeIds, lovedOneName)
      if (next) {
        setPrompt(next)
        setSeenIds(prev => [...prev, next.id])
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-medium text-stone-400 uppercase tracking-widest">
          Today&apos;s prompt
        </span>
        {prompt.category && (
          <>
            <span className="text-stone-200 select-none">·</span>
            <span className="text-xs text-stone-400">{prompt.category}</span>
          </>
        )}
      </div>
      <p className="text-lg font-serif text-stone-700 leading-relaxed mb-8">
        {prompt.text}
      </p>
      <Link
        href={`/journal?prompt_id=${prompt.id}`}
        className="inline-block px-6 py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
      >
        Start journaling
      </Link>
      <div className="mt-5">
        <button
          type="button"
          onClick={handleNextPrompt}
          disabled={isPending}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-40"
        >
          {isPending ? 'Loading…' : 'See a different prompt →'}
        </button>
      </div>
    </div>
  )
}
