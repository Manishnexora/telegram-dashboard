import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function SupervisorRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
