import React, { useState } from 'react'
import { Lock, ArrowRight } from 'lucide-react'

export function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Contraseña incorrecta')
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#070b0c] px-4 text-zinc-100 bg-[radial-gradient(ellipse_at_top,rgba(6,95,70,0.35),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(242,184,128,0.12),transparent_55%)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#f2b880]/30 bg-[#f2b880]/15 text-[#f2b880]">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">HQ · Segundo Cerebro</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Introduce tu contraseña para acceder a myVault
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña..."
            autoFocus
            required
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#f2b880]/60 focus:outline-none"
          />

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2b880] py-3 text-sm font-bold text-zinc-950 hover:bg-[#f5c496] disabled:opacity-50 transition-all cursor-pointer"
          >
            <span>{loading ? 'Verificando...' : 'Entrar'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
