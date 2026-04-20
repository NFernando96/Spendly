import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, X, RefreshCw, Zap, Sun, Moon, Monitor, Tag, ChevronDown, ChevronUp, Pencil, Download } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { fmt } from '../utils/helpers'
import { addRecurring, updateRecurring, deleteRecurring, addCustomCategory, deleteCustomCategory,
         BUILTIN_EXPENSE_CATEGORIES, BUILTIN_INCOME_CATEGORIES,
         addCustomBillPreset, deleteCustomBillPreset, subscribeBillPresets,
         addCustomLoanType, deleteCustomLoanType, subscribeLoanTypes,
         addCustomRecurringCategory, deleteCustomRecurringCategory,
         BUILTIN_BILL_PRESETS, BUILTIN_LOAN_TYPES } from '../services/db'
import { collection, getDocs } from 'firebase/firestore'
import { db, auth } from '../services/firebase'

const BLANK_RECURRING = { description:'', amount:'', category:'Bills', cycle:'month' }
const EMOJI_POOL = ['🏷️','🎯','⚡','🔑','🌟','🎪','🎸','🍕','🚀','🌈','💎','🎭','🏆','🌺','🔥','💡','🎁','🌙','🎨','🛡️']
const CAT_COLORS = ['#10b981','#3b82f6','#f59e0b','#ec4899','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#a855f7','#6b7280','#14b8a6','#e879f9','#fb923c','#4ade80']

export default function Settings() {
  const { recurring, quickExpenses, theme, setTheme, expenseCategories, incomeCategories, recurringCategories } = useApp()

  const [showRecurring, setShowRecurring] = useState(false)
  const [recurringForm, setRecurringForm] = useState(BLANK_RECURRING)
  const [savingR, setSavingR] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState(null) // holds the recurring item being edited

  const [showCat, setShowCat] = useState(false)
  const [catForm, setCatForm] = useState({ name:'', icon:'🏷️', color:'#10b981', type:'expense' })
  const [savingC, setSavingC] = useState(false)

  const [catSection, setCatSection] = useState('expense') // 'expense' | 'income'
  const [catExpanded, setCatExpanded] = useState(false)

  // Bills presets state
  const [billPresets, setBillPresets] = useState([])
  const [showBillCat, setShowBillCat] = useState(false)
  const [billCatForm, setBillCatForm] = useState({ name:'', icon:'📋', color:'#6b7280' })
  const [savingBC, setSavingBC] = useState(false)
  const [billCatExpanded, setBillCatExpanded] = useState(false)

  // Loan types state
  const [loanTypes, setLoanTypes] = useState([])
  const [showLoanCat, setShowLoanCat] = useState(false)
  const [loanCatForm, setLoanCatForm] = useState({ name:'', icon:'🏦', color:'#6b7280' })
  const [savingLC, setSavingLC] = useState(false)
  const [loanCatExpanded, setLoanCatExpanded] = useState(false)

  const [showRecurringCat, setShowRecurringCat]   = useState(false)
  const [recurringCatForm, setRecurringCatForm]   = useState({ name:'', icon:'🔄', color:'#06b6d4' })
  const [savingRC, setSavingRC]                   = useState(false)

  useEffect(() => {
    const unsub1 = subscribeBillPresets(setBillPresets)
    const unsub2 = subscribeLoanTypes(setLoanTypes)
    return () => { unsub1(); unsub2() }
  }, [])

  const cycles = ['day','week','month','year']

  const [backingUp, setBackingUp]   = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [restoring, setRestoring]   = useState(false)
  const [restoreMsg, setRestoreMsg] = useState('')

  const COLS = ['accounts','transactions','bills','loans','loanPayments','recurring','quickExpenses','customExpenseCategories','customIncomeCategories','customBillPresets','customLoanTypes']

  const downloadBackup = async () => {
    setBackingUp(true)
    try {
      const uid = auth.currentUser.uid
      const backup = { exportedAt: new Date().toISOString(), version: 1, uid, collections: {} }
      await Promise.all(COLS.map(async (col) => {
        const snap = await getDocs(collection(db, 'users', uid, col))
        backup.collections[col] = snap.docs.map(d => d.data())
      }))
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `spendly-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBackupDone(true)
      setTimeout(() => setBackupDone(false), 3000)
    } catch(e) { console.error(e) }
    setBackingUp(false)
  }

  const restoreBackup = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('⚠️ This will OVERWRITE all your current data with the backup file. This cannot be undone. Continue?')) {
      e.target.value = ''
      return
    }
    setRestoring(true)
    setRestoreMsg('')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.collections) throw new Error('Invalid backup file')
      const uid = auth.currentUser.uid
      const { setDoc: sd, doc: dc, deleteDoc: dd } = await import('firebase/firestore')
      for (const colName of COLS) {
        const items = data.collections[colName]
        if (!items) continue
        // Delete existing
        const existing = await getDocs(collection(db, 'users', uid, colName))
        await Promise.all(existing.docs.map(d => dd(d.ref)))
        // Write backup items
        await Promise.all(items.filter(item => item.id).map(item =>
          sd(dc(db, 'users', uid, colName, item.id), item)
        ))
      }
      setRestoreMsg('✅ Data restored! Refreshing…')
      setTimeout(() => window.location.reload(), 2000)
    } catch(e) {
      console.error(e)
      setRestoreMsg('❌ Restore failed. Make sure the file is a valid Spendly backup.')
    }
    setRestoring(false)
    e.target.value = ''
  }

  const saveRecurring = async () => {
    if (!recurringForm.description || !recurringForm.amount) return
    setSavingR(true)
    try {
      if (editingRecurring) {
        await updateRecurring(editingRecurring.id, { ...recurringForm, amount: parseFloat(recurringForm.amount) })
        setEditingRecurring(null)
      } else {
        await addRecurring({ ...recurringForm, amount: parseFloat(recurringForm.amount) })
      }
      setShowRecurring(false)
      setRecurringForm(BLANK_RECURRING)
    }
    catch(e){console.error(e)}
    setSavingR(false)
  }

  const startEditRecurring = (r) => {
    setEditingRecurring(r)
    setRecurringForm({ description: r.description, amount: String(r.amount), category: r.category, cycle: r.cycle })
    setShowRecurring(true)
  }

  const saveCat = async () => {
    if (!catForm.name.trim()) return
    setSavingC(true)
    try { await addCustomCategory(catForm.type, { name:catForm.name.trim(), icon:catForm.icon, color:catForm.color }); setShowCat(false); setCatForm({ name:'', icon:'🏷️', color:'#10b981', type:'expense' }) }
    catch(e){console.error(e)}
    setSavingC(false)
  }

  const saveBillCat = async () => {
    if (!billCatForm.name.trim()) return
    setSavingBC(true)
    try { await addCustomBillPreset({ name:billCatForm.name.trim(), icon:billCatForm.icon, color:billCatForm.color }); setShowBillCat(false); setBillCatForm({ name:'', icon:'📋', color:'#6b7280' }) }
    catch(e){console.error(e)}
    setSavingBC(false)
  }

  const saveLoanCat = async () => {
    if (!loanCatForm.name.trim()) return
    setSavingLC(true)
    try { await addCustomLoanType({ name:loanCatForm.name.trim(), icon:loanCatForm.icon, color:loanCatForm.color }); setShowLoanCat(false); setLoanCatForm({ name:'', icon:'🏦', color:'#6b7280' }) }
    catch(e){console.error(e)}
    setSavingLC(false)
  }

  const saveRecurringCat = async () => {
    if (!recurringCatForm.name.trim()) return
    setSavingRC(true)
    try { await addCustomRecurringCategory({ name:recurringCatForm.name.trim(), icon:recurringCatForm.icon, color:recurringCatForm.color }); setShowRecurringCat(false); setRecurringCatForm({ name:'', icon:'🔄', color:'#06b6d4' }) }
    catch(e){console.error(e)}
    setSavingRC(false)
  }

  // Separate builtins from custom
  const customExpense = expenseCategories.filter(c => c.custom)
  const customIncome  = incomeCategories.filter(c => c.custom)
  const displayCats   = catSection === 'expense' ? expenseCategories : incomeCategories
  const customList    = catSection === 'expense' ? customExpense : customIncome

  return (
    <div className="page" style={{ padding:'20px 16px 0' }}>
      <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.5px', marginBottom:24, color:'var(--text)' }}>Settings</h1>

      {/* ── Appearance ── */}
      <SectionHead icon={<Sun size={15} color="var(--warn)" />} iconBg="var(--warn-bg)" title="Appearance" />
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:28, boxShadow:'var(--shadow)' }}>
        <SettingRow label="Color theme" sub="Choose how Spendly looks">
          <div style={{ display:'flex', gap:6 }}>
            {[
              { v:'light', icon:<Sun size={13}/>, label:'Light' },
              { v:'dark',  icon:<Moon size={13}/>, label:'Dark' },
              { v:'system',icon:<Monitor size={13}/>, label:'Auto' },
            ].map(opt => (
              <button key={opt.v} onClick={() => setTheme(opt.v)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'6px 12px', borderRadius:999, fontSize:12, fontWeight:600,
                background: theme===opt.v ? 'var(--accent)' : 'var(--surface2)',
                border:`1.5px solid ${theme===opt.v ? 'var(--accent)' : 'var(--border)'}`,
                color: theme===opt.v ? '#fff' : 'var(--text)', transition:'all 0.15s',
              }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>
      </div>

      {/* ── Categories (4-tab unified section) ── */}
      {(() => {
        // Tab config
        const tabs = [
          { key:'expense',   label:'Expenses',   icon:'💸' },
          { key:'income',    label:'Income',     icon:'💰' },
          { key:'bills',     label:'Bills',      icon:'💡' },
          { key:'loans',     label:'Loans',      icon:'🏦' },
          { key:'recurring', label:'Recurring',  icon:'🔄' },
        ]
        const isExpInc   = catSection === 'expense' || catSection === 'income'
        const isBill     = catSection === 'bills'
        const isLoan     = catSection === 'loans'
        const isRecurring = catSection === 'recurring'

        const displayList  = isExpInc    ? (catSection === 'expense' ? expenseCategories : incomeCategories)
                           : isBill     ? billPresets
                           : isLoan     ? loanTypes
                           : recurringCategories
        const hasCustom    = isExpInc    ? displayList.filter(c=>c.custom).length === 0
                           : isBill     ? billPresets.filter(c=>c.custom).length === 0
                           : isLoan     ? loanTypes.filter(c=>c.custom).length === 0
                           : recurringCategories.filter(c=>c.custom).length === 0
        const noCustomLabel = isExpInc   ? `No custom ${catSection} categories yet.`
                           : isBill     ? 'No custom bill types yet.'
                           : isLoan     ? 'No custom loan types yet.'
                           : 'No custom recurring categories yet.'
        const onAdd = () => {
          if (isBill)      return setShowBillCat(true)
          if (isLoan)      return setShowLoanCat(true)
          if (isRecurring) return setShowRecurringCat(true)
          setCatForm(f => ({ ...f, type: catSection }))
          setShowCat(true)
        }
        const onDelete = (c) => {
          if (isBill)           deleteCustomBillPreset(c.name)
          else if (isLoan)      deleteCustomLoanType(c.name)
          else if (isRecurring) deleteCustomRecurringCategory(c.name)
          else                  deleteCustomCategory(catSection, c.name)
        }
        const expanded  = isBill ? billCatExpanded : isLoan ? loanCatExpanded : catExpanded
        const setExpand = isBill ? setBillCatExpanded : isLoan ? setLoanCatExpanded : setCatExpanded

        return (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <SectionHead icon={<Tag size={15} color="#8b5cf6" />} iconBg="#8b5cf615" title="Categories" />
              <button onClick={onAdd} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:999, background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:700 }}>
                <Plus size={13}/> Add
              </button>
            </div>
            <p style={{ fontSize:13, color:'var(--text2)', marginBottom:12 }}>
              {isBill ? 'Manage bill types shown in Bills page.' : isLoan ? 'Manage loan types shown in Loans page.' : 'Add custom transaction categories.'}
            </p>

            {/* 4 tabs */}
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => { setCatSection(t.key); setCatExpanded(false); setBillCatExpanded(false); setLoanCatExpanded(false) }} style={{
                  padding:'6px 14px', borderRadius:999, fontSize:13, fontWeight:600,
                  background: catSection===t.key ? 'var(--accent)' : 'var(--surface2)',
                  border:`1.5px solid ${catSection===t.key ? 'var(--accent)' : 'var(--border)'}`,
                  color: catSection===t.key ? '#fff' : 'var(--text)', transition:'all 0.15s',
                  display:'flex', alignItems:'center', gap:5,
                }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {/* Pills */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'14px', marginBottom:28, boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom: expanded ? 8 : 0 }}>
                {(expanded ? displayList : displayList.slice(0,8)).map(c => (
                  <div key={c.name} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:999, background:c.color+'15', border:`1.5px solid ${c.color}40` }}>
                    <span style={{ fontSize:14 }}>{c.icon}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:c.color }}>{c.name}</span>
                    {c.custom && (
                      <button onClick={() => onDelete(c)} style={{ display:'flex', marginLeft:2, opacity:0.6, transition:'opacity 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.6'}
                      >
                        <X size={11} color={c.color} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {displayList.length > 8 && (
                <button onClick={() => setExpand(v => !v)} style={{ marginTop:8, display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text2)', fontWeight:500 }}>
                  {expanded ? <><ChevronUp size={13}/> Show less</> : <><ChevronDown size={13}/> Show all ({displayList.length})</>}
                </button>
              )}
              {hasCustom && <p style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{noCustomLabel}</p>}
            </div>
          </>
        )
      })()}

      {/* placeholder to keep the old Loan Types header from being the next element – removed */}
      {/* ── Recurring ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <SectionHead icon={<RefreshCw size={15} color="var(--info)" />} iconBg="var(--info-bg)" title="Recurring Expenses" />
        <button onClick={() => setShowRecurring(true)} style={{
          display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:999,
          background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:700,
        }}>
          <Plus size={13}/> Add
        </button>
      </div>
      <p style={{ fontSize:13, color:'var(--text2)', marginBottom:14 }}>These show as reminders on your dashboard.</p>

      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:28 }}>
        {recurring.map(r => {
          const cat = recurringCategories.find(c=>c.name===r.category) || expenseCategories.find(c=>c.name===r.category)
          return (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'12px 14px', boxShadow:'var(--shadow)' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:(cat?.color||'#6b7280')+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                {cat?.icon||'📦'}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{r.description}</p>
                <p style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>Every {r.cycle} · {fmt(r.amount)}</p>
              </div>
              <button onClick={() => startEditRecurring(r)} style={{ opacity:0.4, transition:'opacity 0.15s', marginRight:4 }}
                onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.4'}
              >
                <Pencil size={14} color="var(--accent)" />
              </button>
              <button onClick={() => deleteRecurring(r.id)} style={{ opacity:0.4, transition:'opacity 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.4'}
              >
                <Trash2 size={14} color="var(--danger)" />
              </button>
            </div>
          )
        })}
        {recurring.length === 0 && <EmptyCard text="No recurring expenses set up" />}
      </div>

      {/* ── Data Backup ── */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:10 }}>
        <SectionHead icon={<Download size={15} color="#0284c7" />} iconBg="#0284c715" title="Data Backup" />
      </div>
      <p style={{ fontSize:13, color:'var(--text2)', marginBottom:14 }}>
        Your data is automatically backed up to Firestore every day when you open the app (last 7 days kept). You can also download a local copy or restore from a file.
      </p>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:28, boxShadow:'var(--shadow)' }}>

        {/* Download row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Download backup</p>
            <p style={{ fontSize:12, color:'var(--text2)' }}>Save a local .json copy of all your data</p>
          </div>
          <button
            onClick={downloadBackup}
            disabled={backingUp}
            style={{
              flexShrink:0, display:'flex', alignItems:'center', gap:7,
              padding:'9px 16px', borderRadius:'var(--r-lg)',
              background: backupDone ? '#10b981' : 'var(--accent)',
              color:'#fff', fontSize:13, fontWeight:700,
              border:'none', cursor: backingUp ? 'wait' : 'pointer',
              opacity: backingUp ? 0.7 : 1, transition:'all 0.2s',
            }}
          >
            {backingUp
              ? <><span style={{ width:13, height:13, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} /></>
              : backupDone ? '✓ Done!'
              : <><Download size={13}/> Download</>
            }
          </button>
        </div>

        {/* Restore row */}
        <div style={{ padding:'14px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div>
              <p style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Restore from file</p>
              <p style={{ fontSize:12, color:'var(--text2)' }}>Upload a .json backup to overwrite current data</p>
            </div>
            <label style={{
              flexShrink:0, display:'flex', alignItems:'center', gap:7,
              padding:'9px 16px', borderRadius:'var(--r-lg)',
              background: restoring ? 'var(--surface2)' : 'var(--danger-bg)',
              color: restoring ? 'var(--text2)' : 'var(--danger)',
              border:`1.5px solid ${restoring ? 'var(--border)' : 'var(--danger)'}`,
              fontSize:13, fontWeight:700, cursor: restoring ? 'wait' : 'pointer',
              transition:'all 0.2s',
            }}>
              <input type="file" accept=".json" onChange={restoreBackup} style={{ display:'none' }} disabled={restoring} />
              {restoring
                ? <><span style={{ width:13, height:13, border:'2px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} /> Restoring…</>
                : <>↑ Restore</>
              }
            </label>
          </div>
          {restoreMsg && (
            <p style={{ marginTop:10, fontSize:13, fontWeight:600, color: restoreMsg.startsWith('✅') ? '#10b981' : 'var(--danger)' }}>
              {restoreMsg}
            </p>
          )}
          <div style={{ marginTop:12, padding:'9px 12px', background:'var(--surface2)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
            <p style={{ fontSize:11, color:'var(--text3)', lineHeight:1.6 }}>
              ⚠️ <strong style={{ color:'var(--text2)' }}>Warning:</strong> Restoring will overwrite ALL current data. Auto-backup runs daily — check Firestore Console → <code>users/[uid]/autoBackups</code> for recent snapshots.
            </p>
          </div>
        </div>
      </div>

      {/* ── Frequent ── */}
      <SectionHead icon={<Zap size={15} color="var(--warn)" />} iconBg="var(--warn-bg)" title="Frequent Expenses" />
      <p style={{ fontSize:13, color:'var(--text2)', marginBottom:14 }}>Auto-tracked. Appear as quick-add on home screen.</p>
      <div style={{ display:'flex', flexDirection:'column', gap:6, paddingBottom:32 }}>
        {quickExpenses.slice(0,8).map(q => (
          <div key={q.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'var(--shadow)' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{q.description}</p>
              <p style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>Used {q.usageCount} time{q.usageCount!==1?'s':''}</p>
            </div>
            <span style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:'var(--text2)' }}>{fmt(q.amount)}</span>
          </div>
        ))}
        {quickExpenses.length === 0 && <EmptyCard text="Quick-add buttons appear after your first few transactions" />}
      </div>

      {/* ── Add Custom Category Modal ── */}
      {showCat && createPortal(
        <div onClick={e=>e.target===e.currentTarget&&setShowCat(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>New Category</h2>
              <button onClick={() => setShowCat(false)} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)" />
              </button>
            </div>

            <F label="Type">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {['expense','income'].map(t => (
                  <button key={t} onClick={() => setCatForm(f=>({...f,type:t}))} style={{
                    padding:'10px', borderRadius:'var(--r)', fontSize:13, fontWeight:600, textTransform:'capitalize',
                    background: catForm.type===t ? 'var(--accent-bg)' : 'var(--surface2)',
                    border:`1.5px solid ${catForm.type===t ? 'var(--accent)' : 'var(--border)'}`,
                    color: catForm.type===t ? 'var(--accent-fg)' : 'var(--text)', transition:'all 0.15s',
                  }}>{t}</button>
                ))}
              </div>
            </F>

            <F label="Category Name">
              <input value={catForm.name} onChange={e=>setCatForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Gym" style={inp} />
            </F>

            <F label="Icon">
              <EmojiPicker value={catForm.icon} onChange={em => setCatForm(f=>({...f,icon:em}))} />
            </F>

            <F label="Color">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {CAT_COLORS.map(col => (
                  <button key={col} onClick={() => setCatForm(f=>({...f,color:col}))} style={{
                    width:30, height:30, borderRadius:'50%', background:col,
                    border:`3px solid ${catForm.color===col ? 'var(--text)' : 'transparent'}`,
                    transition:'border 0.12s', outline:'none',
                  }} />
                ))}
              </div>
            </F>

            {/* Preview */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Preview</label>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:999, background:catForm.color+'18', border:`1.5px solid ${catForm.color}60` }}>
                <span style={{ fontSize:16 }}>{catForm.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:catForm.color }}>{catForm.name || 'Category name'}</span>
              </div>
            </div>

            <button onClick={saveCat} disabled={!catForm.name.trim()||savingC} style={{
              width:'100%', padding:14, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700,
              background:'var(--accent)', color:'#fff', opacity:!catForm.name.trim()||savingC?0.4:1, transition:'opacity 0.15s',
            }}>
              {savingC ? 'Saving…' : 'Add Category'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Bill Type Modal ── */}
      {showBillCat && createPortal(
        <div onClick={e=>e.target===e.currentTarget&&setShowBillCat(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>New Bill Type</h2>
              <button onClick={() => setShowBillCat(false)} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)" />
              </button>
            </div>
            <F label="Name">
              <input value={billCatForm.name} onChange={e=>setBillCatForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Maintenance" style={inp} />
            </F>
            <F label="Icon">
              <EmojiPicker value={billCatForm.icon} onChange={em => setBillCatForm(f=>({...f,icon:em}))} />
            </F>
            <F label="Color">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {CAT_COLORS.map(col => (
                  <button key={col} onClick={() => setBillCatForm(f=>({...f,color:col}))} style={{ width:30, height:30, borderRadius:'50%', background:col, border:`3px solid ${billCatForm.color===col ? 'var(--text)' : 'transparent'}`, transition:'border 0.12s', outline:'none' }} />
                ))}
              </div>
            </F>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Preview</label>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:999, background:billCatForm.color+'18', border:`1.5px solid ${billCatForm.color}60` }}>
                <span style={{ fontSize:16 }}>{billCatForm.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:billCatForm.color }}>{billCatForm.name || 'Bill type name'}</span>
              </div>
            </div>
            <button onClick={saveBillCat} disabled={!billCatForm.name.trim()||savingBC} style={{ width:'100%', padding:14, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700, background:'var(--accent)', color:'#fff', opacity:!billCatForm.name.trim()||savingBC?0.4:1, transition:'opacity 0.15s' }}>
              {savingBC ? 'Saving…' : 'Add Bill Type'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Loan Type Modal ── */}
      {showLoanCat && createPortal(
        <div onClick={e=>e.target===e.currentTarget&&setShowLoanCat(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>New Loan Type</h2>
              <button onClick={() => setShowLoanCat(false)} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)" />
              </button>
            </div>
            <F label="Name">
              <input value={loanCatForm.name} onChange={e=>setLoanCatForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Family Loan" style={inp} />
            </F>
            <F label="Icon">
              <EmojiPicker value={loanCatForm.icon} onChange={em => setLoanCatForm(f=>({...f,icon:em}))} />
            </F>
            <F label="Color">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {CAT_COLORS.map(col => (
                  <button key={col} onClick={() => setLoanCatForm(f=>({...f,color:col}))} style={{ width:30, height:30, borderRadius:'50%', background:col, border:`3px solid ${loanCatForm.color===col ? 'var(--text)' : 'transparent'}`, transition:'border 0.12s', outline:'none' }} />
                ))}
              </div>
            </F>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Preview</label>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:999, background:loanCatForm.color+'18', border:`1.5px solid ${loanCatForm.color}60` }}>
                <span style={{ fontSize:16 }}>{loanCatForm.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:loanCatForm.color }}>{loanCatForm.name || 'Loan type name'}</span>
              </div>
            </div>
            <button onClick={saveLoanCat} disabled={!loanCatForm.name.trim()||savingLC} style={{ width:'100%', padding:14, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700, background:'var(--accent)', color:'#fff', opacity:!loanCatForm.name.trim()||savingLC?0.4:1, transition:'opacity 0.15s' }}>
              {savingLC ? 'Saving…' : 'Add Loan Type'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Recurring Category Modal ── */}
      {showRecurringCat && createPortal(
        <div onClick={e=>e.target===e.currentTarget&&setShowRecurringCat(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>New Recurring Category</h2>
              <button onClick={() => setShowRecurringCat(false)} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)" />
              </button>
            </div>
            <F label="Name">
              <input value={recurringCatForm.name} onChange={e=>setRecurringCatForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Membership" style={inp} />
            </F>
            <F label="Icon">
              <EmojiPicker value={recurringCatForm.icon} onChange={em => setRecurringCatForm(f=>({...f,icon:em}))} />
            </F>
            <F label="Color">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {CAT_COLORS.map(col => (
                  <button key={col} onClick={() => setRecurringCatForm(f=>({...f,color:col}))} style={{ width:30, height:30, borderRadius:'50%', background:col, border:`3px solid ${recurringCatForm.color===col ? 'var(--text)' : 'transparent'}`, transition:'border 0.12s', outline:'none' }} />
                ))}
              </div>
            </F>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Preview</label>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:999, background:recurringCatForm.color+'18', border:`1.5px solid ${recurringCatForm.color}60` }}>
                <span style={{ fontSize:16 }}>{recurringCatForm.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:recurringCatForm.color }}>{recurringCatForm.name || 'Category name'}</span>
              </div>
            </div>
            <button onClick={saveRecurringCat} disabled={!recurringCatForm.name.trim()||savingRC} style={{ width:'100%', padding:14, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700, background:'var(--accent)', color:'#fff', opacity:!recurringCatForm.name.trim()||savingRC?0.4:1, transition:'opacity 0.15s' }}>
              {savingRC ? 'Saving…' : 'Add Recurring Category'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Recurring Modal ── */}
      {showRecurring && createPortal(
        <div onClick={e=>{ if(e.target===e.currentTarget){ setShowRecurring(false); setEditingRecurring(null); setRecurringForm(BLANK_RECURRING) }}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:9999 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', width:'100%', maxWidth:520, borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 20px 44px', animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'var(--border2)' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{editingRecurring ? 'Edit Recurring Expense' : 'New Recurring Expense'}</h2>
              <button onClick={() => { setShowRecurring(false); setEditingRecurring(null); setRecurringForm(BLANK_RECURRING) }} style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="var(--text2)" />
              </button>
            </div>

            {[['Description','text','description','e.g. Netflix'],['Amount (Rs.)','number','amount','0']].map(([l,t,k,ph]) => (
              <F key={k} label={l}>
                <input type={t} placeholder={ph} value={recurringForm[k]} onChange={e=>setRecurringForm(f=>({...f,[k]:e.target.value}))} style={inp} />
              </F>
            ))}

            <F label="Category">
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {recurringCategories.map(c => (
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
            </F>

            <F label="Repeat every">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {cycles.map(c => (
                  <button key={c} onClick={() => setRecurringForm(f=>({...f,cycle:c}))} style={{
                    padding:'10px 4px', borderRadius:'var(--r)', fontSize:13, textTransform:'capitalize',
                    background: recurringForm.cycle===c ? 'var(--accent-bg)' : 'var(--surface2)',
                    border:`1.5px solid ${recurringForm.cycle===c ? 'var(--accent)' : 'var(--border)'}`,
                    color: recurringForm.cycle===c ? 'var(--accent-fg)' : 'var(--text)',
                    fontWeight: recurringForm.cycle===c ? 700 : 400, transition:'all 0.15s',
                  }}>{c}</button>
                ))}
              </div>
            </F>

            <button onClick={saveRecurring} disabled={!recurringForm.description||!recurringForm.amount||savingR} style={{
              width:'100%', padding:15, borderRadius:'var(--r-lg)', fontSize:15, fontWeight:700,
              background:'var(--accent)', color:'#fff',
              opacity:!recurringForm.description||!recurringForm.amount||savingR?0.4:1,
              marginTop:4, transition:'opacity 0.15s',
            }}>
              {savingR ? 'Saving…' : editingRecurring ? 'Save Changes' : 'Add Recurring Expense'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const SectionHead = ({ icon, iconBg, title }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
    <div style={{ width:32, height:32, borderRadius:10, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
    <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{title}</h2>
  </div>
)

const SettingRow = ({ label, sub, children }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', gap:12 }}>
    <div>
      <p style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{label}</p>
      {sub && <p style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{sub}</p>}
    </div>
    {children}
  </div>
)

const EmptyCard = ({ text }) => (
  <div style={{ background:'var(--surface)', border:'1px dashed var(--border2)', borderRadius:'var(--r-lg)', padding:'28px 0', textAlign:'center' }}>
    <p style={{ color:'var(--text3)', fontSize:14 }}>{text}</p>
  </div>
)

const EmojiPicker = ({ value, onChange }) => {
  const handleCustom = (e) => {
    // Extract the first grapheme cluster (emoji or char) from the input
    const raw = e.target.value
    // Use Intl.Segmenter if available, otherwise take last typed char
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter()
      const segs = [...seg.segment(raw)]
      if (segs.length > 0) onChange(segs[segs.length - 1].segment)
    } else {
      // fallback: grab last 2 code-units (covers most emoji)
      const chars = [...raw]
      if (chars.length > 0) onChange(chars[chars.length - 1])
    }
  }
  return (
    <div>
      {/* Custom emoji input */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'10px 12px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)' }}>
        <span style={{ fontSize:28, lineHeight:1, minWidth:34, textAlign:'center' }}>{value}</span>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Type any emoji</p>
          <input
            type="text"
            placeholder="Open emoji keyboard & pick one…"
            onChange={handleCustom}
            style={{ ...inp, padding:'6px 10px', fontSize:13, width:'100%' }}
          />
        </div>
      </div>
      {/* Quick-pick pool */}
      <p style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6 }}>Or pick from common:</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {EMOJI_POOL.map(em => (
          <button key={em} onClick={() => onChange(em)} style={{
            width:38, height:38, borderRadius:10, fontSize:18,
            background: value===em ? 'var(--accent-bg)' : 'var(--surface2)',
            border:`1.5px solid ${value===em ? 'var(--accent)' : 'var(--border)'}`,
            display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
          }}>{em}</button>
        ))}
      </div>
    </div>
  )
}

const inp = { width:'100%', padding:'12px 14px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:15, color:'var(--text)', outline:'none', transition:'border-color 0.15s' }
const F = ({label,children}) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
    {children}
  </div>
)