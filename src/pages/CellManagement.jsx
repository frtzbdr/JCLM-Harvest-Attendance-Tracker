import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRightLeft,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
const emptyLeaderForm = { full_name: '', contact_number: '' }
const emptyMemberForm = { full_name: '', contact_number: '', cell_leader_id: '', assignment_type: 'Cell Leader', other_cell_leader_name: '' }

export default function CellManagement() {
  const [leaders, setLeaders] = useState([])
  const [members, setMembers] = useState([])
  const [firstTimers, setFirstTimers] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewMembersLeaderId, setViewMembersLeaderId] = useState(null)

  const [leaderModal, setLeaderModal] = useState(false)
  const [editingLeaderId, setEditingLeaderId] = useState(null)
  const [leaderForm, setLeaderForm] = useState(emptyLeaderForm)
  const [savingLeader, setSavingLeader] = useState(false)

  const [memberModal, setMemberModal] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState(null)
  const [memberForm, setMemberForm] = useState(emptyMemberForm)
  const [savingMember, setSavingMember] = useState(false)

  async function loadCellData() {
    setLoading(true)
    setError('')
    try {
      const [
        { data: leaderRows, error: leadersError },
        { data: memberRows, error: membersError },
        { data: firstTimerRows, error: firstTimersError },
      ] = await Promise.all([
        supabase
          .from('cell_leaders')
          .select('id, full_name, contact_number, is_active, created_at')
          .order('full_name', { ascending: true }),
        supabase
          .from('members')
          .select('id, full_name, contact_number, cell_leader_id, is_active, created_at, assignment_type, other_cell_leader_name')
          .order('full_name', { ascending: true }),
        supabase.from('harvest_ops_first_timers').select('id,full_name,contact_number,assignment_type,assigned_cell_leader_id,other_cell_leader_name,created_at').order('full_name', { ascending: true }),
      ])
      if (leadersError) throw leadersError
      if (membersError) throw membersError
      if (firstTimersError) throw firstTimersError
      setLeaders(leaderRows ?? [])
      setMembers(memberRows ?? [])
      setFirstTimers(firstTimerRows ?? [])
    } catch (err) {
      setError(err.message || 'Unable to load Cell Management data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCellData()
  }, [])

  const activeLeaders = useMemo(
    () => leaders.filter(leader => leader.is_active),
    [leaders]
  )

  const filteredLeaders = useMemo(() => {
    const term = search.trim().toLowerCase()
    return leaders.filter(leader => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && leader.is_active) ||
        (statusFilter === 'inactive' && !leader.is_active)
      const matchesSearch =
        !term ||
        leader.full_name.toLowerCase().includes(term) ||
        (leader.contact_number || '').toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [leaders, search, statusFilter])

  const assignedFirstTimersFor = leaderId => firstTimers.filter(row => row.assignment_type === 'Cell Leader' && row.assigned_cell_leader_id === leaderId)
  const openCellFirstTimers = firstTimers.filter(row => !row.assignment_type || row.assignment_type === 'Open Cell')
  const openCellMembers = members.filter(member => !member.cell_leader_id)
  const activeMemberCount = members.filter(member => member.is_active).length + firstTimers.length
  const assignedActiveMemberCount = members.filter(member => member.is_active && member.cell_leader_id).length + firstTimers.filter(row => row.assignment_type === 'Cell Leader' && row.assigned_cell_leader_id).length

  function openAddLeader() {
    setError('')
    setNotice('')
    setEditingLeaderId(null)
    setLeaderForm(emptyLeaderForm)
    setLeaderModal(true)
  }

  function openEditLeader(leader) {
    setError('')
    setNotice('')
    setEditingLeaderId(leader.id)
    setLeaderForm({
      full_name: leader.full_name || '',
      contact_number: leader.contact_number || '',
    })
    setLeaderModal(true)
  }

  async function saveLeader(event) {
    event.preventDefault()
    const name = leaderForm.full_name.trim()
    const contact = leaderForm.contact_number.trim()
    if (!name) return

    setSavingLeader(true)
    setError('')
    setNotice('')
    try {
      const { data: existing, error: checkError } = await supabase
        .from('cell_leaders')
        .select('id, full_name')
        .ilike('full_name', name)
        .neq('id', editingLeaderId || '00000000-0000-0000-0000-000000000000')
        .limit(1)
      if (checkError) throw checkError
      if (existing?.length) throw new Error('A Cell Leader with that name already exists.')

      const payload = { full_name: name, contact_number: contact || null }
      const result = editingLeaderId
        ? await supabase.from('cell_leaders').update(payload).eq('id', editingLeaderId)
        : await supabase.from('cell_leaders').insert(payload)
      if (result.error) throw result.error

      setLeaderModal(false)
      setNotice(editingLeaderId ? 'Cell Leader details updated.' : 'Cell Leader added.')
      await loadCellData()
    } catch (err) {
      setError(err.message || 'Unable to save Cell Leader.')
    } finally {
      setSavingLeader(false)
    }
  }

  async function toggleLeaderStatus(leader) {
    const nextActive = !leader.is_active
    const prompt = nextActive
      ? `Reactivate ${leader.full_name}?`
      : `Set ${leader.full_name} as inactive? Their active members will be moved to Open Cell.`
    if (!window.confirm(prompt)) return

    setError('')
    setNotice('')
    try {
      // Move active members first. If this fails, keep the leader active to avoid orphaned assignments.
      if (!nextActive) {
        const { error: moveError } = await supabase
          .from('members')
          .update({ cell_leader_id: null })
          .eq('cell_leader_id', leader.id)
          .eq('is_active', true)
        if (moveError) throw new Error(`Members could not be moved to Open Cell; leader was not deactivated. ${moveError.message}`)
      }
      const { error: updateError } = await supabase
        .from('cell_leaders')
        .update({ is_active: nextActive })
        .eq('id', leader.id)
      if (updateError) throw updateError
      setNotice(nextActive ? `${leader.full_name} is now active.` : `${leader.full_name} is inactive; their active members were moved to Open Cell.`)
      await loadCellData()
    } catch (err) {
      setError(err.message || 'Unable to update Cell Leader status.')
    }
  }

  function openAddMember(defaultLeaderId = '') {
    setError('')
    setNotice('')
    setEditingMemberId(null)
    setMemberForm({ ...emptyMemberForm, cell_leader_id: defaultLeaderId, assignment_type: defaultLeaderId ? 'Cell Leader' : 'Open Cell' })
    setMemberModal(true)
  }

  function openEditMember(member) {
    setError('')
    setNotice('')
    setEditingMemberId(member.id)
    setMemberForm({
      full_name: member.full_name || '',
      contact_number: member.contact_number || '',
      cell_leader_id: member.cell_leader_id || '',
      assignment_type: member.assignment_type || (member.cell_leader_id ? 'Cell Leader' : 'Open Cell'),
      other_cell_leader_name: member.other_cell_leader_name || '',
    })
    setMemberModal(true)
  }

  async function saveMember(event) {
    event.preventDefault()
    const name = memberForm.full_name.trim()
    const contact = memberForm.contact_number.trim()
    if (!name) return

    const chosenLeaderId = memberForm.assignment_type === 'Cell Leader' ? (memberForm.cell_leader_id || null) : null
    if (memberForm.assignment_type === 'Cell Leader' && !chosenLeaderId) {
      setError('Choose a Cell Leader.');
      return
    }
    if (memberForm.assignment_type === 'Other Cell Group' && !memberForm.other_cell_leader_name.trim()) {
      setError('Enter the other Cell Leader name.');
      return
    }
    if (chosenLeaderId && !activeLeaders.some(leader => leader.id === chosenLeaderId)) {
      setError('Choose an active Cell Leader, or choose Open Cell.')
      return
    }

    setSavingMember(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        full_name: name,
        contact_number: contact || null,
        cell_leader_id: chosenLeaderId,
        assignment_type: memberForm.assignment_type,
        other_cell_leader_name: memberForm.assignment_type === 'Other Cell Group' ? memberForm.other_cell_leader_name.trim() : null,
      }
      const result = editingMemberId
        ? await supabase.from('members').update(payload).eq('id', editingMemberId)
        : await supabase.from('members').insert(payload)
      if (result.error) throw result.error

      setMemberModal(false)
      setNotice(
        editingMemberId
          ? chosenLeaderId
            ? 'Member details and cell assignment updated.'
            : 'Member moved to Open Cell.'
          : 'Member added.'
      )
      await loadCellData()
    } catch (err) {
      setError(err.message || 'Unable to save member.')
    } finally {
      setSavingMember(false)
    }
  }

  async function toggleMemberStatus(member) {
    const nextActive = !member.is_active
    if (!window.confirm(
      `${nextActive ? 'Reactivate' : 'Set'} ${member.full_name} ${nextActive ? '?' : 'as inactive? Their attendance history will be preserved.'}`
    )) return

    setError('')
    setNotice('')
    const { error: updateError } = await supabase
      .from('members')
      .update({ is_active: nextActive })
      .eq('id', member.id)
    if (updateError) {
      setError(updateError.message || 'Unable to update member status.')
      return
    }
    setNotice(`${member.full_name} is now ${nextActive ? 'active' : 'inactive'}.`)
    await loadCellData()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="brand-accent text-xs font-bold uppercase tracking-widest">
            Personnel / Organization
          </p>
          <h2 className="mt-2 text-2xl font-bold">Cell Management</h2>
          <p className="mt-2 text-sm text-gray-400">
            Manage Cell Leaders, member records, and cell assignments.
          </p>
        </div>
        <button type="button" onClick={openAddLeader} className="primary-button inline-flex items-center justify-center gap-2">
          <Plus size={18} /> Add Cell Leader
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-900 bg-red-950/30 p-4">
          <AlertCircle className="mt-0.5 shrink-0 text-red-400" size={20} />
          <div className="min-w-0">
            <p className="font-semibold text-red-400">Action needs attention</p>
            <p className="mt-1 break-words text-sm text-gray-300">{error}</p>
          </div>
          <button type="button" aria-label="Dismiss error" onClick={() => setError('')} className="ml-auto text-gray-400">
            <X size={18} />
          </button>
        </div>
      )}
      {notice && !error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-lime-800/60 bg-lime-950/20 p-3 text-sm text-lime-300">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="tactical-card p-5">
          <p className="text-sm text-gray-400">Cell Leaders</p>
          <p className="mt-3 text-3xl font-bold">{leaders.length}</p>
          <p className="mt-1 text-xs text-gray-500">{activeLeaders.length} active</p>
        </div>
        <div className="tactical-card p-5">
          <p className="text-sm text-gray-400">Active Members</p>
          <p className="mt-3 text-3xl font-bold">{activeMemberCount}</p>
          <p className="mt-1 text-xs text-gray-500">{assignedActiveMemberCount} assigned to a cell</p>
        </div>
        <div className="tactical-card p-5">
          <p className="text-sm text-gray-400">Open Cell</p>
          <p className="mt-3 text-3xl font-bold">{openCellMembers.filter(member => member.is_active).length + openCellFirstTimers.length}</p>
          <p className="mt-1 text-xs text-gray-500">Active members without a Cell Leader</p>
        </div>
      </div>

      <section className="tactical-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search Cell Leaders..."
              className="w-full rounded-lg border border-gray-700 bg-gray-900 py-3 pl-10 pr-4 text-sm outline-none focus:border-lime-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-lime-400"
            aria-label="Filter Cell Leaders by status"
          >
            <option value="active">Active leaders</option>
            <option value="inactive">Inactive leaders</option>
            <option value="all">All leaders</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-8 text-sm text-gray-300">
            <LoaderCircle className="animate-spin brand-accent" size={20} /> Loading Cell Management data...
          </div>
        ) : filteredLeaders.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="brand-accent mx-auto" size={34} />
            <h3 className="mt-3 font-semibold">{leaders.length ? 'No matching Cell Leaders' : 'No Cell Leaders yet'}</h3>
            <p className="mt-1 text-sm text-gray-400">Try a different filter or add a Cell Leader.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredLeaders.map(leader => {
              const leaderMembers = members.filter(member => member.cell_leader_id === leader.id)
              const leaderFirstTimers = assignedFirstTimersFor(leader.id)
              const totalLeaderPeople = leaderMembers.length + leaderFirstTimers.length
              return (
                <article key={leader.id} className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-xl bg-lime-300/10 p-3"><UserRound className="brand-accent" size={23} /></div>
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold">{leader.full_name}</h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {leaderMembers.filter(member => member.is_active).length + leaderFirstTimers.length} active / {totalLeaderPeople} total people
                        </p>
                        {leader.contact_number && <p className="mt-1 text-xs text-gray-500">{leader.contact_number}</p>}
                        {!leader.is_active && <p className="mt-1 text-xs text-amber-400">Inactive</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button type="button" onClick={() => openEditLeader(leader)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs hover:bg-gray-800">
                        <Pencil size={14} /> Edit
                      </button>
                      <button type="button" onClick={() => toggleLeaderStatus(leader)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs hover:bg-gray-800">
                        {leader.is_active ? 'Set inactive' : 'Reactivate'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setViewMembersLeaderId(viewMembersLeaderId === leader.id ? null : leader.id)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2.5 text-sm hover:bg-gray-800"
                    >
                      <Users size={16} />
                      {viewMembersLeaderId === leader.id ? 'Hide Members' : 'View Members'}
                      <span className="text-gray-400">({totalLeaderPeople})</span>
                    </button>
                    {leader.is_active && (
                      <button type="button" onClick={() => openAddMember(leader.id)} className="primary-button inline-flex flex-1 items-center justify-center gap-2">
                        <Plus size={16} /> Add Member
                      </button>
                    )}
                  </div>
                  {viewMembersLeaderId === leader.id && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 sm:p-6"
                      onMouseDown={event => {
                        if (event.target === event.currentTarget) setViewMembersLeaderId(null)
                      }}>
                      <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Members assigned to ${leader.full_name}`}
                        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 shadow-2xl"
                        onClick={event => event.stopPropagation()}
                      >
                        <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-4 sm:p-5">
                          <div className="min-w-0">
                            <p className="brand-accent text-xs font-bold uppercase tracking-widest">Cell Roster</p>
                            <h3 className="mt-1 break-words text-lg font-bold">{leader.full_name}</h3>
                            <p className="mt-1 text-sm text-gray-400">
                              {leaderMembers.filter(member => member.is_active).length + leaderFirstTimers.length} active / {totalLeaderPeople} total people
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close member list"
                            onClick={() => setViewMembersLeaderId(null)}
                            className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:bg-gray-800"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">
                          {totalLeaderPeople === 0 ? (
                            <p className="rounded-lg border border-gray-800 p-4 text-sm text-gray-500">No members assigned to this Cell Leader yet.</p>
                          ) : <>{leaderMembers.map(member => (
                            <div key={member.id} className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className={`text-sm ${member.is_active ? 'text-gray-200' : 'text-gray-500 line-through'}`}>{member.full_name}</p>
                                  {!member.is_active && <span className="text-xs text-amber-400">Inactive</span>}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">{member.contact_number || 'No contact number'}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => { setViewMembersLeaderId(null); openEditMember(member) }} className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs hover:bg-gray-800">
                                  <ArrowRightLeft size={14} /> Edit / Move
                                </button>
                                <button type="button" onClick={() => toggleMemberStatus(member)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs hover:bg-gray-800">
                                  {member.is_active ? 'Set inactive' : 'Reactivate'}
                                </button>
                              </div>
                            </div>
                          ))}{leaderFirstTimers.map(person => <div key={`first-timer-${person.id}`} className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/70 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm text-gray-200">{person.full_name} <span className="text-xs text-emerald-400">First Timer</span></p><p className="mt-1 text-xs text-gray-500">{person.contact_number || 'No contact number'}</p></div><span className="text-xs text-gray-400">Manage in First Timers</span></div>)}</>}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-gray-800 p-4">
                          {leader.is_active && (
                            <button type="button" onClick={() => { setViewMembersLeaderId(null); openAddMember(leader.id) }} className="primary-button inline-flex items-center justify-center gap-2">
                              <Plus size={16} /> Add Member
                            </button>
                          )}
                          <button type="button" onClick={() => setViewMembersLeaderId(null)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800">
                            Close
                          </button>
                        </div>
                      </section>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {leaderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveLeader} className="w-full max-w-md space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">{editingLeaderId ? 'Edit Cell Leader' : 'Add Cell Leader'}</h3>
              <button type="button" aria-label="Close form" onClick={() => setLeaderModal(false)} className="rounded p-1 hover:bg-gray-800"><X size={20} /></button>
            </div>
            <label className="block text-sm text-gray-300">
              Full name
              <input required autoFocus value={leaderForm.full_name} onChange={event => setLeaderForm({ ...leaderForm, full_name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-lime-400" placeholder="Enter Cell Leader name" />
            </label>
            <label className="block text-sm text-gray-300">
              Contact number (optional)
              <input value={leaderForm.contact_number} onChange={event => setLeaderForm({ ...leaderForm, contact_number: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-lime-400" placeholder="Enter contact number" />
            </label>
            <div className="flex gap-2">
              <button className="primary-button flex-1" type="submit" disabled={savingLeader}>{savingLeader ? 'Saving...' : 'Save Cell Leader'}</button>
              <button className="rounded-lg border border-gray-700 px-4" type="button" disabled={savingLeader} onClick={() => setLeaderModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {memberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveMember} className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="brand-accent text-xs font-bold uppercase tracking-widest">Member Record</p>
                <h3 className="mt-1 text-lg font-bold">{editingMemberId ? 'Edit / Move Member' : 'Add Member'}</h3>
              </div>
              <button type="button" aria-label="Close form" onClick={() => setMemberModal(false)} className="rounded p-1 hover:bg-gray-800"><X size={20} /></button>
            </div>
            <label className="block text-sm text-gray-300">
              Full name
              <input required autoFocus value={memberForm.full_name} onChange={event => setMemberForm({ ...memberForm, full_name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-lime-400" placeholder="Enter member full name" />
            </label>
            <label className="block text-sm text-gray-300">
              Contact number (optional)
              <input value={memberForm.contact_number} onChange={event => setMemberForm({ ...memberForm, contact_number: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-lime-400" placeholder="Enter contact number" />
            </label>
            <label className="block text-sm text-gray-300">
              Cell assignment
              <select value={memberForm.assignment_type} onChange={event => setMemberForm({ ...memberForm, assignment_type: event.target.value, cell_leader_id: '', other_cell_leader_name: '' })} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-lime-400">
                <option value="Cell Leader">Cell Leader</option>
                <option value="Open Cell">Open Cell</option>
                <option value="Other Cell Group">Other Cell Group</option>
              </select>
            </label>
            {memberForm.assignment_type === 'Cell Leader' && <label className="block text-sm text-gray-300">Select Cell Leader
              <select required value={memberForm.cell_leader_id} onChange={event => setMemberForm({ ...memberForm, cell_leader_id: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-lime-400">
                <option value="">Select Cell Leader</option>{activeLeaders.map(leader => <option key={leader.id} value={leader.id}>{leader.full_name}</option>)}
              </select>
            </label>}
            {memberForm.assignment_type === 'Other Cell Group' && <label className="block text-sm text-gray-300">Other Cell Leader's name
              <input required value={memberForm.other_cell_leader_name} onChange={event => setMemberForm({ ...memberForm, other_cell_leader_name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-lime-400" placeholder="Enter other Cell Leader's name" />
            </label>}
            <p className="text-xs text-gray-500">Only active registered Cell Leaders appear in the network leader list.</p>
            <div className="flex gap-2">
              <button className="primary-button flex-1" type="submit" disabled={savingMember}>{savingMember ? 'Saving...' : editingMemberId ? 'Save Changes' : 'Add Member'}</button>
              <button className="rounded-lg border border-gray-700 px-4" type="button" disabled={savingMember} onClick={() => setMemberModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <section className="tactical-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="brand-accent text-xs font-bold uppercase tracking-widest">Unassigned Members</p>
            <h3 className="mt-1 text-lg font-bold">Open Cell</h3>
            <p className="mt-1 text-sm text-gray-400">Active members who are not currently assigned to a Cell Leader.</p>
          </div>
          <span className="rounded-full border border-gray-700 px-3 py-1 text-sm text-gray-300">
            {openCellMembers.filter(member => member.is_active).length + openCellFirstTimers.length} active
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-6 text-sm text-gray-300">
            <LoaderCircle className="animate-spin brand-accent" size={20} /> Loading Open Cell members...
          </div>
        ) : openCellMembers.length + openCellFirstTimers.length === 0 ? (
          <div className="rounded-lg border border-gray-700 p-5 text-center">
            <Users className="brand-accent mx-auto" size={30} />
            <p className="mt-2 font-medium">No members in Open Cell</p>
            <p className="mt-1 text-sm text-gray-400">Members without an assigned Cell Leader will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-gray-800/70 text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Member Name</th>
                  <th className="px-4 py-3 font-semibold">Contact Number</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {openCellMembers.map(member => (
                  <tr key={member.id} className="hover:bg-gray-800/30">
                    <td className={`px-4 py-3 font-medium ${member.is_active ? 'text-gray-200' : 'text-gray-500'}`}>{member.full_name}</td>
                    <td className="px-4 py-3 text-gray-400">{member.contact_number || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs ${member.is_active ? 'bg-lime-950/40 text-lime-300' : 'bg-amber-950/40 text-amber-300'}`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openEditMember(member)} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs hover:bg-gray-800">
                          <ArrowRightLeft size={14} /> Assign / Edit
                        </button>
                        <button type="button" onClick={() => toggleMemberStatus(member)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs hover:bg-gray-800">
                          {member.is_active ? 'Set inactive' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {openCellFirstTimers.map(person => <tr key={`open-first-timer-${person.id}`}><td className="px-4 py-3 font-medium text-gray-200">{person.full_name} <span className="text-xs text-emerald-400">First Timer</span></td><td className="px-4 py-3 text-gray-400">{person.contact_number || '—'}</td><td className="px-4 py-3"><span className="text-xs text-emerald-300">Open Cell</span></td><td className="px-4 py-3 text-right text-xs text-gray-400">Manage in First Timers</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" onClick={() => openAddMember('')} className="primary-button inline-flex items-center justify-center gap-2">
          <Plus size={16} /> Add Member to Open Cell
        </button>
      </section>

      <p className="text-xs text-gray-500">
        Inactive records are retained instead of deleted. Moving a member changes their current cell assignment and does not delete the member record.
      </p>
    </div>
  )
}
