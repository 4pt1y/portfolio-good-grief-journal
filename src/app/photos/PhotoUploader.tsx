'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

export type Photo = {
  id: string
  url: string
  caption: string | null
  taken_at: string | null
  created_at: string
  loved_one_id: string | null
}

type LovedOne = {
  id: string
  name: string
}

type Props = {
  userId: string
  lovedOneId: string
  lovedOneName: string
  initialPhotos: Photo[]
  lovedOnes: LovedOne[]
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

function storagePathFromUrl(url: string): string {
  const marker = '/object/public/photos/'
  const idx = url.indexOf(marker)
  return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : ''
}

export default function PhotoUploader({
  userId, lovedOneId, lovedOneName, initialPhotos, lovedOnes,
}: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)

  // Upload form
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [takenAt, setTakenAt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Filter
  const [filterLovedOneId, setFilterLovedOneId] = useState<string>('all')

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editCaption, setEditCaption] = useState('')
  const [editTakenAt, setEditTakenAt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editSaved, setEditSaved] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Refs so the keyboard effect always reads current values without re-registering
  const isEditingRef = useRef(isEditing)
  isEditingRef.current = isEditing

  const filteredPhotos = filterLovedOneId === 'all'
    ? photos
    : photos.filter(p => p.loved_one_id === filterLovedOneId)

  const filteredLenRef = useRef(filteredPhotos.length)
  filteredLenRef.current = filteredPhotos.length

  // Sync edit fields whenever the lightbox opens on a new photo
  const prevLightboxId = useRef<string | null>(null)
  useEffect(() => {
    if (lightboxIndex === null) {
      prevLightboxId.current = null
      return
    }
    const photo = filteredPhotos[lightboxIndex]
    if (!photo || photo.id === prevLightboxId.current) return
    prevLightboxId.current = photo.id
    setEditCaption(photo.caption ?? '')
    setEditTakenAt(photo.taken_at?.slice(0, 10) ?? '')
    setIsEditing(false)
    setEditSaved(false)
  }) // intentionally runs every render — the prevLightboxId guard makes it cheap

  // Body scroll lock while lightbox is open
  useEffect(() => {
    if (lightboxIndex !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [lightboxIndex])

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return

    function onKey(e: KeyboardEvent) {
      if (isEditingRef.current) {
        if (e.key === 'Escape') { setIsEditing(false); setEditSaved(false) }
        return
      }
      const len = filteredLenRef.current
      if (e.key === 'Escape') setLightboxIndex(null)
      else if (e.key === 'ArrowLeft') setLightboxIndex(i => i !== null ? (i - 1 + len) % len : null)
      else if (e.key === 'ArrowRight') setLightboxIndex(i => i !== null ? (i + 1) % len : null)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex])

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  function closeLightbox() {
    setLightboxIndex(null)
    setIsEditing(false)
    setEditSaved(false)
  }

  function navigateLightbox(dir: 1 | -1) {
    setLightboxIndex(i => i !== null ? (i + dir + filteredLenRef.current) % filteredLenRef.current : null)
  }

  // Upload handlers
  function validateAndSet(f: File) {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setUploadError('Only JPEG, PNG, and WebP images are supported.')
      return
    }
    if (f.size > MAX_BYTES) {
      setUploadError('Photo must be under 10 MB.')
      return
    }
    setUploadError('')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) validateAndSet(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) validateAndSet(f)
  }

  function resetUpload() {
    setFile(null)
    setPreview(null)
    setCaption('')
    setTakenAt('')
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setUploadError('')

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/${crypto.randomUUID()}.${ext}`

    const { data: uploadData, error: storageError } = await supabase.storage
      .from('photos')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (storageError || !uploadData) {
      setUploadError('Upload failed — please check your connection and try again.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(uploadData.path)

    const { data: newPhoto, error: insertError } = await supabase
      .from('photos')
      .insert({
        user_id: userId,
        loved_one_id: lovedOneId,
        url: publicUrl,
        thumbnail_url: publicUrl,
        caption: caption.trim() || null,
        taken_at: takenAt || null,
      })
      .select('id, url, caption, taken_at, created_at, loved_one_id')
      .single()

    if (insertError || !newPhoto) {
      setUploadError("Photo uploaded, but we couldn't save the details. Please try again.")
      setUploading(false)
      return
    }

    // Auto-fill the loved one's profile photo from the first upload, so the
    // dashboard / memory-book thumbnails populate without a separate step.
    // Atomic: the row only changes when photo_url is still null/empty AND
    // this is the primary loved one — a no-op otherwise.
    const { error: thumbnailErr } = await supabase
      .from('loved_ones')
      .update({ photo_url: publicUrl })
      .eq('id', lovedOneId)
      .eq('is_primary', true)
      .or('photo_url.is.null,photo_url.eq.""')

    // Non-fatal: the upload itself succeeded, so don't surface this to the user.
    if (thumbnailErr) {
      console.warn('Could not auto-set loved_one photo_url:', thumbnailErr)
    }

    setPhotos(prev => [newPhoto as Photo, ...prev])
    setUploading(false)
    resetUpload()
    setUploadSuccess(true)
    setTimeout(() => setUploadSuccess(false), 3000)
  }

  // Delete handlers
  async function handleDeleteConfirm() {
    if (!deletingId) return
    setIsDeleting(true)
    setDeleteError('')

    const photo = photos.find(p => p.id === deletingId)
    if (!photo) { setDeletingId(null); setIsDeleting(false); return }

    const storagePath = storagePathFromUrl(photo.url)
    if (storagePath) await supabase.storage.from('photos').remove([storagePath])

    const { error } = await supabase.from('photos').delete().eq('id', deletingId)

    if (error) {
      setDeleteError('Something went wrong. Please try again.')
      setIsDeleting(false)
      return
    }

    setPhotos(prev => prev.filter(p => p.id !== deletingId))
    setDeletingId(null)
    setIsDeleting(false)
  }

  // Edit handlers
  async function handleSaveEdit() {
    if (lightboxIndex === null) return
    const photo = filteredPhotos[lightboxIndex]
    if (!photo) return
    setIsSaving(true)

    const { error } = await supabase
      .from('photos')
      .update({
        caption: editCaption.trim() || null,
        taken_at: editTakenAt || null,
      })
      .eq('id', photo.id)

    if (!error) {
      setPhotos(prev => prev.map(p =>
        p.id === photo.id
          ? { ...p, caption: editCaption.trim() || null, taken_at: editTakenAt || null }
          : p
      ))
      setIsEditing(false)
      setEditSaved(true)
      setTimeout(() => setEditSaved(false), 2500)
    }

    setIsSaving(false)
  }

  const currentPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] ?? null : null
  const showFilter = lovedOnes.length > 1

  return (
    <>
      <div className="space-y-5">
        {/* Drop zone or file preview */}
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl py-14 flex flex-col items-center justify-center gap-3
              cursor-pointer select-none transition-colors
              ${dragOver ? 'border-stone-400 bg-stone-100' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'}
            `}
          >
            <svg className="w-8 h-8 text-stone-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.99 11.097" />
            </svg>
            <div className="text-center">
              <p className="text-sm text-stone-500">
                {dragOver ? 'Drop photo here' : 'Drag a photo here, or click to browse'}
              </p>
              <p className="text-xs text-stone-400 mt-1">JPEG, PNG, or WebP &middot; up to 10 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview!} alt="Preview" className="w-full object-cover max-h-72" />
            <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between gap-4">
              <span className="text-xs text-stone-400 truncate">{file.name}</span>
              <button onClick={resetUpload} className="text-xs text-stone-400 hover:text-stone-700 transition-colors shrink-0">
                Remove
              </button>
            </div>
          </div>
        )}

        {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}

        {uploadSuccess && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-sm font-serif text-stone-700">
              Photo added to {lovedOneName}&apos;s memory.
            </p>
          </div>
        )}

        {file && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Caption <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder={`A memory with ${lovedOneName}…`}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Date taken <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={takenAt}
                onChange={e => setTakenAt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading&hellip;
                </span>
              ) : 'Save photo'}
            </button>
          </div>
        )}

        {/* Gallery */}
        {photos.length > 0 && (
          <div className="border-t border-stone-100 pt-8">
            {/* Filter + count row */}
            <div className="flex items-center justify-between mb-4 gap-4">
              <p className="text-xs text-stone-400 uppercase tracking-widest shrink-0">
                {filteredPhotos.length === 1 ? '1 photo' : `${filteredPhotos.length} photos`}
              </p>
              {showFilter && (
                <select
                  value={filterLovedOneId}
                  onChange={e => setFilterLovedOneId(e.target.value)}
                  className="text-xs text-stone-600 border border-stone-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  <option value="all">All</option>
                  {lovedOnes.map(lo => (
                    <option key={lo.id} value={lo.id}>{lo.name}</option>
                  ))}
                </select>
              )}
            </div>

            {filteredPhotos.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-8">No photos for this person yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredPhotos.map((photo, i) => (
                  <div
                    key={photo.id}
                    className="group bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden cursor-pointer"
                    onClick={() => openLightbox(i)}
                  >
                    <div className="aspect-square overflow-hidden bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption ?? 'Photo'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="px-3 py-2.5">
                      {photo.caption && (
                        <p className="text-xs text-stone-600 italic mb-1 line-clamp-2">{photo.caption}</p>
                      )}
                      {photo.taken_at && (
                        <p className="text-xs text-stone-400 mb-2">{formatDate(photo.taken_at)}</p>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingId(photo.id) }}
                        className="text-xs text-stone-300 hover:text-stone-500 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {currentPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) closeLightbox() }}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Photo counter */}
          {filteredPhotos.length > 1 && (
            <p className="absolute top-5 left-1/2 -translate-x-1/2 text-xs text-white/50 tabular-nums">
              {(lightboxIndex ?? 0) + 1} / {filteredPhotos.length}
            </p>
          )}

          {/* Left arrow */}
          {filteredPhotos.length > 1 && (
            <button
              onClick={() => navigateLightbox(-1)}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors z-10"
              aria-label="Previous photo"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Right arrow */}
          {filteredPhotos.length > 1 && (
            <button
              onClick={() => navigateLightbox(1)}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors z-10"
              aria-label="Next photo"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Content — stopPropagation so clicks here don't close the lightbox */}
          <div
            className="w-full max-w-2xl mx-auto px-14 sm:px-20 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={currentPhoto.id}
              src={currentPhoto.url}
              alt={currentPhoto.caption ?? 'Photo'}
              className="w-full max-h-[65vh] object-contain rounded-t-xl"
            />

            {/* Info panel */}
            <div className="bg-white rounded-b-xl px-5 py-4 min-h-16">
              {!isEditing ? (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {currentPhoto.caption && (
                      <p className="text-sm text-stone-700 leading-relaxed">{currentPhoto.caption}</p>
                    )}
                    {currentPhoto.taken_at && (
                      <p className="text-xs text-stone-400 mt-1">{formatDate(currentPhoto.taken_at)}</p>
                    )}
                    {!currentPhoto.caption && !currentPhoto.taken_at && (
                      <p className="text-xs text-stone-300 italic">No caption</p>
                    )}
                    {editSaved && (
                      <p className="text-xs text-emerald-600 mt-1">Saved</p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-stone-400 hover:text-stone-700 transition-colors shrink-0 mt-0.5"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editCaption}
                    onChange={e => setEditCaption(e.target.value)}
                    placeholder="Add a caption…"
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                  <input
                    type="date"
                    value={editTakenAt}
                    onChange={e => setEditTakenAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setIsEditing(false); setEditSaved(false) }}
                      disabled={isSaving}
                      className="px-4 py-2 border border-stone-200 text-stone-600 rounded-lg text-xs font-medium hover:bg-stone-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div
          className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0"
          onClick={e => { if (e.target === e.currentTarget) setDeletingId(null) }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-serif text-stone-800 text-lg mb-2">Remove this photo?</h3>
            <p className="text-sm text-stone-500 leading-relaxed mb-6">
              Are you sure you want to delete this photo? This cannot be undone.
            </p>
            {deleteError && <p className="text-sm text-red-500 mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeletingId(null); setDeleteError('') }}
                disabled={isDeleting}
                className="flex-1 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
