import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Analytics from './pages/Analytics'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import Bills from './pages/Bills'
import Loans from './pages/Loans'
import LoginPage from './pages/LoginPage'

function AuthGate() {
  const { user, authLoading } = useAuth()

  if (authLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '2.5px solid rgba(0,0,0,0.1)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <p style={{ color: '#71717a', fontSize: 14, fontWeight: 500 }}>Loading…</p>
    </div>
  )

  if (!user) return <LoginPage />

  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/Spendly">        
      <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  )
}
