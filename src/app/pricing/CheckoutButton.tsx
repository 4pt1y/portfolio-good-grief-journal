'use client'

import { useState } from 'react'

type CheckoutButtonProps = {
  endpoint: string
  label: string
  className?: string
}

export default function CheckoutButton({ endpoint, label, className }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) {
        setLoading(false)
        return
      }
      const { url } = await res.json() as { url: string }
      if (url) window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? 'Redirecting…' : label}
    </button>
  )
}
