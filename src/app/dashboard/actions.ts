'use server'

import { createClient } from '@/lib/supabase/server'

export type PromptData = {
  id: string
  text: string
  category: string | null
}

export async function fetchNextPrompt(
  excludeIds: string[],
  lovedOneName: string,
): Promise<PromptData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let promptRow: { id: string; text: string; category_id: string } | null = null

  if (excludeIds.length > 0) {
    const { data } = await supabase
      .from('prompts')
      .select('id, text, category_id')
      .not('id', 'in', `(${excludeIds.join(',')})`)
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

  if (!promptRow) return null

  const text = promptRow.text.replace(/\{name\}/g, lovedOneName)

  let category: string | null = null
  const { data: cat } = await supabase
    .from('prompt_categories')
    .select('name')
    .eq('id', promptRow.category_id)
    .single()
  category = cat?.name ?? null

  return { id: promptRow.id, text, category }
}
