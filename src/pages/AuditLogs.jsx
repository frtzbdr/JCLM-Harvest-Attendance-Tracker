import { useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AuditLogs() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [entity, setEntity] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function load() {
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase.from('harvest_ops_audit_logs')
      .select('id, actor_email, action, entity_type, entity_id, summary, created_at')
      .order('created_at', { ascending: false }).limit(1000)
    if (queryError) { setRows([]); setError('Audit log table is not available or access is denied. Apply the supplied audit-log SQL migration and confirm your admin RLS policy.') }
    else setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  const actions = useMemo(() => [...new Set(rows.map(r => r.action).filter(Boolean))].sort(), [rows])
  const entities = useMemo(() => [...new Set(rows.map(r => r.entity_type).filter(Boolean))].sort(), [rows])
  const filtered = useMemo(() => rows.filter(r => {
    const haystack = [r.actor_email, r.action, r.entity_type, r.entity_id, r.summary].join(' ').toLowerCase()
    const date = r.created_at?.slice(0, 10) || ''
    return (!search || haystack.includes(search.toLowerCase().trim())) && (action === 'all' || r.action === action) && (entity === 'all' || r.entity_type === entity) && (!fromDate || date >= fromDate) && (!toDate || date <= toDate)
  }), [rows, search, action, entity, fromDate, toDate])
  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="brand-accent text-xs font-bold uppercase tracking-widest">HARVEST OPS / Security</p><h2 className="mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Activity className="brand-accent"/>Audit Logs</h2><p className="mt-2 text-sm text-slate-500">Search and filter recorded actions across the system.</p></div><button className="secondary-button inline-flex items-center gap-2" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Refresh</button></div>
    {error && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert className="mr-2 inline" size={16}/>{error}</p>}
    <div className="tactical-card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5"><label className="xl:col-span-2"><span className="mb-1 block text-sm font-semibold">Search logs</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17}/><input className="form-control w-full pl-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search actor, action, record, details…"/></div></label><label><span className="mb-1 block text-sm font-semibold">Action</span><select className="form-control w-full" value={action} onChange={e=>setAction(e.target.value)}><option value="all">All actions</option>{actions.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label><span className="mb-1 block text-sm font-semibold">Module</span><select className="form-control w-full" value={entity} onChange={e=>setEntity(e.target.value)}><option value="all">All modules</option>{entities.map(v=><option key={v} value={v}>{v}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block text-sm font-semibold">From</span><input type="date" className="form-control w-full" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label><span className="mb-1 block text-sm font-semibold">To</span><input type="date" className="form-control w-full" value={toDate} onChange={e=>setToDate(e.target.value)}/></label></div></div>
    <div className="tactical-card overflow-hidden"><div className="flex items-center justify-between border-b p-4"><h3 className="font-bold">Activity history</h3><span className="text-sm text-slate-500">{filtered.length} records</span></div>{loading ? <p className="p-6 text-slate-500">Loading audit logs…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Date / Time (Manila)</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Module</th><th className="p-3">Record ID</th><th className="p-3">Details</th></tr></thead><tbody>{filtered.map(r=><tr className="border-t" key={r.id}><td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</td><td className="p-3">{r.actor_email || 'System'}</td><td className="p-3">{r.action}</td><td className="p-3">{r.entity_type}</td><td className="p-3 font-mono text-xs">{r.entity_id || '—'}</td><td className="p-3 min-w-48">{r.summary || '—'}</td></tr>)}</tbody></table>{filtered.length===0&&<p className="p-8 text-center text-slate-500">No audit records match these filters.</p>}</div>}</div>
  </section>
}
