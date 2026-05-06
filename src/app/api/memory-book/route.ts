import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { MemoryBookPDF, type Entry, type Photo } from '@/lib/memory-book/MemoryBookPDF'

export const runtime = 'nodejs'
export const maxDuration = 60

const SIGNED_URL_TTL_SECONDS = 60 * 60

// react-pdf's <Image src> chokes on URLs whose extension it can't infer
// (e.g. Supabase signed URLs with query strings) and aborts the whole render.
// Embedding the bytes as a data URI sidesteps the extension sniffing entirely.
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null

    const headerType = res.headers.get('content-type')?.split(';')[0].trim()
    let mime = headerType && headerType.startsWith('image/') ? headerType : null

    if (!mime) {
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
      mime = EXT_MIME[ext] ?? null
    }
    if (!mime) return null

    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function logError(step: string, err: unknown) {
  if (err instanceof Error) {
    console.error(`[memory-book] ${step} failed:`, {
      message: err.message,
      stack: err.stack,
      cause: err.cause,
    })
  } else {
    console.error(`[memory-book] ${step} failed:`, err)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { user_id?: string; loved_one_id?: string }
    try {
      body = await request.json()
    } catch (err) {
      logError('parse request body', err)
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const lovedOneId = body.loved_one_id
    if (!lovedOneId) {
      return Response.json({ error: 'loved_one_id is required' }, { status: 400 })
    }

    // Verify ownership and fetch loved one details
    const { data: lovedOne, error: lovedOneErr } = await supabase
      .from('loved_ones')
      .select('id, name, relationship, date_of_birth, date_of_passing, photo_url')
      .eq('id', lovedOneId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (lovedOneErr) logError('fetch loved_one', lovedOneErr)
    if (lovedOneErr || !lovedOne) {
      return Response.json({ error: 'Loved one not found' }, { status: 404 })
    }

    // Look for a prior successful book for this loved one. If one exists,
    // this is a regeneration: we update that row in place rather than creating
    // a new one, so the user's existing PDF stays downloadable until the new
    // one is fully ready (and on failure we can revert the row to 'complete').
    const { data: existingComplete, error: existingErr } = await supabase
      .from('memory_books')
      .select('id')
      .eq('user_id', user.id)
      .eq('loved_one_id', lovedOneId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingErr) logError('lookup existing memory_book', existingErr)
    const isRegen = !!existingComplete

    // Entries (with prompt text + ai response)
    const { data: rawEntries, error: entriesErr } = await supabase
      .from('journal_entries')
      .select('id, content, created_at, prompts ( text ), ai_responses ( content )')
      .eq('user_id', user.id)
      .eq('loved_one_id', lovedOneId)
      .order('created_at', { ascending: true })

    if (entriesErr) logError('fetch journal_entries', entriesErr)

    const entries: Entry[] = (rawEntries ?? []).map((e) => {
      const prompt = e.prompts as unknown as { text: string } | null
      const aiRows = e.ai_responses as unknown as { content: string }[] | null
      const promptText = prompt?.text
        ? prompt.text.replace(/\{name\}/g, lovedOne.name)
        : null
      return {
        id: e.id,
        content: e.content,
        created_at: e.created_at,
        promptText,
        aiResponse: aiRows && aiRows.length > 0 ? aiRows[0].content : null,
      }
    })

    // Photos
    const { data: rawPhotos, error: photosErr } = await supabase
      .from('photos')
      .select('id, url, caption, taken_at')
      .eq('user_id', user.id)
      .eq('loved_one_id', lovedOneId)
      .order('taken_at', { ascending: true, nullsFirst: false })

    if (photosErr) logError('fetch photos', photosErr)

    // Fetch all images in parallel and embed as data URIs so react-pdf doesn't
    // need to sniff extensions or fetch over the network during render.
    const [coverDataUri, photoDataUris] = await Promise.all([
      lovedOne.photo_url ? fetchImageAsDataUri(lovedOne.photo_url) : Promise.resolve(null),
      Promise.all(
        (rawPhotos ?? []).map((p) =>
          p.url ? fetchImageAsDataUri(p.url) : Promise.resolve(null),
        ),
      ),
    ])

    console.log('[memory-book] image embed summary:', {
      lovedOneId,
      entries: entries.length,
      photosFound: rawPhotos?.length ?? 0,
      photosEmbedded: photoDataUris.filter((u) => u !== null).length,
      coverEmbedded: coverDataUri !== null,
    })

    const photos: Photo[] = (rawPhotos ?? []).map((p, i) => ({
      id: p.id,
      url: photoDataUris[i],
      caption: p.caption,
      taken_at: p.taken_at,
    }))

    const lovedOneForPdf = { ...lovedOne, photo_url: coverDataUri }

    // Reserve a row up front. For a regen we update the existing 'complete'
    // row in place (its pdf_url stays pointing at the still-valid old PDF
    // until the new upload finishes); for a fresh generation we create a new
    // 'generating' row.
    const title = `Memory Book — ${lovedOne.name}`
    let bookId: string
    if (isRegen) {
      const { error: flagErr } = await supabase
        .from('memory_books')
        .update({ status: 'generating' })
        .eq('id', existingComplete.id)
      if (flagErr) {
        logError('flag existing memory_book as generating', flagErr)
        return Response.json({ error: 'Could not start regeneration' }, { status: 500 })
      }
      bookId = existingComplete.id
    } else {
      const { data: bookRow, error: bookErr } = await supabase
        .from('memory_books')
        .insert({
          user_id: user.id,
          loved_one_id: lovedOneId,
          title,
          status: 'generating',
        })
        .select('id')
        .single()
      if (bookErr) logError('insert memory_books row', bookErr)
      if (bookErr || !bookRow) {
        return Response.json({ error: 'Could not create memory book record' }, { status: 500 })
      }
      bookId = bookRow.id
    }

    // For regens the row's old pdf_url + the storage object are still valid
    // until upload runs, so on any failure before the final commit we revert
    // the row to 'complete' so the user keeps their previous download.
    // Fresh generations have nothing to fall back to → mark 'failed'.
    const failureStatus: 'complete' | 'failed' = isRegen ? 'complete' : 'failed'

    // Render
    let buffer: Buffer
    try {
      buffer = await renderToBuffer(
        React.createElement(MemoryBookPDF, {
          lovedOne: lovedOneForPdf,
          entries,
          photos,
          generatedAt: new Date(),
        }) as React.ReactElement<DocumentProps>,
      )
    } catch (err) {
      logError('renderToBuffer', err)
      await supabase.from('memory_books').update({ status: failureStatus }).eq('id', bookId)
      return Response.json({ error: 'Could not render PDF' }, { status: 500 })
    }

    // Upload (overwrites prior PDF for the same loved one)
    const path = `${user.id}/${lovedOneId}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('memory-books')
      .upload(path, buffer, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) {
      logError('storage upload', uploadErr)
      await supabase.from('memory_books').update({ status: failureStatus }).eq('id', bookId)
      return Response.json({ error: 'Could not upload PDF' }, { status: 500 })
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('memory-books')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (signErr) logError('createSignedUrl', signErr)
    if (!signed?.signedUrl) {
      await supabase.from('memory_books').update({ status: failureStatus }).eq('id', bookId)
      return Response.json({ error: 'Could not create download link' }, { status: 500 })
    }

    const { error: finalUpdateErr } = await supabase
      .from('memory_books')
      .update({ status: 'complete', pdf_url: path })
      .eq('id', bookId)

    if (finalUpdateErr) logError('mark memory_book complete', finalUpdateErr)

    return Response.json({
      id: bookId,
      title,
      download_url: signed.signedUrl,
    })
  } catch (err) {
    logError('unhandled', err)
    return Response.json(
      { error: 'Memory book generation failed unexpectedly. See server logs for details.' },
      { status: 500 },
    )
  }
}
