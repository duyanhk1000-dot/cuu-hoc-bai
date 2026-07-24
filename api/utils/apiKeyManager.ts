import { createClient } from '@supabase/supabase-js'
import { decrypt } from './crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://udksngnafcfubpuwcjhp.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVka3NuZ25hZmNmdWJwdXdjamhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDIxODYsImV4cCI6MjA5ODk3ODE4Nn0.scYOnhkwaM_COBaq_qx8vWFOgBhA95ERmdFvCaAyiME'

// Lưu trạng thái các khóa bị lỗi tạm thời ở mức module
const disabledKeys = new Map<string, number>()
const DISABLE_DURATION_MS = 5 * 60 * 1000 // Tạm khóa trong 5 phút khi gặp lỗi quota/hết hạn

/**
 * Báo cáo một khóa API hoạt động lỗi để tạm thời loại bỏ khỏi danh sách xoay vòng
 */
export function reportFailedKey(key: string) {
  if (!key) return
  disabledKeys.set(key, Date.now() + DISABLE_DURATION_MS)
  console.warn(`[ApiKeyManager] Khóa API đã bị vô hiệu hóa tạm thời trong 5 phút do gặp lỗi: ${key.substring(0, 6)}...`)
}

/**
 * Lấy danh sách khóa API hoạt động tốt (đã giải mã) cho người dùng hiện tại
 */
export async function getDecryptedApiKeys(authHeader?: string): Promise<string[]> {
  let keys: string[] = []

  // 1. Phân tích mã JWT Token từ Header Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token && token !== 'undefined' && token !== 'null') {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false }
        })
        
        // Xác minh token để lấy thông tin user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (user && !authError) {
          // Lấy danh sách API keys của người dùng trong DB
          const { data, error } = await supabase
            .from('users')
            .select('api_keys')
            .eq('auth_user_id', user.id)
            .maybeSingle()
          
          if (data?.api_keys && !error) {
            const encryptedKeys: string[] = JSON.parse(data.api_keys)
            if (Array.isArray(encryptedKeys)) {
              // Giải mã các khóa
              keys = encryptedKeys.map(k => decrypt(k).trim()).filter(Boolean)
            }
          }
        }
      } catch (err) {
        console.error('[ApiKeyManager] Lỗi khi truy vấn khóa người dùng từ DB:', err)
      }
    }
  }

  // 2. Fallback: Nếu không tìm thấy khóa nào từ người dùng, dùng khóa cấu hình chung từ môi trường máy chủ
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys = process.env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(Boolean)
  }

  if (keys.length === 0) {
    return []
  }

  // 3. Thiết lập RLS & Failover: Loại bỏ các khóa đang bị tạm ngưng hoạt động
  const now = Date.now()
  const activeKeys = keys.filter(key => {
    const disabledUntil = disabledKeys.get(key) || 0
    return now > disabledUntil
  })

  // Nếu tất cả các khóa đều bị tạm khóa, sử dụng lại toàn bộ để tránh lỗi ngắt kết nối hoàn toàn
  return activeKeys.length > 0 ? activeKeys : keys
}
