import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../services/firebase'

// ── Allowlist: only these emails can access the app ───────────────────────────
const ALLOWED_EMAILS = [
  'kbrnfernando@gmail.com', // ← replace with your actual email
]

const isAllowed = (email) => ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email?.toLowerCase())

const AuthCtx = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !isAllowed(u.email)) {
        // Signed in but not allowed — sign them out immediately
        await signOut(auth)
        setUser(null)
      } else {
        setUser(u)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const signIn = (email, password) => {
    if (!isAllowed(email)) return Promise.reject({ code: 'auth/not-allowed' })
    return signInWithEmailAndPassword(auth, email, password)
  }

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
    <AuthCtx.Provider value={{ user, authLoading, signIn, signInWithGoogle, logOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)