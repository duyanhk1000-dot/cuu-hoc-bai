import { GoogleGenAI } from '@google/genai'
import { getDecryptedApiKeys, reportFailedKey } from './utils/apiKeyManager.js'
import { maskSensitiveData } from './utils/privacyFilter.js'

async function generateWithRetry(ai: any, model: string, options: any, maxRetries = 3, delayMs = 1500) {
  let lastErr: any = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        ...options
      })
      return response
    } catch (err: any) {
      lastErr = err
      const errMsg = err.message || ''
      const errStatus = err.status || ''
      
      const isTemporary = 
        errStatus === 'UNAVAILABLE' || 
        errStatus === 503 || 
        errMsg.includes('503') || 
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('experiencing high demand') ||
        errMsg.includes('overloaded')
      
      const isQuotaExceeded = 
        errStatus === 429 || 
        errMsg.includes('429') || 
        errMsg.includes('Quota exceeded') || 
        errMsg.includes('RESOURCE_EXHAUSTED')
      
      if (isTemporary && !isQuotaExceeded && attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed with temporary 503 error. Retrying in ${delayMs}ms... Error: ${errMsg}`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } else {
        throw err
      }
    }
  }
  throw lastErr
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageData } = req.body || {}
  if (!imageData) {
    return res.status(400).json({ error: 'imageData (Base64) is required' })
  }

  // AI Security: Giới hạn kích thước payload ảnh Base64 đầu vào để tránh cạn kiệt tài nguyên
  if (imageData.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Tệp ảnh quá lớn! Hãy vẽ lại nét gọn gàng hơn.' })
  }

  // Trích xuất phần dữ liệu Base64 thô từ DataURL
  let base64Data = imageData
  let mimeType = 'image/png'
  if (imageData.startsWith('data:')) {
    const parts = imageData.split(',')
    const meta = parts[0]
    base64Data = parts[1]
    
    const match = meta.match(/data:([^;]+);/)
    if (match) {
      mimeType = match[1]
    }
  }

  const authHeader = req.headers.authorization
  const keys = await getDecryptedApiKeys(authHeader)

  if (keys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' })
  }

  try {
    const systemInstruction = `Bạn là một gia sư AI OCR nhận diện viết tay chuyên nghiệp trong lĩnh vực giáo dục.
Nhiệm vụ của bạn là nhận dạng chính xác nội dung chữ viết tay từ ảnh nét vẽ được cung cấp.

YÊU CẦU:
1. Nếu ảnh chứa công thức toán học hoặc ký hiệu khoa học, hãy dịch chính xác sang mã LaTeX chuẩn (ví dụ: \\frac{a}{b}, x^2, \\int x dx). Tuyệt đối bọc các biểu thức toán học này trong LaTeX.
2. Nếu ảnh chứa Hán tự (chữ Trung Quốc) hoặc ngôn ngữ khác, hãy trả về văn bản Unicode chuẩn (ví dụ: 我喜欢学习中文).
3. Chỉ trả về kết quả văn bản thô nhận diện được. Tuyệt đối KHÔNG kèm giải thích, không chèn các thẻ markdown \`\`\` hay tiêu đề. Trả về kết quả trực tiếp nhất có thể.`

    const userPrompt = 'Hãy nhận diện nội dung viết tay trong bức ảnh này.'

    let responseText = ''
    let success = false
    let lastError: any = null

    // Xoay vòng các API key cho đến khi có key thành công
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      try {
        const ai = new GoogleGenAI({ apiKey: key })
        const response = await generateWithRetry(ai, 'gemini-2.5-flash', {
          contents: [
            {
              role: 'user',
              parts: [
                { text: userPrompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          config: {
            systemInstruction
          }
        })
        responseText = response.text || ''
        success = true
        break
      } catch (err: any) {
        lastError = err
        reportFailedKey(key) // Tạm vô hiệu hóa khóa bị lỗi
        console.warn(`API Key ${i+1}/${keys.length} failed in ocr-handwriting. Error:`, err.message)
      }
    }

    if (!success) {
      return res.status(503).json({ error: 'Dịch vụ AI OCR hiện tại đang bận hoặc quá tải. Vui lòng thử lại sau.' })
    }

    const cleanedText = responseText.trim()
    return res.status(200).json({ text: cleanedText })
  } catch (error: any) {
    console.error('[OCR Handwriting Error]:', error)
    return res.status(500).json({ error: 'Đã xảy ra lỗi trong quá trình nhận dạng viết tay bằng AI.' })
  }
}
