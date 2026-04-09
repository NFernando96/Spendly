export const fmt = (n) => 'Rs.\u00a0' + Math.round(n || 0).toLocaleString('en-LK')

export const fmtDate = (dateStr) => {
  if (!dateStr) return ''
  const today = new Date().toISOString().split('T')[0]
  const yest  = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  if (dateStr === yest)  return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    ...(dateStr.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
  })
}

export const todayStr = () => new Date().toISOString().split('T')[0]

export const groupByDate = (txs) => {
  const g = {}
  txs.forEach(t => { ;(g[t.date] = g[t.date] || []).push(t) })
  return Object.entries(g).sort(([a], [b]) => b.localeCompare(a))
}
