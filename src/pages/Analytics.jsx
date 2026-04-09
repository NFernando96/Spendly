import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useApp } from '../context/AppContext'
import { fmt } from '../utils/helpers'
import { getCatMeta } from '../services/db'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function Analytics() {
  const { transactions, monthStr } = useApp()
  const [sel, setSel] = useState(monthStr)

  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.date?.slice(0,7)).filter(Boolean))
    return [...s].sort((a,b) => b.localeCompare(a))
  }, [transactions])

  const mTx      = useMemo(() => transactions.filter(t => t.date?.startsWith(sel)), [transactions, sel])
  const mExpense  = useMemo(() => mTx.filter(t => t.type === 'expense'), [mTx])
  const mIncome   = useMemo(() => mTx.filter(t => t.type === 'income'), [mTx])

  const totalExpense = mExpense.reduce((s,t) => s+t.amount, 0)
  const totalIncome  = mIncome.reduce((s,t) => s+t.amount, 0)
  const net          = totalIncome - totalExpense

  const catData = useMemo(() => {
    const tot = {}
    mExpense.forEach(t => { tot[t.category] = (tot[t.category]||0)+t.amount })
    return Object.entries(tot).sort(([,a],[,b]) => b-a).map(([name, value]) => ({ name, value, ...getCatMeta(name,'expense') }))
  }, [mExpense])

  const daily = useMemo(() => {
    const d = {}
    mExpense.forEach(t => { const n = parseInt(t.date?.split('-')[2]); d[n] = (d[n]||0)+t.amount })
    return Array.from({length:31},(_,i) => ({ day:i+1, amount:d[i+1]||0 }))
  }, [mExpense])

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

      {/* Month selector */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', marginBottom:20, paddingBottom:2 }}>
        {months.map(m => (
          <button key={m} onClick={() => setSel(m)} style={{
            padding:'7px 14px', borderRadius:999, flexShrink:0, fontSize:13,
            fontWeight: sel === m ? 600 : 400,
            background: sel === m ? 'var(--accent)' : 'var(--surface)',
            border: `1.5px solid ${sel === m ? 'var(--accent)' : 'var(--border)'}`,
            color: sel === m ? '#fff' : 'var(--text2)',
            transition: 'all 0.15s',
          }}>
            {new Date(m+'-01').toLocaleDateString('en-US',{month:'long',year:'numeric'})}
          </button>
        ))}
        {months.length === 0 && (
          <p style={{ color:'var(--text3)', fontSize:13, padding:'6px 0' }}>No data yet</p>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <SummaryCard label="Expenses" value={fmt(totalExpense)} icon={<TrendingDown size={14}/>} color="var(--danger)" bg="var(--danger-bg)" />
        <SummaryCard label="Income"   value={fmt(totalIncome)}  icon={<TrendingUp size={14}/>}   color="var(--income)" bg="var(--income-bg)" />
      </div>
      <div style={{
        background: net >= 0 ? 'var(--accent-bg)' : 'var(--danger-bg)',
        border: `1px solid ${net >= 0 ? 'var(--accent)' : 'var(--danger)'}`,
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

      {/* Pie chart */}
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
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:12, fontWeight:700, fontFamily:'var(--mono)' }}>{totalExpense ? Math.round(c.value/totalExpense*100) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Daily spending */}
      {daily.some(d => d.amount > 0) && (
        <Card title="Daily spending">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={daily.filter((_,i) => i<28)} barSize={9}>
              <XAxis dataKey="day" tick={{fontSize:9,fill:'var(--text3)'}} axisLine={false} tickLine={false} interval={3} />
              <YAxis hide />
              <Tooltip formatter={v=>[fmt(v),'Spent']} contentStyle={tt} cursor={{fill:'var(--surface2)'}} />
              <Bar dataKey="amount" fill="var(--danger)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Monthly trend */}
      {monthly.length > 1 && (
        <Card title="Monthly trend">
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

      {mTx.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 0' }}>
          <p style={{ fontSize:32, marginBottom:12 }}>📊</p>
          <p style={{ color:'var(--text3)', fontSize:14 }}>No data for this period</p>
        </div>
      )}
    </div>
  )
}

const SummaryCard = ({ label, value, icon, color, bg }) => (
  <div style={{ background: bg, border:`1px solid ${color}30`, borderRadius:'var(--r-lg)', padding:'14px 16px' }}>
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
