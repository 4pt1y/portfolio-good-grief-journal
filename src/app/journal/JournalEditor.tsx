'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userId: string
  lovedOneId: string
  promptId: string
  promptText: string
  lovedOneName: string
}

type SaveStatus = 'idle' | 'saving' | 'saved'
type AiPhase = 'idle' | 'streaming' | 'done' | 'crisis'

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0
}

export default function JournalEditor({ userId, lovedOneId, promptId, promptText, lovedOneName }: Props) {
  const [content, setContent] = useState('')
  const [entryId, setEntryId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [finishing, setFinishing] = useState(false)
  const [aiPhase, setAiPhase] = useState<AiPhase>('idle')
  const [aiResponse, setAiResponse] = useState('')
  const [crisisMessage, setCrisisMessage] = useState('')

  // Refs let the autosave interval always read the latest values without restarting
  const contentRef = useRef('')
  const entryIdRef = useRef<string | null>(null)
  const savingRef = useRef(false)
  contentRef.current = content
  entryIdRef.current = entryId

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const aiResponseRef = useRef<HTMLDivElement>(null)
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

  // Scroll AI response into view as it streams in
  useEffect(() => {
    if (aiPhase === 'streaming' && aiResponseRef.current) {
      aiResponseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [aiResponse, aiPhase])

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

    const savedEntryId = entryIdRef.current
    if (!savedEntryId) {
      router.push('/dashboard')
      return
    }

    setAiPhase('streaming')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch('/api/ai-response', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journal_entry_id: savedEntryId,
          content: contentRef.current,
          prompt_text: promptText,
          loved_one_name: lovedOneName,
        }),
      })

      if (!res.ok || !res.body) throw new Error('AI unavailable')

      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        clearTimeout(timeout)
        const data = await res.json() as { crisis?: boolean; message?: string }
        if (data.crisis && data.message) {
          setCrisisMessage(data.message)
          setAiPhase('crisis')
          return
        }
        throw new Error('Unexpected JSON response')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAiResponse(prev => prev + decoder.decode(value, { stream: true }))
      }

      clearTimeout(timeout)
      setAiPhase('done')
    } catch {
      clearTimeout(timeout)
      router.push('/dashboard')
    }
  }

  const wc = wordCount(content)

  if (aiPhase === 'crisis') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
          <p className="text-stone-700 text-base leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
          <p className="text-base text-stone-700 leading-relaxed font-serif whitespace-pre-wrap">
            {crisisMessage}
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a
              href="tel:988"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              Call or text 988
            </a>
            <a
              href="https://988lifeline.org/chat/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-3 border border-stone-300 bg-white text-stone-700 rounded-xl text-sm font-medium hover:border-stone-400 transition-colors"
            >
              Chat online at 988lifeline.org →
            </a>
          </div>

          <div className="mt-7 pt-5 border-t border-amber-200">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
            >
              Continue to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (aiPhase !== 'idle') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
          <p className="text-stone-700 text-base leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>

        <div ref={aiResponseRef} className="bg-amber-50 border border-amber-100 rounded-2xl p-8">
          {aiPhase === 'streaming' && !aiResponse && (
            <p className="text-sm text-stone-400 italic">A response is being written for you…</p>
          )}
          {aiResponse && (
            <p className="text-base text-stone-700 leading-relaxed font-serif whitespace-pre-wrap">
              {aiResponse}
              {aiPhase === 'streaming' && (
                <span className="inline-block w-0.5 h-4 bg-stone-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </p>
          )}
          {aiPhase === 'done' && (
            <div className="mt-6 pt-5 border-t border-amber-200">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-5 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
              >
                Continue to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

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
