'use client'

import { useEffect, type ReactNode } from 'react'
import { usePageHeader } from './page-header-context'

type Props = {
  title: string
  actionButton?: ReactNode
}

/**
 * Renderizado dentro de qualquer página protegida para definir o título e
 * o botão de ação da Topbar. Limpa o estado ao desmontar.
 *
 * Uso:
 *   <PageHeader title="Revendedores" actionButton={<Button>Novo</Button>} />
 */
export function PageHeader({ title, actionButton }: Props) {
  const { setTitle, setActionButton } = usePageHeader()

  useEffect(() => {
    setTitle(title)
    return () => setTitle('')
  }, [title, setTitle])

  useEffect(() => {
    setActionButton(actionButton ?? null)
    return () => setActionButton(null)
  // actionButton is intentionally excluded — callers should stabilize it with useMemo/useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, setActionButton])

  return null
}
