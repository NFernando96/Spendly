import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownLeft, Eye, EyeOff, AlertTriangle, Clock, Receipt, CheckCircle2, Trash2, Pencil, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { fmt, fmtDate, groupByDate } from '../utils/helpers'
import { getCatMeta, deleteBill, deleteLoan, addLoanPayment, addTransaction, updateRecurring, deleteRecurring, updateAccount } from '../services/db'
import TxRow from '../components/TxRow'
import AddModal from '../components/AddModal'

export default function Dashboard() {
  const {
    accounts, transactions, quickExpenses, recurring, bills, loans, loanPayments,
    totalBalance, todayExpenses, monthExpenses, monthStr,
    balanceHidden, toggleBalance, expenseCategories,
  } = useApp()

  const [editingAccount, setEditingAccount] = useState(null)
  const [accountForm, setAccountForm]       = useState({})
  const [savingAcct, setSavingAcct]         = useState(false)
  const [settlingBill, setSettlingBill] = useState(null) // bill being settled
  const [settlingLoan, setSettlingLoan] = useState(null) // loan being paid from dashboard
  const [settleAccount, setSettleAccount] = useState('')
  const [editingRecurring, setEditingRecurring] = useState(null)
  const [recurringForm, setRecurringForm] = useState({ description:'', amount:'', category:'Bills', cycle:'month' })
  const [savingR, setSavingR] = useState(false)

  const openEditAccount = (a) => {
    setEditingAccount(a)
    setAccountForm({
      name: a.name, type: a.type,
      balance: String(a.balance || 0),
      minPayment: String(a.minPayment || ''),
      creditLimit: String(a.creditLimit || ''),
      paymentDueDate: a.paymentDueDate || '',
    })
  }

  const saveAccount = async () => {
    if (!accountForm.name || !editingAccount) return
    setSavingAcct(true)
    try {
      const d = {
        name: accountForm.name.trim(), type: accountForm.type,
        balance: parseFloat(accountForm.balance) || 0,
        ...(accountForm.type === 'credit' ? {
          minPayment: parseFloat(accountForm.minPayment) || 0,
          creditLimit: parseFloat(accountForm.creditLimit) || 0,
          paymentDueDate: accountForm.paymentDueDate || null,
        } : {}),
      }
      await updateAccount(editingAccount.id, d)
      setEditingAccount(null)
    } catch(e) { console.error(e) }
    setSavingAcct(false)
  }

  const [prefill, setPrefill] = useState(null)
    if (!recurringForm.description || !recurringForm.amount || !editingRecurring) return
    setSavingR(true)
    try {
      await updateRecurring(editingRecurring.id, { ...recurringForm, amount: parseFloat(recurringForm.amount) })
      setEditingRecurring(null)
    } catch(e){ console.error(e) }
    setSavingR(false)
  }

  const startEditRecurring = (r) => {
    setEditingRecurring(r)
    setRecurringForm({ description: r.description, amount: String(r.amount), category: r.category, cycle: r.cycle })
  }

  const settleBill = async (b) => {
    const acctId = settleAccount || accounts[0]?.id
    if (!acctId || !b.amount) return
    await addTransaction({
      type: 'expense',
      amount: b.amount,
      category: 'Bills',
      description: b.name,
      date: new Date().toISOString().split('T')[0],
      accountId: acctId,
    })
    setSettlingBill(null)
    setSettleAccount('')
  }

  const settleLoanInstallment = async (l) => {
    const acctId = settleAccount || accounts[0]?.id
    if (!acctId || !l.installmentAmount) return
    const today = new Date().toISOString().split('T')[0]
    await addLoanPayment({ loanId: l.id, amount: l.installmentAmount, date: today, note: 'Paid from home screen' })
    await addTransaction({
      type: 'expense',
      amount: l.installmentAmount,
      category: 'Loans',
      description: `${l.name} installment`,
      date: today,
      accountId: acctId,
      loanId: l.id,
    })
    setSettlingLoan(null)
    setSettleAccount('')
  }

  const recent = transactions.slice(0, 14)
  const groups = groupByDate(recent)

  const monthIncome = transactions
    .filter(t => t.type === 'income' && t.date?.startsWith(monthStr))
    .reduce((s, t) => s + t.amount, 0)

  const savings = monthIncome - monthExpenses
  const savingsRate = monthIncome > 0 ? Math.round((savings / monthIncome) * 100) : 0

  // Credit cards with minimum payment or due date set
  const creditWarnings = accounts.filter(a =>
    a.type === 'credit' && ((a.minPayment || 0) > 0 || a.paymentDueDate)
  )

  // mask only monetary values
  const mask = (str) => balanceHidden ? '••••••' : str

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="page" style={{ padding:'20px 16px 0' }}>

      {/* ── Hero Card ── */}
      <div style={{
        borderRadius:'var(--r-xl)',
        background:'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%)',
        padding:'22px 20px', position:'relative', overflow:'hidden', marginBottom:14,
      }}>
        <div style={{ position:'absolute', right:-24, top:-24, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', right:36, bottom:-32, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <p style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.09em' }}>Total Balance</p>
          <button
            onClick={toggleBalance}
            style={{
              display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:999,
              background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)',
              cursor:'pointer', transition:'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}
          >
            {balanceHidden
              ? <Eye size={13} color="rgba(255,255,255,0.9)" />
              : <EyeOff size={13} color="rgba(255,255,255,0.9)" />}
            <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.9)' }}>
              {balanceHidden ? 'Show' : 'Hide'}
            </span>
          </button>
        </div>

        <p style={{ fontFamily:'var(--mono)', fontSize:40, fontWeight:700, color:'#fff', letterSpacing:'-1px', marginBottom:18, lineHeight:1 }}>
          {mask(fmt(totalBalance))}
        </p>

        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          <HeroStat icon={<ArrowUpRight size={11}/>} label="Spent" value={mask(fmt(monthExpenses))} danger />
          <HeroStat icon={<ArrowDownLeft size={11}/>} label="Income" value={mask(fmt(monthIncome))} />
          <HeroStat icon={<Calendar size={11}/>} label="Today" value={mask(fmt(todayExpenses))} />
          {savingsRate > 0 && <HeroStat icon={<TrendingUp size={11}/>} label="Saved" value={`${savingsRate}%`} />}
        </div>
      </div>

      {/* ── Credit card payment warnings ── */}
      {creditWarnings.map(a => {
        const isOverdue = a.paymentDueDate && a.paymentDueDate < today
        const isDueSoon = a.paymentDueDate && !isOverdue && a.paymentDueDate <= addDays(today, 7)
        const urgentColor = isOverdue ? 'var(--danger)' : 'var(--warn)'
        const urgentBg    = isOverdue ? 'var(--danger-bg)' : 'var(--warn-bg)'
        const urgentFg    = isOverdue ? 'var(--danger-fg)' : 'var(--warn-fg)'
        return (
          <div key={a.id} style={{
            background: urgentBg,
            border:`1.5px solid ${urgentColor}`,
            borderRadius:'var(--r-lg)', padding:'12px 14px',
            display:'flex', alignItems:'flex-start', gap:10, marginBottom:10,
          }}>
            {isOverdue
              ? <AlertTriangle size={16} color={urgentColor} style={{ flexShrink:0, marginTop:1 }} />
              : <Clock size={16} color={urgentColor} style={{ flexShrink:0, marginTop:1 }} />}
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:700, color:urgentFg }}>
                {isOverdue ? '⚠ Overdue — ' : isDueSoon ? '⏰ Due soon — ' : '💳 Payment due — '}{a.name}
              </p>
              <div style={{ display:'flex', gap:14, marginTop:3, flexWrap:'wrap' }}>
                {(a.minPayment || 0) > 0 && (
                  <p style={{ fontSize:12, color:urgentColor }}>
                    Min: <span style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{mask(fmt(a.minPayment))}</span>
                  </p>
                )}
                {a.paymentDueDate && (
                  <p style={{ fontSize:12, color:urgentColor }}>
                    Due: <span style={{ fontWeight:700 }}>{fmtShortDate(a.paymentDueDate)}</span>
                  </p>
                )}
                {a.creditLimit > 0 && (
                  <p style={{ fontSize:12, color:urgentColor }}>
                    Balance: <span style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{mask(fmt(a.balance || 0))}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}


      {/* ── Bill due warnings ── */}
      {(() => {
        const todayD = new Date()
        const todayDay = todayD.getDate()
        const daysInMonth = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0).getDate()
        const urgentBills = bills.filter(b => {
          let diff = b.dueDay - todayDay
          if (diff < -5) diff = (daysInMonth - todayDay) + b.dueDay
          return diff <= 5
        }).map(b => {
          let diff = b.dueDay - todayDay
          if (diff < -5) diff = (daysInMonth - todayDay) + b.dueDay
          return { ...b, diff }
        }).sort((a,b) => a.diff - b.diff)
        if (!urgentBills.length) return null
        return urgentBills.map(b => {
          const isOverdue = b.diff < 0
          const urgentColor = isOverdue ? 'var(--danger)' : 'var(--warn)'
          const urgentBg    = isOverdue ? 'var(--danger-bg)' : 'var(--warn-bg)'
          const urgentFg    = isOverdue ? 'var(--danger-fg)' : 'var(--warn-fg)'
          const dueLabel = isOverdue ? `${Math.abs(b.diff)}d overdue` : b.diff === 0 ? 'Due today' : `Due in ${b.diff}d`
          const isSettling = settlingBill?.id === b.id
          return (
            <div key={b.id} style={{ background:urgentBg, border:`1.5px solid ${urgentColor}`, borderRadius:'var(--r-lg)', padding:'11px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:b.color+'25', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{b.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:urgentFg }}>{b.name}</p>
                  <p style={{ fontSize:11, color:urgentColor, marginTop:1 }}>
                    {isOverdue ? '⚠ Overdue' : b.diff === 0 ? '⏰ Due today' : '⏰ Due soon'} · Day {b.dueDay} of month
                  </p>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {b.amount > 0 && <p style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:800, color:urgentColor }}>{mask(fmt(b.amount))}</p>}
                  <span style={{ fontSize:11, fontWeight:700, color:urgentColor }}>{dueLabel}</span>
                </div>
              </div>
              {/* Action buttons */}
              <div style={{ display:'flex', gap:6, marginTop:10 }}>
                {b.amount > 0 && (
                  <button onClick={() => { setSettlingBill(b); setSettleAccount(accounts[0]?.id || '') }}
                    style={{ flex:1, padding:'7px 0', borderRadius:'var(--r)', fontSize:12, fontWeight:700, background:'var(--accent)', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <CheckCircle2 size={13}/> Settle Bill
                  </button>
                )}
                <button onClick={() => { if(confirm(`Delete "${b.name}" bill?`)) deleteBill(b.id) }}
                  style={{ padding:'7px 12px', borderRadius:'var(--r)', fontSize:12, fontWeight:700, background:'var(--danger-bg)', color:'var(--danger)', border:`1px solid var(--danger)`, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  <Trash2 size={12}/> Delete
                </button>
              </div>
              {/* Account picker when settling */}
              {isSettling && (
                <div style={{ marginTop:10, padding:'10px', background:'var(--surface)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Pay from account</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {accounts.map(a => {
                      const icons = { cash:'💵', bank:'🏦', credit:'💳' }
                      const sel = settleAccount === a.id
                      return (
                        <button key={a.id} onClick={() => setSettleAccount(a.id)} style={{ padding:'5px 10px', borderRadius:999, fontSize:12, fontWeight:600, background: sel ? 'var(--accent-bg)' : 'var(--surface2)', border:`1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, color: sel ? 'var(--accent-fg)' : 'var(--text)', display:'flex', alignItems:'center', gap:4 }}>
                          <span>{icons[a.type]||'🏦'}</span>{a.name}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => settleBill(b)} style={{ flex:1, padding:'8px', borderRadius:'var(--r)', fontSize:13, fontWeight:700, background:'var(--accent)', color:'#fff', border:'none', cursor:'pointer' }}>
                      Confirm Payment
                    </button>
                    <button onClick={() => setSettlingBill(null)} style={{ padding:'8px 12px', borderRadius:'var(--r)', fontSize:13, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', cursor:'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      })()}

      {/* ── Loan due warnings ── */}
      {(() => {
        const todayD = new Date()
        const todayDay = todayD.getDate()
        const daysInMonth = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0).getDate()
        const urgentLoans = loans.filter(l => l.dueDay && l.installmentAmount > 0).map(l => {
          let diff = l.dueDay - todayDay
          if (diff < -5) diff = (daysInMonth - todayDay) + l.dueDay
          return { ...l, diff }
        }).filter(l => l.diff <= 5).sort((a,b) => a.diff - b.diff)
        if (!urgentLoans.length) return null
        return urgentLoans.map(l => {
          const isOverdue = l.diff < 0
          const urgentColor = isOverdue ? 'var(--danger)' : '#0284c7'
          const urgentBg    = isOverdue ? 'var(--danger-bg)' : '#0284c710'
          const urgentFg    = isOverdue ? 'var(--danger-fg)' : '#0284c7'
          const dueLabel = isOverdue ? `${Math.abs(l.diff)}d overdue` : l.diff === 0 ? 'Due today' : `Due in ${l.diff}d`
          const isSettling = settlingLoan?.id === l.id
          return (
            <div key={l.id} style={{ background:urgentBg, border:`1.5px solid ${urgentColor}`, borderRadius:'var(--r-lg)', padding:'11px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:l.color+'25', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{l.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:urgentFg }}>{l.name}</p>
                  <p style={{ fontSize:11, color:urgentColor, marginTop:1 }}>
                    🏦 {isOverdue ? '⚠ Installment overdue' : l.diff === 0 ? '⏰ Installment due today' : '⏰ Installment due soon'} · Day {l.dueDay}
                  </p>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:800, color:urgentColor }}>{mask(fmt(l.installmentAmount))}</p>
                  <span style={{ fontSize:11, fontWeight:700, color:urgentColor }}>{dueLabel}</span>
                </div>
              </div>
              {/* Action buttons */}
              <div style={{ display:'flex', gap:6, marginTop:10 }}>
                <button onClick={() => { setSettlingLoan(l); setSettleAccount(accounts[0]?.id || '') }}
                  style={{ flex:1, padding:'7px 0', borderRadius:'var(--r)', fontSize:12, fontWeight:700, background:'#0284c7', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  <CheckCircle2 size={13}/> Pay Installment
                </button>
                <button onClick={() => { if(confirm(`Delete loan "${l.name}"? All records will be removed.`)) deleteLoan(l.id) }}
                  style={{ padding:'7px 12px', borderRadius:'var(--r)', fontSize:12, fontWeight:700, background:'var(--danger-bg)', color:'var(--danger)', border:`1px solid var(--danger)`, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  <Trash2 size={12}/> Delete
                </button>
              </div>
              {/* Account picker when paying */}
              {isSettling && (
                <div style={{ marginTop:10, padding:'10px', background:'var(--surface)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Pay from account</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {accounts.map(a => {
                      const icons = { cash:'💵', bank:'🏦', credit:'💳' }
                      const sel = settleAccount === a.id
                      return (
                        <button key={a.id} onClick={() => setSettleAccount(a.id)} style={{ padding:'5px 10px', borderRadius:999, fontSize:12, fontWeight:600, background: sel ? 'var(--accent-bg)' : 'var(--surface2)', border:`1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, color: sel ? 'var(--accent-fg)' : 'var(--text)', display:'flex', alignItems:'center', gap:4 }}>
                          <span>{icons[a.type]||'🏦'}</span>{a.name}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => settleLoanInstallment(l)} style={{ flex:1, padding:'8px', borderRadius:'var(--r)', fontSize:13, fontWeight:700, background:'#0284c7', color:'#fff', border:'none', cursor:'pointer' }}>
                      Confirm Payment
                    </button>
                    <button onClick={() => setSettlingLoan(null)} style={{ padding:'8px 12px', borderRadius:'var(--r)', fontSize:13, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', cursor:'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      })()}

      {/* ── Account chips — click to edit ── */}
      <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', marginBottom:14, paddingBottom:2 }}>
        {accounts.map(a => {
          const icons = { cash:'💵', bank:'🏦', credit:'💳' }
          const isDebt = a.type === 'credit' && (a.balance || 0) > 0
          return (
            <button key={a.id}
              onClick={() => openEditAccount(a)}
              style={{
                flexShrink:0, background:'var(--surface)', border:'1.5px solid var(--border)',
                borderRadius:'var(--r-lg)', padding:'12px 16px', minWidth:130, boxShadow:'var(--shadow)',
                textAlign:'left', cursor:'pointer', transition:'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(124,58,237,0.15)'; e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='var(--shadow)'; e.currentTarget.style.transform='none' }}
              onTouchStart={e => e.currentTarget.style.transform='scale(0.97)'}
              onTouchEnd={e => e.currentTarget.style.transform='none'}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{icons[a.type]||'🏦'}</span>
                <span style={{ fontSize:9, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', background:'var(--surface2)', padding:'2px 6px', borderRadius:999 }}>{a.type}</span>
              </div>
              <p style={{ fontSize:11, color:'var(--text2)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>{a.name}</p>
              <p style={{ fontFamily:'var(--mono)', fontSize:16, fontWeight:800, color: isDebt ? 'var(--danger)' : 'var(--text)' }}>
                {mask(fmt(a.balance||0))}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── Quick add — compact pills ── */}
      {quickExpenses.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <SectionTitle>Quick Add</SectionTitle>
          <div style={{
            display:'flex', gap:6,
            overflowX:'auto', scrollbarWidth:'none',
            paddingBottom:4, paddingTop:1,
            marginLeft:-16, marginRight:-16,
            paddingLeft:16, paddingRight:16,
          }}>
            {quickExpenses.slice(0,12).map(q => (
              <button key={q.id}
                onClick={() => setPrefill({ type:'expense', description:q.description, amount:q.amount, category:q.category, accountId:q.accountId })}
                style={{
                  flexShrink:0,
                  padding:'5px 10px', borderRadius:999,
                  background:'var(--surface2)',
                  border:'1px solid var(--border)',
                  display:'flex', alignItems:'center', gap:5,
                  transition:'all 0.15s', cursor:'pointer',
                  whiteSpace:'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--surface2)' }}
                onTouchStart={e => e.currentTarget.style.transform='scale(0.94)'}
                onTouchEnd={e => e.currentTarget.style.transform='none'}
              >
                <span style={{ fontSize:13 }}>{getCatMeta(q.category,'expense').icon}</span>
                <span style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{q.description}</span>
                <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{Math.round(q.amount).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Recurring — show description + amount, never mask ── */}
      {recurring.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <SectionTitle>Recurring</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {recurring.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'11px 13px' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:getCatMeta(r.category).color+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                  {getCatMeta(r.category).icon}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.description}</p>
                  <p style={{ fontSize:11, color:'var(--text2)', marginTop:1 }}>Every {r.cycle}</p>
                </div>
                {/* Recurring amounts are NOT masked — they're subscription amounts, not account balances */}
                <span style={{ fontSize:14, fontWeight:700, color:'var(--danger)', fontFamily:'var(--mono)', marginRight:6 }}>{fmt(r.amount)}</span>
                <button onClick={() => startEditRecurring(r)}
                  style={{ opacity:0.45, transition:'opacity 0.15s', padding:4, marginRight:2 }}
                  onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
                >
                  <Pencil size={13} color="var(--accent)" />
                </button>
                <button onClick={() => { if(confirm(`Delete "${r.description}"?`)) deleteRecurring(r.id) }}
                  style={{ opacity:0.45, transition:'opacity 0.15s', padding:4 }}
                  onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
                >
                  <Trash2 size={13} color="var(--danger)" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Transactions ── */}
      <SectionTitle>Recent Transactions</SectionTitle>
      {groups.length === 0
        ? (
          <div style={{ textAlign:'center', padding:'48px 0' }}>
            <p style={{ fontSize:32, marginBottom:10 }}>💸</p>
            <p style={{ color:'var(--text3)', fontSize:14 }}>No transactions yet — tap + to add one</p>
          </div>
        )
        : groups.map(([date, txs]) => (
          <div key={date} style={{ marginBottom:14 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{fmtDate(date)}</p>
            {txs.map(t => <TxRow key={t.id} tx={t} />)}
          </div>
        ))
      }

      {prefill && <AddModal prefill={prefill} onClose={() => setPrefill(null)} />}

      {/* ── Edit Account Modal ── */}
      {editingAccount && createPortal(
        <div onClick={e=>{ if(e.target===e.currentTarget) setEditingAccount(null) }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>Edit Account</h2>
              <button onClick={() => setEditingAccount(null)} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)" />
              </button>
            </div>

            <RField label="Account Name">
              <input type="text" placeholder="e.g. NDB Savings" value={accountForm.name||''} onChange={e=>setAccountForm(f=>({...f,name:e.target.value}))}
                style={{ width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
            </RField>

            <RField label="Balance (Rs.)">
              <input type="number" placeholder="0" value={accountForm.balance||''} onChange={e=>setAccountForm(f=>({...f,balance:e.target.value}))}
                style={{ width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
            </RField>

            {editingAccount.type === 'credit' && <>
              <RField label="Minimum Payment (Rs.)">
                <input type="number" placeholder="0" value={accountForm.minPayment||''} onChange={e=>setAccountForm(f=>({...f,minPayment:e.target.value}))}
                  style={{ width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
              </RField>
              <RField label="Credit Limit (Rs.)">
                <input type="number" placeholder="0" value={accountForm.creditLimit||''} onChange={e=>setAccountForm(f=>({...f,creditLimit:e.target.value}))}
                  style={{ width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
              </RField>
              <RField label="Payment Due Date">
                <input type="date" value={accountForm.paymentDueDate||''} onChange={e=>setAccountForm(f=>({...f,paymentDueDate:e.target.value}))}
                  style={{ width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
              </RField>
            </>}

            <button onClick={saveAccount} disabled={!accountForm.name || savingAcct} style={{
              width:'100%', padding:15, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700,
              background:'var(--accent)', color:'#fff', border:'none', cursor:'pointer',
              opacity: !accountForm.name || savingAcct ? 0.4 : 1, marginTop:4, transition:'opacity 0.15s',
            }}>
              {savingAcct ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit Recurring Modal ── */}
      {editingRecurring && createPortal(
        <div onClick={e=>{ if(e.target===e.currentTarget){ setEditingRecurring(null) }}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>Edit Recurring Expense</h2>
              <button onClick={() => setEditingRecurring(null)} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)" />
              </button>
            </div>

            {[['Description','text','description','e.g. Netflix'],['Amount (Rs.)','number','amount','0']].map(([l,t,k,ph]) => (
              <RField key={k} label={l}>
                <input type={t} placeholder={ph} value={recurringForm[k]} onChange={e=>setRecurringForm(f=>({...f,[k]:e.target.value}))}
                  style={{ width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none' }} />
              </RField>
            ))}

            <RField label="Category">
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {expenseCategories.map(c => (
                  <button key={c.name} onClick={() => setRecurringForm(f=>({...f,category:c.name}))} style={{
                    padding:'6px 12px', borderRadius:999, fontSize:12,
                    background: recurringForm.category===c.name ? c.color+'20' : 'var(--surface2)',
                    border:`1.5px solid ${recurringForm.category===c.name ? c.color+'70' : 'var(--border)'}`,
                    color: recurringForm.category===c.name ? c.color : 'var(--text)',
                    fontWeight: recurringForm.category===c.name ? 600 : 400, transition:'all 0.12s',
                  }}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </RField>

            <RField label="Repeat every">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {['day','week','month','year'].map(c => (
                  <button key={c} onClick={() => setRecurringForm(f=>({...f,cycle:c}))} style={{
                    padding:'10px 4px', borderRadius:'var(--r)', fontSize:13, textTransform:'capitalize',
                    background: recurringForm.cycle===c ? 'var(--accent-bg)' : 'var(--surface2)',
                    border:`1.5px solid ${recurringForm.cycle===c ? 'var(--accent)' : 'var(--border)'}`,
                    color: recurringForm.cycle===c ? 'var(--accent-fg)' : 'var(--text)',
                    fontWeight: recurringForm.cycle===c ? 700 : 400, transition:'all 0.15s',
                  }}>{c}</button>
                ))}
              </div>
            </RField>

            <button onClick={saveRecurring} disabled={!recurringForm.description||!recurringForm.amount||savingR} style={{
              width:'100%', padding:15, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700,
              background:'var(--accent)', color:'#fff',
              opacity:!recurringForm.description||!recurringForm.amount||savingR?0.4:1,
              marginTop:4, transition:'opacity 0.15s',
            }}>
              {savingR ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

const RField = ({label, children}) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
    {children}
  </div>
)

const SectionTitle = ({ children }) => (
  <h3 style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>{children}</h3>
)

const HeroStat = ({ icon, label, value, danger }) => (
  <div>
    <div style={{ display:'flex', alignItems:'center', gap:3, color:'rgba(255,255,255,0.5)', marginBottom:2 }}>
      {icon}
      <span style={{ fontSize:10, fontWeight:500 }}>{label}</span>
    </div>
    <p style={{ fontSize:13, fontWeight:700, color: danger ? '#fda4af' : '#fff', fontFamily:'var(--mono)' }}>{value}</p>
  </div>
)