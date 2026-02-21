import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ConvexHttpClient } from 'convex/browser'
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
const OAUTH_REDIRECT_URI = 'http://127.0.0.1:3210/auth/callback'
const VERIFIER_STORAGE_KEY = '__convexAuthOAuthVerifier'
const AUTH_STORAGE_NAMESPACE = convexUrl.replace(/\/+$/, '')

function namespacedVerifierKey(namespace: string): string {
  const escapedNamespace = namespace.replace(/[^a-zA-Z0-9]/g, '')
  return `${VERIFIER_STORAGE_KEY}_${escapedNamespace}`
}

function ConvexAuthBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const actions = useAuthActions()
  const [lastError, setLastError] = useState<string | null>(null)
  const [awaitingOAuthCallback, setAwaitingOAuthCallback] = useState(false)
  const handledOAuthCodesRef = useRef<Set<string>>(new Set())

  const completeOAuthCode = useCallback(
    async (code: string) => {
      if (handledOAuthCodesRef.current.has(code)) return
      handledOAuthCodesRef.current.add(code)
      setAwaitingOAuthCallback(false)
      try {
        const result = await actions.signIn('github', { code, redirectTo: OAUTH_REDIRECT_URI })
        if (!result.signingIn) {
          setLastError('GitHub callback received, but session activation did not complete.')
        } else {
          setLastError(null)
        }
      } catch (e) {
        setLastError(e instanceof Error ? e.message : 'Sign-in completion failed')
      }
    },
    [actions]
  )

  useEffect(() => {
    const handlePayload = ({ code, error }: { code?: string; error?: string }) => {
      if (error) {
        setAwaitingOAuthCallback(false)
        setLastError(error)
        return
      }
      if (!code) {
        if (awaitingOAuthCallback) {
          setAwaitingOAuthCallback(false)
          setLastError('OAuth callback reached app, but code was missing.')
        }
        return
      }
      void completeOAuthCode(code)
    }

    const authApi = window.api?.auth
    if (!authApi) return

    void authApi.consumeOAuthCallback?.().then((payload) => {
      if (payload) handlePayload(payload)
    })

    return authApi.onOAuthCallback?.(handlePayload)
  }, [awaitingOAuthCallback, completeOAuthCode])

  useEffect(() => {
    if (!awaitingOAuthCallback) return
    const authApi = window.api?.auth
    if (!authApi?.consumeOAuthCallback) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 120 // ~60s at 500ms

    const poll = async () => {
      if (cancelled) return
      attempts += 1
      const payload = await authApi.consumeOAuthCallback()
      if (payload?.error) {
        setAwaitingOAuthCallback(false)
        setLastError(payload.error)
        return
      }
      if (payload?.code) {
        await completeOAuthCode(payload.code)
        return
      }
      if (attempts >= maxAttempts) {
        setAwaitingOAuthCallback(false)
        setLastError('Timed out waiting for OAuth callback. Try sign-in again.')
        return
      }
      setTimeout(() => {
        void poll()
      }, 500)
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [awaitingOAuthCallback, completeOAuthCode])

  const value = useMemo<LeaderboardAuthState>(
    () => ({
      configured: true,
      isLoading,
      isAuthenticated,
      lastError,
      signInWithGitHub: async () => {
        try {
          setLastError(null)
          if (convexUrl && window.api?.auth?.openSystemSignIn) {
            const http = new ConvexHttpClient(convexUrl)
            const start = (await (http as unknown as {
              action: (name: string, args: unknown) => Promise<unknown>
            }).action('auth:signIn', {
              provider: 'github',
              params: {
                redirectTo: OAUTH_REDIRECT_URI
              }
            })) as { redirect?: string; verifier?: string }

            if (!start.redirect || !start.verifier) {
              setLastError('Auth start failed: missing redirect or verifier')
              return
            }

            window.localStorage.setItem(namespacedVerifierKey(AUTH_STORAGE_NAMESPACE), start.verifier)
            await window.api.auth.openSystemSignIn(start.redirect)
            setAwaitingOAuthCallback(true)
            return
          }

          const result = await actions.signIn('github', { redirectTo: OAUTH_REDIRECT_URI })
          if (!result.signingIn && !result.redirect) {
            setLastError('GitHub sign-in returned no redirect URL. Check Convex auth env vars and provider setup.')
          }
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
    <ConvexAuthProvider client={convexClient} storageNamespace={AUTH_STORAGE_NAMESPACE}>
      <ConvexAuthBridge>{children}</ConvexAuthBridge>
    </ConvexAuthProvider>
  )
}

export function useLeaderboardAuth(): LeaderboardAuthState {
  return useContext(LeaderboardAuthContext)
}
