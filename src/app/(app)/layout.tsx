import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from './actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#F4F8FD]">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[196px] flex-col bg-[#0C447C]">
        <div className="px-5 py-6">
          <span className="text-white text-lg font-bold tracking-tight">Revendê</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <SidebarLink href="/dashboard">Dashboard</SidebarLink>
          <SidebarLink href="/produtos">Produtos</SidebarLink>
          <SidebarLink href="/revendedores">Revendedores</SidebarLink>
          <SidebarLink href="/envios">Envios</SidebarLink>
          <SidebarLink href="/conferencias">Conferências</SidebarLink>
          <SidebarLink href="/estoque">Estoque</SidebarLink>
          <SidebarLink href="/financeiro">Financeiro</SidebarLink>
          <SidebarLink href="/venda-direta">Venda Direta</SidebarLink>
          <SidebarLink href="/calculadora">Calculadora</SidebarLink>
        </nav>
        <div className="px-3 py-4">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full text-left text-sm text-blue-200 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="md:pl-[196px] flex flex-col min-h-screen">
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Bottom navigation — mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#B5D4F4] flex">
        <BottomNavLink href="/dashboard" label="Dashboard" />
        <BottomNavLink href="/envios" label="Enviar" />
        <BottomNavLink href="/conferencias" label="Conferir" />
        <BottomNavLink href="/estoque" label="Estoque" />
        <BottomNavLink href="/financeiro" label="Financeiro" />
      </nav>
    </div>
  )
}

function SidebarLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block text-sm text-blue-100 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
    >
      {children}
    </a>
  )
}

function BottomNavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex-1 flex flex-col items-center justify-center py-3 text-xs text-gray-500 hover:text-[#185FA5] transition-colors"
    >
      {label}
    </a>
  )
}
