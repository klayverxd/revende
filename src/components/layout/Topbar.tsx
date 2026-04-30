'use client'

import { usePathname } from 'next/navigation'
import { usePageHeader } from './page-header-context'
import { getTitleFromPathname } from './nav-config'

export function Topbar() {
  const pathname = usePathname()
  const { title, actionButton } = usePageHeader()

  const displayTitle = title || getTitleFromPathname(pathname)

  return (
    <header className="h-12 shrink-0 bg-white border-b border-[#B5D4F4] flex items-center justify-between px-4 md:px-6">
      <h1 className="text-sm font-semibold text-[#0C447C] truncate">{displayTitle}</h1>
      {actionButton != null && <div className="shrink-0 ml-4">{actionButton}</div>}
    </header>
  )
}
