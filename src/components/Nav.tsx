'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

type NavLink = {
  href: string
  label: string
  active?: boolean
}

type NavProps = {
  desktopLinks: NavLink[]
  userEmail?: string
  showDesktopSignOut?: boolean
  backHref?: string
}

const MOBILE_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/journal/history', label: 'Past Entries' },
  { href: '/photos', label: 'Photos' },
  { href: '/memory-book', label: 'Memory Book' },
]

export default function Nav({ desktopLinks, userEmail, showDesktopSignOut = true, backHref }: NavProps) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-brand-blush border-b border-brand-periwinkle px-4 sm:px-6 py-4 flex justify-between items-center relative">
      {backHref ? (
        <a href={backHref} className="text-sm text-brand-slate hover:text-brand-navy transition-colors">
          ← Back
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logos/logo-horizontal.svg" alt="The Good Grief Journal" className="h-10 w-auto" />
      )}

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-4">
        {desktopLinks.map((link, i) => (
          <Fragment key={link.href}>
            {i > 0 && <span className="text-brand-periwinkle select-none">|</span>}
            <Link
              href={link.href}
              className={link.active ? 'text-sm text-brand-navy font-medium' : 'text-sm text-brand-slate hover:text-brand-navy transition-colors'}
            >
              {link.label}
            </Link>
          </Fragment>
        ))}
        {userEmail && (
          <>
            {desktopLinks.length > 0 && <span className="text-brand-periwinkle select-none">|</span>}
            <span className="text-sm text-brand-slate">{userEmail}</span>
          </>
        )}
        {showDesktopSignOut && <SignOutButton />}
      </div>

      {/* Mobile: hamburger button */}
      <button
        className="md:hidden text-brand-slate text-2xl leading-none"
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        ☰
      </button>

      {/* Mobile: dropdown */}
      {open && (
        <div className="absolute top-full right-0 left-0 bg-brand-blush border-b border-brand-periwinkle shadow-md z-50 md:hidden">
          {MOBILE_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-6 py-3 text-sm text-brand-slate hover:text-brand-navy hover:bg-brand-periwinkle/10 transition-colors"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="px-6 py-3 border-t border-brand-periwinkle/30">
            <SignOutButton />
          </div>
        </div>
      )}
    </nav>
  )
}
