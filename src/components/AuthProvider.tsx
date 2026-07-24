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
        const savedMockUser = localStorage.getItem('family_learning_mock_user')
        const savedMockProfile = localStorage.getItem('family_learning_mock_profile')
        
        if (savedMockUser && savedMockProfile) {
          setUser(JSON.parse(savedMockUser))
          setProfile(JSON.parse(savedMockProfile))
          setLoading(false)
          return
        }

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
          // Chỉ xóa nếu không có mock session đang hoạt động
          if (!localStorage.getItem('family_learning_mock_user')) {
            setUser(null)
            setProfile(null)
          }
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
  const login = async (emailOrUsername: string, password: string) => {
    setLoading(true)
    try {
      // Fallback: Đăng nhập bằng tên người dùng đơn giản (phuhuynh, hocsinh)
      if (!emailOrUsername.includes('@')) {
        const isMatched = (emailOrUsername === 'phuhuynh' && password === '123456') || 
                          (emailOrUsername === 'hocsinh' && password === '123456');
        if (isMatched) {
          const role: 'parent' | 'student' = emailOrUsername === 'phuhuynh' ? 'parent' : 'student';
          const mockUser = {
            id: emailOrUsername === 'phuhuynh' ? 'mock-parent-id' : 'mock-student-id',
            email: `${emailOrUsername}@example.com`
          } as any
          const mockProfile = {
            username: emailOrUsername,
            role: role,
            auth_user_id: mockUser.id
          }
          setUser(mockUser)
          setProfile(mockProfile)
          
          // Lưu trạng thái mock session để không bị mất khi reload
          localStorage.setItem('family_learning_mock_user', JSON.stringify(mockUser))
          localStorage.setItem('family_learning_mock_profile', JSON.stringify(mockProfile))
          
          setLoading(false)
          return { error: null }
        } else {
          setLoading(false)
          return { error: new Error('Sai tên đăng nhập hoặc mật khẩu!') }
        }
      }

      // Đăng nhập bình thường bằng Supabase Auth
      const { data, error } = await authService.login(emailOrUsername, password)
      if (error) {
        setLoading(false)
        return { error }
      }
      if (data?.user) {
        setUser(data.user)
        await loadProfile(data.user.id)
        
        // Xóa mock session nếu có
        localStorage.removeItem('family_learning_mock_user')
        localStorage.removeItem('family_learning_mock_profile')
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
      // Xóa mock session
      localStorage.removeItem('family_learning_mock_user')
      localStorage.removeItem('family_learning_mock_profile')

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
