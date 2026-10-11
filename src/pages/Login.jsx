import { useState } from 'react'
import { Cross, Eye, EyeOff, LogIn, Moon, Sun } from 'lucide-react'
import { supabase } from '../lib/supabase'
import churchLogo from '../assets/jclm-logo.png'

export default function Login({ onLogin, theme = 'light', onThemeToggle }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) { setErrorMessage('Sign-in failed. Check your email and password, then try again.'); return }
    if (data?.session) onLogin?.(data.session)
  }

  return (
    <main className={`login-shell login-${theme} min-h-[calc(100vh-2rem)] flex items-center justify-center px-4 py-10 sm:px-6`}>
      <section className="login-card w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
        <div className="login-accent h-1.5 w-full" />
        <div className="p-6 sm:p-9">
          <div className="mb-7 flex items-center justify-between">
            <div className="login-mark login-logo-mark flex h-12 w-12 items-center justify-center rounded-xl"><img src={churchLogo} alt="Jesus Christ the Lifegiver Ministries logo" /></div>
            <button type="button" onClick={onThemeToggle} className="login-theme-toggle inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}{theme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>
          </div>
          <p className="login-eyebrow text-xs font-bold uppercase tracking-[0.24em]">JCLM / Harvest Operations</p>
          <h1 className="login-title mt-3 text-3xl font-bold tracking-tight">Administrator Login</h1>
          <p className="login-copy mt-3 text-sm leading-6">Sign in with your authorized account.</p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div><label htmlFor="login-email" className="login-label mb-2 block text-sm font-medium">Email</label><input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="login-input w-full rounded-lg px-4 py-3 text-sm outline-none transition" /></div>
            <div><label htmlFor="login-password" className="login-label mb-2 block text-sm font-medium">Password</label><div className="relative"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="login-input w-full rounded-lg py-3 pl-4 pr-12 text-sm outline-none transition" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)} className="login-eye absolute inset-y-0 right-0 flex items-center px-3">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            {errorMessage && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p>}
            <button type="submit" disabled={loading} className="login-submit inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"><LogIn size={18} />{loading ? 'Signing in…' : 'Sign In'}</button>
          </form>
          <p className="login-footer mt-6 text-center text-xs leading-5">Authorized JCLM personnel only</p>
        </div>
      </section>
    </main>
  )
}
