import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')

const glyphs = {
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  alert: <><path d="m10.3 3.9-8 13.8A1.5 1.5 0 0 0 3.6 20h16.8a1.5 1.5 0 0 0 1.3-2.3l-8-13.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.5-2.6L20 12M4 12l2.9 5.6A7 7 0 0 0 18.4 15" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  siren: <><path d="M18 8a6 6 0 0 0-12 0v7h12V8Z" /><path d="M4 19h16M9 22h6M12 2V1M4.9 4.9l-.7-.7m15.6.7.7-.7" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
}

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{glyphs[name] || glyphs.activity}</svg>
}

async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const csrfCookie = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))
  const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.split('=').slice(1).join('=')) : ''
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' && method !== 'HEAD' && csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = parsed.detail || parsed.message || parsed.title || body
    } catch {
      // Keep plain-text error messages as-is.
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  if (response.status === 204) return null
  return response.json()
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en', includeTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(date)
}

function initials(name = 'Response team') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isRegistering = mode === 'register'

  const submitAuth = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const username = form.get(isRegistering ? 'email' : 'username').trim().toLowerCase()
    const password = form.get('password')
    try {
      const csrf = await apiRequest('/auth/csrf')
      if (isRegistering) {
        await apiRequest('/auth/register', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': csrf.token },
          body: JSON.stringify({ fullName: form.get('fullName').trim(), email: username, password }),
        })
        const refreshedCsrf = await apiRequest('/auth/csrf')
        const account = await apiRequest('/auth/login', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': refreshedCsrf.token },
          body: JSON.stringify({ username, password }),
        })
        onAuthenticated(account)
      } else {
        const account = await apiRequest('/auth/login', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': csrf.token },
          body: JSON.stringify({ username, password }),
        })
        onAuthenticated(account)
      }
    } catch (authError) {
      setError(authError.message || 'Unable to authenticate. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen">
    <div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" />
    <div className="auth-brand"><span className="brand-mark"><Icon name="shield" size={22} strokeWidth={2.1} /></span><span><strong>harbor</strong><small>RESPONSE PLATFORM</small></span></div>
    <section className="auth-card">
      <div className="auth-card-kicker"><span className="auth-lock"><Icon name="shield" size={14} /></span> PRIVATE OPERATIONS SPACE</div>
      <h1>{isRegistering ? 'Join your response network' : 'Welcome back'}</h1>
      <p className="auth-subtitle">{isRegistering ? 'Create a community account to submit and track your requests for help.' : 'Sign in to your Harbor account to continue.'}</p>
      <div className="auth-role-info"><span className="role-info-icon"><Icon name={isRegistering ? 'users' : 'shield'} size={16} /></span><span><strong>{isRegistering ? 'Community user account' : 'Admin or community sign-in'}</strong><small>{isRegistering ? 'New self-serve accounts have request-only access.' : 'Your secure role determines what you can access.'}</small></span></div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submitAuth}>
        {isRegistering && <label>Full name<input name="fullName" placeholder="Your name" autoComplete="name" required maxLength="120" /></label>}
        <label>{isRegistering ? 'Email address' : 'Username or email'}<input name={isRegistering ? 'email' : 'username'} type={isRegistering ? 'email' : 'text'} placeholder={isRegistering ? 'you@example.com' : 'Username or email'} autoComplete="username" required maxLength="254" /></label>
        <label>Password<input name="password" type="password" placeholder={isRegistering ? 'At least 10 characters' : 'Enter your password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} required minLength={isRegistering ? 10 : undefined} maxLength="72" /></label>
        {isRegistering && <p className="auth-password-note">Use at least 10 characters. Admin privileges can only be provisioned by your system administrator.</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create user account' : 'Sign in securely'}<Icon name="arrow" size={16} /></button>
      </form>
      <div className="auth-switch">{isRegistering ? 'Already have an account?' : 'Need a community account?'} <button onClick={() => { setMode(isRegistering ? 'login' : 'register'); setError('') }}>{isRegistering ? 'Sign in' : 'Create one'}</button></div>
      <div className="auth-security"><Icon name="shield" size={14} /><span>Encrypted session <i /> Role-based access</span></div>
    </section>
    <footer className="auth-footer"><span>Harbor response platform</span><span>Secure access for response teams</span></footer>
  </main>
}

function App() {
  const [disasters, setDisasters] = useState([])
  const [requests, setRequests] = useState([])
  const [summary, setSummary] = useState({ totalDisasters: 0, totalEmergencyRequests: 0 })
  const [connection, setConnection] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState('overview')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState('')
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      try {
        await apiRequest('/auth/csrf')
        const account = await apiRequest('/auth/me')
        if (active) {
          setUser(account)
          setPage(account.role === 'ADMIN' ? 'overview' : 'requests')
        }
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setAuthReady(true)
      }
    }
    restoreSession()
    return () => { active = false }
  }, [])

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const adminMode = user?.role === 'ADMIN'
      const [disasterData, requestData, dashboardData] = await Promise.all([
        adminMode ? apiRequest('/disasters') : Promise.resolve([]),
        apiRequest('/emergency-requests'),
        adminMode ? apiRequest('/dashboard') : Promise.resolve(null),
      ])
      setDisasters(Array.isArray(disasterData) ? disasterData : [])
      setRequests(Array.isArray(requestData) ? requestData : [])
      setSummary(dashboardData || { totalDisasters: 0, totalEmergencyRequests: requestData.length })
      setConnection('online')
      setError('')
    } catch (requestError) {
      setConnection('offline')
      setError(requestError.message || 'Could not connect to the backend.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    const initialLoad = window.setTimeout(() => loadWorkspace(), 0)
    const refreshTimer = window.setInterval(() => loadWorkspace(true), 30000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(refreshTimer)
    }
  }, [loadWorkspace, user])

  const handleAuthenticated = (account) => {
    setUser(account)
    setPage(account.role === 'ADMIN' ? 'overview' : 'requests')
    setSearch('')
  }

  const handleLogout = async () => {
    try {
      const csrf = await apiRequest('/auth/csrf')
      await apiRequest('/auth/logout', { method: 'POST', headers: { 'X-XSRF-TOKEN': csrf.token } })
    } catch {
      // Clear local UI state even if the session has already expired.
    }
    setUser(null)
    setDisasters([])
    setRequests([])
    setSummary({ totalDisasters: 0, totalEmergencyRequests: 0 })
    setPage('requests')
  }

  const filteredDisasters = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...disasters]
      .filter((item) => !query || [item.title, item.type, item.location, item.severity].some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0))
  }, [disasters, search])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...requests]
      .filter((item) => !query || [item.name, item.phone, item.location, item.details, item.status].some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [requests, search])

  const severeCount = disasters.filter((item) => ['critical', 'high', 'severe'].includes((item.severity || '').toLowerCase())).length
  const openRequests = requests.filter((item) => !['resolved', 'closed', 'complete', 'completed'].includes((item.status || '').toLowerCase())).length
  const latestIncidents = filteredDisasters.slice(0, 5)
  const latestRequests = filteredRequests.slice(0, 4)

  if (!authReady) {
    return <div className="auth-loading"><span className="brand-mark"><Icon name="shield" size={22} /></span><span>Restoring your secure session…</span></div>
  }
  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />
  }

  const submitRecord = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const isIncident = modal === 'disaster'
    const payload = isIncident
      ? {
          title: form.get('title').trim(),
          type: form.get('type'),
          severity: form.get('severity'),
          location: form.get('location').trim(),
          description: form.get('description').trim(),
          latitude: form.get('latitude') ? Number(form.get('latitude')) : null,
          longitude: form.get('longitude') ? Number(form.get('longitude')) : null,
        }
      : {
          name: form.get('name').trim(),
          phone: form.get('phone').trim(),
          location: form.get('location').trim(),
          details: form.get('details').trim(),
          status: 'OPEN',
        }

    setSaving(true)
    try {
      await apiRequest(isIncident ? '/disasters' : '/emergency-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setModal('')
      setPage(isIncident ? 'incidents' : 'requests')
      await loadWorkspace()
    } catch (requestError) {
      setError(requestError.message || 'Could not save this record.')
    } finally {
      setSaving(false)
    }
  }

  const updateRequestStatus = async (request, status) => {
    setUpdatingId(request.id)
    try {
      await apiRequest(`/emergency-requests/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...request, status }),
      })
      await loadWorkspace(true)
    } catch (requestError) {
      setError(requestError.message || 'Could not update request status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const currentTitle = page === 'overview' ? 'Overview' : page === 'incidents' ? 'Incident reports' : 'Emergency requests'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setPage('overview')} aria-label="Harbor home">
          <span className="brand-mark"><Icon name="shield" size={22} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>harbor</strong><small>RESPONSE PLATFORM</small></span>
        </a>
        <div className="workspace-switcher"><span className="workspace-avatar">{initials(user.fullName).slice(0, 1)}</span><span className="workspace-copy"><strong>{user.role === 'ADMIN' ? 'Northstar Relief' : user.fullName}</strong><small>{user.role === 'ADMIN' ? 'Operations workspace' : 'Personal response account'}</small></span><span className="switch-chevron"><Icon name="chevron" size={15} /></span></div>
        <div className="nav-label">{user.role === 'ADMIN' ? 'WORKSPACE' : 'YOUR ACCOUNT'}</div>
        <nav className="main-nav" aria-label="Main navigation">
          {user.role === 'ADMIN' && <>
            <button className={`nav-link ${page === 'overview' ? 'active' : ''}`} onClick={() => setPage('overview')}><Icon name="grid" /><span>Overview</span></button>
            <button className={`nav-link ${page === 'incidents' ? 'active' : ''}`} onClick={() => setPage('incidents')}><Icon name="alert" /><span>Incidents</span><span className="nav-count">{summary.totalDisasters || 0}</span></button>
          </>}
          <button className={`nav-link ${page === 'requests' ? 'active' : ''}`} onClick={() => setPage('requests')}><Icon name="siren" /><span>{user.role === 'ADMIN' ? 'Emergency requests' : 'My requests'}</span><span className="nav-count">{summary.totalEmergencyRequests || 0}</span></button>
          {user.role === 'ADMIN' && <button className="nav-link" onClick={() => setPage('incidents')}><Icon name="map" /><span>Response map</span><span className="nav-soon">VIEW</span></button>}
        </nav>
        {user.role === 'ADMIN' && <><div className="nav-label team-label">TEAM</div><nav className="main-nav" aria-label="Team navigation"><button className="nav-link" onClick={() => setPage('requests')}><Icon name="users" /><span>People &amp; requests</span></button></nav></>}
        <div className="sidebar-bottom">
          <div className="support-card"><span className="support-icon"><Icon name="activity" size={16} /></span><strong>{user.role === 'ADMIN' ? 'Need a hand?' : 'Need help?'}</strong><p>{user.role === 'ADMIN' ? 'Your response team is one click away.' : 'Send a request to your response team.'}</p><button onClick={() => setModal('request')}>Create a request <Icon name="arrow" size={14} /></button></div>
          <button className="profile-button" onClick={handleLogout}><span className="profile-avatar">{initials(user.fullName)}</span><span className="profile-copy"><strong>{user.fullName}</strong><small>{user.role === 'ADMIN' ? 'Admin · Sign out' : 'User · Sign out'}</small></span><span className="profile-dots">↗</span></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Icon name="shield" size={20} /></span><strong>harbor</strong></div>
          <div className="breadcrumbs"><span>{user.role === 'ADMIN' ? 'Northstar Relief' : user.fullName}</span><Icon name="chevron" size={14} /><strong>{currentTitle}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents, requests..." aria-label="Search incidents and requests" /><kbd>⌘ K</kbd></label>
            <span className={`connection-pill ${connection}`}><span className="connection-dot" />{connection === 'online' ? 'Live connection' : connection === 'offline' ? 'API offline' : 'Connecting'}</span>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setError('You’re all caught up.')}><Icon name="bell" /></button>
            <button className="top-avatar top-avatar-button" aria-label="Sign out" title="Sign out" onClick={handleLogout}>{initials(user.fullName)}</button>
          </div>
        </header>

        <div className="page-content">
          {error && <div className={`notice ${connection === 'offline' ? 'notice-error' : 'notice-info'}`} role="status"><span>{connection === 'offline' ? 'Backend connection issue' : 'Heads up'}</span><p>{connection === 'offline' ? 'Start the backend and check that it is available at localhost:8080.' : error}</p><div className="notice-actions"><button onClick={() => loadWorkspace()}>Try again</button><button aria-label="Dismiss notice" onClick={() => setError('')}><Icon name="close" size={15} /></button></div></div>}

          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> SECURE {user.role === 'ADMIN' ? 'OPERATIONS WORKSPACE' : 'RESPONSE ACCOUNT'}</div><h1>{page === 'overview' ? `Good morning, ${user.fullName.split(' ')[0]}` : currentTitle}<span className="heading-wave">{page === 'overview' ? '✳' : ''}</span></h1><p className="heading-subtitle">{user.role !== 'ADMIN' ? 'Track the help you have requested and stay up to date with your response team.' : page === 'overview' ? 'Here’s what’s happening across your response network.' : page === 'incidents' ? 'Track, triage, and coordinate active incident reports.' : 'Manage requests and coordinate support across your response network.'}</p></div>
            <div className="heading-actions"><button className="button button-secondary" onClick={() => loadWorkspace()} disabled={loading}><Icon name="refresh" size={16} />{loading ? 'Syncing' : 'Refresh'}</button><button className="button button-primary" onClick={() => setModal(user.role === 'USER' || page === 'requests' ? 'request' : 'disaster')}><Icon name="plus" size={17} />{user.role === 'USER' || page === 'requests' ? 'New request' : 'New incident'}</button></div>
          </section>

          {user.role === 'ADMIN' ? <section className="metrics-grid" aria-label="Workspace metrics">
            <MetricCard icon="alert" tone="violet" label="Total incidents" value={summary.totalDisasters ?? disasters.length} note="Across your workspace" />
            <MetricCard icon="siren" tone="orange" label="Open requests" value={openRequests} note="Waiting for a response" />
            <MetricCard icon="activity" tone="red" label="High priority" value={severeCount} note="Needs urgent attention" />
            <MetricCard icon="layers" tone="green" label="All-time requests" value={summary.totalEmergencyRequests ?? requests.length} note="People connected to help" />
          </section> : <section className="metrics-grid user-metrics" aria-label="Your request metrics"><MetricCard icon="siren" tone="orange" label="Your requests" value={requests.length} note="Requests submitted by you" /><MetricCard icon="activity" tone="green" label="Awaiting support" value={openRequests} note="Your team can see these" /></section>}

          {user.role === 'ADMIN' && page === 'overview' && <OverviewContent incidents={latestIncidents} requests={latestRequests} disasters={disasters} loading={loading} onViewIncidents={() => setPage('incidents')} onViewRequests={() => setPage('requests')} onCreateIncident={() => setModal('disaster')} onCreateRequest={() => setModal('request')} onUpdateStatus={updateRequestStatus} updatingId={updatingId} />}
          {user.role === 'ADMIN' && page === 'incidents' && <IncidentList incidents={filteredDisasters} loading={loading} onCreate={() => setModal('disaster')} />}
          {page === 'requests' && <RequestList requests={filteredRequests} loading={loading} onCreate={() => setModal('request')} onUpdateStatus={updateRequestStatus} updatingId={updatingId} canManage={user.role === 'ADMIN'} />}

          <footer className="page-footer"><span><span className="footer-status" />All systems operational</span><span>Harbor response platform <span className="footer-dot">·</span> Data syncs every 30 seconds</span></footer>
        </div>
      </main>
      {modal && <RecordModal type={user.role === 'USER' ? 'request' : modal} saving={saving} onClose={() => setModal('')} onSubmit={submitRecord} />}
    </div>
  )
}

function MetricCard({ icon, tone, label, value, note }) {
  return <article className="metric-card"><div className="metric-top"><span className={`metric-icon ${tone}`}><Icon name={icon} size={17} /></span><span className="metric-period">Workspace</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-note"><span className="note-dot" />{note}</div></article>
}

function ActivityChart({ disasters }) {
  const bars = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    const count = disasters.filter((item) => item.reportedAt && new Date(item.reportedAt).toDateString() === day.toDateString()).length
    return { label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day), count }
  })
  const max = Math.max(...bars.map((bar) => bar.count), 1)
  return <div className="chart-wrap"><div className="chart-y-labels"><span>{max}</span><span>{Math.ceil(max / 2)}</span><span>0</span></div><div className="chart-area"><div className="chart-gridline gridline-one" /><div className="chart-gridline gridline-two" /><div className="chart-gridline gridline-three" /><div className="bar-group">{bars.map((bar, index) => <div className="bar-column" key={bar.label}><div className={`bar-track ${bar.count ? '' : 'bar-empty'}`}><div className={`bar-fill ${index === bars.length - 1 ? 'bar-today' : ''}`} style={{ height: `${bar.count ? Math.max((bar.count / max) * 100, 16) : 3}%` }} title={`${bar.count} incident${bar.count === 1 ? '' : 's'}`} /></div><span className={index === bars.length - 1 ? 'today-label' : ''}>{bar.label}</span></div>)}</div></div></div>
}

function SeverityPanel({ disasters }) {
  const levels = [{ label: 'Critical', color: 'critical', match: ['critical'] }, { label: 'High', color: 'high', match: ['high', 'severe'] }, { label: 'Moderate', color: 'moderate', match: ['moderate', 'medium'] }, { label: 'Low', color: 'low', match: ['low', 'minor'] }]
  return <div className="severity-content"><div className="severity-ring" style={{ '--ring-fill': `${disasters.length ? 66 : 0}%` }}><div><strong>{disasters.length}</strong><span>Total</span></div></div><div className="severity-legend">{levels.map((level) => { const count = disasters.filter((item) => level.match.includes((item.severity || '').toLowerCase())).length; return <div className="severity-row" key={level.label}><span className={`severity-dot ${level.color}`} /><span>{level.label}</span><strong>{count}</strong></div> })}</div></div>
}

function OverviewContent({ incidents, requests, disasters, loading, onViewIncidents, onViewRequests, onCreateIncident, onCreateRequest, onUpdateStatus, updatingId }) {
  return <>
    <section className="insights-grid">
      <article className="panel activity-panel"><div className="panel-heading"><div><div className="panel-kicker">RESPONSE OVERVIEW</div><h2>Incident activity</h2></div><span className="period-select">Last 7 days <Icon name="chevron" size={14} /></span></div><ActivityChart disasters={disasters} /><div className="chart-footnote"><span className="chart-key" />Reports received <span className="chart-footnote-divider">·</span> Updated in real time</div></article>
      <article className="panel severity-panel"><div className="panel-heading"><div><div className="panel-kicker">TRIAGE</div><h2>By severity</h2></div><span className="round-icon"><Icon name="alert" size={16} /></span></div><SeverityPanel disasters={disasters} /><div className="severity-footnote"><span className="severity-footnote-dot" />Severity based on incident reports</div></article>
    </section>
    <section className="panel records-panel"><div className="panel-heading records-heading"><div><div className="panel-kicker">LIVE OPERATIONS</div><h2>Latest reports</h2></div><div className="record-tabs"><button className="record-tab active">Incidents <span>{disasters.length}</span></button><button className="record-tab" onClick={onViewRequests}>Requests <span>{requests.length}</span></button></div><button className="text-button" onClick={onViewIncidents}>View all <Icon name="chevron" size={15} /></button></div>{loading && incidents.length === 0 ? <LoadingRows /> : incidents.length ? <IncidentTable incidents={incidents} /> : <EmptyState icon="alert" title="No incidents reported yet" detail="Reports created by your team will appear here." action="Create first incident" onClick={onCreateIncident} />}</section>
    <section className="panel requests-panel"><div className="panel-heading records-heading"><div><div className="panel-kicker">COMMUNITY SUPPORT</div><h2>Emergency requests</h2></div><button className="text-button" onClick={onViewRequests}>View all <Icon name="chevron" size={15} /></button></div>{loading && requests.length === 0 ? <LoadingRows /> : requests.length ? <RequestTable requests={requests} onUpdateStatus={onUpdateStatus} updatingId={updatingId} canManage /> : <EmptyState icon="siren" title="No requests in the queue" detail="New calls for help will show up here as they come in." action="Create a request" onClick={onCreateRequest} compact />}</section>
  </>
}

function IncidentTable({ incidents }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>INCIDENT</th><th>LOCATION</th><th>SEVERITY</th><th>REPORTED</th><th /></tr></thead><tbody>{incidents.map((incident) => <tr key={incident.id}><td><div className="primary-cell"><span className={`incident-type-icon ${severityTone(incident.severity)}`}><Icon name="alert" size={15} /></span><span><strong>{incident.title || incident.type || 'Untitled report'}</strong><small>{incident.type || 'Incident'} <span className="cell-dot">·</span> #{incident.id}</small></span></div></td><td><span className="location-cell"><Icon name="pin" size={14} />{incident.location || 'Location not provided'}</span></td><td><SeverityBadge severity={incident.severity} /></td><td className="muted-cell">{formatDate(incident.reportedAt, true)}</td><td><button className="row-action" aria-label={`Incident ${incident.id}`}><Icon name="chevron" size={16} /></button></td></tr>)}</tbody></table></div>
}

function RequestTable({ requests, onUpdateStatus, updatingId, canManage = false }) {
  return <div className="table-scroll"><table className="data-table request-table"><thead><tr><th>{canManage ? 'REQUESTER' : 'REQUEST'}</th>{canManage && <th>LOCATION</th>}<th>{canManage ? 'DETAILS' : 'LOCATION'}</th><th>STATUS</th><th /></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><div className="person-cell"><span className="person-avatar">{initials(canManage ? request.name : request.details || 'Help request')}</span><span><strong>{canManage ? request.name || 'Anonymous' : request.details || 'Help requested'}</strong><small>{canManage ? request.phone || 'No phone provided' : `Submitted ${formatDate(request.createdAt)}`}</small></span></div></td>{canManage && <td><span className="location-cell"><Icon name="pin" size={14} />{request.location || 'Not provided'}</span></td>}<td className="request-detail" title={canManage ? request.details : request.location}>{canManage ? request.details || 'No details provided' : request.location || 'Location not provided'}</td><td>{canManage ? <select className={`status-select status-${(request.status || 'open').toLowerCase().replaceAll(' ', '-')}`} value={request.status || 'OPEN'} disabled={updatingId === request.id} onChange={(event) => onUpdateStatus(request, event.target.value)} aria-label={`Update status for ${request.name || 'request'}`}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select> : <span className={`status-select status-${(request.status || 'open').toLowerCase().replaceAll(' ', '-')}`}>{(request.status || 'OPEN').replaceAll('_', ' ')}</span>}</td><td className="muted-cell request-date">{canManage ? formatDate(request.createdAt) : ''}</td></tr>)}</tbody></table></div>
}

function IncidentList({ incidents, loading, onCreate }) {
  return <section className="panel full-list-panel"><div className="panel-heading records-heading"><div><div className="panel-kicker">INCIDENT MANAGEMENT</div><h2>All incidents <span className="heading-count">{incidents.length}</span></h2></div><button className="button button-primary button-small" onClick={onCreate}><Icon name="plus" size={16} />New incident</button></div>{loading && !incidents.length ? <LoadingRows /> : incidents.length ? <IncidentTable incidents={incidents} /> : <EmptyState icon="alert" title="No incidents found" detail="Try a different search or create a new incident report." action="Create incident" onClick={onCreate} />}</section>
}

function RequestList({ requests, loading, onCreate, onUpdateStatus, updatingId, canManage = false }) {
  return <section className="panel full-list-panel"><div className="panel-heading records-heading"><div><div className="panel-kicker">COMMUNITY SUPPORT</div><h2>{canManage ? 'All requests' : 'Your requests'} <span className="heading-count">{requests.length}</span></h2></div><button className="button button-primary button-small" onClick={onCreate}><Icon name="plus" size={16} />New request</button></div>{loading && !requests.length ? <LoadingRows /> : requests.length ? <RequestTable requests={requests} onUpdateStatus={onUpdateStatus} updatingId={updatingId} canManage={canManage} /> : <EmptyState icon="siren" title={canManage ? 'No requests found' : 'You have not sent a request yet'} detail={canManage ? 'Requests submitted to your team will appear here.' : 'Create a request and your authorized response team will be able to help.'} action="Create a request" onClick={onCreate} />}</section>
}

function SeverityBadge({ severity }) {
  const value = severity || 'Unspecified'
  return <span className={`severity-badge ${severityTone(severity)}`}><span />{value}</span>
}

function severityTone(severity = '') {
  const value = severity.toLowerCase()
  if (value.includes('critical')) return 'tone-critical'
  if (value.includes('high') || value.includes('severe')) return 'tone-high'
  if (value.includes('moderate') || value.includes('medium')) return 'tone-moderate'
  if (value.includes('low') || value.includes('minor')) return 'tone-low'
  return 'tone-neutral'
}

function EmptyState({ icon, title, detail, action, onClick, compact = false }) {
  return <div className={`empty-state ${compact ? 'empty-compact' : ''}`}><span className="empty-icon"><Icon name={icon} size={19} /></span><strong>{title}</strong><p>{detail}</p>{action && <button className="text-button" onClick={onClick}>{action}<Icon name="arrow" size={14} /></button>}</div>
}

function LoadingRows() {
  return <div className="loading-rows" aria-label="Loading records"><span /><span /><span /></div>
}

function RecordModal({ type, saving, onClose, onSubmit }) {
  const isIncident = type === 'disaster'
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><span className={`modal-icon ${isIncident ? 'modal-violet' : 'modal-orange'}`}><Icon name={isIncident ? 'alert' : 'siren'} size={20} /></span><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div><div className="modal-heading"><h2 id="modal-title">{isIncident ? 'Report an incident' : 'Create emergency request'}</h2><p>{isIncident ? 'Add the key details so your response team can coordinate.' : 'Log a request for help and route it to your team.'}</p></div>
    <form onSubmit={onSubmit} className="record-form">{isIncident ? <><label>Incident title<input name="title" placeholder="e.g. Flooding near Riverside" required maxLength="120" /></label><div className="form-row"><label>Type<select name="type" defaultValue="Flood"><option>Flood</option><option>Wildfire</option><option>Storm</option><option>Earthquake</option><option>Medical</option><option>Other</option></select></label><label>Severity<select name="severity" defaultValue="Moderate"><option>Low</option><option>Moderate</option><option>High</option><option>Critical</option></select></label></div><label>Location<input name="location" placeholder="City, neighborhood, or address" required maxLength="160" /></label><label>Description<textarea name="description" placeholder="What happened? Share details the response team should know." rows="3" /></label><div className="form-row"><label>Latitude <span className="optional-label">optional</span><input name="latitude" type="number" step="any" placeholder="37.7749" /></label><label>Longitude <span className="optional-label">optional</span><input name="longitude" type="number" step="any" placeholder="-122.4194" /></label></div></> : <><label>Requester name<input name="name" placeholder="Full name" required maxLength="120" /></label><div className="form-row"><label>Phone number<input name="phone" type="tel" placeholder="+1 (555) 000-0000" required maxLength="40" /></label><label>Location<input name="location" placeholder="Area or address" required maxLength="160" /></label></div><label>What do they need?<textarea name="details" placeholder="Describe the situation and support needed." rows="4" required maxLength="1000" /></label></>}
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : isIncident ? 'Create incident' : 'Create request'}<Icon name="arrow" size={15} /></button></div>
    </form></section></div>
}

export default App