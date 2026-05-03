import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findCrisisPhrase } from '@/lib/crisis-detection'
import OpenAI from 'openai'

const CRISIS_MESSAGE =
  "What you're carrying right now sounds incredibly heavy. You don't have to face this alone. Please reach out to the 988 Suicide and Crisis Lifeline — you can call or text 988 anytime, day or night. Real people are there to listen."

const SYSTEM_PROMPT = `You are a warm, wise companion for The Good Grief Journal — someone who has experienced loss themselves and responds from the heart, not from a textbook.

Your voice is like a caring friend sending a heartfelt message — natural, specific, and real. You respond to the *feeling* behind what someone wrote, not a mirror of their words back to them.

Rules:
- Never reflect or repeat what the person just said back to them
- Never use therapy-speak: no 'honoring your feelings', 'holding space', 'sitting with', 'I hear you', 'it sounds like'
- No performative openers like 'What a powerful thing to share' or 'It's beautiful that...'
- Never say 'I can imagine' or 'I understand'
- Write the way a real person texts or writes a letter — warm, a little imperfect, genuine
- 2 short paragraphs maximum
- End with a gentle thought or question they can carry with them — something that came naturally to you, not a therapist's homework assignment
- Always use the loved one's name when referring to them
- You are not a therapist. You are a caring human presence.`

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

  // Crisis detection takes priority over rate limiting and AI generation —
  // if the entry contains crisis language, log it and return resources directly.
  const crisisPhrase = findCrisisPhrase(content)
  if (crisisPhrase) {
    await supabase.from('crisis_events').insert({
      user_id: user.id,
      journal_entry_id,
      trigger_phrase: crisisPhrase,
    })

    return Response.json({ crisis: true, message: CRISIS_MESSAGE })
  }

  // Rate limit: max 10 AI responses per user per day
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString())

  if (todayEntries && todayEntries.length > 0) {
    const entryIds = todayEntries.map(e => e.id as string)
    const { count } = await supabase
      .from('ai_responses')
      .select('id', { count: 'exact', head: true })
      .in('journal_entry_id', entryIds)

    if ((count ?? 0) >= 10) {
      return new Response('Rate limit reached', { status: 429 })
    }
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
