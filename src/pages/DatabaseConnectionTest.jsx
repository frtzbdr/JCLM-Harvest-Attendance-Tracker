
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function DatabaseConnectionTest() {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [count, setCount] = useState(null)

  async function testConnection() {
    setStatus('loading')
    setMessage('')
    setCount(null)

    try {
      const { data, error } = await supabase
        .from('cell_leaders')
        .select('id')

      if (error) throw error

      setCount(data.length)
      setMessage(
        `Read successful. Supabase returned ${data.length} cell leader record(s).`
      )
      setStatus('success')
    } catch (error) {
      setMessage(error.message || 'Database request failed.')
      setStatus('error')
    }
  }

  return (
    <section className="mx-auto max-w-3xl p-4 sm:p-7">
      <div className="tactical-card space-y-5 p-6">
        <p className="brand-accent text-xs font-bold uppercase tracking-widest">
          JCLM / System Diagnostics
        </p>

        <h2 className="text-2xl font-bold">
          Database Connection Test
        </h2>

        <p className="text-sm leading-6 text-gray-400">
          Runs a read-only query against the cell_leaders table.
          No records will be changed.
        </p>

        <button
          type="button"
          onClick={testConnection}
          disabled={status === 'loading'}
          className="primary-button"
        >
          {status === 'loading'
            ? 'TESTING CONNECTION...'
            : 'Test Database Connection'}
        </button>

        {status === 'success' && (
          <div className="rounded-lg border border-lime-700 bg-lime-950/30 p-4">
            <p className="font-semibold text-lime-400">
              Connection successful
            </p>
            <p className="mt-2 text-sm text-gray-300">
              {message}
            </p>
            <p className="mt-2 text-sm text-gray-300">
              Records returned: {count}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4">
            <p className="font-semibold text-red-400">
              Connection test failed
            </p>
            <p className="mt-2 break-words text-sm text-gray-300">
              {message}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
