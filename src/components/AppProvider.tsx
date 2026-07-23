'use client'

import { createContext, useContext } from 'react'

// Minimal stub — replaced with full context in Task 8.
const AppContext = createContext<null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <AppContext.Provider value={null}>{children}</AppContext.Provider>
}

export function useAppContext() {
  return useContext(AppContext)
}
