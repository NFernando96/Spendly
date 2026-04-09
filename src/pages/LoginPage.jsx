import { useState } from 'react'
import { TrendingUp, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

export default function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()

  const [mode, setMode]         = useState('login') // 'login' | 'signup'
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')

  const friendlyError = (code) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'Incorrect email or password.'
      case 'auth/email-already-in-use': return 'An account with this email already exists.'
      case 'auth/weak-password': return 'Password must be at least 6 characters.'
      case 'auth/invalid-email': return 'Please enter a valid email address.'
      case 'auth/popup-closed-by-user': return 'Google sign-in was cancelled.'
      case 'auth/too-many-requests': return 'Too many attempts. Please try again later.'
      default: return 'Something went wrong. Please try again.'
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields.'); return }
    if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return }
    setLoading(true)
    try {
      if (mode === 'login') await signIn(email.trim(), password)
      else                  await signUp(email.trim(), password, name.trim())
    } catch (e) {
      setError(friendlyError(e.code))
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try { await signInWithGoogle() }
    catch (e) { setError(friendlyError(e.code)) }
    setGoogleLoading(false)
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login')
    setError('')
    setName(''); setEmail(''); setPassword('')
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
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
            marginBottom: 14,
          }}>
            <TrendingUp size={24} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 4 }}>Spendly</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Your personal finance tracker</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          padding: '28px 24px',
          boxShadow: 'var(--shadow-md)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          {/* Google button */}
          <button onClick={handleGoogle} disabled={googleLoading || loading} style={{
            width: '100%', padding: '11px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'var(--surface2)', border: '1.5px solid var(--border2)',
            borderRadius: 'var(--r-lg)', fontSize: 14, fontWeight: 600, color: 'var(--text)',
            cursor: googleLoading ? 'wait' : 'pointer',
            transition: 'all 0.15s', marginBottom: 18, opacity: googleLoading ? 0.7 : 1,
          }}
            onMouseEnter={e => { if (!googleLoading) e.currentTarget.style.background = 'var(--surface3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)' }}
          >
            {googleLoading
              ? <span style={{ width: 18, height: 18, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : GOOGLE_ICON
            }
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Name field (signup only) */}
          {mode === 'signup' && (
            <Field label="Full name" style={{ marginBottom: 12 }}>
              <InputRow icon={<User size={15} color="var(--text3)" />}>
                <input
                  type="text" placeholder="John Doe" value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={inputStyle}
                />
              </InputRow>
            </Field>
          )}

          {/* Email */}
          <Field label="Email" style={{ marginBottom: 12 }}>
            <InputRow icon={<Mail size={15} color="var(--text3)" />}>
              <input
                type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={inputStyle}
              />
            </InputRow>
          </Field>

          {/* Password */}
          <Field label="Password" style={{ marginBottom: 20 }}>
            <InputRow icon={<Lock size={15} color="var(--text3)" />} trailing={
              <button onClick={() => setShowPass(v => !v)} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '0 4px' }}>
                {showPass ? <EyeOff size={15} color="var(--text3)" /> : <Eye size={15} color="var(--text3)" />}
              </button>
            }>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={inputStyle}
              />
            </InputRow>
          </Field>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--danger-bg)', border: '1px solid var(--danger)',
              borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 16,
            }}>
              <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: 'var(--danger-fg)', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading || googleLoading} style={{
            width: '100%', padding: '13px 16px',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            border: 'none', borderRadius: 'var(--r-lg)',
            fontSize: 15, fontWeight: 700, color: '#fff',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.35)' }}
          >
            {loading
              ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              : mode === 'login' ? 'Sign in' : 'Create account'
            }
          </button>
        </div>

        {/* Switch mode */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text2)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={switchMode} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--accent)', fontWeight: 600, fontSize: 14, padding: 0,
          }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

const Field = ({ label, children, style }) => (
  <div style={style}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
    {children}
  </div>
)

const InputRow = ({ icon, trailing, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--surface2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r)', padding: '0 12px',
    transition: 'border-color 0.15s',
  }}
    onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent)'}
    onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
  >
    {icon}
    {children}
    {trailing}
  </div>
)

const inputStyle = {
  flex: 1, padding: '11px 0', background: 'transparent',
  border: 'none', outline: 'none',
  fontSize: 14, color: 'var(--text)',
  fontFamily: 'var(--font)',
}
