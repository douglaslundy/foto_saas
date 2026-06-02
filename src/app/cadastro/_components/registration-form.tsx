'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RegistrationForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    cpf_cnpj: '',
    studio_name: '',
    city: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao realizar cadastro.')
        return
      }
      router.push('/conta-em-analise')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full h-11 px-3 rounded-lg border border-[#e5e7eb] bg-white text-[#111827] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition-all'
  const labelClass = 'block text-xs font-semibold text-[#374151] mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-2">Dados pessoais</p>

      <div>
        <label htmlFor="name" className={labelClass}>Nome completo</label>
        <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className={inputClass} placeholder="João Silva" />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className={inputClass} placeholder="joao@studio.com" />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>Senha (mínimo 8 caracteres)</label>
        <input id="password" name="password" type="password" required minLength={8} value={form.password} onChange={handleChange} className={inputClass} placeholder="••••••••" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="phone" className={labelClass}>Telefone</label>
          <input id="phone" name="phone" type="tel" required value={form.phone} onChange={handleChange} className={inputClass} placeholder="(11) 99999-9999" />
        </div>
        <div>
          <label htmlFor="cpf_cnpj" className={labelClass}>CPF / CNPJ</label>
          <input id="cpf_cnpj" name="cpf_cnpj" type="text" required value={form.cpf_cnpj} onChange={handleChange} className={inputClass} placeholder="000.000.000-00" />
        </div>
      </div>

      <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider pt-2">Dados do estúdio</p>

      <div>
        <label htmlFor="studio_name" className={labelClass}>Nome do estúdio</label>
        <input id="studio_name" name="studio_name" type="text" required value={form.studio_name} onChange={handleChange} className={inputClass} placeholder="Studio Silva" />
      </div>

      <div>
        <label htmlFor="city" className={labelClass}>Cidade</label>
        <input id="city" name="city" type="text" required value={form.city} onChange={handleChange} className={inputClass} placeholder="São Paulo, SP" />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-lg bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
      >
        {loading ? 'Enviando cadastro…' : 'Enviar cadastro'}
      </button>
    </form>
  )
}
