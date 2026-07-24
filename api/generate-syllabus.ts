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

  const { subject, textbookContent = '', totalLessons = 30 } = req.body || {}
  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' })
  }

  // AI Security: Giới hạn độ dài đầu vào để tránh Token Denial of Service
  if (subject.length > 500 || textbookContent.length > 150000) {
    return res.status(400).json({ error: 'Dữ liệu sách giáo khoa hoặc môn học quá lớn!' })
  }

  const authHeader = req.headers.authorization
  const keys = await getDecryptedApiKeys(authHeader)

  if (keys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' })
  }

  try {
    // 1. Phân tách System Instructions
    const systemInstruction = `Bạn là một chuyên gia thiết kế chương trình giáo dục xuất sắc. Nhiệm vụ của bạn là thiết kế một lộ trình học tập (Syllabus) chi tiết theo các buổi học cụ thể.

Yêu cầu định dạng đầu ra:
- Phải trả về lộ trình bằng định dạng Markdown (.md) sạch sẽ.
- Trình bày chi tiết phân bổ cho từng buổi học một từ Buổi 1 đến Buổi cuối cùng.
- Nội dung mỗi buổi học cần ghi rõ: Tiêu đề buổi học, Mục tiêu kiến thức và Tóm tắt nội dung chính cần giảng dạy.`

    // 2. Xây dựng User Content
    let userPrompt = `Hãy thiết kế một lộ trình học tập chi tiết gồm đúng ${totalLessons} buổi học cho môn học: "${subject}".\n`
    if (textbookContent) {
      userPrompt += `Dưới đây là nội dung sách giáo khoa hoặc tài liệu tham khảo được cung cấp để thiết kế lộ trình bám sát:\n---\n${textbookContent.substring(0, 40000)}\n---\n`
    }

    userPrompt = maskSensitiveData(userPrompt)

    let responseText = ''
    let success = false
    let lastError: any = null

    // Xoay vòng các API key cho đến khi có key thành công
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      try {
        const ai = new GoogleGenAI({ apiKey: key })
        const response = await generateWithRetry(ai, 'gemini-2.5-flash', {
          contents: userPrompt,
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
        console.warn(`API Key ${i+1}/${keys.length} failed in generate-syllabus. Error:`, err.message)
      }
    }

    if (!success) {
      return res.status(503).json({ error: 'Dịch vụ tạo lộ trình AI hiện tại đang quá tải. Vui lòng thử lại sau.' })
    }

    return res.status(200).json({ content: responseText })
  } catch (error: any) {
    console.error('[GenerateSyllabus Error]:', error)
    return res.status(500).json({ error: 'Đã xảy ra lỗi trong quá trình sinh lộ trình học bằng AI.' })
  }
}
