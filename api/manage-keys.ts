import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from './utils/crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://udksngnafcfubpuwcjhp.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVka3NuZ25hZmNmdWJwdXdjamhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDIxODYsImV4cCI6MjA5ODk3ODE4Nn0.scYOnhkwaM_COBaq_qx8vWFOgBhA95ERmdFvCaAyiME'

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.substring(7)

  // Hỗ trợ Mock/Offline mode cho môi trường phát triển cục bộ
  if (token === 'mock-parent-id' || token === 'mock-student-id') {
    if (req.method === 'POST') {
      const { apiKeys } = req.body || {}
      if (apiKeys && Array.isArray(apiKeys)) {
        // Lưu tạm vào LocalStorage giả lập
        return res.status(200).json({ success: true, mockSaved: true })
      }
      return res.status(400).json({ error: 'Invalid payload' })
    }
    if (req.method === 'GET') {
      return res.status(200).json({ apiKeys: ['AIzaSyMockAPIKeyForDevelopmentOnly'] })
    }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'POST') {
      const { apiKeys } = req.body || {}
      if (!apiKeys || !Array.isArray(apiKeys)) {
        return res.status(400).json({ error: 'apiKeys must be an array' })
      }

      // Mã hóa các keys
      const encryptedKeys = apiKeys.map(k => encrypt(k.trim())).filter(Boolean)
      
      const { error } = await supabase
        .from('users')
        .update({ api_keys: JSON.stringify(encryptedKeys) })
        .eq('auth_user_id', user.id)

      if (error) {
        return res.status(500).json({ error: 'Failed to save API keys to DB' })
      }

      return res.status(200).json({ success: true })
    } 
    
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('users')
        .select('api_keys')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (error) {
        return res.status(500).json({ error: 'Failed to retrieve API keys' })
      }

      if (!data?.api_keys) {
        return res.status(200).json({ apiKeys: [] })
      }

      const encryptedKeys: string[] = JSON.parse(data.api_keys)
      // Giải mã và tạo bản ẩn (masked) để hiển thị ở frontend
      const maskedKeys = encryptedKeys.map(k => {
        const raw = decrypt(k)
        if (raw.length <= 10) return '***'
        return `${raw.substring(0, 6)}...${raw.substring(raw.length - 4)}`
      })

      return res.status(200).json({ apiKeys: maskedKeys })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
}
