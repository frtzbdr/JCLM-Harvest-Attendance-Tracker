import { useMemo, useState } from 'react'
import { Download, ExternalLink, Printer, QrCode } from 'lucide-react'
export default function QRAttendance() {
  const [downloadError, setDownloadError] = useState('')
  const [downloading, setDownloading] = useState(false)
  // One fixed event: the QR opens the public Harvest OPS landing page. No event ID or selector is needed.
  const checkInUrl = useMemo(() => `${window.location.origin}/`, [])
  const qrImageUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&margin=16&format=png&data=${encodeURIComponent(checkInUrl)}`, [checkInUrl])

  async function downloadQr() {
    setDownloading(true); setDownloadError('')
    try {
      const response = await fetch(qrImageUrl)
      if (!response.ok) throw new Error('QR service unavailable')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl; link.download = 'JCLM-Harvest-Gathering-Check-In-QR.png'
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl)
    } catch {
      setDownloadError('Download was blocked. Choose “Open QR image” and save it from your browser instead.')
    } finally { setDownloading(false) }
  }

  return <section className="mx-auto max-w-5xl p-4 sm:p-7">
    
    <div className="mb-6"><p className="brand-accent text-xs font-bold uppercase tracking-widest">HARVEST OPS / Checkpoint</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Harvest Gathering QR Check-In</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">This QR code is already assigned to the Harvest Gathering. Visitors scan it to open the welcome page, then choose Log Attendance or First Timer Registration. No event selection or event code is needed.</p></div>
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      <div className="tactical-card flex flex-col items-center p-5 sm:p-7">
        <div className="mb-3 flex items-center gap-2 self-start"><QrCode className="brand-accent"/><h3 className="font-bold">OFFICIAL CHECK-IN QR</h3></div>
        <img src={qrImageUrl} alt="QR code for Harvest Gathering attendance check-in" className="w-full max-w-sm rounded-xl bg-white p-3" />
        <p className="mt-3 break-all text-center text-xs text-slate-500">{checkInUrl}</p>
        <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
          <button type="button" className="primary-button inline-flex items-center gap-2" onClick={downloadQr} disabled={downloading}><Download size={16}/>{downloading ? 'Preparing…' : 'Download QR'}</button>
          <button type="button" className="secondary-button inline-flex items-center gap-2" onClick={() => window.print()}><Printer size={16}/>Print</button>
          <a className="secondary-button inline-flex items-center gap-2" href={qrImageUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/>Open QR image</a>
        </div>
        {downloadError && <p role="alert" className="mt-3 text-sm text-amber-600">{downloadError}</p>}
      </div>
      <div className="tactical-card p-5 sm:p-7"><h3 className="text-lg font-bold">Registration Booth Instructions</h3><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-500"><li>Display or print this QR code at the booth.</li><li>Visitors scan it with their phone camera.</li><li>The website opens directly to the Harvest Gathering welcome page.</li><li>Returning attendees select <strong>Log Attendance</strong>; first-time visitors select <strong>I'm a First Timer</strong>.</li></ol><p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">This QR code does not identify a separate event record. All check-ins submitted through HARVEST OPS are for the single Harvest Gathering.</p></div>
    </div>
  </section>
}
