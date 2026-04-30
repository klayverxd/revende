'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'

type PageHeaderCtx = {
  title: string
  actionButton: ReactNode
  setTitle: Dispatch<SetStateAction<string>>
  setActionButton: Dispatch<SetStateAction<ReactNode>>
}

export const PageHeaderContext = createContext<PageHeaderCtx>({
  title: '',
  actionButton: null,
  setTitle: () => {},
  setActionButton: () => {},
})

export function usePageHeader() {
  return useContext(PageHeaderContext)
}

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('')
  const [actionButton, setActionButton] = useState<ReactNode>(null)

  const stableSetTitle = useCallback<Dispatch<SetStateAction<string>>>(
    (v) => setTitle(v),
    []
  )
  const stableSetActionButton = useCallback<Dispatch<SetStateAction<ReactNode>>>(
    (v) => setActionButton(v),
    []
  )

  return (
    <PageHeaderContext.Provider
      value={{
        title,
        actionButton,
        setTitle: stableSetTitle,
        setActionButton: stableSetActionButton,
      }}
    >
      {children}
    </PageHeaderContext.Provider>
  )
}
