'use client'

import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { PageHeaderProvider } from './page-header-context'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Topbar } from './Topbar'

type Props = {
  user: User
  children: ReactNode
}

export function AppShell({ user, children }: Props) {
  return (
    <PageHeaderProvider>
      <div className="min-h-screen bg-[#F4F8FD]">
        <Sidebar user={user} />

        {/* Main area — shifted right on desktop to clear sidebar */}
        <div className="md:pl-[196px] flex flex-col min-h-screen">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
            {children}
          </main>
        </div>

        <BottomNav />
      </div>
    </PageHeaderProvider>
  )
}
