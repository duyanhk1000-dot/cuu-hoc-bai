import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const ITERATIONS = 10000

// Lấy khóa mật mã hóa từ biến môi trường (hoặc fallback mặc định cho môi trường dev)
const ENCRYPTION_KEY_SECRET = process.env.API_KEY_ENCRYPTION_KEY || 'default_family_learning_app_secret_key_32_chars'

export function encrypt(text: string): string {
  if (!text) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY_SECRET, salt, ITERATIONS, KEY_LENGTH, 'sha256')
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag().toString('hex')
  
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 4) {
      // Nếu không đúng cấu trúc mã hóa mới, coi là plaintext để tránh vỡ dữ liệu cũ
      return encryptedText
    }
    
    const [saltHex, ivHex, authTagHex, encryptedHex] = parts
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY_SECRET, salt, ITERATIONS, KEY_LENGTH, 'sha256')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (err) {
    // Fallback: Trả về chính chuỗi thô nếu giải mã gặp sự cố
    return encryptedText
  }
}
