'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type LoginState = { error: string }

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'E-mail ou senha incorretos.' }
  }

  // Vincula convite pendente — SECURITY DEFINER lê o JWT da sessão atual
  if (data.user) {
    await supabase.rpc('vincular_convite_pendente')
    revalidatePath('/configuracoes')
  }

  redirect('/dashboard')
}
