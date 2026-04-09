import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { addTransaction, updateTransaction } from '../services/db'
import { todayStr } from '../utils/helpers'

const TYPES = [
  { id:'expense',  label:'Expense',  Icon:ArrowUpRight,   color:'#e11d48' },
  { id:'income',   label:'Income',   Icon:ArrowDownLeft,  color:'#059669' },
  { id:'transfer', label:'Transfer', Icon:ArrowLeftRight, color:'#7c3aed' },
]

export default function AddModal({ onClose, prefill, editMode, editTx }) {
  const { accounts, quickExpenses, expenseCategories, incomeCategories } = useApp()

  const [type,    setType]    = useState(prefill?.type || 'expense')
  const [amount,  setAmount]  = useState(prefill?.amount?.toString() || '')
  const [desc,    setDesc]    = useState(prefill?.description || '')
  const [cat,     setCat]     = useState(prefill?.category || '')
  const [accId,   setAccId]   = useState(prefill?.accountId || '')
  const [toAccId, setToAccId] = useState(prefill?.toAccountId || '')
  const [date,    setDate]    = useState(prefill?.date || todayStr())
  const [saving,  setSaving]  = useState(false)
  const amtRef      = useRef()
  const initialised = useRef(false)

  const categories = type === 'income' ? incomeCategories : expenseCategories

  // Set default account once
  useEffect(() => {
    if (initialised.current || !accounts.length) return
    initialised.current = true
    if (!accId)   setAccId(accounts[0].id)
    if (!toAccId) setToAccId(accounts[1]?.id || accounts[0].id)
    setTimeout(() => amtRef.current?.focus(), 120)
  }, [accounts])

  // Set default category when type changes (not on first render if prefill provided)
  const prevType = useRef(type)
  useEffect(() => {
    if (prevType.current === type) return
    prevType.current = type
    if (type !== 'transfer') {
      const cats = type === 'income' ? incomeCategories : expenseCategories
      if (!cats.find(c => c.name === cat)) setCat(cats[0]?.name || '')
    }
  }, [type, expenseCategories, incomeCategories])

  // Ensure cat is set when categories load
  useEffect(() => {
    if (!cat && categories.length) setCat(categories[0].name)
  }, [categories])

  const submit = async () => {
    if (!amount || !desc || !accId) return
    setSaving(true)
    try {
      const data = {
        type, amount:parseFloat(amount),
        description:desc.trim(),
        category: type !== 'transfer' ? cat : 'Transfer',
        accountId:accId, date,
        ...(type === 'transfer' ? { toAccountId:toAccId } : {}),
      }
      editMode && editTx ? await updateTransaction(editTx, data) : await addTransaction(data)
      onClose()
    } catch(e) { console.error(e); setSaving(false) }
  }

  const activeType = TYPES.find(t => t.id === type)

  const modal = (
    <div
      onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'8px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'94dvh', overflowY:'auto' }}
      >
        {/* Drag pill */}
        <div style={{ display:'flex', justifyContent:'center', paddingTop:10, paddingBottom:6 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
        </div>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{editMode ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button
            onClick={onClose}
            style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}
          >
            <X size={16} color="var(--text2)" />
          </button>
        </div>

        {/* Type tabs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:22 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} style={{
              padding:'10px 6px', borderRadius:'var(--r)', fontSize:13, fontWeight:600,
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              background: type===t.id ? t.color+'15' : 'var(--surface2)',
              border:`1.5px solid ${type===t.id ? t.color+'60' : 'var(--border)'}`,
              color: type===t.id ? t.color : 'var(--text)', transition:'all 0.15s',
            }}>
              <t.Icon size={14}/>{t.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom:16 }}>
          <Label>Amount (Rs.)</Label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:17, fontWeight:700, color:'var(--text3)' }}>Rs.</span>
            <input ref={amtRef} type="number" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"
              style={{ ...inp, paddingLeft:46, fontSize:26, fontWeight:800, letterSpacing:'-0.5px', color:activeType?.color }} />
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom:16 }}>
          <Label>Description</Label>
          <input type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What was this for?" style={inp} />
        </div>

        {/* Quick suggestions */}
        {!editMode && type==='expense' && quickExpenses.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <Label>Quick add</Label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {quickExpenses.slice(0,8).map(q => (
                <button key={q.id}
                  onClick={() => { setDesc(q.description); setAmount(q.amount.toString()); setCat(q.category||'Misc'); if(q.accountId) setAccId(q.accountId) }}
                  style={{ padding:'5px 12px', borderRadius:999, background:'var(--surface2)', border:'1px solid var(--border)', fontSize:12, color:'var(--text)', fontWeight:500, transition:'all 0.12s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)'}}
                >
                  {q.description} · Rs.{Math.round(q.amount).toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category */}
        {type !== 'transfer' && (
          <div style={{ marginBottom:16 }}>
            <Label>{type==='income' ? 'Income source' : 'Category'}</Label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {categories.map(c => (
                <button key={c.name} onClick={() => setCat(c.name)} style={{
                  padding:'6px 13px', borderRadius:999, fontSize:13,
                  background: cat===c.name ? c.color+'18' : 'var(--surface2)',
                  border:`1.5px solid ${cat===c.name ? c.color+'70' : 'var(--border)'}`,
                  color: cat===c.name ? c.color : 'var(--text)',
                  fontWeight: cat===c.name ? 600 : 400, transition:'all 0.12s',
                }}>{c.icon} {c.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Account */}
        <div style={{ marginBottom:16 }}>
          <Label>{type==='transfer' ? 'From account' : 'Account'}</Label>
          <Sel value={accId} onChange={setAccId} options={accounts.map(a=>({v:a.id,l:a.name}))} />
        </div>
        {type==='transfer' && (
          <div style={{ marginBottom:16 }}>
            <Label>To account</Label>
            <Sel value={toAccId} onChange={setToAccId} options={accounts.filter(a=>a.id!==accId).map(a=>({v:a.id,l:a.name}))} />
          </div>
        )}

        {/* Date */}
        <div style={{ marginBottom:24 }}>
          <Label>Date</Label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} />
        </div>

        <button onClick={submit} disabled={!amount||!desc||saving} style={{
          width:'100%', padding:16, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700,
          background:activeType?.color||'var(--accent)', color:'#fff',
          opacity:(!amount||!desc||saving)?0.4:1, transition:'all 0.15s',
        }}>
          {saving ? 'Saving…' : editMode ? 'Save Changes' : `Add ${activeType?.label||type}`}
        </button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

const inp = { width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', transition:'border-color 0.15s' }
const Label = ({children}) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>{children}</label>
const Sel = ({value,onChange,options}) => (
  <select value={value} onChange={e=>onChange(e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
    {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
)
