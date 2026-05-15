import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import MemoryBookList, { type MemoryBookItem } from './MemoryBookList'
import PaywallGuard from '@/components/PaywallGuard'

export default async function MemoryBookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: primary } = await supabase
    .from('loved_ones')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .maybeSingle()
  if (!primary) redirect('/onboarding')

  const [
    { data: lovedOnes },
    { data: photoRows },
    { data: allBooks },
  ] = await Promise.all([
    supabase
      .from('loved_ones')
      .select('id, name, relationship, photo_url, entry_count')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false }),
    supabase
      .from('photos')
      .select('loved_one_id')
      .eq('user_id', user.id),
    // Pull every book so we can detect "latest attempt failed" per loved one
    supabase
      .from('memory_books')
      .select('id, loved_one_id, pdf_url, created_at, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const photoCounts = new Map<string, number>()
  for (const p of photoRows ?? []) {
    const k = p.loved_one_id as string | null
    if (k) photoCounts.set(k, (photoCounts.get(k) ?? 0) + 1)
  }

  type BookSnapshot = {
    pdf_url: string | null
    created_at: string
    status: 'generating' | 'complete' | 'failed'
  }
  // Latest book (any status) and latest complete book, per loved one
  const latestByLovedOne = new Map<string, BookSnapshot>()
  const latestCompleteByLovedOne = new Map<string, BookSnapshot>()
  for (const b of allBooks ?? []) {
    if (!b.loved_one_id) continue
    const snap: BookSnapshot = {
      pdf_url: b.pdf_url,
      created_at: b.created_at,
      status: b.status as BookSnapshot['status'],
    }
    if (!latestByLovedOne.has(b.loved_one_id)) {
      latestByLovedOne.set(b.loved_one_id, snap)
    }
    if (snap.status === 'complete' && !latestCompleteByLovedOne.has(b.loved_one_id)) {
      latestCompleteByLovedOne.set(b.loved_one_id, snap)
    }
  }

  // Sign URLs for existing complete books (1 hour TTL)
  const items: MemoryBookItem[] = await Promise.all(
    (lovedOnes ?? []).map(async (lo) => {
      const latest = latestByLovedOne.get(lo.id)
      const latestComplete = latestCompleteByLovedOne.get(lo.id)

      let downloadUrl: string | null = null
      let lastGeneratedAt: string | null = null
      if (latestComplete?.pdf_url) {
        const { data: signed } = await supabase.storage
          .from('memory-books')
          .createSignedUrl(latestComplete.pdf_url, 60 * 60)
        downloadUrl = signed?.signedUrl ?? null
        lastGeneratedAt = latestComplete.created_at
      }

      // "Latest attempt failed" only when the most recent row is failed
      // and there isn't a usable complete book to fall back to.
      const latestFailed = latest?.status === 'failed' && !downloadUrl

      return {
        id: lo.id,
        name: lo.name,
        relationship: lo.relationship,
        photo_url: lo.photo_url,
        entry_count: lo.entry_count,
        photo_count: photoCounts.get(lo.id) ?? 0,
        downloadUrl,
        lastGeneratedAt,
        latestFailed,
      }
    }),
  )

  return (
    <PaywallGuard>
    <div className="min-h-screen bg-white">
      <Nav
        desktopLinks={[
          { href: '/journal/history', label: 'Past entries' },
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/photos', label: 'Photos' },
        ]}
        userEmail={user.email}
      />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <h2 className="text-3xl font-serif text-brand-navy mb-3">Memory Book</h2>
        <p className="text-brand-slate leading-relaxed mb-8 max-w-md">
          A keepsake PDF that gathers your journal entries and photos into one place —
          yours to keep, print, or share.
        </p>

        <MemoryBookList userId={user.id} items={items} />
      </main>
    </div>
    </PaywallGuard>
  )
}
