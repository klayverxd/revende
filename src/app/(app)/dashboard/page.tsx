import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0C447C] mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500">Logado como {user?.email}</p>
    </div>
  )
}
