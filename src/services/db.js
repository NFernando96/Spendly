// ── Firestore DB ───────────────────────────────────────────────────────────────
// All data is scoped per user: users/{uid}/{collection}
// Mirrors the original localStorage API exactly — no other files need changes.

import {
  collection, doc, setDoc, updateDoc, deleteDoc, addDoc,
  onSnapshot, query, orderBy, getDoc, getDocs, writeBatch,
} from 'firebase/firestore'
import { db, auth } from './firebase'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// Helpers: paths scoped to the logged-in user
const userCol = (col)     => collection(db, 'users', auth.currentUser.uid, col)
const userDoc = (col, id) => doc(db, 'users', auth.currentUser.uid, col, id)

// ── Built-in categories (read-only seeds) ─────────────────────────────────────
export const BUILTIN_EXPENSE_CATEGORIES = [
  { name: 'Food',          icon: '🥗', color: '#10b981' },
  { name: 'Transport',     icon: '🚌', color: '#3b82f6' },
  { name: 'Bills',         icon: '💡', color: '#f59e0b' },
  { name: 'Family',        icon: '👨‍👩‍👧', color: '#ec4899' },
  { name: 'Health',        icon: '💊', color: '#ef4444' },
  { name: 'Personal',      icon: '🧴', color: '#8b5cf6' },
  { name: 'Subscriptions', icon: '📱', color: '#06b6d4' },
  { name: 'Shopping',      icon: '🛍️', color: '#f97316' },
  { name: 'Education',     icon: '📚', color: '#84cc16' },
  { name: 'Entertainment', icon: '🎬', color: '#a855f7' },
  { name: 'Misc',          icon: '📦', color: '#6b7280' },
  { name: 'Loans',         icon: '🏦', color: '#0284c7' },
]

export const BUILTIN_INCOME_CATEGORIES = [
  { name: 'Salary',       icon: '💼', color: '#10b981' },
  { name: 'Freelance',    icon: '💻', color: '#3b82f6' },
  { name: 'Investment',   icon: '📈', color: '#f59e0b' },
  { name: 'Gift',         icon: '🎁', color: '#ec4899' },
  { name: 'Rental',       icon: '🏠', color: '#8b5cf6' },
  { name: 'Bonus',        icon: '🏆', color: '#06b6d4' },
  { name: 'Business',     icon: '🏢', color: '#f97316' },
  { name: 'Other Income', icon: '💰', color: '#6b7280' },
]

// Legacy exports so existing import sites don't break
export const EXPENSE_CATEGORIES = BUILTIN_EXPENSE_CATEGORIES
export const INCOME_CATEGORIES  = BUILTIN_INCOME_CATEGORIES
export const DEFAULT_CATEGORIES = BUILTIN_EXPENSE_CATEGORIES

// ── Dynamic categories ────────────────────────────────────────────────────────
export const subscribeExpenseCategories = (cb) => {
  const q = query(userCol('customExpenseCategories'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    const custom = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb([...BUILTIN_EXPENSE_CATEGORIES, ...custom])
  })
}

export const subscribeIncomeCategories = (cb) => {
  const q = query(userCol('customIncomeCategories'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    const custom = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb([...BUILTIN_INCOME_CATEGORIES, ...custom])
  })
}

export const addCustomCategory = async (type, data) => {
  const col = type === 'income' ? 'customIncomeCategories' : 'customExpenseCategories'
  await addDoc(userCol(col), { ...data, custom: true, createdAt: Date.now() })
}

export const deleteCustomCategory = async (type, name) => {
  const col = type === 'income' ? 'customIncomeCategories' : 'customExpenseCategories'
  const snap = await getDocs(userCol(col))
  const match = snap.docs.find(d => d.data().name === name)
  if (match) await deleteDoc(match.ref)
}

// Sync getters (used in modals before async data loads — returns builtins only)
export const getExpenseCategories = () => BUILTIN_EXPENSE_CATEGORIES
export const getIncomeCategories  = () => BUILTIN_INCOME_CATEGORIES

export const getCatMeta = (name, type) => {
  const list = type === 'income' ? BUILTIN_INCOME_CATEGORIES : BUILTIN_EXPENSE_CATEGORIES
  return list.find(c => c.name === name)
    || BUILTIN_EXPENSE_CATEGORIES.find(c => c.name === name)
    || BUILTIN_INCOME_CATEGORIES.find(c => c.name === name)
    || { name, icon: '💸', color: '#6b7280' }
}

// ── Accounts ──────────────────────────────────────────────────────────────────
const SEED_ACCOUNTS = [
  { id: 'acc_cash',   name: 'Cash',        type: 'cash',   balance: 0, createdAt: Date.now() },
  { id: 'acc_bank',   name: 'NDB Savings', type: 'bank',   balance: 0, createdAt: Date.now() + 1 },
  { id: 'acc_credit', name: 'NDB Credit',  type: 'credit', balance: 0, createdAt: Date.now() + 2 },
]

// Seed default accounts for brand-new users
const seedAccountsIfNeeded = async () => {
  const snap = await getDocs(userCol('accounts'))
  if (snap.empty) {
    const batch = writeBatch(db)
    SEED_ACCOUNTS.forEach(a => batch.set(userDoc('accounts', a.id), a))
    await batch.commit()
  }
}

export const subscribeAccounts = (cb) => {
  seedAccountsIfNeeded()
  const q = query(userCol('accounts'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export const addAccount    = async (data) => {
  const id = uid()
  await setDoc(userDoc('accounts', id), { ...data, id, createdAt: Date.now() })
}
export const updateAccount = async (id, data) => {
  await updateDoc(userDoc('accounts', id), data)
}
export const deleteAccount = async (id) => {
  await deleteDoc(userDoc('accounts', id))
}

// ── Transactions ──────────────────────────────────────────────────────────────
export const subscribeTransactions = (cb) => {
  const q = query(userCol('transactions'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export const addTransaction = async (data) => {
  const id = uid()
  const tx = { ...data, id, createdAt: Date.now() }
  await setDoc(userDoc('transactions', id), tx)
  await _applyBalance(data, 1)

  // Track quick expenses for autocomplete
  if (data.type === 'expense') {
    const key = data.description.trim().toLowerCase().replace(/\s+/g, '_') + '_' + data.amount
    const ref  = userDoc('quickExpenses', key)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      await updateDoc(ref, {
        usageCount: snap.data().usageCount + 1,
        amount:     data.amount,
        category:   data.category,
        accountId:  data.accountId,
      })
    } else {
      await setDoc(ref, {
        id:          key,
        description: data.description.trim(),
        amount:      data.amount,
        category:    data.category,
        accountId:   data.accountId,
        usageCount:  1,
      })
    }
  }
}

export const deleteTransaction = async (tx) => {
  await deleteDoc(userDoc('transactions', tx.id))
  await _applyBalance(tx, -1)
}

export const updateTransaction = async (oldTx, newData) => {
  await _applyBalance(oldTx, -1)
  const updated = { ...oldTx, ...newData }
  await setDoc(userDoc('transactions', oldTx.id), updated)
  await _applyBalance(updated, 1)
}

const _applyBalance = async (tx, dir) => {
  const amt = parseFloat(tx.amount) * dir
  if      (tx.type === 'expense')  { await _shiftBal(tx.accountId, -amt) }
  else if (tx.type === 'income')   { await _shiftBal(tx.accountId, +amt) }
  else if (tx.type === 'transfer') { await _shiftBal(tx.accountId, -amt); await _shiftBal(tx.toAccountId, +amt) }
}

const _shiftBal = async (id, delta) => {
  const ref  = userDoc('accounts', id)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const current = snap.data().balance || 0
    await updateDoc(ref, { balance: Math.round((current + delta) * 100) / 100 })
  }
}

// ── Quick Expenses ────────────────────────────────────────────────────────────
export const subscribeQuickExpenses = (cb) => {
  return onSnapshot(userCol('quickExpenses'), snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb(data.sort((a, b) => b.usageCount - a.usageCount))
  })
}

// ── Recurring ─────────────────────────────────────────────────────────────────
export const subscribeRecurring = (cb) => {
  const q = query(userCol('recurring'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export const addRecurring    = async (data) => {
  const id = uid()
  await setDoc(userDoc('recurring', id), { ...data, id, createdAt: Date.now() })
}
export const updateRecurring = async (id, data) => {
  await updateDoc(userDoc('recurring', id), data)
}
export const deleteRecurring = async (id) => {
  await deleteDoc(userDoc('recurring', id))
}

// ── Bills ─────────────────────────────────────────────────────────────────────
export const BUILTIN_BILL_PRESETS = [
  { name: 'Electricity', icon: '⚡', color: '#f59e0b' },
  { name: 'Water',       icon: '💧', color: '#0284c7' },
  { name: 'Internet',    icon: '🌐', color: '#6366f1' },
  { name: 'Router/ISP',  icon: '📡', color: '#8b5cf6' },
  { name: 'Mobile',      icon: '📱', color: '#06b6d4' },
  { name: 'Gas',         icon: '🔥', color: '#ef4444' },
  { name: 'Rent',        icon: '🏠', color: '#10b981' },
  { name: 'Insurance',   icon: '🛡️', color: '#059669' },
  { name: 'TV/Cable',    icon: '📺', color: '#a855f7' },
  { name: 'Streaming',   icon: '🎬', color: '#ec4899' },
  { name: 'Gym',         icon: '💪', color: '#f97316' },
  { name: 'Other',       icon: '📋', color: '#6b7280' },
]

export const BILL_PRESETS   = BUILTIN_BILL_PRESETS
export const getBillPresets = () => BUILTIN_BILL_PRESETS
export const getBillPreset  = (name) =>
  BUILTIN_BILL_PRESETS.find(p => p.name === name) || { name, icon: '📋', color: '#6b7280' }

export const subscribeBillPresets = (cb) => {
  const q = query(userCol('customBillPresets'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    const custom = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb([...BUILTIN_BILL_PRESETS, ...custom])
  })
}

export const addCustomBillPreset = async (data) => {
  await addDoc(userCol('customBillPresets'), { ...data, custom: true, createdAt: Date.now() })
}
export const deleteCustomBillPreset = async (name) => {
  const snap = await getDocs(userCol('customBillPresets'))
  const match = snap.docs.find(d => d.data().name === name)
  if (match) await deleteDoc(match.ref)
}

export const subscribeBills = (cb) => {
  return onSnapshot(userCol('bills'), snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb(data.sort((a, b) => (a.dueDay || 1) - (b.dueDay || 1)))
  })
}

export const addBill    = async (data) => {
  const id = uid()
  await setDoc(userDoc('bills', id), { ...data, id, createdAt: Date.now() })
}
export const updateBill = async (id, data) => {
  await updateDoc(userDoc('bills', id), data)
}
export const deleteBill = async (id) => {
  await deleteDoc(userDoc('bills', id))
}

// ── Loans ─────────────────────────────────────────────────────────────────────
export const BUILTIN_LOAN_TYPES = [
  { name: 'Home Loan',     icon: '🏠', color: '#0284c7' },
  { name: 'Car Loan',      icon: '🚗', color: '#059669' },
  { name: 'Personal Loan', icon: '👤', color: '#7c3aed' },
  { name: 'Education',     icon: '🎓', color: '#d97706' },
  { name: 'Business',      icon: '🏢', color: '#0891b2' },
  { name: 'Gold Loan',     icon: '🥇', color: '#ca8a04' },
  { name: 'Other',         icon: '🏦', color: '#6b7280' },
]

export const LOAN_TYPES   = BUILTIN_LOAN_TYPES
export const getLoanTypes = () => BUILTIN_LOAN_TYPES

export const subscribeLoanTypes = (cb) => {
  const q = query(userCol('customLoanTypes'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    const custom = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb([...BUILTIN_LOAN_TYPES, ...custom])
  })
}

export const addCustomLoanType = async (data) => {
  await addDoc(userCol('customLoanTypes'), { ...data, custom: true, createdAt: Date.now() })
}
export const deleteCustomLoanType = async (name) => {
  const snap = await getDocs(userCol('customLoanTypes'))
  const match = snap.docs.find(d => d.data().name === name)
  if (match) await deleteDoc(match.ref)
}

export const subscribeLoans = (cb) => {
  const q = query(userCol('loans'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export const addLoan    = async (data) => {
  const id = uid()
  await setDoc(userDoc('loans', id), { ...data, id, createdAt: Date.now() })
}
export const updateLoan = async (id, data) => {
  await updateDoc(userDoc('loans', id), data)
}
export const deleteLoan = async (id) => {
  const batch = writeBatch(db)
  batch.delete(userDoc('loans', id))
  const snap = await getDocs(userCol('loanPayments'))
  snap.docs.filter(d => d.data().loanId === id).forEach(d => batch.delete(d.ref))
  await batch.commit()
}

export const subscribeLoanPayments = (cb) => {
  const q = query(userCol('loanPayments'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export const addLoanPayment = async (data) => {
  const id = uid()
  await setDoc(userDoc('loanPayments', id), { ...data, id, createdAt: Date.now() })
}
export const deleteLoanPayment = async (id) => {
  await deleteDoc(userDoc('loanPayments', id))
}

// ── Recurring Categories ───────────────────────────────────────────────────────
export const BUILTIN_RECURRING_CATEGORIES = [
  { name: 'Subscriptions', icon: '📱', color: '#06b6d4' },
  { name: 'Rent',          icon: '🏠', color: '#10b981' },
  { name: 'Insurance',     icon: '🛡️', color: '#059669' },
  { name: 'Utilities',     icon: '💡', color: '#f59e0b' },
  { name: 'Transport',     icon: '🚌', color: '#3b82f6' },
  { name: 'Health',        icon: '💊', color: '#ef4444' },
  { name: 'Education',     icon: '📚', color: '#84cc16' },
  { name: 'Savings',       icon: '🏦', color: '#8b5cf6' },
  { name: 'Family',        icon: '👨‍👩‍👧', color: '#ec4899' },
  { name: 'Other',         icon: '📦', color: '#6b7280' },
]

export const RECURRING_CATEGORIES = BUILTIN_RECURRING_CATEGORIES

export const subscribeRecurringCategories = (cb) => {
  const q = query(userCol('customRecurringCategories'), orderBy('createdAt'))
  return onSnapshot(q, snap => {
    const custom = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb([...BUILTIN_RECURRING_CATEGORIES, ...custom])
  })
}

export const addCustomRecurringCategory = async (data) => {
  await addDoc(userCol('customRecurringCategories'), { ...data, custom: true, createdAt: Date.now() })
}

export const deleteCustomRecurringCategory = async (name) => {
  const snap = await getDocs(userCol('customRecurringCategories'))
  const match = snap.docs.find(d => d.data().name === name)
  if (match) await deleteDoc(match.ref)
}