import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT =
  "You are a compassionate grief companion for The Good Grief Journal. Your role is to respond to someone who has just written a journal entry about their grief. You are warm, gentle, and never clinical. You validate their feelings without minimizing them. You never give advice unless asked. You speak in 2-3 short paragraphs. You always use the loved one's name when referring to them. You never say things like 'I understand' or 'I'm sorry for your loss' — instead show you understand through reflection. You are not a therapist — you are a caring presence."

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { journal_entry_id, content, prompt_text, loved_one_name } =
    await request.json() as {
      journal_entry_id: string
      content: string
      prompt_text: string
      loved_one_name: string
    }

  if (!content || !journal_entry_id) {
    return new Response('Missing required fields', { status: 400 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  try {
    stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `The journaling prompt was: "${prompt_text}"\n\nTheir entry about ${loved_one_name}:\n\n${content}`,
        },
      ],
    })
  } catch {
    return new Response('AI service unavailable', { status: 502 })
  }

  let fullText = ''
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            fullText += text
            controller.enqueue(encoder.encode(text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  after(async () => {
    if (!fullText) return
    const db = await createClient()
    await db.from('ai_responses').insert({
      journal_entry_id,
      content: fullText,
      model_used: 'gpt-4o-mini',
    })
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
