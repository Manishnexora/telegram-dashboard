import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { SupervisorRoute } from './components/SupervisorRoute'
import { AppLayout } from './components/AppLayout'
import { Login } from './pages/Login'
import { LiveDeals } from './pages/LiveDeals'
import { Channels } from './pages/Channels'
import { NewChannel } from './pages/NewChannel'
import { ChannelDetail } from './pages/ChannelDetail'
import { NewDeals } from './pages/NewDeals'
import { History } from './pages/History'
import { Billing } from './pages/Billing'
import { TeamManagement } from './pages/TeamManagement'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<LiveDeals />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/channels/new" element={<NewChannel />} />
            <Route path="/channels/:id" element={<ChannelDetail />} />
            <Route path="/new-deals" element={<NewDeals />} />
            <Route
              path="/history"
              element={
                <SupervisorRoute>
                  <History />
                </SupervisorRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <SupervisorRoute>
                  <Billing />
                </SupervisorRoute>
              }
            />
            <Route
              path="/team"
              element={
                <AdminRoute>
                  <TeamManagement />
                </AdminRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
