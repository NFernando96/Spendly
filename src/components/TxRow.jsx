import { useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import { getCatMeta, deleteTransaction } from '../services/db'
import { fmt } from '../utils/helpers'
import AddModal from './AddModal'

export default function TxRow({ tx }) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)

  const meta = getCatMeta(tx.category, tx.type)
  const isExpense  = tx.type === 'expense'
  const isIncome   = tx.type === 'income'
  const isTransfer = tx.type === 'transfer'

  const amtColor = isExpense ? 'var(--danger)' : isIncome ? 'var(--income)' : 'var(--text2)'
  const amtSign  = isExpense ? '−' : isIncome ? '+' : '⇄'

  return (
    <>
      <div
        style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'12px 14px',
          background:'var(--surface)',
          borderRadius:'var(--r)',
          border:'1px solid var(--border)',
          marginBottom:6,
          transition:'all 0.15s',
          boxShadow: hovered ? 'var(--shadow-md)' : 'none',
          transform: hovered ? 'translateY(-1px)' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Icon */}
        <div style={{
          width:40, height:40, borderRadius:12,
          background: isTransfer ? 'var(--info-bg)' : meta.color + '18',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:18, flexShrink:0,
        }}>
          {isTransfer ? '⇄' : meta.icon}
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:14, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {tx.description}
          </p>
          <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
            {isTransfer ? 'Transfer' : meta.name}
          </p>
        </div>

        {/* Amount */}
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <p style={{ fontSize:15, fontWeight:700, color: amtColor, letterSpacing:'-0.3px', fontFamily:'var(--mono)' }}>
            {amtSign}{fmt(tx.amount)}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:4, flexShrink:0, opacity: hovered ? 1 : 0, transition:'opacity 0.15s' }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
              background:'var(--accent-bg)', border:'none', cursor:'pointer', transition:'all 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--accent-bg)'}
            title="Edit transaction"
          >
            <Pencil size={12} color="var(--accent)" style={{ pointerEvents:'none' }} />
          </button>
          <button
            onClick={() => { if (confirm('Delete this transaction?')) deleteTransaction(tx) }}
            style={{
              width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
              background:'var(--danger-bg)', border:'none', cursor:'pointer', transition:'all 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--danger-bg)'}
            title="Delete transaction"
          >
            <Trash2 size={12} color="var(--danger)" style={{ pointerEvents:'none' }} />
          </button>
        </div>
      </div>

      {editing && (
        <AddModal
          prefill={{ ...tx }}
          editMode
          editTx={tx}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
