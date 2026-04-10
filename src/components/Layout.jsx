import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, List, BarChart2, Wallet, Settings, Plus, TrendingUp, Receipt, Landmark, LogOut, X } from 'lucide-react'
import AddModal from './AddModal'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Home' },
  { to: '/transactions', icon: List,            label: 'Transactions' },
  { to: '/analytics',    icon: BarChart2,       label: 'Analytics' },
  { to: '/accounts',     icon: Wallet,          label: 'Accounts' },
  { to: '/bills',        icon: Receipt,         label: 'Bills' },
  { to: '/loans',        icon: Landmark,        label: 'Loans' },
  { to: '/settings',     icon: Settings,        label: 'Settings' },
]

export default function Layout() {
  const [showAdd, setShowAdd]           = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { loading } = useApp()
  const { user, logOut } = useAuth()

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase()

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', gap:16 }}>
      <div style={{ width:36, height:36, border:'2.5px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <p style={{ color:'var(--text2)', fontSize:14, fontWeight:500 }}>Loading…</p>
    </div>
  )

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div style={{ marginBottom:32, paddingLeft:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <TrendingUp size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:17, letterSpacing:'-0.3px' }}>Spendly</span>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', paddingLeft:42 }}>Personal finance</p>
        </div>

        <nav style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} style={{ textDecoration:'none' }}>
              {({ isActive }) => (
                <div style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 12px', borderRadius:'var(--r)',
                  background: isActive ? 'var(--accent-bg)' : 'transparent',
                  transition:'all 0.15s',
                }}>
                  <n.icon size={18} strokeWidth={isActive ? 2.5 : 1.8} color={isActive ? 'var(--accent)' : 'var(--text2)'} />
                  <span style={{ fontSize:14, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent-fg)' : 'var(--text2)' }}>{n.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout — desktop */}
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--surface2)', borderRadius:'var(--r)', display:'flex', alignItems:'center', gap:10 }}>
          {user?.photoURL
            ? <img src={user.photoURL} alt="avatar" style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, objectFit:'cover' }} />
            : <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials}</div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.displayName || 'User'}
            </p>
            <p style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.email}
            </p>
          </div>
          <button onClick={logOut} title="Sign out" style={{ background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', opacity:0.5, transition:'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
          >
            <LogOut size={15} color="var(--danger)" />
          </button>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'12px 16px', borderRadius:'var(--r-lg)',
            background:'var(--accent)', color:'#fff',
            fontSize:14, fontWeight:700,
            boxShadow:'0 4px 16px rgba(124,58,237,0.35)',
            transition:'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(124,58,237,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(124,58,237,0.35)' }}
        >
          <Plus size={18} strokeWidth={2.5} />
          Add Transaction
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content" style={{ overflowY:'auto' }}>
        <div className="page-inner">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Top Bar (avatar + sign out) ── */}
      <div className="mobile-topbar" style={{
        position:'fixed', top:0, left:'50%', transform:'translateX(-50%)',
        width:'100%', maxWidth:'var(--max-w)',
        height:52,
        background:'var(--surface)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 16px',
        zIndex:201,
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <TrendingUp size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:15, letterSpacing:'-0.3px', color:'var(--text)' }}>Spendly</span>
        </div>

        {/* Avatar — tap to show sign out */}
        <div style={{ position:'relative' }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:8 }}
          >
            {user?.photoURL
              ? <img src={user.photoURL} alt="avatar" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border2)' }} />
              : <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff' }}>{initials}</div>
            }
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <>
              {/* backdrop */}
              <div onClick={() => setShowUserMenu(false)} style={{ position:'fixed', inset:0, zIndex:299 }} />
              <div style={{
                position:'absolute', right:0, top:'calc(100% + 8px)',
                background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--r-lg)', boxShadow:'var(--shadow-md)',
                minWidth:200, zIndex:300, overflow:'hidden',
              }}>
                {/* User info */}
                <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
                  <p style={{ fontSize:13, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {user?.displayName || 'User'}
                  </p>
                  <p style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>
                    {user?.email}
                  </p>
                </div>
                {/* Sign out */}
                <button
                  onClick={() => { setShowUserMenu(false); logOut() }}
                  style={{
                    width:'100%', padding:'12px 14px',
                    display:'flex', alignItems:'center', gap:10,
                    background:'none', border:'none', cursor:'pointer',
                    fontSize:13, fontWeight:600, color:'var(--danger)',
                    textAlign:'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav" style={{
        position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
        width:'100%', maxWidth:'var(--max-w)',
        background:'var(--surface)',
        borderTop:'1px solid var(--border)',
        display:'grid', gridTemplateColumns:'repeat(7,1fr)',
        height:'var(--nav-h)', alignItems:'center',
        zIndex:200, paddingBottom:'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(n => <MobileNavItem key={n.to} {...n} />)}
      </nav>

      {/* ── Floating add button (mobile) ── */}
      <button
        className="mobile-fab"
        onClick={() => setShowAdd(true)}
        style={{
          position:'fixed',
          bottom:'calc(var(--nav-h) + 14px)',
          right:16,
          width:52, height:52, borderRadius:'50%',
          background:'var(--accent)', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 20px rgba(124,58,237,0.5)',
          zIndex:199,
          transition:'all 0.15s',
        }}
        onMouseDown={e => e.currentTarget.style.transform='scale(0.92)'}
        onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
        onTouchStart={e => e.currentTarget.style.transform='scale(0.92)'}
        onTouchEnd={e => e.currentTarget.style.transform='scale(1)'}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function MobileNavItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'6px 0', textDecoration:'none' }}>
      {({ isActive }) => (
        <>
          <div style={{
            width:34, height:26, borderRadius:8,
            display:'flex', alignItems:'center', justifyContent:'center',
            background: isActive ? 'var(--accent-bg)' : 'transparent',
            transition:'all 0.15s',
          }}>
            <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} color={isActive ? 'var(--accent)' : 'var(--text3)'} />
          </div>
          <span style={{ fontSize:9, fontWeight: isActive ? 700 : 400, color: isActive ? 'var(--accent)' : 'var(--text3)' }}>{label.split(' ')[0]}</span>
        </>
      )}
    </NavLink>
  )
}