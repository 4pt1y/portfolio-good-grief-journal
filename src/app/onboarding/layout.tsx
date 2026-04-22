import { Lora } from 'next/font/google'

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
})

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${lora.variable} min-h-screen bg-stone-50 flex items-center justify-center px-4 py-12`}>
      {children}
    </div>
  )
}
