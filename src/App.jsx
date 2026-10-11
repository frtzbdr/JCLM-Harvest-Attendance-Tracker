import { useEffect, useState } from 'react'

import {

  Activity,

  CalendarDays,


  ChevronRight,

  ClipboardCheck,
  FileSpreadsheet,
  Cross,

  LayoutDashboard,

  LogOut,

  Menu,
  Shield,
  UserRoundPlus,
  Sun,
  Moon,
  QrCode,

  Users,

  X,

} from 'lucide-react'

import './App.css'

import { supabase } from './lib/supabase'

import Login from './pages/Login'

import CellManagement from './pages/CellManagement.jsx'

import FirstTimers from './pages/FirstTimers.jsx'

import AttendanceCheckIn from './pages/AttendanceCheckIn.jsx'


import Dashboard from './pages/Dashboard.jsx'
import QRAttendance from './pages/QRAttendance.jsx'
import harvestLogo from './assets/harvest-gathering-logo.png'
import HarvestReports from './pages/HarvestReports.jsx'
import ImportMembers from './pages/ImportMembers.jsx'
import AuditLogs from './pages/AuditLogs.jsx'
import churchLogo from './assets/jclm-logo.png'

// Allow ordinary names (including Filipino/Unicode letters), spaces, periods,
// apostrophes, and hyphens. This improves input quality; database RPCs must still
// validate inputs and use parameterized queries for security.
const sanitizePersonName = (value) => value.replace(/[^\p{L}\p{M}\s.'’\-]/gu, '').replace(/\s{2,}/g, ' ')
const sanitizePhone = (value) => value.replace(/[^0-9+()\-\s]/g, '')


const navigation = [
  { label: 'Harvest Dashboard', icon: LayoutDashboard },
  { label: 'Attendance Check-In', icon: ClipboardCheck },
  { label: 'QR Attendance Check-In', icon: QrCode },
  { label: 'Cell Management', icon: Users },
  { label: 'Import Members', icon: FileSpreadsheet },
  { label: 'First Timers', icon: UserRoundPlus },
  { label: 'Reports', icon: Activity },
  { label: 'Audit Logs', icon: Shield },
]



function App() {

  const [session, setSession] = useState(null)

  const [authLoading, setAuthLoading] = useState(true)

  const [roleLoading, setRoleLoading] = useState(true)

  const [appRole, setAppRole] = useState(null)

  const [roleError, setRoleError] = useState('')

  const [activePage, setActivePage] = useState('Harvest Dashboard')
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('jclm-theme') || 'light' } catch { return 'light' } })

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [signingOut, setSigningOut] = useState(false)

  const [authError, setAuthError] = useState('')
  const [publicView, setPublicView] = useState('home')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberSearchLoading, setMemberSearchLoading] = useState(false)
  const [memberCheckInLoading, setMemberCheckInLoading] = useState(false)
  const [memberCheckInMessage, setMemberCheckInMessage] = useState('')
  const [memberCheckInError, setMemberCheckInError] = useState('')
  const [firstTimerForm, setFirstTimerForm] = useState({ full_name: '', date_of_birth: '', contact_number: '', invited_by: '' })
  const [firstTimerSaving, setFirstTimerSaving] = useState(false)
  const [firstTimerInviterResults, setFirstTimerInviterResults] = useState([])
  const [firstTimerInviterLoading, setFirstTimerInviterLoading] = useState(false)
  const [firstTimerError, setFirstTimerError] = useState('')
  const [firstTimerSuccess, setFirstTimerSuccess] = useState(false)
  const [firstTimerAlreadyCheckedIn, setFirstTimerAlreadyCheckedIn] = useState(false)



  useEffect(() => {

    let active = true



    async function loadSession() {

      const { data, error } = await supabase.auth.getSession()

      if (!active) return



      if (error) {

        console.error('Unable to restore session:', error.message)

        setAuthError('Unable to verify your session. Please refresh and try again.')

      }



      setSession(data?.session ?? null)

      setAuthLoading(false)

    }



    loadSession()



    const {

      data: { subscription },

    } = supabase.auth.onAuthStateChange((_event, newSession) => {

      setSession(newSession)

      setAuthLoading(false)

      if (!newSession) setActivePage('Harvest Dashboard')

    })



    return () => {

      active = false

      subscription.unsubscribe()

    }

  }, [])



  useEffect(() => {

    let active = true



    async function loadAppRole() {

      setRoleLoading(true)

      setAppRole(null)

      setRoleError('')



      if (!session) {

        setRoleLoading(false)

        return

      }



      const { data, error } = await supabase.rpc('get_my_app_role')



      if (!active) return



      if (error) {

        console.error('Unable to verify application role:', error.message)

        setRoleError('We could not verify your access permissions. Please sign out and try again.')

        setRoleLoading(false)

        return

      }



      const roleRow = Array.isArray(data) ? data[0] : null

      setAppRole(roleRow?.role ?? null)

      setRoleLoading(false)

    }



    loadAppRole()



    return () => {

      active = false

    }

  }, [session])



  useEffect(() => {
    try { localStorage.setItem('jclm-theme', theme) } catch {}
    document.documentElement.dataset.theme = theme
  }, [theme])

  function navigate(label) {

    setActivePage(label)

    setMobileMenuOpen(false)

  }



  async function handleSignOut() {

    setSigningOut(true)

    setAuthError('')



    const { error } = await supabase.auth.signOut()

    if (error) {

      console.error('Sign out failed:', error.message)

      setAuthError('Sign out failed. Please try again.')

    }

    setSigningOut(false)

  }



  if (authLoading || (session && roleLoading)) {

    return (

      <main data-theme={theme} className={`status-screen min-h-screen flex items-center justify-center p-6 theme-${theme}`}>

        <p className="text-lime-400 font-semibold">VERIFYING ACCESS...</p>

      </main>

    )

  }



  if (!session) {
    if (publicView === 'member-checkin') {
      return (
        <main className="welcome-shell">
          <button type="button" className="back-link" onClick={() => { setPublicView('home'); setMemberSearch(''); setMemberResults([]); setSelectedMember(null); setMemberCheckInError(''); setMemberCheckInMessage('') }}>
            ← Back to choices
          </button>
          <section className="welcome-panel member-checkin-panel">
            <div className="welcome-mark church-logo-mark"><img src={churchLogo} alt="Jesus Christ the Lifegiver Ministries logo" /></div>
            <p className="eyebrow">JESUS CHRIST THE LIFEGIVER MINISTRIES</p>
            <h1>Log Attendance</h1>
            <p className="welcome-copy">Type your name and select your member record to check in.</p>
            {!memberCheckInMessage && (
              <>
                <label className="member-search-label" htmlFor="public-member-search">Search your full name</label>
                <input
                  id="public-member-search"
                  className="member-search-input"
                  type="search"
                  autoComplete="off"
                  value={memberSearch}
                  placeholder="Start typing your name..."
                  onChange={async (event) => {
                    const value = sanitizePersonName(event.target.value)
                    setMemberSearch(value)
                    setSelectedMember(null)
                    setMemberCheckInError('')
                    setMemberResults([])
                    if (value.trim().length < 2) return
                    setMemberSearchLoading(true)
                    const { data, error } = await supabase.rpc('harvest_ops_search_people', { search_text: value.trim() })
                    setMemberSearchLoading(false)
                    if (error) {
                      setMemberCheckInError('We could not search members right now. Please ask a church leader for help.')
                      return
                    }
                    setMemberResults(Array.isArray(data) ? data : [])
                  }}
                />
                {memberSearchLoading && <p className="member-helper">Searching members…</p>}
                {memberSearch.trim().length >= 2 && !memberSearchLoading && memberResults.length === 0 && !selectedMember && !memberCheckInError && (
                  <p className="member-helper">No matching active members or Cell Leaders found. Check your spelling or ask a church leader for help.</p>
                )}
                {memberResults.length > 0 && !selectedMember && (
                  <div className="member-result-list" role="listbox" aria-label="Matching members">
                    {memberResults.map((member) => (
                      <button key={member.id} type="button" className="member-result-option" onClick={() => { setSelectedMember(member); setMemberSearch(member.full_name); setMemberResults([]) }}>
                        <span>{member.full_name}<small className="inviter-type-label">{member.person_type === 'cell_leader' ? 'Cell Leader' : 'Member'}</small></span><ChevronRight size={18} />
                      </button>
                    ))}
                  </div>
                )}
                {selectedMember && (
                  <div className="selected-member-card">
                    <p className="member-helper">Selected {selectedMember.person_type === 'cell_leader' ? 'Cell Leader' : 'Member'}</p>
                    <strong>{selectedMember.full_name}</strong>
                    <button type="button" className="welcome-cta member-submit" disabled={memberCheckInLoading} onClick={async () => {
                      setMemberCheckInLoading(true)
                      setMemberCheckInError('')
                      const { data, error } = await supabase.rpc('harvest_ops_record_attendance', {
                        target_person_id: selectedMember.id,
                        target_person_type: selectedMember.person_type || 'member',
                        target_method: 'qr',
                      })
                      setMemberCheckInLoading(false)
                      if (error) {
                        setMemberCheckInError('We could not record your attendance. Please ask a church leader for help.')
                        return
                      }
                      const result = Array.isArray(data) ? data[0] : data
                      if (result?.status === 'already_checked_in') {
                        setMemberCheckInMessage('ALREADY_RECORDED: Our records confirm that you have already logged your attendance for this event. No additional attendance record was created.')
                      } else if (result?.status === 'use_member_record') {
                        setMemberCheckInError('This Cell Leader also has a matching member record. Please go back and select the Member entry so attendance is recorded only once.')
                      } else if (result?.status === 'checked_in') {
                        setMemberCheckInMessage('Your attendance has been recorded. Thank you for joining us!')
                      } else {
                        setMemberCheckInError('We could not confirm your check-in. Please ask a church leader for help.')
                      }
                    }}>
                      {memberCheckInLoading ? 'Recording attendance…' : 'Confirm Check-In'} <ChevronRight size={19} />
                    </button>
                    <button type="button" className="member-change-button" onClick={() => { setSelectedMember(null); setMemberSearch(''); setMemberCheckInError('') }}>That's not me — choose another name</button>
                  </div>
                )}
                {memberCheckInError && <p className="setup-note" role="alert">{memberCheckInError}</p>}
              </>
            )}
            {memberCheckInMessage && (
              <div className="member-success" role="status">
                <span className="member-success-icon">✓</span>
                <h2>{memberCheckInMessage.startsWith('ALREADY_RECORDED:') ? 'Attendance Already Recorded' : "You're all set!"}</h2>
                <p>{memberCheckInMessage.replace('ALREADY_RECORDED: ', '')}</p>
                <button type="button" className="welcome-cta" onClick={() => { setPublicView('home'); setMemberSearch(''); setMemberResults([]); setSelectedMember(null); setMemberCheckInMessage(''); setMemberCheckInError('') }}>Back to welcome page</button>
              </div>
            )}
            <p className="member-privacy-note">Only active members and Cell Leaders are searchable. Please ask a church leader if you need assistance.</p>
          </section>
        </main>
      )
    }

    if (publicView === 'member-login') {
      return (
        <div className="public-shell">
          <button type="button" className="back-link" onClick={() => setPublicView('home')}>
            ← Back to choices
          </button>
          <Login onLogin={setSession} theme={theme} onThemeToggle={() => setTheme(current => current === 'light' ? 'dark' : 'light')} />
        </div>
      )
    }

    if (publicView === 'first-timer') {
      async function submitFirstTimer(event) {
        event.preventDefault()
        setFirstTimerError('')
        if (!firstTimerForm.full_name.trim() || !firstTimerForm.date_of_birth || !firstTimerForm.invited_by.trim()) {
          setFirstTimerError('Please enter your full name, date of birth, and who invited you.')
          return
        }

        setFirstTimerSaving(true)
        const { data, error } = await supabase.rpc('harvest_ops_register_first_timer', {
          visitor_full_name: firstTimerForm.full_name.trim(),
          visitor_date_of_birth: firstTimerForm.date_of_birth,
          visitor_contact_number: firstTimerForm.contact_number.trim() || null,
          visitor_invited_by: firstTimerForm.invited_by.trim(),
        })
        setFirstTimerSaving(false)

        if (error) {
          console.error('First-timer registration failed:', error.message)
          setFirstTimerError('We could not complete your registration right now. Please ask a church leader for help.')
          return
        }

        const result = Array.isArray(data) ? data[0] : data
        if (result?.status === 'possible_duplicate') {
          setFirstTimerError('We found an existing first-timer record with the same name. Please ask a JCLM church leader to verify your information. If you are a different person with the same name, a leader can add you manually. No new profile or attendance record was created.')
        } else if (result?.status === 'invalid_characters') {
          setFirstTimerError('Please use letters, spaces, periods, apostrophes, or hyphens in names.');
        } else if (result?.status === 'already_checked_in') {
          setFirstTimerAlreadyCheckedIn(true)
          setFirstTimerSuccess(true)
        } else if (result?.status === 'registered' || result?.status === 'already_registered') {
          setFirstTimerAlreadyCheckedIn(false)
          setFirstTimerSuccess(true)
        } else {
          setFirstTimerError('We could not confirm your registration. Please ask a church leader for help.')
        }
      }

      return (
        <main className="welcome-shell">
          <button type="button" className="back-link" onClick={() => { setPublicView('home'); setFirstTimerError(''); setFirstTimerSuccess(false); setFirstTimerAlreadyCheckedIn(false) }}>
            ← Back to choices
          </button>
          <section className="welcome-panel first-timer-panel">
            <div className="welcome-mark church-logo-mark"><img src={churchLogo} alt="Jesus Christ the Lifegiver Ministries logo" /></div>
            <p className="eyebrow">JESUS CHRIST THE LIFEGIVER MINISTRIES</p>
            {firstTimerSuccess ? (
              <div className="member-success" role="status">
                <span className="member-success-icon">✓</span>
                <h2>{firstTimerAlreadyCheckedIn ? 'Attendance Already Recorded' : 'Welcome to the JCLM Family!'}</h2>
                <p>{firstTimerAlreadyCheckedIn
                  ? 'Our records confirm that your attendance has already been logged for this event. No additional attendance record was created.'
                  : "Your information has been submitted and your attendance has been recorded. We're glad you're here!"}</p>
                <button type="button" className="welcome-cta" onClick={() => { setPublicView('home'); setFirstTimerForm({ full_name: '', date_of_birth: '', contact_number: '', invited_by: '' }); setFirstTimerSuccess(false); setFirstTimerAlreadyCheckedIn(false); setFirstTimerError('') }}>Back to welcome page</button>
              </div>
            ) : (
              <>
                <h1>Welcome to the JCLM Family! <span aria-hidden="true">💚</span></h1>
                <p className="welcome-copy">
                  We're so glad you're here! Whether this is your first time visiting or you're just getting to know us, we pray that you'll experience God's love, grace, and presence today.
                </p>
                <p className="welcome-copy">
                  Please fill out this short form so we can welcome you personally and stay connected with you.
                </p>
                                <form className="first-timer-form" onSubmit={submitFirstTimer}>
                  <label className="member-search-label" htmlFor="visitor-full-name">Full name <span aria-hidden="true">*</span></label>
                  <input id="visitor-full-name" className="member-search-input" type="text" autoComplete="name" maxLength={120} value={firstTimerForm.full_name} placeholder="Enter your full name" title="Use letters, spaces, periods, apostrophes, or hyphens." onChange={e => setFirstTimerForm(current => ({ ...current, full_name: sanitizePersonName(e.target.value) }))} required />
                  <label className="member-search-label" htmlFor="visitor-dob">Date of birth <span aria-hidden="true">*</span></label>
                  <input id="visitor-dob" className="member-search-input" type="date" autoComplete="bday" max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })} value={firstTimerForm.date_of_birth} onChange={e => setFirstTimerForm(current => ({ ...current, date_of_birth: e.target.value }))} required />
                  <label className="member-search-label" htmlFor="visitor-contact">Contact number <span className="optional-label">(optional)</span></label>
                  <input id="visitor-contact" className="member-search-input" type="tel" autoComplete="tel" maxLength={40} value={firstTimerForm.contact_number} placeholder="e.g. 09XX XXX XXXX" title="Use digits, spaces, plus, parentheses, or hyphens." onChange={e => setFirstTimerForm(current => ({ ...current, contact_number: sanitizePhone(e.target.value) }))} />
                  <label className="member-search-label" htmlFor="visitor-invited-by">Who invited you? <span aria-hidden="true">*</span></label>
                  <input id="visitor-invited-by" className="member-search-input" type="text" autoComplete="off" maxLength={120} value={firstTimerForm.invited_by} placeholder="Type a member or leader's name" title="Use letters, spaces, periods, apostrophes, or hyphens." onChange={async e => {
                    const value = sanitizePersonName(e.target.value)
                    setFirstTimerForm(current => ({ ...current, invited_by: value }))
                    setFirstTimerInviterResults([])
                    if (value.trim().length < 2) return
                    setFirstTimerInviterLoading(true)
                    const { data, error } = await supabase.rpc('harvest_ops_search_inviters', { search_text: value.trim() })
                    setFirstTimerInviterLoading(false)
                    if (!error && Array.isArray(data)) setFirstTimerInviterResults(data)
                  }} required />
                  {firstTimerInviterLoading && <p className="member-helper">Searching names…</p>}
                  {firstTimerInviterResults.length > 0 && (
                    <div className="member-result-list" role="listbox" aria-label="Suggested inviters">
                      {firstTimerInviterResults.map((person) => (
                        <button key={`${person.inviter_type}:${person.id}`} type="button" className="member-result-option" onClick={() => {
                          setFirstTimerForm(current => ({ ...current, invited_by: person.full_name }))
                          setFirstTimerInviterResults([])
                        }}>
                          <span>{person.full_name}<small className="inviter-type-label">{person.inviter_type === 'member' ? 'Member' : 'Cell Leader'}</small></span><ChevronRight size={18} />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="member-helper">Choose a suggestion or enter another person's name.</p>
                  {firstTimerError && <p className="setup-note" role="alert">{firstTimerError}</p>}
                  <button type="submit" className="welcome-cta first-timer-submit" disabled={firstTimerSaving}>
                    {firstTimerSaving ? 'Submitting…' : "Submit & Check In"} <ChevronRight size={19} />
                  </button>
                </form>
              </>
            )}
          </section>
        </main>
      )
    }

    return (
      <main className="welcome-shell landing-shell">
        <section className="landing-content">
          <div className="landing-brand">
            <div className="harvest-logo-wrap landing-logo-wrap"><span className="harvest-logo-fallback" aria-hidden="true"><Shield size={54} /><Cross size={25} /></span><img className="harvest-event-logo" src={harvestLogo} alt="Call of Duty: One Mission — Harvest Gathering" /></div>
            <p className="eyebrow">JESUS CHRIST THE LIFEGIVER MINISTRIES</p>
            <h1>CALL OF <span>DUTY</span></h1>
            <p className="brand-subtitle">ONE MISSION • LUKE 19:10</p>
          </div>
          <div className="landing-heading">
            <p className="eyebrow">WE'RE HAPPY YOU'RE HERE</p>
            <h2>Welcome!</h2>
            <p>Please choose an option to continue.</p>
          </div>
          <div className="choice-grid">
            <button type="button" className="choice-card choice-card-light" onClick={() => { setPublicView('member-checkin'); setMemberCheckInError(''); setMemberCheckInMessage('') }}>
              <span className="choice-icon"><ClipboardCheck size={34} /></span>
              <span className="choice-title">Log Attendance</span>
              <span className="choice-description">For registered JCLM members</span>
              <span className="choice-arrow"><ChevronRight size={20} /></span>
            </button>
            <button type="button" className="choice-card choice-card-green" onClick={() => { setAuthError(''); setPublicView('first-timer') }}>
              <span className="choice-icon"><UserRoundPlus size={34} /></span>
              <span className="choice-title">I'm a First Timer</span>
              <span className="choice-description">New here? We'd love to welcome you!</span>
              <span className="choice-arrow"><ChevronRight size={20} /></span>
            </button>
          </div>
          <div className="leader-login-link">
            <button
              type="button"
              className="member-change-button"
              onClick={() => { setAuthError(''); setPublicView('member-login') }}
            >
              Leader Login
            </button>
          </div>
          <footer className="landing-footer">
            <span>“For we are His workmanship...”</span>
            <span>Ephesians 2:10</span>
          </footer>
        </section>
        <div className="leaf-decoration leaf-decoration-one" />
        <div className="leaf-decoration leaf-decoration-two" />
      </main>
    )
  }



  if (roleError || appRole !== 'network_leader') {

    return (

      <main data-theme={theme} className={`status-screen min-h-screen flex items-center justify-center p-6 theme-${theme}`}>

        <section className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">

            <Shield size={28} />

          </div>

          <h1 className="mt-5 text-center text-xl font-bold">

            {roleError ? 'Access Verification Failed' : 'Access Denied'}

          </h1>

          <p className="mt-3 text-center text-sm leading-6 text-gray-400">

            {roleError

              ? roleError

              : 'Your account is signed in, but it does not have permission to access the JCLM Network dashboard. Contact your Network Leader if you believe this is a mistake.'}

          </p>

          <button

            type="button"

            onClick={handleSignOut}

            disabled={signingOut}

            className="primary-button mt-6 inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"

          >

            <LogOut size={17} />

            {signingOut ? 'Signing out…' : 'Sign out'}

          </button>

        </section>

      </main>

    )

  }



  return (

    <div className={`app-shell min-h-screen theme-${theme}`} data-theme={theme}>

      <div className="flex min-h-screen">

        {/* Desktop sidebar */}

        <aside className="sidebar hidden p-5 md:flex md:flex-col">

          <div className="mb-9 flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-lime-300">

              <img className="sidebar-church-logo" src={churchLogo} alt="Jesus Christ the Lifegiver Ministries" />

            </div>

            <div>

              <h1 className="brand-accent text-lg font-bold">HARVEST OPS</h1>

              <p className="text-xs tracking-widest text-gray-400">HARVEST GATHERING</p>

            </div>

          </div>



          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">

            Operations

          </p>



          <nav className="space-y-1">

            {navigation.map(({ label, icon: Icon }) => (

              <button

                key={label}

                type="button"

                onClick={() => navigate(label)}

                className={`nav-item ${activePage === label ? 'active' : ''}`}

                aria-current={activePage === label ? 'page' : undefined}

              >

                <Icon size={19} />

                <span>{label}</span>

              </button>

            ))}

          </nav>



          <div className="mt-auto rounded-xl border border-gray-700 p-3">

            <p className="brand-accent text-xs font-semibold">SYSTEM STATUS</p>

            <p className="mt-2 text-sm text-gray-300">

              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-lime-400" />

              Interface ready

            </p>

            <p className="mt-1 text-xs text-gray-500">Database integration in progress</p>

          </div>

        </aside>



        {/* Main application */}

        <main className="min-w-0 flex-1">

          <header className="flex items-center justify-between border-b border-gray-800 px-4 py-4 sm:px-7">

            <div className="flex items-center gap-3">

              <button

                type="button"

                className="rounded-lg p-2 hover:bg-gray-800 md:hidden"

                aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}

                aria-expanded={mobileMenuOpen}

                onClick={() => setMobileMenuOpen((open) => !open)}

              >

                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}

              </button>

              <div>

                <p className="text-xs uppercase tracking-widest text-gray-500">

                  JCLM / HARVEST OPERATION

                </p>

                <h2 className="mt-1 text-lg font-semibold sm:text-xl">{activePage}</h2>

              </div>

            </div>



            <div className="flex items-center gap-3">

              <div className="hidden items-center gap-2 rounded-full border border-gray-700 px-3 py-2 text-xs text-gray-400 sm:flex">

                <span className="h-2 w-2 rounded-full bg-lime-400" />

                ADMIN WORKSPACE

              </div>

              <button
                type="button"
                onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
                className="theme-toggle inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
                <span className="hidden sm:inline">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
              </button>

              <button

                type="button"

                onClick={handleSignOut}

                disabled={signingOut}

                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"

              >

                <LogOut size={17} />

                <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>

              </button>

            </div>

          </header>



          {authError && (

            <p role="alert" className="mx-4 mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300 sm:mx-7">

              {authError}

            </p>

          )}



          {/* Mobile navigation */}

          {mobileMenuOpen && (

            <nav className="space-y-1 border-b border-gray-800 p-4 md:hidden">

              {navigation.map(({ label, icon: Icon }) => (

                <button

                  key={label}

                  type="button"

                  onClick={() => navigate(label)}

                  className={`nav-item ${activePage === label ? 'active' : ''}`}

                  aria-current={activePage === label ? 'page' : undefined}

                >

                  <Icon size={19} />

                  <span>{label}</span>

                  <ChevronRight className="ml-auto" size={16} />

                </button>

              ))}

            </nav>

          )}



          {/* Command Center */}

          {/* Command Center uses the live Dashboard component below. */}

          {activePage === 'Cell Management' && <CellManagement />}
          {activePage === 'Import Members' && <ImportMembers />}
          {activePage === 'First Timers' && <FirstTimers />}
          {activePage === 'Attendance Check-In' && <AttendanceCheckIn />}
          {activePage === 'QR Attendance Check-In' && <QRAttendance />}
          {activePage === 'Harvest Dashboard' && <Dashboard mode="harvest" />}

          {activePage === 'Reports' && <HarvestReports />}
          {activePage === 'Audit Logs' && <AuditLogs />}

        </main>

      </div>

    </div>

  )

}



export default App
