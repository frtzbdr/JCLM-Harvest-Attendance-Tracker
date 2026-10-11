import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  LoaderCircle,
  Pencil,
  Search,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
  name: '',
  description: '',
  event_date: '',
  gathering_type: 'SUN',
  sun_session: 'morning',
  status: 'upcoming',
}

const EVENT_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

function formatDate(dateValue) {
  if (!dateValue) return 'No date'
  // Append local midday to avoid date-only values shifting a day in some time zones.
  const date = new Date(`${dateValue}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function inferGatheringType(name = '') {
  const value = name.toLowerCase()
  if (value.includes('tgif') || value.includes('thank god it')) return 'TGIF'
  if (value.includes('cell') || value.includes('bible study')) return 'CELL'
  return 'SUN'
}

function statusClasses(status) {
  if (status === 'active') return 'border-lime-800 bg-lime-950/40 text-lime-300'
  if (status === 'completed') return 'border-gray-700 bg-gray-800 text-gray-300'
  return 'border-sky-900 bg-sky-950/40 text-sky-300'
}

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadEvents() {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('events')
      .select('id, name, description, event_date, status, created_at, gathering_type, sun_session')
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message || 'Unable to load events.')
      setEvents([])
    } else {
      setEvents(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    return events.filter(event => {
      const matchesSearch =
        !term ||
        (event.name || '').toLowerCase().includes(term) ||
        (event.description || '').toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [events, search, statusFilter])

  function openCreateForm() {
    setEditingEvent(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEditForm(event) {
    setEditingEvent(event)
    setForm({
      name: event.name || '',
      description: event.description || '',
      event_date: event.event_date || '',
      gathering_type: event.gathering_type || inferGatheringType(event.name),
      sun_session: event.sun_session || 'morning',
      status: event.status || 'upcoming',
    })
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
    setEditingEvent(null)
    setForm({ ...EMPTY_FORM })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const name = form.name.trim()
    if (!name) {
      setError('Please enter an event name.')
      return
    }
    if (!form.event_date) {
      setError('Please choose an event date.')
      return
    }
    if (!EVENT_STATUSES.some(item => item.value === form.status)) {
      setError('Please choose a valid event status.')
      return
    }

    setSaving(true)
    const payload = {
      name,
      description: form.description.trim() || null,
      event_date: form.event_date,
      gathering_type: form.gathering_type,
      sun_session: form.gathering_type === 'SUN' ? form.sun_session : null,
      status: form.status,
    }

    const result = editingEvent
      ? await supabase.from('events').update(payload).eq('id', editingEvent.id).select('id').single()
      : await supabase.from('events').insert(payload).select('id').single()

    setSaving(false)

    if (result.error) {
      setError(result.error.message || 'Unable to save the event.')
      return
    }

    setFormOpen(false)
    setEditingEvent(null)
    setForm({ ...EMPTY_FORM })
    setNotice(editingEvent ? 'Event updated successfully.' : 'Event created successfully.')
    await loadEvents()
  }

  async function updateStatus(eventRow, nextStatus) {
    if (eventRow.status === nextStatus) return
    setError('')
    setNotice('')
    const { error: updateError } = await supabase
      .from('events')
      .update({ status: nextStatus })
      .eq('id', eventRow.id)

    if (updateError) {
      setError(updateError.message || 'Unable to update event status.')
      return
    }

    setNotice(`"${eventRow.name}" status updated to ${EVENT_STATUSES.find(item => item.value === nextStatus)?.label || nextStatus}.`)
    await loadEvents()
  }

  const counts = useMemo(() => ({
    total: events.length,
    upcoming: events.filter(event => event.status === 'upcoming').length,
    active: events.filter(event => event.status === 'active').length,
    completed: events.filter(event => event.status === 'completed').length,
  }), [events])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="brand-accent text-xs font-bold uppercase tracking-widest">Operations Planning</p>
          <h2 className="mt-2 text-2xl font-bold">Events Management</h2>
          <p className="mt-2 text-sm text-gray-400">Create and manage services, gatherings, and other church events.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="primary-button inline-flex items-center justify-center gap-2"
        >
          <CirclePlus size={18} />
          Create Event
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-900 bg-red-950/30 p-4">
          <AlertCircle className="mt-0.5 shrink-0 text-red-400" size={20} />
          <p className="min-w-0 flex-1 break-words text-sm text-gray-300">{error}</p>
          <button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={18} /></button>
        </div>
      )}
      {notice && !error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-lime-800/60 bg-lime-950/20 p-3 text-sm text-lime-300">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16} /></button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tactical-card p-5"><p className="text-sm text-gray-400">Total Events</p><p className="mt-3 text-3xl font-bold">{counts.total}</p></div>
        <div className="tactical-card p-5"><p className="text-sm text-gray-400">Upcoming</p><p className="mt-3 text-3xl font-bold">{counts.upcoming}</p></div>
        <div className="tactical-card p-5"><p className="text-sm text-gray-400">Active</p><p className="mt-3 text-3xl font-bold">{counts.active}</p></div>
        <div className="tactical-card p-5"><p className="text-sm text-gray-400">Completed</p><p className="mt-3 text-3xl font-bold">{counts.completed}</p></div>
      </section>

      <section className="tactical-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search event name or description..."
              className="w-full rounded-lg border border-gray-700 bg-gray-900 py-3 pl-10 pr-4 text-sm outline-none focus:border-lime-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            aria-label="Filter events by status"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-lime-400"
          >
            <option value="all">All statuses</option>
            {EVENT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <button type="button" onClick={loadEvents} className="rounded-lg border border-gray-700 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm text-gray-300"><LoaderCircle className="animate-spin brand-accent" size={20} /> Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="text-gray-500" size={34} />
            <p className="font-medium text-gray-200">{events.length ? 'No events match your filters.' : 'No events yet.'}</p>
            <p className="text-sm text-gray-400">{events.length ? 'Try another search or status.' : 'Create your first event to make it available for attendance check-in.'}</p>
            {!events.length && <button type="button" onClick={openCreateForm} className="primary-button mt-1 inline-flex items-center gap-2"><CirclePlus size={17} /> Create Event</button>}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-gray-800/70 text-xs uppercase tracking-wide text-gray-400">
                <tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Gathering</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredEvents.map(event => (
                  <tr key={event.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-4"><p className="font-medium text-gray-100">{event.name}</p><p className="mt-1 text-xs text-gray-500">Created {formatDate(event.created_at?.slice(0, 10))}</p></td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-300">{formatDate(event.event_date)}</td>
                    <td className="px-4 py-4"><span className="inline-flex rounded-full border border-emerald-800/60 bg-emerald-950/30 px-2 py-1 text-xs text-emerald-300">{event.gathering_type || inferGatheringType(event.name)}{(event.gathering_type || inferGatheringType(event.name)) === 'SUN' && event.sun_session ? ` · ${event.sun_session}` : ''}</span></td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClasses(event.status)}`}>
                        {EVENT_STATUSES.find(item => item.value === event.status)?.label || event.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-xs text-gray-400">{event.description || '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openEditForm(event)} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-200 hover:bg-gray-800"><Pencil size={14} /> Edit</button>
                        <select
                          value={event.status}
                          onChange={change => updateStatus(event, change.target.value)}
                          aria-label={`Change status for ${event.name}`}
                          className="max-w-[130px] rounded-lg border border-gray-700 bg-gray-900 px-2 py-2 text-xs outline-none focus:border-lime-400"
                        >
                          {EVENT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border border-gray-700 bg-gray-950 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="brand-accent text-xs font-bold uppercase tracking-widest">{editingEvent ? 'Update Event' : 'New Event'}</p>
                <h3 className="mt-1 text-xl font-bold">{editingEvent ? 'Edit Event Details' : 'Create an Event'}</h3>
              </div>
              <button type="button" aria-label="Close form" onClick={closeForm} disabled={saving} className="rounded-lg border border-gray-700 p-2 hover:bg-gray-800 disabled:opacity-50"><X size={18} /></button>
            </div>

            <label className="block text-sm text-gray-300">Event Name <span className="text-red-400">*</span>
              <input required maxLength={150} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Sunday Worship Service" className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 outline-none focus:border-lime-400" />
            </label>

            <label className="block text-sm text-gray-300">Event Date <span className="text-red-400">*</span>
              <input required type="date" value={form.event_date} onChange={event => setForm(current => ({ ...current, event_date: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 outline-none focus:border-lime-400" />
            </label>

            <label className="block text-sm text-gray-300">Gathering Type <span className="text-red-400">*</span>
              <select required value={form.gathering_type} onChange={event => setForm(current => ({ ...current, gathering_type: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 outline-none focus:border-lime-400">
                <option value="TGIF">TGIF — Thank God It's Friday</option>
                <option value="SUN">SUN — Sunday Service / Cell Celebration</option>
                <option value="CELL">CELL — Cell Group / Bible Study</option>
              </select>
            </label>

            {form.gathering_type === 'SUN' && <label className="block text-sm text-gray-300">SUN Session <span className="text-red-400">*</span>
              <select required value={form.sun_session} onChange={event => setForm(current => ({ ...current, sun_session: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 outline-none focus:border-lime-400">
                <option value="morning">Morning</option><option value="afternoon">Afternoon</option>
              </select>
            </label>}

            <label className="block text-sm text-gray-300">Description
              <textarea rows={3} maxLength={2000} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Add event details (optional)" className="mt-2 w-full resize-y rounded-lg border border-gray-700 bg-gray-900 p-3 outline-none focus:border-lime-400" />
            </label>

            <label className="block text-sm text-gray-300">Status
              <select required value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 outline-none focus:border-lime-400">
                {EVENT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-800 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-gray-700 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="primary-button inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <LoaderCircle className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
                {saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
