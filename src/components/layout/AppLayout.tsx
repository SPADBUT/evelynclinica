import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  Camera,
  ClipboardSignature,
  FileText,
  LayoutDashboard,
  Menu,
  ScrollText,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/pacientes', label: 'Prontuários', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/fotos', label: 'Antes & Depois', icon: Camera },
  { to: '/termos', label: 'Consentimentos', icon: ClipboardSignature },
  { to: '/contratos', label: 'Contratos', icon: ScrollText },
  { to: '/orcamentos', label: 'Orçamentos', icon: Wallet },
]

export function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-border bg-plum text-cream transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-6">
            <div>
              <p className="font-display text-3xl tracking-wide">Evelyn</p>
              <p className="text-xs uppercase tracking-[0.2em] text-blush">Clínica Estética</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-blush hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 pb-6">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-blush hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 px-5 py-4 text-xs text-blush/80">
            <p className="flex items-center gap-2">
              <FileText size={14} /> V1 · Gestão clínica
            </p>
            <p className="mt-1">Dados salvos neste dispositivo (LGPD local).</p>
          </div>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-cream/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded-lg border border-border bg-white p-2 text-plum"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <div>
            <p className="font-display text-xl text-plum">Evelyn</p>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
