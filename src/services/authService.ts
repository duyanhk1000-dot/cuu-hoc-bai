import { supabase } from '../supabaseClient'
import { UserProfile } from '../types/auth'

export const authService = {
  // 1. Đăng nhập bằng email và mật khẩu (Supabase Auth)
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // 2. Đăng xuất khỏi hệ thống
  async logout() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // 3. Lấy session hiện tại
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    return { data, error }
  },

  // 4. Làm mới session
  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession()
    return { data, error }
  },

  // 5. Lấy profile tương ứng theo auth_user_id
  async getProfile(authUserId: string): Promise<{ data: UserProfile | null; error: any }> {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    
    return { data: data as UserProfile | null, error }
  }
}
