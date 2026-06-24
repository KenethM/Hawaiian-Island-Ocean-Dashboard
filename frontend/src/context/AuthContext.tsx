import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { api, TOKEN_KEY } from '../services/api'
import type { User, RegisterPayload } from '../types'

interface AuthState {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      api.getMe().then(setUser).catch(() => {
        localStorage.removeItem(TOKEN_KEY)
      })
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    localStorage.setItem(TOKEN_KEY, res.access_token)
    setUser(res.user)
  }, [])

  const register = useCallback(async (data: RegisterPayload) => {
    const res = await api.register(data)
    localStorage.setItem(TOKEN_KEY, res.access_token)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
