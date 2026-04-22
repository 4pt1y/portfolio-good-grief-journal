'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const RELATIONSHIPS = [
  'Mother', 'Father', 'Spouse/Partner', 'Child',
  'Sibling', 'Grandparent', 'Friend', 'Other',
]

const PRONOUNS = ['She/Her', 'He/Him', 'They/Them']

const TOTAL_STEPS = 3

export default function OnboardingPage() {
  const [step, setStep] = useState(1)

  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [pronouns, setPronouns] = useState('')

  const [dateOfPassing, setDateOfPassing] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function handleNext() {
    if (step === 1 && !name.trim()) {
      setError('Please enter their name.')
      return
    }
    setError('')
    setStep(s => s + 1)
  }

  function handleBack() {
    setError('')
    setStep(s => s - 1)
  }

  async function handleComplete() {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // profiles row must exist before inserting loved_ones (FK constraint)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email! }, { onConflict: 'id' })

    if (profileError) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    let photoUrl: string | null = null
    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('loved-ones')
        .upload(path, photo)
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('loved-ones')
          .getPublicUrl(uploadData.path)
        photoUrl = publicUrl
      }
    }

    const { error: insertError } = await supabase
      .from('loved_ones')
      .insert({
        user_id: user.id,
        name: name.trim(),
        relationship: relationship || null,
        pronouns: pronouns || null,
        date_of_passing: dateOfPassing || null,
        date_of_birth: dateOfBirth || null,
        photo_url: photoUrl,
        is_primary: true,
      })

    if (insertError) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const stepTitles = [
    'Who are you grieving?',
    'When did you lose them?',
    `A moment to honor ${name.trim() || 'them'}`,
  ]

  return (
    <div className="w-full max-w-lg">
      {/* Progress indicator */}
      <div className="flex items-center justify-center mb-8 gap-3">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const n = i + 1
          const isActive = n === step
          const isDone = n < step
          return (
            <div key={n} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-stone-800 text-white'
                    : isDone
                    ? 'bg-stone-400 text-white'
                    : 'border border-stone-300 text-stone-400'
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  n
                )}
              </div>
              {n < TOTAL_STEPS && (
                <div className={`w-10 h-px ${n < step ? 'bg-stone-400' : 'bg-stone-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">
          Step {step} of {TOTAL_STEPS}
        </p>
        <h1
          className="text-2xl text-stone-800 mb-1"
          style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
        >
          {stepTitles[step - 1]}
        </h1>

        {error && (
          <p className="text-sm text-red-500 mt-3">{error}</p>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-stone-500 -mt-2">
              Tell us about them so your journal can feel personal.
            </p>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Their name <span className="text-stone-400">(required)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Margaret, Dad, Nana"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Relationship
              </label>
              <select
                value={relationship}
                onChange={e => setRelationship(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 text-stone-700 bg-white appearance-none"
              >
                <option value="">Select a relationship…</option>
                {RELATIONSHIPS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Their pronouns
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRONOUNS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPronouns(pronouns === p ? '' : p)}
                    className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                      pronouns === p
                        ? 'bg-stone-800 text-white border-stone-800'
                        : 'border-stone-200 text-stone-600 hover:border-stone-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-400 mt-2">
                This helps us refer to them naturally in your prompts.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-stone-500 -mt-2">
              These are optional — you can always add them later.
            </p>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Date of passing
              </label>
              <input
                type="date"
                value={dateOfPassing}
                onChange={e => setDateOfPassing(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 text-stone-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Date of birth
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 text-stone-700"
              />
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-stone-500 -mt-2 leading-relaxed">
              Your journal is ready. If you have a photo of{' '}
              {name.trim() || 'them'}, you can add it here — it&apos;ll be there
              to hold their memory as you write.
            </p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              {photoPreview ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-stone-200"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-stone-600">{photo?.name}</span>
                    <button
                      type="button"
                      onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                      className="text-xs text-stone-400 hover:text-stone-600 text-left"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-stone-200 rounded-xl text-sm text-stone-400 hover:border-stone-300 hover:text-stone-500 transition-colors flex flex-col items-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.99 11.097" />
                  </svg>
                  <span>Upload a photo <span className="text-stone-300">(optional)</span></span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className={`mt-8 flex ${step > 1 ? 'justify-between' : 'justify-end'}`}>
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="px-5 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              ← Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={loading}
              className="px-6 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating your journal…' : 'Create my journal'}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-stone-400 mt-6">
        You can update all of this later in your settings.
      </p>
    </div>
  )
}
