import { requireSalaoUser } from '@/lib/auth'
import { AdminShell } from './AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireSalaoUser()
  return <AdminShell profile={profile}>{children}</AdminShell>
}
