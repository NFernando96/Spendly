import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Pencil, X, Eye, EyeOff, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { fmt } from '../utils/helpers'
import { addLoan, updateLoan, deleteLoan, addLoanPayment, deleteLoanPayment, getLoanTypes, addTransaction } from '../services/db'

const blankLoan = {
  name: '', icon: '🏦', color: '#6b7280',
  loanAmount: '', currentBalance: '', installmentAmount: '', interestRate: '',
  termMonths: '', startDate: '', dueDay: '', notes: '',
}

function getDueStatus(dueDay) {
  if (!dueDay) return null
  const today = new Date()
  const todayDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  let diff = dueDay - todayDay
  if (diff < -5) diff = (daysInMonth - todayDay) + dueDay
  return diff
}

function getLoanStats(loan, payments) {
  const loanPayments = payments.filter(p => p.loanId === loan.id)
  const totalPaid    = loanPayments.reduce((s, p) => s + p.amount, 0)
  // If currentBalance is set, treat it as the starting remaining amount (for pre-existing loans)
  const hasCurrBal   = loan.currentBalance != null && loan.currentBalance > 0
  const baseBalance  = hasCurrBal ? loan.currentBalance : (loan.loanAmount || 0)
  const remaining    = Math.max(0, baseBalance - totalPaid)
  // Progress reflects full loan history including pre-app payments
  const loanTotal    = loan.loanAmount || baseBalance
  const alreadyPaid  = hasCurrBal ? Math.max(0, loanTotal - loan.currentBalance) : 0
  const paidPct      = loanTotal > 0 ? Math.min(100, Math.round(((alreadyPaid + totalPaid) / loanTotal) * 100)) : 0
  const installment  = loan.installmentAmount || 0
  const instPaid     = installment > 0 ? Math.floor(totalPaid / installment) : loanPayments.length
  const totalInst    = loan.termMonths || (installment > 0 && loan.loanAmount > 0 ? Math.ceil(loan.loanAmount / installment) : 0)
  const instLeft     = totalInst > 0 ? Math.max(0, totalInst - instPaid) : null
  return { totalPaid, remaining, paidPct, instPaid, totalInst, instLeft, count: loanPayments.length, loanPayments, alreadyPaid }
}

function getOrdinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Day Picker Calendar Component ──
function DayPicker({ value, onChange, placeholder = 'Select due day' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const selected = parseInt(value) || null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '12px 14px', background: 'var(--surface2)',
          border: `1.5px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--r)', fontSize: 15, color: selected ? 'var(--text)' : 'var(--text3)',
          outline: 'none', transition: 'border-color 0.15s', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} color={selected ? 'var(--accent)' : 'var(--text3)'} />
          {selected ? `${getOrdinal(selected)} of each month` : placeholder}
        </span>
        <ChevronDown size={14} color="var(--text3)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          padding: '14px',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, textAlign: 'center' }}>
            Pick installment due day
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {days.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => { onChange(String(d)); setOpen(false) }}
                style={{
                  padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: selected === d ? 'var(--accent)' : 'var(--surface2)',
                  border: `1.5px solid ${selected === d ? 'var(--accent)' : 'var(--border)'}`,
                  color: selected === d ? '#fff' : 'var(--text)', cursor: 'pointer',
                  transition: 'all 0.12s', textAlign: 'center',
                }}
                onMouseEnter={e => { if (selected !== d) { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
                onMouseLeave={e => { if (selected !== d) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' } }}
              >
                {d}
              </button>
            ))}
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              style={{ width: '100%', marginTop: 10, padding: '7px', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'var(--danger-bg)', border: 'none', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Loans() {
  const { loans, loanPayments, accounts } = useApp()

  const [hidden, setHidden] = useState(() => {
    try { const s = localStorage.getItem('loansHidden'); return s === null ? false : s === 'true' } catch { return false }
  })
  const toggleHidden = () => setHidden(v => { const n = !v; try { localStorage.setItem('loansHidden', String(n)) } catch {}; return n })
  const mask = (str) => hidden ? '••••••' : str

  const [showLoan,   setShowLoan]   = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [form,       setForm]       = useState(blankLoan)
  const [saving,     setSaving]     = useState(false)
  const [typeIdx,    setTypeIdx]    = useState(null)

  const [payLoan,    setPayLoan]    = useState(null)
  const [payForm,    setPayForm]    = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '', accountId: '' })
  const [payingSave, setPayingSave] = useState(false)

  const [expanded, setExpanded]    = useState({})

  const openAdd = () => { setEditId(null); setForm(blankLoan); setTypeIdx(null); setShowLoan(true) }
  const openEdit = (l) => {
    setEditId(l.id)
    const ti = getLoanTypes().findIndex(t => t.name === l.loanType || t.icon === l.icon)
    setTypeIdx(ti >= 0 ? ti : null)
    setForm({
      name: l.name, icon: l.icon, color: l.color,
      loanAmount: String(l.loanAmount || ''), currentBalance: String(l.currentBalance || ''),
      installmentAmount: String(l.installmentAmount || ''),
      interestRate: String(l.interestRate || ''), termMonths: String(l.termMonths || ''),
      startDate: l.startDate || '', dueDay: String(l.dueDay || ''), notes: l.notes || '',
    })
    setShowLoan(true)
  }
  const closeLoan = () => { setShowLoan(false); setEditId(null) }

  const saveLoan = async () => {
    if (!form.name || !form.loanAmount) return
    setSaving(true)
    try {
      const d = {
        name: form.name.trim(), icon: form.icon, color: form.color,
        loanAmount:        parseFloat(form.loanAmount) || 0,
        currentBalance:    form.currentBalance !== '' ? (parseFloat(form.currentBalance) || 0) : null,
        installmentAmount: parseFloat(form.installmentAmount) || 0,
        interestRate:      parseFloat(form.interestRate) || 0,
        termMonths:        parseInt(form.termMonths) || 0,
        startDate:         form.startDate || null,
        dueDay:            parseInt(form.dueDay) || null,
        notes:             form.notes.trim(),
      }
      editId ? await updateLoan(editId, d) : await addLoan(d)
      closeLoan()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  const removeLoan = async (l) => {
    if (!confirm(`Delete "${l.name}"? All payment records will also be removed.`)) return
    await deleteLoan(l.id)
    setExpanded(ex => { const n = {...ex}; delete n[l.id]; return n })
  }

  const openPay = (l) => {
    setPayLoan(l)
    setPayForm({ amount: String(l.installmentAmount || ''), date: new Date().toISOString().split('T')[0], note: '' })
  }
  const closePay = () => setPayLoan(null)

  const savePayment = async () => {
    if (!payForm.amount || !payLoan) return
    setPayingSave(true)
    try {
      const amt = parseFloat(payForm.amount)
      // Record in loan payment ledger
      await addLoanPayment({ loanId: payLoan.id, amount: amt, date: payForm.date, note: payForm.note.trim() })
      // Also add as an expense transaction so it shows in Recent Transactions & Analytics
      const accountId = payForm.accountId || (accounts[0]?.id ?? '')
      if (accountId) {
        await addTransaction({
          type: 'expense',
          amount: amt,
          category: 'Loans',
          description: payForm.note.trim() || `${payLoan.name} installment`,
          date: payForm.date,
          accountId,
          loanId: payLoan.id, // link back for reference
        })
      }
      closePay()
    } catch(e) { console.error(e) }
    setPayingSave(false)
  }

  const removePayment = async (p) => {
    if (!confirm('Remove this payment record?')) return
    await deleteLoanPayment(p.id)
  }

  const totalBorrowed  = loans.reduce((s, l) => s + (l.loanAmount || 0), 0)
  const totalPaidAll   = loans.reduce((s, l) => { const st = getLoanStats(l, loanPayments); return s + st.totalPaid + (st.alreadyPaid || 0) }, 0)
  const totalRemaining = loans.reduce((s, l) => s + getLoanStats(l, loanPayments).remaining, 0)

  return (
    <div className="page" style={{ padding: '20px 16px 0' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.5px' }}>Loans</h1>
          <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Track borrowed amounts & repayments</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={toggleHidden} style={btnSecondary}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text2)'}}
          >
            {hidden ? <Eye size={14}/> : <EyeOff size={14}/>}
            <span>{hidden ? 'Show' : 'Hide'}</span>
          </button>
          <button onClick={openAdd} style={btnPrimary}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}
          >
            <Plus size={14}/> Add Loan
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {loans.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
          <SummaryCard label="Borrowed"  value={mask(fmt(totalBorrowed))}  color="var(--info)"   bg="var(--info-bg)"   />
          <SummaryCard label="Paid"      value={mask(fmt(totalPaidAll))}   color="var(--income)" bg="var(--income-bg)" />
          <SummaryCard label="Remaining" value={mask(fmt(totalRemaining))} color="var(--danger)" bg="var(--danger-bg)" />
        </div>
      )}

      {/* Loan cards */}
      {loans.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 0' }}>
          <p style={{ fontSize:44, marginBottom:12 }}>🏦</p>
          <p style={{ fontWeight:700, color:'var(--text)', marginBottom:6, fontSize:16 }}>No loans yet</p>
          <p style={{ color:'var(--text3)', fontSize:13 }}>Add your home loan, car loan or any borrowing</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {loans.map(l => {
            const stats   = getLoanStats(l, loanPayments)
            const diff    = getDueStatus(l.dueDay)
            const isOpen  = !!expanded[l.id]
            const isOverdue  = diff !== null && diff < 0
            const isDueSoon  = diff !== null && diff >= 0 && diff <= 7
            const borderColor = isOverdue ? 'var(--danger)' : isDueSoon ? 'var(--warn)' : 'var(--border)'
            const barColor = stats.paidPct >= 90 ? 'var(--income)' : stats.paidPct >= 50 ? 'var(--accent)' : 'var(--info)'

            return (
              <div key={l.id} style={{ background:'var(--surface)', border:`1.5px solid ${borderColor}`, borderRadius:'var(--r-lg)', boxShadow:'var(--shadow)', overflow:'hidden', transition:'box-shadow 0.15s' }}>

                <div style={{ padding:'14px 14px 12px', display:'flex', gap:12, alignItems:'flex-start' }}>
                  {/* Icon */}
                  <div style={{ width:46, height:46, borderRadius:13, background:l.color+'1a', border:`1px solid ${l.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:23, flexShrink:0 }}>
                    {l.icon}
                  </div>

                  {/* Middle info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <p style={{ fontSize:15, fontWeight:800, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.name}</p>
                      {diff !== null && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999,
                          color: isOverdue ? 'var(--danger)' : isDueSoon ? 'var(--warn)' : 'var(--text3)',
                          background: isOverdue ? 'var(--danger-bg)' : isDueSoon ? 'var(--warn-bg)' : 'var(--surface2)',
                          flexShrink:0,
                        }}>
                          {isOverdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today' : `Due in ${diff}d`}
                        </span>
                      )}
                    </div>

                    {/* ── Initial Loan Amount + Left to Pay ── */}
                    <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, background:'var(--info-bg)', border:'1px solid var(--info)30' }}>
                        <span style={{ fontSize:9, fontWeight:700, color:'var(--info)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Initial</span>
                        <span style={{ fontSize:12, fontWeight:800, color:'var(--info)', fontFamily:'var(--mono)' }}>{mask(fmt(l.loanAmount || 0))}</span>
                      </div>
                      {l.currentBalance != null && l.currentBalance > 0 && l.currentBalance < l.loanAmount && (
                        <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, background:'var(--warn-bg)', border:'1px solid var(--warn)30' }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'var(--warn)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Pre-paid</span>
                          <span style={{ fontSize:12, fontWeight:800, color:'var(--warn)', fontFamily:'var(--mono)' }}>{mask(fmt(l.loanAmount - l.currentBalance))}</span>
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, background: stats.remaining > 0 ? 'var(--danger-bg)' : 'var(--income-bg)', border:`1px solid ${stats.remaining > 0 ? 'var(--danger)' : 'var(--income)'}30` }}>
                        <span style={{ fontSize:9, fontWeight:700, color: stats.remaining > 0 ? 'var(--danger)' : 'var(--income)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Left to Pay</span>
                        <span style={{ fontSize:12, fontWeight:800, color: stats.remaining > 0 ? 'var(--danger)' : 'var(--income)', fontFamily:'var(--mono)' }}>{mask(fmt(stats.remaining))}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom:6 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, color:'var(--text3)' }}>{mask(fmt(stats.totalPaid))} paid</span>
                        <span style={{ fontSize:11, fontWeight:700, color: barColor }}>{stats.paidPct}%</span>
                      </div>
                      <div style={{ height:6, borderRadius:999, background:'var(--surface3)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${stats.paidPct}%`, background: barColor, borderRadius:999, transition:'width 0.5s ease' }} />
                      </div>
                    </div>

                    {/* Key numbers */}
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                      {l.installmentAmount > 0 && <Chip label="Installment" value={mask(fmt(l.installmentAmount))} color="var(--accent)" />}
                      {stats.instLeft !== null && <Chip label="Inst. left" value={stats.instLeft} color="var(--text2)" plain />}
                      {l.interestRate > 0 && <Chip label="Rate" value={`${l.interestRate}%`} color="var(--warn)" plain />}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => openEdit(l)} style={{ ...iconBtn, opacity:0.45 }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
                      ><Pencil size={13} color="var(--text2)"/></button>
                      <button onClick={() => removeLoan(l)} style={{ ...iconBtn, opacity:0.45 }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
                      ><Trash2 size={13} color="var(--danger)"/></button>
                    </div>
                    <button onClick={() => openPay(l)} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:999, background:'var(--income-bg)', border:'1.5px solid var(--income)', color:'var(--income)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}
                      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='none'}
                    >
                      <Plus size={12}/> Pay
                    </button>
                  </div>
                </div>

                {l.notes && (
                  <div style={{ padding:'0 14px 10px' }}>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>📝 {l.notes}</span>
                  </div>
                )}

                {stats.count > 0 && (
                  <button
                    onClick={() => setExpanded(ex => ({ ...ex, [l.id]: !ex[l.id] }))}
                    style={{ width:'100%', padding:'9px 14px', background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', border:'none', borderTop:'1px solid var(--border)' }}
                  >
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>
                      {stats.count} payment{stats.count !== 1 ? 's' : ''} recorded
                    </span>
                    {isOpen ? <ChevronUp size={15} color="var(--text3)"/> : <ChevronDown size={15} color="var(--text3)"/>}
                  </button>
                )}

                {isOpen && stats.count > 0 && (
                  <div style={{ borderTop:'1px solid var(--border)', padding:'10px 14px 14px' }}>
                    <p style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Payment History</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {stats.loanPayments.map(p => (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--surface2)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:'var(--income-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <CheckCircle2 size={14} color="var(--income)"/>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:13, fontWeight:700, color:'var(--income)', fontFamily:'var(--mono)' }}>{mask(fmt(p.amount))}</p>
                            {p.note && <p style={{ fontSize:11, color:'var(--text3)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.note}</p>}
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <p style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>{fmtDate(p.date)}</p>
                            <button onClick={() => removePayment(p)} style={{ ...iconBtn, opacity:0.35 }}
                              onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.35'}
                            ><Trash2 size={11} color="var(--danger)"/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add/Edit Loan Modal ── */}
      {showLoan && createPortal(
        <div onClick={e=>e.target===e.currentTarget&&closeLoan()} style={overlay}>
          <div onClick={e=>e.stopPropagation()} style={sheet}>
            <Pill/>
            <SheetHeader title={editId ? 'Edit Loan' : 'New Loan'} onClose={closeLoan}/>

            <F label="Loan Type">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
                {getLoanTypes().map((t, i) => (
                  <button key={t.name} onClick={() => { setTypeIdx(i); setForm(f=>({...f, name:f.name||t.name, icon:t.icon, color:t.color})) }}
                    style={{ padding:'10px 4px', borderRadius:'var(--r)', display:'flex', flexDirection:'column', alignItems:'center', gap:3, fontSize:11, fontWeight:600,
                      background: typeIdx===i ? t.color+'18' : 'var(--surface2)',
                      border:`1.5px solid ${typeIdx===i ? t.color+'80' : 'var(--border)'}`,
                      color: typeIdx===i ? t.color : 'var(--text2)', transition:'all 0.15s', cursor:'pointer' }}
                  >
                    <span style={{ fontSize:20 }}>{t.icon}</span>
                    <span style={{ textAlign:'center', lineHeight:1.2 }}>{t.name}</span>
                  </button>
                ))}
              </div>
            </F>

            <F label="Loan Name">
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Bank of Ceylon Home Loan" style={inp}/>
            </F>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <F label="Total Loan Amount (Rs.)">
                <input type="number" inputMode="decimal" value={form.loanAmount} onChange={e=>setForm(f=>({...f,loanAmount:e.target.value}))} placeholder="0" style={inp}/>
              </F>
              <F label="Monthly Installment (Rs.)">
                <input type="number" inputMode="decimal" value={form.installmentAmount} onChange={e=>setForm(f=>({...f,installmentAmount:e.target.value}))} placeholder="0" style={inp}/>
              </F>
            </div>

            <F label="Current Remaining Balance (Rs.)">
              <input
                type="number" inputMode="decimal"
                value={form.currentBalance}
                onChange={e=>setForm(f=>({...f,currentBalance:e.target.value}))}
                placeholder={form.loanAmount ? `e.g. ${form.loanAmount} if no payments yet` : 'Leave blank if starting fresh'}
                style={inp}
              />
              {form.loanAmount && form.currentBalance && parseFloat(form.currentBalance) < parseFloat(form.loanAmount) && (
                <p style={{ fontSize:11, color:'var(--income)', marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
                  ✅ Already paid: Rs. {(parseFloat(form.loanAmount) - parseFloat(form.currentBalance)).toLocaleString('en-LK')} before tracking
                </p>
              )}
              <p style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>
                Set this if you already made payments before using this app. Leave blank to track from the full amount.
              </p>
            </F>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <F label="Interest Rate (% p.a.)">
                <input type="number" inputMode="decimal" value={form.interestRate} onChange={e=>setForm(f=>({...f,interestRate:e.target.value}))} placeholder="0" style={inp}/>
              </F>
              <F label="Term (months)">
                <input type="number" inputMode="numeric" value={form.termMonths} onChange={e=>setForm(f=>({...f,termMonths:e.target.value}))} placeholder="e.g. 60" style={inp}/>
              </F>
            </div>

            <F label="Due Day">
              <DayPicker value={form.dueDay} onChange={v => setForm(f=>({...f, dueDay:v}))} placeholder="Select installment due day" />
            </F>

            <F label="Start Date">
              <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={inp}/>
            </F>

            <F label="Notes (optional)">
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Branch, account number…" style={inp}/>
            </F>

            <button onClick={saveLoan} disabled={!form.name||!form.loanAmount||saving}
              style={{ ...saveBtnStyle, opacity:(!form.name||!form.loanAmount||saving)?0.4:1 }}
            >
              {saving ? 'Saving…' : editId ? 'Update Loan' : 'Add Loan'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Record Payment Modal ── */}
      {payLoan && createPortal(
        <div onClick={e=>e.target===e.currentTarget&&closePay()} style={overlay}>
          <div onClick={e=>e.stopPropagation()} style={{ ...sheet, maxHeight:'60dvh' }}>
            <Pill/>
            <SheetHeader title="Record Payment" subtitle={payLoan.name} onClose={closePay}/>

            <F label="Amount Paid (Rs.)">
              <input type="number" inputMode="decimal" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} placeholder="0" style={inp}/>
            </F>
            <F label="Paid From Account">
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {accounts.map(a => {
                  const icons = { cash:'💵', bank:'🏦', credit:'💳' }
                  const sel = payForm.accountId === a.id || (!payForm.accountId && accounts[0]?.id === a.id)
                  return (
                    <button key={a.id} onClick={() => setPayForm(f=>({...f,accountId:a.id}))} style={{
                      padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:600,
                      background: sel ? 'var(--accent-bg)' : 'var(--surface2)',
                      border:`1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                      color: sel ? 'var(--accent-fg)' : 'var(--text)', transition:'all 0.12s',
                      display:'flex', alignItems:'center', gap:5,
                    }}>
                      <span>{icons[a.type]||'🏦'}</span>{a.name}
                    </button>
                  )
                })}
              </div>
            </F>
            <F label="Payment Date">
              <input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} style={inp}/>
            </F>
            <F label="Note (optional)">
              <input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} placeholder="e.g. April installment" style={inp}/>
            </F>

            <button onClick={savePayment} disabled={!payForm.amount||payingSave}
              style={{ ...saveBtnStyle, opacity:(!payForm.amount||payingSave)?0.4:1, background:'var(--income)' }}
            >
              {payingSave ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const today = new Date().toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

function Chip({ label, value, color, plain }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
      <span style={{ fontSize:9, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:700, color, fontFamily: plain ? 'var(--font)' : 'var(--mono)' }}>{value}</span>
    </div>
  )
}

function SummaryCard({ label, value, color, bg }) {
  return (
    <div style={{ background:bg, borderRadius:'var(--r-lg)', padding:'12px 10px', textAlign:'center', border:`1px solid ${color}22` }}>
      <p style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:800, color }}>{value}</p>
      <p style={{ fontSize:10, color:'var(--text3)', marginTop:3, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</p>
    </div>
  )
}

function Pill() {
  return <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}><div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }}/></div>
}

function SheetHeader({ title, subtitle, onClose }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
      <div>
        <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{title}</h2>
        {subtitle && <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{subtitle}</p>}
      </div>
      <button onClick={onClose} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <X size={16} color="var(--text2)"/>
      </button>
    </div>
  )
}

const F = ({ label, children }) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
    {children}
  </div>
)

const inp          = { width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', transition:'border-color 0.15s' }
const iconBtn      = { display:'flex', background:'none', border:'none', cursor:'pointer', transition:'opacity 0.15s', padding:2 }
const btnPrimary   = { display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:999, background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:700, boxShadow:'0 2px 8px rgba(124,58,237,0.35)', transition:'all 0.15s', border:'none', cursor:'pointer' }
const btnSecondary = { display:'flex', alignItems:'center', gap:5, padding:'8px 13px', borderRadius:999, background:'var(--surface2)', border:'1.5px solid var(--border)', cursor:'pointer', fontSize:13, fontWeight:600, color:'var(--text2)', transition:'all 0.15s' }
const overlay      = { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }
const sheet        = { background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'92dvh', overflowY:'auto' }
const saveBtnStyle = { width:'100%', padding:14, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700, background:'var(--accent)', color:'#fff', marginTop:4, transition:'opacity 0.15s', cursor:'pointer', border:'none' }
