// ── Local Storage DB ──────────────────────────────────────────────────────────

const read  = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
const write = (key, val)      => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
const uid   = ()              => Math.random().toString(36).slice(2) + Date.now().toString(36)

const listeners = {}
const emit  = (channel) => (listeners[channel] || []).forEach(fn => fn())
const on    = (channel, fn) => { listeners[channel] = [...(listeners[channel]||[]), fn]; return () => { listeners[channel] = (listeners[channel]||[]).filter(f=>f!==fn) } }

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

// ── Dynamic categories (merged with builtins) ─────────────────────────────────
export const subscribeExpenseCategories = (cb) => {
  const notify = () => {
    const custom = read('customExpenseCategories', [])
    cb([...BUILTIN_EXPENSE_CATEGORIES, ...custom])
  }
  notify()
  return on('customExpenseCategories', notify)
}

export const subscribeIncomeCategories = (cb) => {
  const notify = () => {
    const custom = read('customIncomeCategories', [])
    cb([...BUILTIN_INCOME_CATEGORIES, ...custom])
  }
  notify()
  return on('customIncomeCategories', notify)
}

export const addCustomCategory = (type, data) => {
  const key = type === 'income' ? 'customIncomeCategories' : 'customExpenseCategories'
  const list = read(key, [])
  list.push({ ...data, id: uid(), custom: true })
  write(key, list)
  emit(key)
  // Also re-emit the merged channel
  emit(type === 'income' ? 'customIncomeCategories' : 'customExpenseCategories')
}

export const deleteCustomCategory = (type, name) => {
  const key = type === 'income' ? 'customIncomeCategories' : 'customExpenseCategories'
  write(key, read(key, []).filter(c => c.name !== name))
  emit(key)
}

// Convenience: sync getters used inside modals that need current merged lists
export const getExpenseCategories = () => [...BUILTIN_EXPENSE_CATEGORIES, ...read('customExpenseCategories', [])]
export const getIncomeCategories  = () => [...BUILTIN_INCOME_CATEGORIES,  ...read('customIncomeCategories',  [])]

// Legacy exports so existing import sites don't break
export const EXPENSE_CATEGORIES = BUILTIN_EXPENSE_CATEGORIES
export const INCOME_CATEGORIES  = BUILTIN_INCOME_CATEGORIES
export const DEFAULT_CATEGORIES = BUILTIN_EXPENSE_CATEGORIES

export const getCatMeta = (name, type) => {
  const expList = getExpenseCategories()
  const incList = getIncomeCategories()
  const list = type === 'income' ? incList : expList
  return list.find(c => c.name === name)
    || expList.find(c => c.name === name)
    || incList.find(c => c.name === name)
    || { name, icon: '💸', color: '#6b7280' }
}

// ── Accounts ──────────────────────────────────────────────────────────────────
const SEED_ACCOUNTS = [
  { id: 'acc_cash',   name: 'Cash',        type: 'cash',   balance: 0, createdAt: Date.now() },
  { id: 'acc_bank',   name: 'NDB Savings', type: 'bank',   balance: 0, createdAt: Date.now() + 1 },
  { id: 'acc_credit', name: 'NDB Credit',  type: 'credit', balance: 0, createdAt: Date.now() + 2 },
]

export const subscribeAccounts = (cb) => {
  const notify = () => {
    let data = read('accounts', null)
    if (!data) { data = SEED_ACCOUNTS; write('accounts', data) }
    cb([...data].sort((a,b) => a.createdAt - b.createdAt))
  }
  notify()
  return on('accounts', notify)
}

export const addAccount    = (data) => { const a = read('accounts', SEED_ACCOUNTS); a.push({ ...data, id: uid(), createdAt: Date.now() }); write('accounts', a); emit('accounts') }
export const updateAccount = (id, data) => { write('accounts', read('accounts', []).map(a => a.id === id ? { ...a, ...data } : a)); emit('accounts') }
export const deleteAccount = (id) => { write('accounts', read('accounts', []).filter(a => a.id !== id)); emit('accounts') }

// ── Transactions ──────────────────────────────────────────────────────────────
export const subscribeTransactions = (cb) => {
  const notify = () => { const data = read('transactions', []); cb([...data].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)) }
  notify()
  return on('transactions', notify)
}

export const addTransaction = (data) => {
  const transactions = read('transactions', [])
  const tx = { ...data, id: uid(), createdAt: Date.now() }
  transactions.push(tx)
  write('transactions', transactions)
  _applyBalance(data, 1)
  if (data.type === 'expense') {
    const key = data.description.trim().toLowerCase().replace(/\s+/g, '_') + '_' + data.amount
    const quickList = read('quickExpenses', [])
    const idx = quickList.findIndex(q => q.id === key)
    if (idx >= 0) {
      quickList[idx] = { ...quickList[idx], usageCount: quickList[idx].usageCount + 1, amount: data.amount, category: data.category, accountId: data.accountId }
    } else {
      quickList.push({ id: key, description: data.description.trim(), amount: data.amount, category: data.category, accountId: data.accountId, usageCount: 1 })
    }
    write('quickExpenses', quickList)
    emit('quickExpenses')
  }
  emit('transactions')
}

export const deleteTransaction = (tx) => { write('transactions', read('transactions', []).filter(t => t.id !== tx.id)); _applyBalance(tx, -1); emit('transactions') }

export const updateTransaction = (oldTx, newData) => {
  _applyBalance(oldTx, -1)
  const updated = { ...oldTx, ...newData }
  write('transactions', read('transactions', []).map(t => t.id === oldTx.id ? updated : t))
  _applyBalance(updated, 1)
  emit('transactions')
}

const _applyBalance = (tx, dir) => {
  const amt = parseFloat(tx.amount) * dir
  if (tx.type === 'expense')       { _shiftBal(tx.accountId, -amt) }
  else if (tx.type === 'income')   { _shiftBal(tx.accountId, +amt) }
  else if (tx.type === 'transfer') { _shiftBal(tx.accountId, -amt); _shiftBal(tx.toAccountId, +amt) }
  emit('accounts')
}

const _shiftBal = (id, delta) => {
  const accounts = read('accounts', []).map(a =>
    a.id === id ? { ...a, balance: Math.round(((a.balance || 0) + delta) * 100) / 100 } : a
  )
  write('accounts', accounts)
}

// ── Quick / Recurring ─────────────────────────────────────────────────────────
export const subscribeQuickExpenses = (cb) => {
  const notify = () => { const data = read('quickExpenses', []); cb([...data].sort((a,b) => b.usageCount - a.usageCount)) }
  notify()
  return on('quickExpenses', notify)
}

export const subscribeRecurring = (cb) => {
  const notify = () => cb(read('recurring', []).sort((a,b) => a.createdAt - b.createdAt))
  notify()
  return on('recurring', notify)
}

export const addRecurring    = (data) => { const list = read('recurring', []); list.push({ ...data, id: uid(), createdAt: Date.now() }); write('recurring', list); emit('recurring') }
export const updateRecurring = (id, data) => { write('recurring', read('recurring', []).map(r => r.id === id ? { ...r, ...data } : r)); emit('recurring') }
export const deleteRecurring = (id)   => { write('recurring', read('recurring', []).filter(r => r.id !== id)); emit('recurring') }

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

export const getBillPresets = () => [...BUILTIN_BILL_PRESETS, ...read('customBillPresets', [])]
export const BILL_PRESETS = BUILTIN_BILL_PRESETS // legacy alias

export const getBillPreset = (name) =>
  getBillPresets().find(p => p.name === name) || { name, icon: '📋', color: '#6b7280' }

export const subscribeBillPresets = (cb) => {
  const notify = () => cb(getBillPresets())
  notify()
  return on('customBillPresets', notify)
}

export const addCustomBillPreset = (data) => {
  const list = read('customBillPresets', [])
  list.push({ ...data, id: uid(), custom: true })
  write('customBillPresets', list)
  emit('customBillPresets')
}

export const deleteCustomBillPreset = (name) => {
  write('customBillPresets', read('customBillPresets', []).filter(p => p.name !== name))
  emit('customBillPresets')
}

export const subscribeBills = (cb) => {
  const notify = () => cb([...read('bills', [])].sort((a,b) => (a.dueDay||1) - (b.dueDay||1)))
  notify()
  return on('bills', notify)
}

export const addBill    = (data) => { const list = read('bills', []); list.push({ ...data, id: uid(), createdAt: Date.now() }); write('bills', list); emit('bills') }
export const updateBill = (id, data) => { write('bills', read('bills', []).map(b => b.id === id ? { ...b, ...data } : b)); emit('bills') }
export const deleteBill = (id) => { write('bills', read('bills', []).filter(b => b.id !== id)); emit('bills') }

// ── Loans ─────────────────────────────────────────────────────────────────────
// Loan schema:
//   id, name, icon, color, loanAmount (total borrowed), interestRate (% annual),
//   termMonths, startDate (YYYY-MM-DD), installmentAmount, dueDay (1-31),
//   notes, createdAt
// Loan payments schema (separate key 'loanPayments'):
//   id, loanId, amount, date (YYYY-MM-DD), note, createdAt

export const BUILTIN_LOAN_TYPES = [
  { name: 'Home Loan',     icon: '🏠', color: '#0284c7' },
  { name: 'Car Loan',      icon: '🚗', color: '#059669' },
  { name: 'Personal Loan', icon: '👤', color: '#7c3aed' },
  { name: 'Education',     icon: '🎓', color: '#d97706' },
  { name: 'Business',      icon: '🏢', color: '#0891b2' },
  { name: 'Gold Loan',     icon: '🥇', color: '#ca8a04' },
  { name: 'Other',         icon: '🏦', color: '#6b7280' },
]

export const LOAN_TYPES = BUILTIN_LOAN_TYPES // legacy alias

export const getLoanTypes = () => [...BUILTIN_LOAN_TYPES, ...read('customLoanTypes', [])]

export const subscribeLoanTypes = (cb) => {
  const notify = () => cb(getLoanTypes())
  notify()
  return on('customLoanTypes', notify)
}

export const addCustomLoanType = (data) => {
  const list = read('customLoanTypes', [])
  list.push({ ...data, id: uid(), custom: true })
  write('customLoanTypes', list)
  emit('customLoanTypes')
}

export const deleteCustomLoanType = (name) => {
  write('customLoanTypes', read('customLoanTypes', []).filter(p => p.name !== name))
  emit('customLoanTypes')
}

export const subscribeLoans = (cb) => {
  const notify = () => cb([...read('loans', [])].sort((a,b) => a.createdAt - b.createdAt))
  notify()
  return on('loans', notify)
}
export const addLoan    = (data) => { const list = read('loans', []); list.push({ ...data, id: uid(), createdAt: Date.now() }); write('loans', list); emit('loans') }
export const updateLoan = (id, data) => { write('loans', read('loans', []).map(l => l.id === id ? { ...l, ...data } : l)); emit('loans') }
export const deleteLoan = (id) => {
  write('loans', read('loans', []).filter(l => l.id !== id))
  write('loanPayments', read('loanPayments', []).filter(p => p.loanId !== id))
  emit('loans'); emit('loanPayments')
}

export const subscribeLoanPayments = (cb) => {
  const notify = () => cb([...read('loanPayments', [])].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt))
  notify()
  return on('loanPayments', notify)
}
export const addLoanPayment = (data) => { const list = read('loanPayments', []); list.push({ ...data, id: uid(), createdAt: Date.now() }); write('loanPayments', list); emit('loanPayments') }
export const deleteLoanPayment = (id) => { write('loanPayments', read('loanPayments', []).filter(p => p.id !== id)); emit('loanPayments') }
