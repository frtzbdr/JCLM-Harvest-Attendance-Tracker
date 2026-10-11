import { useEffect, useState } from 'react'
import { RefreshCw, UserRoundPlus, PlusCircle, CheckCircle2, ChevronRight, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
const initialForm = { full_name: '', date_of_birth: '', gender: '', contact_number: '', invited_by: '' }
const emptyEditForm = { full_name: '', date_of_birth: '', gender: '', contact_number: '', invited_by: '', assignment_type: 'Open Cell', assigned_cell_leader_id: '', other_cell_leader_name: '' }

export default function FirstTimers() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [inviterResults, setInviterResults] = useState([])
  const [inviterLoading, setInviterLoading] = useState(false)
  const [leaders, setLeaders] = useState([])
  const [editingRow, setEditingRow] = useState(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editSaving, setEditSaving] = useState(false)

  async function load() {
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase
      .from('harvest_ops_first_timers')
      .select('id,full_name,date_of_birth,gender,contact_number,invited_by,assignment_type,assigned_cell_leader_id,other_cell_leader_name,created_at')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message || 'Could not load first timers.')
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase.from('cell_leaders').select('id,full_name,is_active').eq('is_active', true).order('full_name').then(({ data }) => setLeaders(data || []))
  }, [])

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function searchInviters(value) {
    const cleanValue = value.trim()
    setForm(prev => ({ ...prev, invited_by: value }))
    setInviterResults([])
    if (cleanValue.length < 2) {
      setInviterLoading(false)
      return
    }
    setInviterLoading(true)
    const { data, error: searchError } = await supabase.rpc('harvest_ops_search_inviters', {
      search_text: cleanValue
    })
    setInviterLoading(false)
    if (!searchError && Array.isArray(data)) setInviterResults(data)
  }

  async function submit(event) {
    event.preventDefault()
    setError(''); setNotice('')
    const name = form.full_name.trim()
    const invitedBy = form.invited_by.trim()
    const phone = form.contact_number.trim()
    if (!name || !form.date_of_birth || !form.gender || !invitedBy) {
      setError('Enter the full name, date of birth, gender, and who invited the first timer.')
      return
    }
    if (name.length > 120 || invitedBy.length > 120 || /[<>;]|--|\/\*|\*\//.test(name + invitedBy)) {
      setError('Please check the name and invited-by fields. Unsupported or unsafe characters were found.')
      return
    }
    if (phone && !/^[0-9+()\-\s]{5,25}$/.test(phone)) {
      setError('Enter a valid contact number using digits, spaces, +, parentheses, or hyphens.')
      return
    }
    if (new Date(form.date_of_birth + 'T00:00:00') > new Date()) {
      setError('Date of birth cannot be in the future.')
      return
    }
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc('harvest_ops_admin_register_first_timer', {
      target_full_name: name,
      target_date_of_birth: form.date_of_birth,
      target_gender: form.gender,
      target_contact_number: phone || null,
      target_invited_by: invitedBy,
      record_attendance_now: true
    })
    setSaving(false)
    if (rpcError) {
      console.error('Manual first-timer registration failed:', rpcError.message)
      setError('Could not save the first timer. Confirm the admin registration migration is installed and that your account has permission.')
      return
    }
    const result = Array.isArray(data) ? data[0] : data
    if (result?.status === 'duplicate') {
      setError('A possible duplicate was found. No new first-timer or attendance record was created.')
      return
    }
    setNotice(result?.attendance_status === 'already_checked_in'
      ? 'First timer saved. Attendance was already recorded.'
      : 'First timer registered and attendance recorded successfully.')
    setForm(initialForm)
    setInviterResults([])
    await load()
  }

  async function saveEdit(event) {
    event.preventDefault(); setError(''); setNotice('')
    if (!editForm.full_name.trim() || !editForm.date_of_birth || !editForm.gender || !editForm.invited_by.trim()) { setError('Full name, date of birth, gender, and invited by are required.'); return }
    if (editForm.assignment_type === 'Cell Leader' && !editForm.assigned_cell_leader_id) { setError('Select a registered Cell Leader.'); return }
    if (editForm.assignment_type === 'Other Cell Group' && !editForm.other_cell_leader_name.trim()) { setError('Enter the other Cell Leader name.'); return }
    setEditSaving(true)
    const { error: updateError } = await supabase.from('harvest_ops_first_timers').update({
      full_name: editForm.full_name.trim(), date_of_birth: editForm.date_of_birth, gender: editForm.gender,
      contact_number: editForm.contact_number.trim() || null, invited_by: editForm.invited_by.trim(),
      assignment_type: editForm.assignment_type,
      assigned_cell_leader_id: editForm.assignment_type === 'Cell Leader' ? editForm.assigned_cell_leader_id : null,
      other_cell_leader_name: editForm.assignment_type === 'Other Cell Group' ? editForm.other_cell_leader_name.trim() : null
    }).eq('id', editingRow.id)
    setEditSaving(false)
    if (updateError) { setError('Could not update this record. Apply the supplied SQL migration and confirm table permissions.'); return }
    setEditingRow(null); setNotice('First Timer details and assignment updated.'); await load()
  }

  const filtered = rows.filter(row => {
    const query = search.toLowerCase().trim()
    return !query || row.full_name.toLowerCase().includes(query) ||
      (row.contact_number || '').toLowerCase().includes(query) ||
      (row.invited_by || '').toLowerCase().includes(query)
  })

  return (
    <section className="first-timers-page mx-auto max-w-7xl p-4 sm:p-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserRoundPlus className="brand-accent" size={34} />
          <div>
            <p className="brand-accent text-xs font-bold uppercase tracking-widest">HARVEST OPS / New Arrivals</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">First Timers</h2>
            <p className="mt-2 text-sm text-slate-500">Register first timers manually if QR registration is unavailable, and record their Harvest Gathering attendance.</p>
          </div>
        </div>
        <button className="secondary-button inline-flex items-center gap-2" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17}/>{notice}</p>}

      <div className="first-timer-admin-grid">
        <div className="tactical-card p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <UserRoundPlus className="brand-accent" size={24} />
            <div>
              <h3 className="text-lg font-bold">Manual First Timer Registration</h3>
              <p className="mt-1 text-sm text-slate-500">This will also record attendance for the Harvest Gathering.</p>
            </div>
          </div>
          <form className="first-timer-admin-form" onSubmit={submit}>
            <label>Full name <span>*</span><input className="form-control" value={form.full_name} maxLength={120} onChange={e => update('full_name', e.target.value)} autoComplete="name" required /></label>
            <label>Date of birth <span>*</span><input className="form-control" type="date" value={form.date_of_birth} max={new Date().toISOString().slice(0,10)} onChange={e => update('date_of_birth', e.target.value)} required /></label>
            <label>Gender <span>*</span><select className="form-control" value={form.gender} onChange={e => update('gender', e.target.value)} required><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
            <label>Contact number <small>(optional)</small><input className="form-control" value={form.contact_number} maxLength={25} onChange={e => update('contact_number', e.target.value)} autoComplete="tel" placeholder="e.g. 09XX XXX XXXX" /></label>
            <div className="inviter-autocomplete">
              <label htmlFor="admin-first-timer-invited-by">Who invited you? <span>*</span></label>
              <input
                id="admin-first-timer-invited-by"
                className="form-control"
                value={form.invited_by}
                maxLength={120}
                autoComplete="off"
                placeholder="Start typing a member or leader's name"
                onChange={e => searchInviters(e.target.value)}
                required
              />
              {inviterLoading && <p className="inviter-helper">Searching members and leaders…</p>}
              {!inviterLoading && inviterResults.length > 0 && (
                <div className="member-result-list admin-inviter-results" role="listbox" aria-label="Suggested inviters">
                  {inviterResults.map(person => (
                    <button
                      key={`${person.inviter_type}:${person.id}`}
                      type="button"
                      className="member-result-option"
                      onClick={() => {
                        setForm(prev => ({ ...prev, invited_by: person.full_name }))
                        setInviterResults([])
                      }}
                    >
                      <span>{person.full_name}<small className="inviter-type-label">{person.inviter_type === 'member' ? 'Member' : 'Cell Leader'}</small></span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              )}
              <p className="inviter-helper">Choose a suggestion or enter another person's name.</p>
            </div>
            <button className="primary-button inline-flex items-center justify-center gap-2" type="submit" disabled={saving}>
              <PlusCircle size={17}/>{saving ? 'Saving registration…' : 'Register First Timer & Log Attendance'}
            </button>
          </form>
        </div>

        <div className="tactical-card p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserRoundPlus className="brand-accent" />
            <input className="form-control w-full" placeholder="Search name, contact, or invited by" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? <p className="p-6 text-center text-slate-500">Loading first timers…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr><th className="p-3">Full name</th><th className="p-3">Date of birth</th><th className="p-3">Gender</th><th className="p-3">Contact</th><th className="p-3">Invited by</th><th className="p-3">Registered</th><th className="p-3">Assignment</th><th className="p-3">Action</th></tr></thead>
                <tbody>{filtered.map(row => <tr className="border-t" key={row.id}>
                  <td className="p-3 font-medium">{row.full_name}</td><td className="p-3">{row.date_of_birth || '—'}</td><td className="p-3">{row.gender || '—'}</td><td className="p-3">{row.contact_number || '—'}</td><td className="p-3">{row.invited_by}</td>
                  <td className="p-3">{new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td><td className="p-3">{row.assignment_type || 'Unassigned'}</td><td className="p-3"><button type="button" className="secondary-button inline-flex items-center gap-1" onClick={() => { setEditingRow(row); setEditForm({ full_name: row.full_name || '', date_of_birth: row.date_of_birth || '', gender: row.gender || '', contact_number: row.contact_number || '', invited_by: row.invited_by || '', assignment_type: row.assignment_type || 'Open Cell', assigned_cell_leader_id: row.assigned_cell_leader_id || '', other_cell_leader_name: row.other_cell_leader_name || '' }); setError(''); setNotice('') }}><Pencil size={14}/>Edit / Assign</button></td>
                </tr>)}</tbody>
              </table>
              {filtered.length === 0 && <p className="p-6 text-center text-slate-500">No first-timer registrations found.</p>}
            </div>
          )}
        </div>
      </div>
      {editingRow && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation"><form onSubmit={saveEdit} className="tactical-card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-5" role="dialog" aria-modal="true" aria-labelledby="edit-first-timer-title"><div className="flex items-center justify-between gap-3"><h3 id="edit-first-timer-title" className="text-xl font-bold">Edit / Assign — {editingRow.full_name}</h3><button type="button" className="secondary-button" onClick={() => setEditingRow(null)}>Close</button></div><div className="grid gap-3 sm:grid-cols-2"><label>Full name *<input className="form-control mt-1 w-full" value={editForm.full_name} onChange={e=>setEditForm({...editForm,full_name:e.target.value})} required maxLength={120}/></label><label>Date of birth *<input type="date" className="form-control mt-1 w-full" value={editForm.date_of_birth} onChange={e=>setEditForm({...editForm,date_of_birth:e.target.value})} required/></label><label>Gender *<select className="form-control mt-1 w-full" value={editForm.gender} onChange={e=>setEditForm({...editForm,gender:e.target.value})} required><option value="">Select gender</option><option>Male</option><option>Female</option></select></label><label>Contact number<input className="form-control mt-1 w-full" value={editForm.contact_number} onChange={e=>setEditForm({...editForm,contact_number:e.target.value})}/></label><label className="sm:col-span-2">Invited by *<input className="form-control mt-1 w-full" value={editForm.invited_by} onChange={e=>setEditForm({...editForm,invited_by:e.target.value})} required/></label><label className="sm:col-span-2">Cell assignment *<select className="form-control mt-1 w-full" value={editForm.assignment_type} onChange={e=>setEditForm({...editForm,assignment_type:e.target.value,assigned_cell_leader_id:'',other_cell_leader_name:''})}><option>Cell Leader</option><option>Open Cell</option><option>Other Cell Group</option></select></label>{editForm.assignment_type === 'Cell Leader' && <label className="sm:col-span-2">Registered Cell Leader *<select className="form-control mt-1 w-full" value={editForm.assigned_cell_leader_id} onChange={e=>setEditForm({...editForm,assigned_cell_leader_id:e.target.value})} required><option value="">Select Cell Leader</option>{leaders.map(l=><option key={l.id} value={l.id}>{l.full_name}</option>)}</select></label>}{editForm.assignment_type === 'Other Cell Group' && <label className="sm:col-span-2">Other Cell Leader name *<input className="form-control mt-1 w-full" value={editForm.other_cell_leader_name} onChange={e=>setEditForm({...editForm,other_cell_leader_name:e.target.value})} required maxLength={120}/></label>}</div><p className="text-sm text-slate-500">Review the details before saving. Updates are applied only after you select Save Changes.</p><div className="flex justify-end gap-2"><button type="button" className="secondary-button" onClick={()=>setEditingRow(null)}>Cancel</button><button type="submit" className="primary-button" disabled={editSaving}>{editSaving?'Saving…':'Save Changes'}</button></div></form></div>}
    </section>
  )
}
