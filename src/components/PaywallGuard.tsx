import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PaywallGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.subscription_status !== 'active') {
    redirect('/pricing')
  }

  return <>{children}</>
}
