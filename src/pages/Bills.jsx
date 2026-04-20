import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Pencil, X, Eye, EyeOff, AlertTriangle, Clock, CheckCircle2, Calendar, ChevronDown } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { fmt } from '../utils/helpers'
import { addBill, updateBill, deleteBill, getBillPresets, getBillPreset, subscribeBillPresets } from '../services/db'

const blank = { name: '', icon: '📋', color: '#6b7280', amount: '', dueDay: '', cycle: 'monthly', notes: '', customName: '' }

function getDueStatus(dueDay) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Full date string (YYYY-MM-DD)
  if (typeof dueDay === 'string' && dueDay.includes('-')) {
    const due = new Date(dueDay)
    due.setHours(0, 0, 0, 0)
    return Math.round((due - today) / 86400000)
  }
  // Legacy: day-of-month integer
  const todayDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  let diff = dueDay - todayDay
  if (diff < -5) diff = (daysInMonth - todayDay) + dueDay
  return diff
}

function formatDueLabel(dueDay) {
  if (typeof dueDay === 'string' && dueDay.includes('-')) {
    const d = new Date(dueDay)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return dueDay ? getOrdinal(dueDay) + ' of each month' : 'Day ?'
}

function getOrdinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Smart Due Date Picker ──
// For monthly cycle: picks a day-of-month (1–31), stored as integer
// For yearly cycle: picks a full calendar date, stored as YYYY-MM-DD
function DueDatePicker({ value, onChange, cycle, placeholder = 'Select due date' }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear]   = useState(() => { const d = value && String(value).includes('-') ? new Date(value) : new Date(); return d.getFullYear() })
  const [viewMonth, setViewMonth] = useState(() => { const d = value && String(value).includes('-') ? new Date(value) : new Date(); return d.getMonth() })
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (value && String(value).includes('-')) {
      const d = new Date(value)
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
    } else {
      const d = new Date()
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
    }
    setOpen(o => !o)
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

  const firstDay  = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayStr  = new Date().toISOString().split('T')[0]

  // For monthly: selected day-of-month integer
  const selectedDayInt = cycle === 'monthly' ? (parseInt(value) || null) : null
  // For yearly: selected full date string
  const selectedDateStr = cycle === 'yearly' && value && String(value).includes('-') ? String(value) : null

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }

  const pickDay = (d) => {
    if (cycle === 'monthly') {
      onChange(d) // store as integer
    } else {
      const mm = String(viewMonth + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      onChange(`${viewYear}-${mm}-${dd}`)
    }
    setOpen(false)
  }

  // Display label
  let displayLabel = placeholder
  if (cycle === 'monthly' && selectedDayInt) {
    displayLabel = `${getOrdinal(selectedDayInt)} of every month`
  } else if (cycle === 'yearly' && selectedDateStr) {
    displayLabel = new Date(selectedDateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const hasValue = cycle === 'monthly' ? !!selectedDayInt : !!selectedDateStr

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={handleOpen} style={{
        width: '100%', padding: '12px 14px', background: 'var(--surface2)',
        border: `1.5px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--r)', fontSize: 15, color: hasValue ? 'var(--text)' : 'var(--text3)',
        outline: 'none', transition: 'border-color 0.15s', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} color={hasValue ? 'var(--accent)' : 'var(--text3)'} />
          {displayLabel}
        </span>
        <ChevronDown size={14} color="var(--text3)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          padding: '14px', minWidth: 280,
        }}>
          {/* Helper text */}
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {cycle === 'monthly' ? 'Pick day of month (repeats monthly)' : 'Pick exact due date'}
          </p>

          {/* Month/Year nav — always show for yearly; for monthly just for browsing context */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={{ width:30, height:30, borderRadius:8, background:'var(--surface2)', border:'1.5px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'var(--text)' }}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{ width:30, height:30, borderRadius:8, background:'var(--surface2)', border:'1.5px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'var(--text)' }}>›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e'+i} />)}
            {Array.from({ length: daysInMon }, (_, i) => i + 1).map(d => {
              const mm = String(viewMonth + 1).padStart(2, '0')
              const dd = String(d).padStart(2, '0')
              const dateStr = `${viewYear}-${mm}-${dd}`

              const isSelected = cycle === 'monthly'
                ? selectedDayInt === d
                : selectedDateStr === dateStr
              const isToday = todayStr === dateStr && cycle === 'yearly'

              return (
                <button key={d} type="button" onClick={() => pickDay(d)} style={{
                  padding: '7px 0', borderRadius: 8, fontSize: 13,
                  fontWeight: isSelected || isToday ? 700 : 500,
                  background: isSelected ? 'var(--accent)' : isToday ? 'var(--accent-bg)' : 'transparent',
                  border: `1.5px solid ${isSelected ? 'var(--accent)' : isToday ? 'var(--accent)' : 'transparent'}`,
                  color: isSelected ? '#fff' : isToday ? 'var(--accent)' : 'var(--text)',
                  cursor: 'pointer', transition: 'all 0.1s', textAlign: 'center',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'var(--accent-bg)' : 'transparent' }}
                >{d}</button>
              )
            })}
          </div>

          {hasValue && (
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
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





export default function Bills() {
  const { bills } = useApp()
  const [billPresets, setBillPresets] = useState(getBillPresets())
  const [show,   setShow]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form,   setForm]   = useState(blank)
  const [saving, setSaving] = useState(false)
  const [usePreset, setUsePreset] = useState(true)

  const [amountHidden, setAmountHidden] = useState(() => {
    try { const s = localStorage.getItem('billsAmountHidden'); return s === null ? false : s === 'true' } catch { return false }
  })

  useEffect(() => {
    const unsub = subscribeBillPresets(setBillPresets)
    return unsub
  }, [])
  const toggleAmount = () => setAmountHidden(v => {
    const next = !v
    try { localStorage.setItem('billsAmountHidden', String(next)) } catch {}
    return next
  })
  const mask = (str) => amountHidden ? '••••••' : str

  const openAdd = () => { setEditId(null); setForm(blank); setUsePreset(true); setShow(true) }
  const openEdit = (b) => {
    setEditId(b.id)
    const isPreset = billPresets.some(p => p.name === b.name)
    setUsePreset(isPreset)
    setForm({
      name: b.name, icon: b.icon, color: b.color,
      amount: String(b.amount || ''), dueDay: String(b.dueDay || ''),
      cycle: b.cycle || 'monthly', notes: b.notes || '',
      customName: isPreset ? '' : b.name,
    })
    setShow(true)
  }
  const close = () => { setShow(false); setEditId(null) }

  const selectPreset = (p) => setForm(f => ({ ...f, name: p.name, icon: p.icon, color: p.color, customName: '' }))

  const save = async () => {
    const finalName = usePreset ? form.name : (form.customName.trim() || 'Bill')
    if (!finalName || !form.dueDay) return
    setSaving(true)
    try {
      const d = {
        name: finalName,
        icon: form.icon,
        color: form.color,
        amount: parseFloat(form.amount) || 0,
        dueDay: String(form.dueDay).includes("-") ? form.dueDay : (parseInt(form.dueDay) || 1),
        cycle: form.cycle,
        notes: form.notes.trim(),
      }
      editId ? await updateBill(editId, d) : await addBill(d)
      close()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  const remove = async (b) => {
    if (!confirm(`Delete "${b.name}" bill?`)) return
    await deleteBill(b.id)
  }

  const totalMonthly = bills.reduce((s, b) => {
    if (b.cycle === 'monthly') return s + (b.amount || 0)
    if (b.cycle === 'yearly')  return s + (b.amount || 0) / 12
    return s
  }, 0)

  const overdue  = bills.filter(b => getDueStatus(b.dueDay) < 0)
  const dueSoon  = bills.filter(b => { const d = getDueStatus(b.dueDay); return d >= 0 && d <= 7 })
  const upcoming = bills.filter(b => getDueStatus(b.dueDay) > 7)

  return (
    <div className="page" style={{ padding: '20px 16px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Bills</h1>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Track recurring due dates</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggleAmount} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 13px', borderRadius:999, background:'var(--surface2)', border:'1.5px solid var(--border)', cursor:'pointer', fontSize:13, fontWeight:600, color:'var(--text2)', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)' }}
          >
            {amountHidden ? <Eye size={14}/> : <EyeOff size={14}/>}
            <span>{amountHidden ? 'Show' : 'Hide'}</span>
          </button>
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:999, background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:700, boxShadow:'0 2px 8px rgba(124,58,237,0.35)', transition:'all 0.15s', border:'none', cursor:'pointer' }}
            onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform='none'}
          >
            <Plus size={14}/> Add Bill
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {bills.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          <SummaryCard label="Monthly" value={mask(fmt(totalMonthly))} color="var(--accent)" bg="var(--accent-bg)" />
          <SummaryCard label="Overdue" value={overdue.length} color="var(--danger)" bg="var(--danger-bg)" isCount />
          <SummaryCard label="Due Soon" value={dueSoon.length} color="var(--warn)" bg="var(--warn-bg)" isCount />
        </div>
      )}

      {/* Bills grouped by status */}
      {bills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
          <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No bills yet</p>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Add electricity, internet, rent and more</p>
        </div>
      ) : (
        <>
          <BillGroup title="Overdue" icon={<AlertTriangle size={13}/>} color="var(--danger)" bills={overdue} onEdit={openEdit} onDelete={remove} mask={mask} getDueStatus={getDueStatus} />
          <BillGroup title="Due within 7 days" icon={<Clock size={13}/>} color="var(--warn)" bills={dueSoon} onEdit={openEdit} onDelete={remove} mask={mask} getDueStatus={getDueStatus} />
          <BillGroup title="Upcoming" icon={<CheckCircle2 size={13}/>} color="var(--income)" bills={upcoming} onEdit={openEdit} onDelete={remove} mask={mask} getDueStatus={getDueStatus} />
        </>
      )}

      {/* Modal */}
      {show && createPortal(
        <div onClick={e => e.target === e.currentTarget && close()}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}
        >
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'92dvh', overflowY:'auto' }}
          >
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>{editId ? 'Edit Bill' : 'New Bill'}</h2>
              <button onClick={close} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)"/>
              </button>
            </div>

            {/* Preset picker */}
            <F label="Bill Type">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom: usePreset ? 0 : 12 }}>
                {billPresets.map(p => (
                  <button key={p.name} onClick={() => { setUsePreset(true); selectPreset(p) }}
                    style={{ padding:'10px 6px', borderRadius:'var(--r)', display:'flex', flexDirection:'column', alignItems:'center', gap:4, fontSize:12, fontWeight:600, background: (usePreset && form.name===p.name) ? p.color+'18' : 'var(--surface2)', border:`1.5px solid ${(usePreset && form.name===p.name) ? p.color+'80' : 'var(--border)'}`, color:(usePreset && form.name===p.name) ? p.color : 'var(--text2)', transition:'all 0.15s', cursor:'pointer' }}
                  >
                    <span style={{ fontSize:20 }}>{p.icon}</span>
                    {p.name}
                  </button>
                ))}
              </div>
            </F>

            <F label="Custom Name (optional)">
              <input
                value={usePreset ? '' : form.customName}
                onChange={e => { setUsePreset(false); setForm(f=>({...f, customName:e.target.value, name:e.target.value, icon:'📋', color:'#6b7280'})) }}
                placeholder="e.g. Dialog Broadband"
                style={inp}
              />
            </F>

            <F label="Amount (Rs.)">
              <input type="number" inputMode="decimal" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0" style={inp}/>
            </F>

            <F label="Due Date">
              <DueDatePicker value={form.dueDay} onChange={v => setForm(f=>({...f, dueDay:v}))} cycle={form.cycle} placeholder="Select due date" />
            </F>

            <F label="Cycle">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {['monthly','yearly'].map(c => (
                  <button key={c} onClick={()=>setForm(f=>({...f,cycle:c,dueDay:''}))}
                    style={{ padding:'11px', borderRadius:'var(--r)', fontSize:13, fontWeight:600, background:form.cycle===c?'var(--accent-bg)':'var(--surface2)', border:`1.5px solid ${form.cycle===c?'var(--accent)':'var(--border)'}`, color:form.cycle===c?'var(--accent-fg)':'var(--text2)', transition:'all 0.15s', cursor:'pointer' }}
                  >{c.charAt(0).toUpperCase()+c.slice(1)}</button>
                ))}
              </div>
            </F>

            <F label="Notes (optional)">
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Account #12345" style={inp}/>
            </F>

            <button onClick={save} disabled={(!form.name&&!form.customName)||!form.dueDay||saving}
              style={{ width:'100%', padding:14, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700, background:'var(--accent)', color:'#fff', opacity:((!form.name&&!form.customName)||!form.dueDay||saving)?0.4:1, marginTop:4, transition:'opacity 0.15s', cursor:'pointer', border:'none' }}
            >
              {saving ? 'Saving…' : editId ? 'Update Bill' : 'Add Bill'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function BillGroup({ title, icon, color, bills, onEdit, onDelete, mask, getDueStatus }) {
  if (!bills.length) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:10 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{title}</span>
        <span style={{ fontSize:11, fontWeight:700, color, background:color+'18', borderRadius:999, padding:'1px 7px', marginLeft:2 }}>{bills.length}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {bills.map(b => <BillCard key={b.id} bill={b} onEdit={onEdit} onDelete={onDelete} mask={mask} getDueStatus={getDueStatus} />)}
      </div>
    </div>
  )
}

function BillCard({ bill, onEdit, onDelete, mask, getDueStatus }) {
  const diff = getDueStatus(bill.dueDay)
  const isOverdue = diff < 0
  const isDueSoon = diff >= 0 && diff <= 7

  const statusColor = isOverdue ? 'var(--danger)' : isDueSoon ? 'var(--warn)' : 'var(--income)'
  const statusBg    = isOverdue ? 'var(--danger-bg)' : isDueSoon ? 'var(--warn-bg)' : 'var(--income-bg)'

  const dueLabel = isOverdue
    ? `${Math.abs(diff)}d overdue`
    : diff === 0 ? 'Due today'
    : `Due in ${diff}d`

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--surface)', border:`1.5px solid ${isOverdue ? 'var(--danger)33' : isDueSoon ? 'var(--warn)33' : 'var(--border)'}`, borderRadius:'var(--r-lg)', padding:'13px 14px', boxShadow:'var(--shadow)', transition:'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-md)'; e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow='var(--shadow)'; e.currentTarget.style.transform='none' }}
    >
      <div style={{ width:44, height:44, borderRadius:13, background:bill.color+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, border:`1px solid ${bill.color}25` }}>
        {bill.icon}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bill.name}</p>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>
            Every {bill.cycle} · {formatDueLabel(bill.dueDay)}
          </span>
          {bill.notes && <span style={{ fontSize:11, color:'var(--text3)' }}>· {bill.notes}</span>}
        </div>
      </div>

      <div style={{ textAlign:'right', flexShrink:0 }}>
        <p style={{ fontFamily:'var(--mono)', fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:4 }}>
          {bill.amount ? mask(fmt(bill.amount)) : <span style={{ color:'var(--text3)', fontWeight:500, fontSize:13 }}>No amount</span>}
        </p>
        <span style={{ fontSize:11, fontWeight:700, color:statusColor, background:statusBg, borderRadius:999, padding:'2px 8px' }}>
          {dueLabel}
        </span>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:7 }}>
          <button onClick={() => onEdit(bill)} style={{ display:'flex', opacity:0.45, transition:'opacity 0.15s', background:'none', border:'none', cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
          ><Pencil size={13} color="var(--text2)"/></button>
          <button onClick={() => onDelete(bill)} style={{ display:'flex', opacity:0.45, transition:'opacity 0.15s', background:'none', border:'none', cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
          ><Trash2 size={13} color="var(--danger)"/></button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, bg, isCount }) {
  return (
    <div style={{ background: bg, borderRadius:'var(--r-lg)', padding:'12px 10px', textAlign:'center', border:`1px solid ${color}22` }}>
      <p style={{ fontFamily: isCount ? 'var(--font)' : 'var(--mono)', fontSize: isCount ? 22 : 14, fontWeight:800, color }}>{value}</p>
      <p style={{ fontSize:10, color:'var(--text3)', marginTop:3, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</p>
    </div>
  )
}

const inp = { width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', transition:'border-color 0.15s' }
const F = ({label, children}) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
    {children}
  </div>
)