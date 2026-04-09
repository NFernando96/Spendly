import { createContext, useContext, useEffect, useState } from 'react'
import {
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../services/firebase'

// ── Your email only ───────────────────────────────────────────────────────────
const ALLOWED_EMAILS = [
  'YOUR_EMAIL@gmail.com', // ← replace with your exact Google account email
]

const isAllowed = (email) =>
  ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email?.toLowerCase())

const AuthCtx = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !isAllowed(u.email)) {
        await signOut(auth)
        setUser(null)
      } else {
        setUser(u)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, new GoogleAuthProvider())
    if (!isAllowed(result.user.email)) {
      await signOut(auth)
      throw { code: 'auth/not-allowed' }
    }
    return result
  }

  const logOut = () => signOut(auth)

  return (
    <AuthCtx.Provider value={{ user, authLoading, signInWithGoogle, logOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)