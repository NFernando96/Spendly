import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Pencil, X, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { fmt } from '../utils/helpers'
import { addAccount, updateAccount, deleteAccount } from '../services/db'

const TYPES = [
  { v:'cash',   l:'Cash',        icon:'💵', color:'#059669' },
  { v:'bank',   l:'Bank',        icon:'🏦', color:'#0284c7' },
  { v:'credit', l:'Credit Card', icon:'💳', color:'#e11d48' },
]

const blank = { name:'', type:'cash', balance:'', minPayment:'', creditLimit:'', paymentDueDate:'' }

export default function Accounts() {
  const { accounts } = useApp()
  const [show,   setShow]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form,   setForm]   = useState(blank)
  const [saving, setSaving] = useState(false)

  // Local hide/show state — independent of the Dashboard toggle
  const [balanceHidden, setBalanceHidden] = useState(() => {
    try {
      const stored = localStorage.getItem('accountsBalanceHidden')
      return stored === null ? false : stored === 'true'
    } catch { return false }
  })

  const toggleBalance = () => {
    setBalanceHidden(v => {
      const next = !v
      try { localStorage.setItem('accountsBalanceHidden', String(next)) } catch {}
      return next
    })
  }

  const mask = (str) => balanceHidden ? '••••••' : str

  const cash   = accounts.filter(a=>a.type==='cash').reduce((s,a)=>s+(a.balance||0),0)
  const bank   = accounts.filter(a=>a.type==='bank').reduce((s,a)=>s+(a.balance||0),0)
  const credit = accounts.filter(a=>a.type==='credit').reduce((s,a)=>s+(a.balance||0),0)
  const net    = cash + bank - credit

  const openAdd  = () => { setEditId(null); setForm(blank); setShow(true) }
  const openEdit = (a) => {
    setEditId(a.id)
    setForm({
      name: a.name, type: a.type,
      balance: String(a.balance||0),
      minPayment: String(a.minPayment||''),
      creditLimit: String(a.creditLimit||''),
      paymentDueDate: a.paymentDueDate || '',
    })
    setShow(true)
  }
  const close = () => { setShow(false); setEditId(null) }

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const d = {
        name: form.name.trim(), type: form.type, balance: parseFloat(form.balance)||0,
        ...(form.type === 'credit' ? {
          minPayment: parseFloat(form.minPayment)||0,
          creditLimit: parseFloat(form.creditLimit)||0,
          paymentDueDate: form.paymentDueDate || null,
        } : {}),
      }
      editId ? await updateAccount(editId, d) : await addAccount(d)
      close()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  const remove = async (a) => {
    if (!confirm(`Delete "${a.name}"? This won't reverse past transactions.`)) return
    await deleteAccount(a.id)
  }

  return (
    <div className="page" style={{ padding:'20px 16px 0' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.5px' }}>Accounts</h1>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button
            onClick={toggleBalance}
            style={{
              display:'flex', alignItems:'center', gap:5, padding:'8px 13px', borderRadius:999,
              background:'var(--surface2)', border:'1.5px solid var(--border)',
              cursor:'pointer', transition:'all 0.15s', fontSize:13, fontWeight:600, color:'var(--text2)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)' }}
          >
            {balanceHidden
              ? <Eye size={14} />
              : <EyeOff size={14} />}
            <span>{balanceHidden ? 'Show' : 'Hide'}</span>
          </button>
          <button onClick={openAdd} style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:999,
            background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:700,
            boxShadow:'0 2px 8px rgba(124,58,237,0.35)', transition:'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform='none'}
          >
            <Plus size={14}/> Add Account
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
        {[
          {l:'Cash',icon:'💵',v:cash,c:'#059669'},
          {l:'Bank',icon:'🏦',v:bank,c:'#0284c7'},
          {l:'Credit',icon:'💳',v:credit,c:'#e11d48',danger:true},
        ].map(s => (
          <div key={s.l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'13px 10px', textAlign:'center', boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:20, marginBottom:5 }}>{s.icon}</div>
            <p style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:s.danger&&s.v>0?'var(--danger)':'var(--text)' }}>{mask(fmt(s.v))}</p>
            <p style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Net worth */}
      <div style={{
        background: net >= 0 ? 'var(--income-bg)' : 'var(--danger-bg)',
        border:`1px solid ${net >= 0 ? 'var(--income)' : 'var(--danger)'}33`,
        borderRadius:'var(--r-lg)', padding:'12px 16px',
        display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20,
      }}>
        <p style={{ fontSize:13, fontWeight:600, color: net >= 0 ? 'var(--income-fg)' : 'var(--danger-fg)' }}>Net worth</p>
        <p style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:800, color: net >= 0 ? 'var(--income)' : 'var(--danger)' }}>{mask(fmt(net))}</p>
      </div>

      {/* Accounts list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {accounts.map(a => {
          const ti = TYPES.find(t=>t.v===a.type)||TYPES[0]
          const utilPct = a.type==='credit' && a.creditLimit>0
            ? Math.min(100, Math.round(((a.balance||0)/a.creditLimit)*100)) : null
          const utilColor = utilPct >= 90 ? 'var(--danger)' : utilPct >= 60 ? 'var(--warn)' : 'var(--income)'
          const isDebt = a.type==='credit' && (a.balance||0) > 0
          return (
            <div key={a.id} style={{
              display:'flex', alignItems:'center', gap:12,
              background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'var(--r-lg)', padding:'13px 14px',
              boxShadow:'var(--shadow)', transition:'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-md)'; e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='var(--shadow)'; e.currentTarget.style.transform='none' }}
            >
              <div style={{ width:42, height:42, borderRadius:12, background:ti.color+'15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{ti.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{a.name}</p>
                <p style={{ fontSize:12, color:'var(--text2)' }}>{ti.l}</p>
                {utilPct !== null && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:10, color:'var(--text3)' }}>Utilization</span>
                      <span style={{ fontSize:10, fontWeight:700, color:utilColor, fontFamily:'var(--mono)' }}>{utilPct}%</span>
                    </div>
                    <div style={{ height:3, borderRadius:999, background:'var(--surface3)' }}>
                      <div style={{ height:'100%', width:`${utilPct}%`, background:utilColor, borderRadius:999, transition:'width 0.4s' }} />
                    </div>
                  </div>
                )}
                {a.type==='credit' && a.paymentDueDate && (
                  <p style={{ fontSize:10, color:'var(--warn)', marginTop:4 }}>
                    Due: <strong>{fmtShortDate(a.paymentDueDate)}</strong>
                  </p>
                )}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <p style={{ fontFamily:'var(--mono)', fontSize:17, fontWeight:800, color:isDebt?'var(--danger)':'var(--text)' }}>{mask(fmt(a.balance||0))}</p>
                {a.type==='credit' && (a.minPayment||0)>0 && (
                  <p style={{ fontSize:10, color:'var(--warn)', marginTop:1, fontFamily:'var(--mono)' }}>Min: {mask(fmt(a.minPayment))}</p>
                )}
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:6 }}>
                  <button onClick={() => openEdit(a)} style={{ display:'flex', opacity:0.45, transition:'opacity 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
                  ><Pencil size={13} color="var(--text2)" /></button>
                  <button onClick={() => remove(a)} style={{ display:'flex', opacity:0.45, transition:'opacity 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
                  ><Trash2 size={13} color="var(--danger)" /></button>
                </div>
              </div>
            </div>
          )
        })}
        {accounts.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 0' }}>
            <p style={{ fontSize:32, marginBottom:10 }}>🏦</p>
            <p style={{ color:'var(--text3)', fontSize:14 }}>No accounts yet</p>
          </div>
        )}
      </div>

      {/* ── Modal via portal so close button always works ── */}
      {show && createPortal(
        <div
          onClick={e => e.target===e.currentTarget && close()}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'90dvh', overflowY:'auto' }}
          >
            {/* Pill */}
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{editId ? 'Edit Account' : 'New Account'}</h2>
              <button
                onClick={close}
                style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}
              >
                <X size={16} color="var(--text2)" />
              </button>
            </div>

            <F label="Account Name">
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. NDB Savings" style={inp} />
            </F>
            <F label="Type">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {TYPES.map(t => (
                  <button key={t.v} onClick={() => setForm(f=>({...f,type:t.v}))} style={{
                    padding:'11px 4px', borderRadius:'var(--r)', fontSize:13, fontWeight:600,
                    background: form.type===t.v ? t.color+'15' : 'var(--surface2)',
                    border:`1.5px solid ${form.type===t.v ? t.color+'70' : 'var(--border)'}`,
                    color: form.type===t.v ? t.color : 'var(--text2)', transition:'all 0.15s',
                  }}>
                    <div style={{ fontSize:18, marginBottom:3 }}>{t.icon}</div>{t.l}
                  </button>
                ))}
              </div>
            </F>
            <F label="Starting Balance (Rs.)">
              <input type="number" inputMode="decimal" value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))} placeholder="0" style={inp} />
            </F>
            {form.type === 'credit' && (
              <>
                <F label="Credit Limit (Rs.)">
                  <input type="number" inputMode="decimal" value={form.creditLimit} onChange={e=>setForm(f=>({...f,creditLimit:e.target.value}))} placeholder="0" style={inp} />
                </F>
                <F label="Minimum Payment Due (Rs.)">
                  <input type="number" inputMode="decimal" value={form.minPayment} onChange={e=>setForm(f=>({...f,minPayment:e.target.value}))} placeholder="0" style={inp} />
                </F>
                <F label="Payment Due Date">
                  <input type="date" value={form.paymentDueDate} onChange={e=>setForm(f=>({...f,paymentDueDate:e.target.value}))} style={inp} />
                </F>
              </>
            )}
            <button
              onClick={save} disabled={!form.name||saving}
              style={{ width:'100%', padding:14, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700, background:'var(--accent)', color:'#fff', opacity:!form.name||saving?0.4:1, marginTop:4, transition:'opacity 0.15s' }}
            >
              {saving ? 'Saving…' : editId ? 'Update Account' : 'Create Account'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function fmtShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

const inp = { width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', transition:'border-color 0.15s' }
const F = ({label,children}) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
    {children}
  </div>
)
