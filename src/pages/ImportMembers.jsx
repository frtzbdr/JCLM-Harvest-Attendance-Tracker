import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, FileUp, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
const suspiciousPattern = /(;|--|\/\*|\*\/|<\s*script|\b(union\s+select|select\s+.+\s+from|drop\s+table|delete\s+from|insert\s+into|update\s+\w+\s+set|alter\s+table|create\s+table|exec(?:ute)?\s*\(|xp_\w+)\b)/i
const allowedNamePattern = /^[\p{L}\p{M} .’'\-]+$/u
const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const safeName = value => {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!text || text.length > 120 || suspiciousPattern.test(text) || !allowedNamePattern.test(text)) return null
  return text
}

function findHeader(headers, candidates) {
  return headers.find(h => candidates.includes(String(h ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ')))
}

export default function ImportMembers() {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)
  const [summary, setSummary] = useState(null)

  function downloadTemplate() {
    const data = [
      ['Cell Leader', 'Member Name'],
      ['Example Cell Leader', 'Example Member One'],
      ['', 'Example Member Two'],
      ['', 'Example Member Three'],
      ['Another Cell Leader', 'Example Member Four'],
    ]
    const sheet = XLSX.utils.aoa_to_sheet(data)
    sheet['!cols'] = [{ wch: 30 }, { wch: 34 }]
    sheet['!autofilter'] = { ref: 'A1:B5' }
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Cell Members')
    const guide = XLSX.utils.aoa_to_sheet([
      ['HARVEST OPS — MEMBER IMPORT TEMPLATE'],
      ['Enter one Cell Leader name in column A, then list that leader’s members in column B.'],
      ['For additional members of the same leader, leave column A blank to continue the previous leader.'],
      ['Do not rename the headers. Delete the example rows before importing your real records.'],
      ['Only names are imported. Contact details are not included in this template.'],
    ])
    guide['!cols'] = [{ wch: 100 }]
    XLSX.utils.book_append_sheet(book, guide, 'Instructions')
    XLSX.writeFile(book, 'HARVEST_OPS_Cell_Members_Template.xlsx')
  }

  async function parseFile(file) {
    setError(''); setNotice(''); setSummary(null); setPreview(null); setRows([]); setFileName(file?.name || '')
    if (!file) return
    setLoadingFile(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      if (raw.length < 2) throw new Error('The spreadsheet has no member rows.')
      const headers = raw[0].map(v => String(v ?? '').trim().toLowerCase().replace(/[_-]+/g, ' '))
      const leaderCol = headers.findIndex(h => ['cell leader', 'leader name', 'cell leader name'].includes(h))
      const memberCol = headers.findIndex(h => ['member name', 'member', 'full name', 'name'].includes(h))
      if (leaderCol < 0 || memberCol < 0) throw new Error('Missing required headers. Use the downloaded template with “Cell Leader” and “Member Name” columns.')
      let previousLeader = ''
      const parsed = raw.slice(1).map((line, index) => {
        const rawLeader = String(line[leaderCol] ?? '').trim()
        if (rawLeader) previousLeader = rawLeader
        const rawMember = String(line[memberCol] ?? '').trim()
        if (!rawLeader && !rawMember) return null
        const leader = safeName(previousLeader)
        const member = rawMember ? safeName(rawMember) : ''
        let issue = ''
        if (!leader) issue = 'Missing or unsafe Cell Leader name'
        else if (rawMember && !member) issue = 'Unsafe or invalid member name'
        return { row_number: index + 2, cell_leader: leader || previousLeader, member_name: member || '', issue }
      }).filter(Boolean)
      if (!parsed.length) throw new Error('No importable rows were found.')
      setRows(parsed)
    } catch (e) {
      setError(e.message || 'Unable to read this spreadsheet. Please use the Excel template.')
    } finally { setLoadingFile(false) }
  }

  async function buildPreview() {
    setPreviewLoading(true); setError(''); setNotice(''); setSummary(null)
    try {
      const [{ data: leaders, error: leaderError }, { data: members, error: memberError }] = await Promise.all([
        supabase.from('cell_leaders').select('id,full_name,is_active'),
        supabase.from('members').select('id,full_name,cell_leader_id,is_active'),
      ])
      if (leaderError) throw leaderError
      if (memberError) throw memberError
      const leaderMap = new Map((leaders || []).map(l => [normalize(l.full_name), l]))
      const memberMap = new Map()
      for (const m of members || []) {
        const key = normalize(m.full_name)
        if (!memberMap.has(key)) memberMap.set(key, [])
        memberMap.get(key).push(m)
      }
      const seenInFile = new Map()
      const annotated = rows.map(row => {
        if (row.issue) return { ...row, status: 'unsafe', detail: row.issue }
        const leader = leaderMap.get(normalize(row.cell_leader))
        const inactiveLeader = Boolean(leader && leader.is_active === false)
        const routedLeaderName = inactiveLeader ? 'Open Cell' : row.cell_leader
        const existing = row.member_name ? memberMap.get(normalize(row.member_name)) || [] : []
        const repeated = row.member_name && seenInFile.has(normalize(row.member_name))
        if (row.member_name) seenInFile.set(normalize(row.member_name), row.row_number)
        if (repeated) return { ...row, status: 'duplicate-file', detail: `Duplicate within file (row ${seenInFile.get(normalize(row.member_name))})` }
        if (existing.length) {
          const assignedLeader = leader?.id && existing.some(m => m.cell_leader_id === leader.id)
          return { ...row, display_cell_leader: routedLeaderName, inactiveLeader, status: assignedLeader ? 'duplicate-same' : 'duplicate-existing', detail: assignedLeader ? 'Member already assigned to this leader' : 'Member already exists; overwrite would change their cell assignment' }
        }
        return { ...row, display_cell_leader: routedLeaderName, inactiveLeader, status: inactiveLeader ? 'open-cell' : leader ? 'add-member' : 'add-leader', detail: inactiveLeader ? 'Cell Leader is inactive; member will be assigned to Open Cell' : leader ? 'New member' : 'New Cell Leader and member' }
      })
      setPreview({ rows: annotated, leaders: leaders || [], members: members || [] })
    } catch (e) { setError(e.message || 'Unable to prepare import preview.') }
    finally { setPreviewLoading(false) }
  }

  const counts = useMemo(() => {
    const list = preview?.rows || []
    return {
      valid: list.filter(r => ['add-member', 'add-leader', 'open-cell', 'duplicate-existing', 'duplicate-same'].includes(r.status)).length,
      newLeaders: new Set(list.filter(r => r.status === 'add-leader').map(r => normalize(r.cell_leader))).size,
      newMembers: list.filter(r => r.status === 'add-member' || r.status === 'open-cell' || (r.status === 'add-leader' && r.member_name)).length,
      duplicates: list.filter(r => ['duplicate-existing', 'duplicate-same', 'duplicate-file'].includes(r.status)).length,
      unsafe: list.filter(r => r.status === 'unsafe').length,
    }
  }, [preview])

  async function importRows() {
    if (!preview) return
    const duplicates = counts.duplicates
    const message = duplicates && overwrite
      ? `${counts.newLeaders} new Cell Leader(s) and ${counts.newMembers} new member record(s) are expected. ${duplicates} duplicate row(s) will be reviewed/overwritten where eligible; unsafe rows will be skipped. Proceed?`
      : `${counts.newLeaders} new Cell Leader(s) and ${counts.newMembers} new member record(s) are expected. ${duplicates} duplicate row(s) and ${counts.unsafe} unsafe row(s) will be skipped. Proceed?`
    if (!window.confirm(message)) return
    setImporting(true); setError(''); setNotice(''); setSummary(null)
    try {
      const payload = preview.rows.map(({ cell_leader, member_name, row_number }) => ({ cell_leader, member_name, row_number }))
      const { data, error: rpcError } = await supabase.rpc('harvest_ops_import_cell_members', { import_rows: payload, overwrite_duplicates: overwrite })
      if (rpcError) throw rpcError
      const result = Array.isArray(data) ? data[0] : data
      if (!result || typeof result !== 'object') throw new Error('The server did not return an import summary.')
      setSummary(result)
      setNotice('Import completed. Review the recap below before closing this page.')
      await buildPreview()
    } catch (e) { setError(e.message || 'Import failed. No success was reported.') }
    finally { setImporting(false) }
  }

  const statusLabel = status => ({ unsafe: 'Skipped: unsafe', 'duplicate-file': 'Duplicate in file', 'duplicate-existing': 'Existing duplicate', 'duplicate-same': 'Already assigned', 'add-member': 'Will add member', 'add-leader': 'Will add leader/member', 'open-cell': 'Assign to Open Cell' }[status] || status)
  const statusClass = status => status === 'unsafe' ? 'import-status import-danger' : status.startsWith('duplicate') ? 'import-status import-warning' : 'import-status import-add'

  return <section className="mx-auto max-w-6xl p-4 sm:p-7">
    
    <div className="mb-6"><p className="brand-accent text-xs font-bold uppercase tracking-widest">HARVEST OPS / Data Intake</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Import Cell Members</h2><p className="mt-2 text-sm text-slate-500">Download the Excel template, list each Cell Leader and their members, preview duplicates, then import the safe records.</p></div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="mr-2 inline" size={17}/>{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline" size={17}/>{notice}</p>}
    <div className="tactical-card mb-5 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold"><FileSpreadsheet className="brand-accent mr-2 inline" size={20}/>1. Download the Excel template</h3><p className="mt-1 text-sm text-slate-500">Column A is Cell Leader; column B is Member Name. Blank leader cells continue the leader above.</p></div><button className="primary-button inline-flex items-center justify-center gap-2" onClick={downloadTemplate}><Download size={17}/>Download .xlsx template</button></div></div>
    <div className="tactical-card mb-5 p-4 sm:p-6"><h3 className="mb-3 font-bold"><FileUp className="brand-accent mr-2 inline" size={20}/>2. Upload completed template</h3><input className="form-control w-full" type="file" accept=".xlsx,.xls,.csv" onChange={e=>parseFile(e.target.files?.[0])} disabled={loadingFile || importing}/>{fileName && <p className="mt-2 text-sm text-slate-500">Selected: {fileName}</p>}{loadingFile && <p className="mt-2 text-sm">Reading spreadsheet…</p>}{rows.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-sm">Read {rows.length} non-empty row(s).</span><button className="secondary-button" onClick={buildPreview} disabled={previewLoading}>{previewLoading ? 'Preparing preview…' : 'Preview import'}</button></div>}</div>
    {preview && <div className="tactical-card mb-5 p-4 sm:p-6"><h3 className="font-bold">3. Review before importing</h3><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="import-stat"><span>New leaders</span><strong>{counts.newLeaders}</strong></div><div className="import-stat"><span>New members</span><strong>{counts.newMembers}</strong></div><div className="import-stat"><span>Duplicate rows</span><strong>{counts.duplicates}</strong></div><div className="import-stat"><span>Unsafe rows</span><strong>{counts.unsafe}</strong></div></div>
      {counts.duplicates > 0 && <label className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)} className="mt-1"/><span><strong>Overwrite eligible duplicates</strong><br/>If checked, an existing member with the same normalized name can be reassigned to the imported Cell Leader. Duplicate rows within the same file and unsafe rows will still be skipped.</span></label>}
      <div className="mt-4 max-h-96 overflow-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="sticky top-0"><tr><th className="p-3">Row</th><th className="p-3">Cell Leader</th><th className="p-3">Member</th><th className="p-3">Preview result</th></tr></thead><tbody>{preview.rows.map((row,i)=><tr key={`${row.row_number}-${i}`} className="border-t"><td className="p-3">{row.row_number}</td><td className="p-3">{row.display_cell_leader || row.cell_leader || '—'}</td><td className="p-3">{row.member_name || '—'}</td><td className="p-3"><span className={statusClass(row.status)}>{statusLabel(row.status)}</span><p className="mt-1 text-xs text-slate-500">{row.detail}</p></td></tr>)}</tbody></table></div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-xs text-slate-500"><ShieldAlert size={15} className="mr-1 inline"/>Import is restricted to authorized Network Leaders. Values are passed as data to a parameterized database function; this page never executes spreadsheet text as SQL.</p><button className="primary-button shrink-0" onClick={importRows} disabled={importing || previewLoading}>{importing ? 'Importing…' : 'Confirm and import'}</button></div>
    </div>}
    {summary && <div className="tactical-card p-4 sm:p-6"><h3 className="font-bold">Import recap</h3><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="import-stat"><span>Added</span><strong>{summary.added ?? 0}</strong></div><div className="import-stat"><span>Overwritten</span><strong>{summary.overwritten ?? 0}</strong></div><div className="import-stat"><span>Skipped</span><strong>{summary.skipped ?? 0}</strong></div><div className="import-stat"><span>Rejected as unsafe</span><strong>{summary.unsafe ?? 0}</strong></div></div>{Array.isArray(summary.details) && <div className="mt-4 max-h-80 overflow-auto rounded-lg border"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Row</th><th className="p-3">Cell Leader</th><th className="p-3">Member</th><th className="p-3">Result</th></tr></thead><tbody>{summary.details.map((r,i)=><tr key={i} className="border-t"><td className="p-3">{r.row_number ?? '—'}</td><td className="p-3">{r.cell_leader ?? '—'}</td><td className="p-3">{r.member_name ?? '—'}</td><td className="p-3">{r.status}: {r.message || ''}</td></tr>)}</tbody></table></div>}</div>}
  </section>
}
