'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

export type Photo = {
  id: string
  url: string
  caption: string | null
  taken_at: string | null
  created_at: string
}

type Props = {
  userId: string
  lovedOneId: string
  lovedOneName: string
  initialPhotos: Photo[]
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

// Extracts the storage object path from a Supabase public URL.
// URL format: https://{project}.supabase.co/storage/v1/object/public/photos/{path}
function storagePathFromUrl(url: string): string {
  const marker = '/object/public/photos/'
  const idx = url.indexOf(marker)
  return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : ''
}

export default function PhotoUploader({ userId, lovedOneId, lovedOneName, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)

  // Upload form state
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [takenAt, setTakenAt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
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
      .select('id, url, caption, taken_at, created_at')
      .single()

    if (insertError || !newPhoto) {
      setUploadError('Photo uploaded, but we couldn’t save the details. Please try again.')
      setUploading(false)
      return
    }

    setPhotos(prev => [newPhoto as Photo, ...prev])
    setUploading(false)
    resetUpload()
    setUploadSuccess(true)
    setTimeout(() => setUploadSuccess(false), 3000)
  }

  async function handleDeleteConfirm() {
    if (!deletingId) return
    setIsDeleting(true)
    setDeleteError('')

    const photo = photos.find(p => p.id === deletingId)
    if (!photo) {
      setDeletingId(null)
      setIsDeleting(false)
      return
    }

    // Best-effort storage deletion — don't block on failure
    const storagePath = storagePathFromUrl(photo.url)
    if (storagePath) {
      await supabase.storage.from('photos').remove([storagePath])
    }

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

  return (
    <>
      <div className="space-y-5">
        {/* Drop zone or file preview */}
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl py-14 flex flex-col items-center justify-center gap-3
              cursor-pointer select-none transition-colors
              ${dragOver
                ? 'border-stone-400 bg-stone-100'
                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }
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
              <button
                onClick={resetUpload}
                className="text-xs text-stone-400 hover:text-stone-700 transition-colors shrink-0"
              >
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

        {/* Caption + date + save — shown once a file is selected */}
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
              ) : (
                'Save photo'
              )}
            </button>
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="border-t border-stone-100 pt-8">
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-4">
              {photos.length === 1 ? '1 photo' : `${photos.length} photos`}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                  <div className="aspect-square overflow-hidden bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption ?? 'Photo'}
                      className="w-full h-full object-cover"
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
                      onClick={() => setDeletingId(photo.id)}
                      className="text-xs text-stone-300 hover:text-stone-500 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
            {deleteError && (
              <p className="text-sm text-red-500 mb-4">{deleteError}</p>
            )}
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
