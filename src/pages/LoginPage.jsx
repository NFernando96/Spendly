import { useState } from 'react'
import { TrendingUp, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const GOOGLE_ICON = (
  <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
  </svg>
)

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try { await signInWithGoogle() }
    catch (e) {
      if (e.message === 'auth/not-allowed') setError('Access denied. This app is private.')
      else if (e.code === 'auth/popup-closed-by-user') setError('')
      else setError('Sign-in failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font)',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
            marginBottom: 16,
          }}>
            <TrendingUp size={26} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 6 }}>Spendly</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Your personal finance tracker</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 24px',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28 }}>
            Sign in to access your dashboard
          </p>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--danger-bg)', border: '1px solid var(--danger)',
              borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 20,
              textAlign: 'left',
            }}>
              <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: 'var(--danger-fg)', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: '100%', padding: '13px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              background: 'var(--surface2)', border: '1.5px solid var(--border2)',
              borderRadius: 'var(--r-lg)', fontSize: 15, fontWeight: 600, color: 'var(--text)',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--surface3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)' }}
          >
            {loading
              ? <span style={{ width: 20, height: 20, border: '2.5px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : GOOGLE_ICON
            }
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>

      </div>
    </div>
  )
}