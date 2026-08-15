'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SalaoUser, SalaoUserRole } from '@/types/salao'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, QrCode, AlertTriangle, FileBarChart, Settings,
  LogOut, Menu, UtensilsCrossed,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: SalaoUserRole[]
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'gerente', 'garcom'] },
  { href: '/admin/garcons', label: 'Garçons', icon: QrCode, roles: ['admin', 'gerente'] },
  { href: '/admin/alertas', label: 'Alertas', icon: AlertTriangle, roles: ['admin', 'gerente'] },
  { href: '/admin/relatorios', label: 'Relatórios', icon: FileBarChart, roles: ['admin', 'gerente'] },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings, roles: ['admin'] },
]

export function AdminShell({ profile, children }: { profile: SalaoUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const items = NAV.filter((n) => n.roles.includes(profile.role))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-surface">
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 bg-surface-card border-r border-surface-border flex flex-col transition-transform lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-surface-border">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <UtensilsCrossed size={16} className="text-brand-400" />
          </div>
          <span className="text-sm font-semibold text-white">Matrus · Experiência</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active ? 'bg-brand-500/10 text-brand-400' : 'text-neutral-400 hover:bg-surface-hover hover:text-white'
                )}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-surface-border">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-white truncate">{profile.name}</p>
            <p className="text-xs text-neutral-500 capitalize">{profile.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:bg-surface-hover hover:text-white w-full transition-colors"
          >
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 border-b border-surface-border flex items-center px-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-neutral-400">
            <Menu size={22} />
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
