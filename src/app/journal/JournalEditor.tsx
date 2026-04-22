'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userId: string
  lovedOneId: string
  promptId: string
}

type SaveStatus = 'idle' | 'saving' | 'saved'

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0
}

export default function JournalEditor({ userId, lovedOneId, promptId }: Props) {
  const [content, setContent] = useState('')
  const [entryId, setEntryId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [finishing, setFinishing] = useState(false)

  // Refs let the autosave interval always read the latest values without restarting
  const contentRef = useRef('')
  const entryIdRef = useRef<string | null>(null)
  const savingRef = useRef(false)
  contentRef.current = content
  entryIdRef.current = entryId

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const performSave = useCallback(async (): Promise<boolean> => {
    if (savingRef.current || !contentRef.current.trim()) return false
    savingRef.current = true
    setSaveStatus('saving')

    const wc = wordCount(contentRef.current)
    let ok = true

    if (!entryIdRef.current) {
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          user_id: userId,
          loved_one_id: lovedOneId,
          prompt_id: promptId,
          content: contentRef.current,
          word_count: wc,
        })
        .select('id')
        .single()

      if (!error && data) {
        setEntryId(data.id)
        entryIdRef.current = data.id
      } else {
        ok = false
      }
    } else {
      const { error } = await supabase
        .from('journal_entries')
        .update({ content: contentRef.current, word_count: wc })
        .eq('id', entryIdRef.current)

      if (error) ok = false
    }

    savingRef.current = false
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
    return ok
  }, [supabase, userId, lovedOneId, promptId])

  // Keep a ref to the latest performSave so the fixed interval always calls it
  const performSaveRef = useRef(performSave)
  useEffect(() => { performSaveRef.current = performSave }, [performSave])

  // Fixed 30-second autosave interval
  useEffect(() => {
    const timer = setInterval(() => performSaveRef.current(), 30_000)
    return () => clearInterval(timer)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.max(200, el.scrollHeight)}px`
  }

  async function handleFinish() {
    setFinishing(true)
    if (content.trim()) await performSave()
    router.push('/dashboard')
  }

  const wc = wordCount(content)

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        placeholder="Begin writing here…"
        className="w-full resize-none border-0 outline-none text-stone-800 text-base leading-relaxed placeholder:text-stone-300 bg-transparent"
        style={{ minHeight: '200px' }}
      />

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-stone-100">
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">
            {wc} {wc === 1 ? 'word' : 'words'}
          </span>
          {saveStatus === 'saving' && (
            <span className="text-xs text-stone-400">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-600">Saved</span>
          )}
        </div>

        <button
          onClick={handleFinish}
          disabled={finishing || !content.trim()}
          className="px-5 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors"
        >
          {finishing ? 'Saving…' : 'Save & finish'}
        </button>
      </div>
    </div>
  )
}
