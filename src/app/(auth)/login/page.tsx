'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'

const initialState = { error: '' }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F8FD]">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-[#B5D4F4] px-8 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#0C447C] tracking-tight">Revendê</h1>
            <p className="text-sm text-gray-500 mt-1">Acesse sua conta</p>
          </div>

          <form action={formAction} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent"
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {state.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[#185FA5] hover:bg-[#0C447C] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
            >
              {pending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
