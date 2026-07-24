/**
 * AI Privacy Filter Utility
 * Tự động lọc bỏ các chuỗi nhạy cảm (API Keys, JWT Tokens) trước khi gửi dữ liệu sang máy chủ AI
 */

export function maskSensitiveData(text: string): string {
  if (!text) return ''
  let masked = text

  // 1. Khử trùng các API keys dạng Gemini (AIzaSy...)
  masked = masked.replace(/AIzaSy[A-Za-z0-9_\-]{33}/g, '[GEMINI_API_KEY_MASKED]')

  // 2. Khử trùng các API keys dạng OpenAI (sk-...)
  masked = masked.replace(/sk-[A-Za-z0-9]{48}/g, '[OPENAI_API_KEY_MASKED]')

  // 3. Khử trùng Bearer JWT tokens (định dạng cấu trúc 3 phần ngăn cách bởi dấu chấm)
  masked = masked.replace(/ey[A-Za-z0-9-_=]+\.ey[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[JWT_TOKEN_MASKED]')

  return masked
}
