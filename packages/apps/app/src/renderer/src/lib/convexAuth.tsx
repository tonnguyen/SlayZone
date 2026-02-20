import { createContext, useContext, useMemo, useState } from 'react'
import { ConvexReactClient, useConvexAuth } from 'convex/react'
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react'

interface LeaderboardAuthState {
  configured: boolean
  isLoading: boolean
  isAuthenticated: boolean
  lastError: string | null
  signInWithGitHub: () => Promise<void>
  signOut: () => Promise<void>
}

const defaultState: LeaderboardAuthState = {
  configured: false,
  isLoading: false,
  isAuthenticated: false,
  lastError: null,
  signInWithGitHub: async () => {},
  signOut: async () => {}
}

const LeaderboardAuthContext = createContext<LeaderboardAuthState>(defaultState)
const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim() ?? ''
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null

function ConvexAuthBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const actions = useAuthActions()
  const [lastError, setLastError] = useState<string | null>(null)

  const value = useMemo<LeaderboardAuthState>(
    () => ({
      configured: true,
      isLoading,
      isAuthenticated,
      lastError,
      signInWithGitHub: async () => {
        try {
          setLastError(null)
          await actions.signIn('github')
        } catch (error) {
          setLastError(error instanceof Error ? error.message : 'Sign-in failed')
        }
      },
      signOut: async () => {
        try {
          setLastError(null)
          await actions.signOut()
        } catch (error) {
          setLastError(error instanceof Error ? error.message : 'Sign-out failed')
        }
      }
    }),
    [actions, isAuthenticated, isLoading, lastError]
  )

  return <LeaderboardAuthContext.Provider value={value}>{children}</LeaderboardAuthContext.Provider>
}

export function ConvexAuthBootstrap({ children }: { children: React.ReactNode }): React.JSX.Element {
  if (!convexClient) {
    return <LeaderboardAuthContext.Provider value={defaultState}>{children}</LeaderboardAuthContext.Provider>
  }

  return (
    <ConvexAuthProvider client={convexClient}>
      <ConvexAuthBridge>{children}</ConvexAuthBridge>
    </ConvexAuthProvider>
  )
}

export function useLeaderboardAuth(): LeaderboardAuthState {
  return useContext(LeaderboardAuthContext)
}
