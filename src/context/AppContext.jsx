import { createContext, useContext, useEffect, useState } from 'react'
import {
  subscribeAccounts, subscribeTransactions,
  subscribeQuickExpenses, subscribeRecurring,
  subscribeExpenseCategories, subscribeIncomeCategories,
  subscribeBills,
  subscribeLoans, subscribeLoanPayments,
} from '../services/db'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../services/firebase'

const Ctx = createContext(null)

function applyTheme(theme) {
  const html = document.documentElement
  html.classList.remove('light', 'dark')
  if (theme === 'light') html.classList.add('light')
  else if (theme === 'dark') html.classList.add('dark')
}

export const AppProvider = ({ children }) => {
  const [accounts, setAccounts]               = useState([])
  const [transactions, setTransactions]       = useState([])
  const [quickExpenses, setQuickExpenses]     = useState([])
  const [recurring, setRecurring]             = useState([])
  const [bills, setBills]                     = useState([])
  const [loans, setLoans]                     = useState([])
  const [loanPayments, setLoanPayments]       = useState([])
  const [expenseCategories, setExpenseCats]   = useState([])
  const [incomeCategories, setIncomeCats]     = useState([])
  const [loading, setLoading]                 = useState(true)

  // Default: hidden (true) so sensitive data is hidden on load
  const [balanceHidden, setBalanceHidden] = useState(() => {
    try {
      const stored = localStorage.getItem('balanceHidden')
      return stored === null ? true : stored === 'true'
    } catch { return true }
  })

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'system' } catch { return 'system' }
  })

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

  const toggleBalance = () => {
    setBalanceHidden(v => {
      const next = !v
      try { localStorage.setItem('balanceHidden', String(next)) } catch {}
      return next
    })
  }

  useEffect(() => {
    let n = 0
    const done = () => { if (++n >= 2) setLoading(false) }
    const u1 = subscribeAccounts(d => { setAccounts(d); done() })
    const u2 = subscribeTransactions(d => { setTransactions(d); done() })
    const u3 = subscribeQuickExpenses(setQuickExpenses)
    const u4 = subscribeRecurring(setRecurring)
    const u7 = subscribeBills(setBills)
    const u8 = subscribeLoans(setLoans)
    const u9 = subscribeLoanPayments(setLoanPayments)
    const u5 = subscribeExpenseCategories(setExpenseCats)
    const u6 = subscribeIncomeCategories(setIncomeCats)
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9() }
  }, [])

  // ── Auto daily backup to Firestore ────────────────────────────────────────
  // Runs once per day when the app is opened. Stores last 7 daily snapshots
  // under users/{uid}/autoBackups/{YYYY-MM-DD}
  useEffect(() => {
    if (loading) return // wait until data is loaded
    const runBackup = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const lastBackup = localStorage.getItem('lastAutoBackup')
        if (lastBackup === today) return // already backed up today

        const uid  = auth.currentUser?.uid
        if (!uid) return

        const cols = ['accounts','transactions','bills','loans','loanPayments','recurring','quickExpenses']
        const backup = { backedUpAt: new Date().toISOString(), date: today, collections: {} }

        await Promise.all(cols.map(async (col) => {
          const snap = await getDocs(collection(db, 'users', uid, col))
          backup.collections[col] = snap.docs.map(d => d.data())
        }))

        // Save under users/{uid}/autoBackups/{date}
        await setDoc(doc(db, 'users', uid, 'autoBackups', today), backup)

        // Keep track locally so we don't re-run today
        localStorage.setItem('lastAutoBackup', today)
        console.log(`[Spendly] Auto backup saved for ${today}`)
      } catch(e) {
        console.warn('[Spendly] Auto backup failed:', e)
      }
    }
    runBackup()
  }, [loading])

  const todayStr = new Date().toISOString().split('T')[0]
  const monthStr = todayStr.slice(0, 7)

  const totalBalance = accounts.reduce((s, a) =>
    a.type === 'credit' ? s - (a.balance || 0) : s + (a.balance || 0), 0)

  const todayExpenses = transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((s, t) => s + t.amount, 0)

  const monthExpenses = transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(monthStr))
    .reduce((s, t) => s + t.amount, 0)

  return (
    <Ctx.Provider value={{
      accounts, transactions, quickExpenses, recurring, bills, loans, loanPayments,
      expenseCategories, incomeCategories,
      loading,
      totalBalance, todayExpenses, monthExpenses, todayStr, monthStr,
      balanceHidden, toggleBalance,
      theme, setTheme,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)