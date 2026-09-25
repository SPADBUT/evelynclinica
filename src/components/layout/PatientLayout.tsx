import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardSignature, LogOut, ScrollText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'

const nav = [
  { to: '/portal', label: 'Meus termos', icon: ClipboardSignature, end: true },
  { to: '/portal/contratos', label: 'Meus contratos', icon: ScrollText },
]

export function PatientLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border bg-plum text-cream">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="font-display text-3xl tracking-wide">Evelyn</p>
            <p className="text-xs uppercase tracking-[0.2em] text-blush">Portal da paciente</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-cream">{user?.name}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-blush hover:bg-white/10 hover:text-white"
              onClick={logout}
            >
              <LogOut size={14} /> Sair
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 px-4 pb-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-blush hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
