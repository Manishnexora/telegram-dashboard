import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, type Role } from '../types'

interface NavItem {
  to: string
  label: string
  icon: string
  roles?: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Live Deals', icon: '🟢' },
  { to: '/new-deals', label: 'New Deals', icon: '🆕' },
  { to: '/channels', label: 'All Channels', icon: '📁' },
  { to: '/history', label: 'History', icon: '🕘', roles: ['admin', 'supervisor'] },
  { to: '/billing', label: 'Payment Details', icon: '💳', roles: ['admin', 'supervisor'] },
  { to: '/team', label: 'Team Management', icon: '👥', roles: ['admin'] },
]

// On phones the sidebar starts closed (it would otherwise cover the whole
// screen); on tablets/desktops it starts open, same as before.
function getInitialSidebarState() {
  if (typeof window === 'undefined') return true
  return window.innerWidth >= 768
}

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState)

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (profile && item.roles.includes(profile.role))
  )

  function closeOnMobile() {
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen doodle-bg">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-gradient-to-br from-[#2AABEE] to-[#229ED9] text-white flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/20 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold" onClick={closeOnMobile}>
            Telegram Dashboard
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="text-white/80 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={closeOnMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-white/25 text-white' : 'text-white/90 hover:bg-white/15'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/20 text-sm">
          <div className="text-white truncate">{profile?.name}</div>
          <div className="text-white/70 text-xs mb-2">({profile?.role && ROLE_LABELS[profile.role]})</div>
          <button onClick={signOut} className="text-white/90 hover:text-white hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
          className="fixed top-4 left-4 z-40 rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] text-white w-9 h-9 flex items-center justify-center shadow-lg hover:brightness-110"
        >
          ☰
        </button>
      )}

      <main className={`transition-all duration-300 pl-0 ${sidebarOpen ? 'md:pl-64' : ''}`}>
        <div className="p-4 pt-16 sm:p-6 sm:pt-16">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
