import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { authService } from '../services/authService'
import { AuthUser, UserProfile, AuthContextType } from '../types/auth'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Hàm tải thông tin profile người dùng
  const loadProfile = async (authUserId: string) => {
    try {
      const { data, error } = await authService.getProfile(authUserId)
      if (error) {
        console.error('Error fetching user profile:', error)
        setProfile(null)
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('Failed to load user profile:', err)
      setProfile(null)
    }
  }

  useEffect(() => {
    // 1. Kiểm tra session ban đầu khi mount component
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await authService.getSession()
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth initialization failed:', err)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // 2. Đăng ký listener lắng nghe các sự thay đổi trạng thái auth từ Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setLoading(true)
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    // Hủy đăng ký listener khi unmount component
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Khai báo hàm đăng nhập wrapper
  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await authService.login(email, password)
      if (error) {
        setLoading(false)
        return { error }
      }
      if (data?.user) {
        setUser(data.user)
        await loadProfile(data.user.id)
      }
      setLoading(false)
      return { error: null }
    } catch (err: any) {
      setLoading(false)
      return { error: err }
    }
  }

  // Khai báo hàm đăng xuất wrapper
  const logout = async () => {
    setLoading(true)
    try {
      const { error } = await authService.logout()
      setUser(null)
      setProfile(null)
      setLoading(false)
      return { error }
    } catch (err: any) {
      setLoading(false)
      return { error: err }
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
