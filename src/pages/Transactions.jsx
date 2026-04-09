import { useState, useMemo } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { fmt, fmtDate, groupByDate } from '../utils/helpers'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../services/db'
import TxRow from '../components/TxRow'

const ALL_CATS = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
]

export default function Transactions() {
  const { transactions, monthStr } = useApp()
  const [search, setSearch]  = useState('')
  const [cat, setCat]        = useState('All')
  const [month, setMonth]    = useState(monthStr)
  const [typeFilter, setTypeFilter] = useState('all')

  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.date?.slice(0,7)).filter(Boolean))
    return [...s].sort((a,b) => b.localeCompare(a))
  }, [transactions])

  const filtered = useMemo(() => transactions.filter(t => {
    if (month && !t.date?.startsWith(month)) return false
    if (cat !== 'All' && t.category !== cat) return false
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (search && !t.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [transactions, month, cat, search, typeFilter])

  const totalExpense = filtered.filter(t => t.type==='expense').reduce((s,t) => s+t.amount, 0)
  const totalIncome  = filtered.filter(t => t.type==='income').reduce((s,t) => s+t.amount, 0)
  const groups = groupByDate(filtered)

  const fmtM = s => new Date(s+'-01').toLocaleDateString('en-US',{month:'short',year:'2-digit'})

  return (
    <div className="page">
      {/* Sticky header */}
      <div style={{
        position:'sticky', top:0, zIndex:50,
        background:'var(--bg)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--border)',
        padding:'16px 16px 12px',
      }}>
        <h1 style={{ fontFamily:'var(--font-head)', fontSize:24, fontWeight:800, marginBottom:14, letterSpacing:'-0.5px' }}>Transactions</h1>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:10 }}>
          <Search size={14} color="var(--text3)" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search transactions…"
            style={{
              width:'100%', padding:'10px 36px',
              background:'var(--surface)', border:'1.5px solid var(--border)',
              borderRadius:999, fontSize:14, color:'var(--text)', outline:'none',
              transition:'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor='var(--accent)'}
            onBlur={e => e.target.style.borderColor='var(--border)'}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', display:'flex' }}>
              <X size={14} color="var(--text3)" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          {[['all','All'],['expense','Expenses'],['income','Income'],['transfer','Transfers']].map(([v,l]) => (
            <button key={v} onClick={() => setTypeFilter(v)} style={{
              padding:'5px 12px', borderRadius:999, fontSize:12, fontWeight: typeFilter===v ? 600 : 400,
              background: typeFilter===v ? 'var(--text)' : 'var(--surface)',
              border: `1px solid ${typeFilter===v ? 'var(--text)' : 'var(--border)'}`,
              color: typeFilter===v ? 'var(--bg)' : 'var(--text2)',
              transition:'all 0.15s', flexShrink:0,
            }}>{l}</button>
          ))}
        </div>

        {/* Month pills */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', marginBottom:8, paddingBottom:2 }}>
          {months.map(m => (
            <button key={m} onClick={() => setMonth(month===m ? '' : m)} style={{
              padding:'5px 12px', borderRadius:999, whiteSpace:'nowrap', flexShrink:0,
              fontSize:12, fontWeight: month===m ? 600 : 400,
              background: month===m ? 'var(--accent-bg)' : 'var(--surface)',
              border:`1.5px solid ${month===m ? 'var(--accent)' : 'var(--border)'}`,
              color: month===m ? 'var(--accent-fg)' : 'var(--text2)',
              transition:'all 0.15s',
            }}>{fmtM(m)}</button>
          ))}
        </div>

        {/* Category chips */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
          <CatChip label="All" active={cat==='All'} onClick={() => setCat('All')} />
          {ALL_CATS.map(c => (
            <CatChip key={c.name} label={`${c.icon} ${c.name}`} active={cat===c.name} onClick={() => setCat(cat===c.name?'All':c.name)} color={c.color} />
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
        <span style={{ fontSize:12, color:'var(--text3)' }}>{filtered.length} result{filtered.length!==1?'s':''}</span>
        <div style={{ display:'flex', gap:14 }}>
          {totalIncome > 0 && (
            <span style={{ fontSize:13, fontWeight:700, color:'var(--income)', fontFamily:'var(--mono)' }}>+{fmt(totalIncome)}</span>
          )}
          {totalExpense > 0 && (
            <span style={{ fontSize:13, fontWeight:700, color:'var(--danger)', fontFamily:'var(--mono)' }}>−{fmt(totalExpense)}</span>
          )}
        </div>
      </div>

      {/* Transactions list */}
      <div style={{ padding:'8px 16px' }}>
        {groups.length === 0
          ? (
            <div style={{ textAlign:'center', padding:'48px 0' }}>
              <p style={{ fontSize:32, marginBottom:12 }}>🔍</p>
              <p style={{ color:'var(--text3)', fontSize:14 }}>Nothing found</p>
            </div>
          )
          : groups.map(([date, txs]) => (
            <div key={date} style={{ paddingTop:12 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{fmtDate(date)}</p>
              {txs.map(t => <TxRow key={t.id} tx={t} />)}
            </div>
          ))
        }
      </div>
    </div>
  )
}

const CatChip = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    padding:'5px 12px', borderRadius:999, whiteSpace:'nowrap', flexShrink:0,
    fontSize:12, fontWeight: active ? 600 : 400,
    background: active ? (color ? color+'20' : 'var(--accent-bg)') : 'var(--surface)',
    border:`1.5px solid ${active ? (color||'var(--accent)')+'70' : 'var(--border)'}`,
    color: active ? (color||'var(--accent-fg)') : 'var(--text2)',
    transition:'all 0.12s',
  }}>{label}</button>
)
