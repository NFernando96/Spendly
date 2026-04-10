import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useApp } from '../context/AppContext'
import { fmt } from '../utils/helpers'
import { getCatMeta } from '../services/db'
import { TrendingUp, TrendingDown, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

// ── Date helpers ──────────────────────────────────────────────────────────────
const today      = () => new Date().toISOString().split('T')[0]
const weekStart  = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0] }
const monthStart = (m) => m + '-01'
const monthEnd   = (m) => { const [y,mo] = m.split('-').map(Number); return new Date(y, mo, 0).toISOString().split('T')[0] }

export default function Analytics() {
  const { transactions, monthStr } = useApp()

  // mode: 'month' | 'week' | 'range'
  const [mode,      setMode]      = useState('month')
  const [selMonth,  setSelMonth]  = useState(monthStr)
  const [rangeFrom, setRangeFrom] = useState(monthStart(monthStr))
  const [rangeTo,   setRangeTo]   = useState(today())
  const [showRange, setShowRange] = useState(false)

  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.date?.slice(0,7)).filter(Boolean))
    return [...s].sort((a,b) => b.localeCompare(a))
  }, [transactions])

  // Compute from/to based on mode
  const { from, to, label } = useMemo(() => {
    if (mode === 'week') {
      const ws = weekStart()
      return { from: ws, to: today(), label: 'This Week' }
    }
    if (mode === 'range') {
      return { from: rangeFrom, to: rangeTo, label: `${rangeFrom} → ${rangeTo}` }
    }
    // month
    return { from: monthStart(selMonth), to: monthEnd(selMonth), label: selMonth }
  }, [mode, selMonth, rangeFrom, rangeTo])

  const filtered  = useMemo(() => transactions.filter(t => t.date && t.date >= from && t.date <= to), [transactions, from, to])
  const mExpense  = useMemo(() => filtered.filter(t => t.type === 'expense'), [filtered])
  const mIncome   = useMemo(() => filtered.filter(t => t.type === 'income'),  [filtered])

  const totalExpense = mExpense.reduce((s,t) => s+t.amount, 0)
  const totalIncome  = mIncome.reduce((s,t)  => s+t.amount, 0)
  const net          = totalIncome - totalExpense

  const catData = useMemo(() => {
    const tot = {}
    mExpense.forEach(t => { tot[t.category] = (tot[t.category]||0)+t.amount })
    return Object.entries(tot).sort(([,a],[,b]) => b-a).map(([name, value]) => ({ name, value, ...getCatMeta(name,'expense') }))
  }, [mExpense])

  // Daily breakdown for the selected period
  const daily = useMemo(() => {
    const d = {}
    mExpense.forEach(t => { if(t.date) d[t.date] = (d[t.date]||0)+t.amount })
    // Generate all days in range
    const days = []
    const cur = new Date(from)
    const end = new Date(to)
    while (cur <= end) {
      const k = cur.toISOString().split('T')[0]
      days.push({ day: cur.getDate(), date: k, amount: d[k]||0,
        label: cur.toLocaleDateString('en-US', { month:'short', day:'numeric' }) })
      cur.setDate(cur.getDate()+1)
    }
    return days
  }, [mExpense, from, to])

  const monthly = useMemo(() => {
    const m = {}
    transactions.filter(t => t.type === 'expense').forEach(t => { const k = t.date?.slice(0,7); if(k) m[k]=(m[k]||0)+t.amount })
    return Object.entries(m).sort(([a],[b]) => a.localeCompare(b)).slice(-6).map(([k,v]) => ({
      month: new Date(k+'-01').toLocaleDateString('en-US',{month:'short'}), amount:v
    }))
  }, [transactions])

  const tt = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, fontSize:12, color:'var(--text)', boxShadow:'var(--shadow-md)' }

  return (
    <div className="page" style={{ padding:'20px 16px 0' }}>
      <h1 style={{ fontFamily:'var(--font-head)', fontSize:26, fontWeight:800, letterSpacing:'-0.5px', marginBottom:16 }}>Analytics</h1>

      {/* ── Filter Mode Tabs ── */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {[
          { v:'month', l:'Monthly' },
          { v:'week',  l:'This Week' },
          { v:'range', l:'Date Range' },
        ].map(opt => (
          <button key={opt.v} onClick={() => { setMode(opt.v); if(opt.v==='range') setShowRange(true) }} style={{
            padding:'7px 14px', borderRadius:999, fontSize:13, fontWeight: mode===opt.v ? 700 : 500,
            background: mode===opt.v ? 'var(--accent)' : 'var(--surface)',
            border:`1.5px solid ${mode===opt.v ? 'var(--accent)' : 'var(--border)'}`,
            color: mode===opt.v ? '#fff' : 'var(--text2)',
            transition:'all 0.15s', display:'flex', alignItems:'center', gap:5,
          }}>
            {opt.v === 'range' && <Calendar size={12} />}
            {opt.l}
          </button>
        ))}
      </div>

      {/* ── Month scroll (only when mode=month) ── */}
      {mode === 'month' && (
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', marginBottom:16, paddingBottom:2 }}>
          {months.map(m => (
            <button key={m} onClick={() => setSelMonth(m)} style={{
              padding:'6px 13px', borderRadius:999, flexShrink:0, fontSize:12,
              fontWeight: selMonth===m ? 600 : 400,
              background: selMonth===m ? 'var(--accent-bg)' : 'var(--surface)',
              border:`1.5px solid ${selMonth===m ? 'var(--accent)' : 'var(--border)'}`,
              color: selMonth===m ? 'var(--accent-fg)' : 'var(--text2)',
              transition:'all 0.15s',
            }}>
              {new Date(m+'-01').toLocaleDateString('en-US',{month:'short',year:'numeric'})}
            </button>
          ))}
          {months.length === 0 && <p style={{ color:'var(--text3)', fontSize:13 }}>No data yet</p>}
        </div>
      )}

      {/* ── Week label ── */}
      {mode === 'week' && (
        <div style={{ marginBottom:16, padding:'8px 14px', background:'var(--accent-bg)', border:'1.5px solid var(--accent)', borderRadius:'var(--r-lg)', display:'inline-flex', alignItems:'center', gap:7 }}>
          <Calendar size={13} color="var(--accent)" />
          <span style={{ fontSize:13, fontWeight:600, color:'var(--accent-fg)' }}>
            {new Date(from+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} — {new Date(to+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
          </span>
        </div>
      )}

      {/* ── Date range picker ── */}
      {mode === 'range' && (
        <div style={{ marginBottom:16, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <button onClick={() => setShowRange(v=>!v)} style={{
            width:'100%', padding:'11px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'none', border:'none', cursor:'pointer',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <Calendar size={14} color="var(--accent)" />
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                {new Date(rangeFrom+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                {' → '}
                {new Date(rangeTo+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
              </span>
            </div>
            {showRange ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
          </button>
          {showRange && (
            <div style={{ padding:'0 14px 14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, borderTop:'1px solid var(--border)' }}>
              <div style={{ paddingTop:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>From</label>
                <input type="date" value={rangeFrom} max={rangeTo}
                  onChange={e => setRangeFrom(e.target.value)}
                  style={{ width:'100%', padding:'9px 10px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:13, color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ paddingTop:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>To</label>
                <input type="date" value={rangeTo} min={rangeFrom} max={today()}
                  onChange={e => setRangeTo(e.target.value)}
                  style={{ width:'100%', padding:'9px 10px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:13, color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* Quick range presets */}
              <div style={{ gridColumn:'1/-1', display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                {[
                  { l:'Last 7 days',  f:()=>{ const d=new Date(); d.setDate(d.getDate()-6); return d.toISOString().split('T')[0] }, t:today },
                  { l:'Last 30 days', f:()=>{ const d=new Date(); d.setDate(d.getDate()-29); return d.toISOString().split('T')[0] }, t:today },
                  { l:'Last 3 months',f:()=>{ const d=new Date(); d.setMonth(d.getMonth()-3); return d.toISOString().split('T')[0] }, t:today },
                  { l:'This year',    f:()=>new Date().getFullYear()+'-01-01', t:today },
                ].map(p => (
                  <button key={p.l} onClick={() => { setRangeFrom(p.f()); setRangeTo(p.t()); setShowRange(false) }} style={{
                    padding:'5px 11px', borderRadius:999, fontSize:11, fontWeight:600,
                    background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text2)',
                    cursor:'pointer', transition:'all 0.12s',
                  }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)' }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)' }}
                  >{p.l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <SummaryCard label="Expenses" value={fmt(totalExpense)} icon={<TrendingDown size={14}/>} color="var(--danger)" bg="var(--danger-bg)" />
        <SummaryCard label="Income"   value={fmt(totalIncome)}  icon={<TrendingUp size={14}/>}  color="var(--income)" bg="var(--income-bg)" />
      </div>
      <div style={{
        background: net >= 0 ? 'var(--accent-bg)' : 'var(--danger-bg)',
        border:`1px solid ${net >= 0 ? 'var(--accent)' : 'var(--danger)'}`,
        borderRadius:'var(--r-lg)', padding:'14px 18px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:20,
      }}>
        <p style={{ fontSize:13, fontWeight:600, color: net >= 0 ? 'var(--accent-fg)' : 'var(--danger-fg)' }}>
          {net >= 0 ? '✅ Net savings' : '⚠️ Net loss'}
        </p>
        <p style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:800, color: net >= 0 ? 'var(--accent-fg)' : 'var(--danger-fg)' }}>
          {net >= 0 ? '+' : ''}{fmt(net)}
        </p>
      </div>

      {/* ── Pie chart ── */}
      {catData.length > 0 && (
        <Card title="Spending by category">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <PieChart width={150} height={150}>
              <Pie data={catData} cx={70} cy={70} innerRadius={44} outerRadius={68} paddingAngle={2} dataKey="value">
                {catData.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div style={{ flex:1 }}>
              {catData.slice(0,6).map(c => (
                <div key={c.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'var(--text)' }}>{c.icon} {c.name}</span>
                  </div>
                  <p style={{ fontSize:12, fontWeight:700, fontFamily:'var(--mono)' }}>
                    {totalExpense ? Math.round(c.value/totalExpense*100) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Daily spending ── */}
      {daily.some(d => d.amount > 0) && (
        <Card title={`Daily spending${mode==='month' ? ` — ${new Date(selMonth+'-01').toLocaleDateString('en-US',{month:'long'})}` : ''}`}>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={daily.slice(0, 60)} barSize={mode==='range' && daily.length > 20 ? 4 : 9}>
              <XAxis dataKey={daily.length > 14 ? 'day' : 'label'}
                tick={{fontSize:9,fill:'var(--text3)'}} axisLine={false} tickLine={false}
                interval={daily.length > 20 ? Math.floor(daily.length/10) : 0} />
              <YAxis hide />
              <Tooltip formatter={v=>[fmt(v),'Spent']} labelFormatter={(_,p) => p[0]?.payload?.label || ''} contentStyle={tt} cursor={{fill:'var(--surface2)'}} />
              <Bar dataKey="amount" fill="var(--danger)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Monthly trend (always shown regardless of filter) ── */}
      {monthly.length > 1 && (
        <Card title="Monthly trend (all time)">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={monthly} barSize={28}>
              <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text3)'}} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={v=>[fmt(v),'Spent']} contentStyle={tt} cursor={{fill:'var(--surface2)'}} />
              <Bar dataKey="amount" fill="var(--info)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 0' }}>
          <p style={{ fontSize:32, marginBottom:12 }}>📊</p>
          <p style={{ color:'var(--text3)', fontSize:14 }}>No data for this period</p>
        </div>
      )}
    </div>
  )
}

const SummaryCard = ({ label, value, icon, color, bg }) => (
  <div style={{ background:bg, border:`1px solid ${color}30`, borderRadius:'var(--r-lg)', padding:'14px 16px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:6, color, marginBottom:6 }}>
      {icon}
      <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
    </div>
    <p style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:800, color }}>{value}</p>
  </div>
)

const Card = ({ title, children }) => (
  <div style={{ marginBottom:16 }}>
    <h3 style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>{title}</h3>
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'16px', boxShadow:'var(--shadow)' }}>
      {children}
    </div>
  </div>
)