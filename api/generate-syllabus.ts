import { GoogleGenAI } from '@google/genai'
import { getDecryptedApiKeys, reportFailedKey } from './utils/apiKeyManager.js'

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

  const { subject, textbookContent, totalLessons = 30 } = req.body || {}
  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' })
  }

  const authHeader = req.headers.authorization
  const keys = await getDecryptedApiKeys(authHeader)

  if (keys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' })
  }

  try {
    let prompt = `Bạn là một chuyên gia giáo dục xuất sắc. Hãy thiết kế một lộ trình học tập (Syllabus) chi tiết gồm đúng ${totalLessons} buổi học cho môn học: "${subject}".\n`
    if (textbookContent) {
      prompt += `Dưới đây là nội dung sách giáo khoa hoặc tài liệu tham khảo được cung cấp để bạn thiết kế lộ trình bám sát:\n---\n${textbookContent.substring(0, 40000)}\n---\n`
    }
    prompt += `Yêu cầu lộ trình học tập phải cực kỳ chi tiết, khoa học, phân bổ thời gian hợp lý.\n`
    prompt += `Hãy trả về lộ trình bằng định dạng Markdown chi tiết cho từng buổi học từ Buổi 1 đến Buổi ${totalLessons}.`

    let responseText = ''
    let success = false
    let lastError: any = null

    // Xoay vòng các API key cho đến khi có key thành công
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      try {
        const ai = new GoogleGenAI({ apiKey: key })
        const response = await generateWithRetry(ai, 'gemini-2.5-flash', {
          contents: prompt,
        })
        responseText = response.text || ''
        success = true
        break
      } catch (err: any) {
        lastError = err
        reportFailedKey(key) // Tạm vô hiệu hóa khóa bị lỗi
        console.warn(`API Key ${i+1}/${keys.length} failed in generate-syllabus. Error:`, err.message)
      }
    }

    if (!success) {
      return res.status(503).json({ error: `Tất cả ${keys.length} API keys đều quá tải hoặc không khả dụng. Lỗi cuối cùng: ${lastError?.message || 'Unavailable'}` })
    }

    return res.status(200).json({ content: responseText })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' })
  }
}
