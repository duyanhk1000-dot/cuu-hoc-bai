import { GoogleGenAI } from '@google/genai'
import { getDecryptedApiKeys, reportFailedKey } from './utils/apiKeyManager'

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

  const { fileUrl, fileData } = req.body || {}
  if (!fileUrl && !fileData) {
    return res.status(400).json({ error: 'Empty file URL or file data' })
  }

  const authHeader = req.headers.authorization
  const keys = await getDecryptedApiKeys(authHeader)

  if (keys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' })
  }

  try {
    let base64Data = fileData
    
    if (fileUrl) {
      try {
        const fileResponse = await fetch(fileUrl)
        if (!fileResponse.ok) {
          throw new Error(`HTTP ${fileResponse.status} ${fileResponse.statusText}`)
        }
        const arrayBuffer = await fileResponse.arrayBuffer()
        base64Data = Buffer.from(arrayBuffer).toString('base64')
      } catch (fetchErr: any) {
        return res.status(400).json({ 
          error: `Không thể tải file PDF từ Supabase Storage (${fetchErr.message || fetchErr}). Vui lòng kiểm tra cấu hình Storage Bucket 'textbooks' đã bật Public chưa.` 
        })
      }
    }

    if (!base64Data) {
      return res.status(400).json({ error: 'Không tìm thấy dữ liệu tệp PDF để xử lý' })
    }

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
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data
              }
            },
            'Bạn là một trợ lý AI chuyên nghiệp. Hãy đọc tài liệu PDF này (sách giáo khoa/chương trình học) và trích xuất/chuyển đổi toàn bộ nội dung kiến thức cốt lõi, danh sách các chương, các bài học và tóm tắt nội dung chi tiết của từng bài học sang định dạng Markdown (.md) sạch sẽ, rõ ràng, dễ đọc để làm căn cứ soạn giáo trình dạy học. Hãy viết toàn bộ bằng tiếng Việt.'
          ]
        })
        responseText = response.text || ''
        success = true
        break
      } catch (err: any) {
        lastError = err
        reportFailedKey(key) // Tạm vô hiệu hóa khóa bị lỗi
        console.warn(`API Key ${i+1}/${keys.length} failed in extract-pdf. Error:`, err.message)
      }
    }

    if (!success) {
      return res.status(503).json({ error: `Tất cả ${keys.length} API keys đều quá tải hoặc không khả dụng. Lỗi cuối cùng: ${lastError?.message || 'Unavailable'}` })
    }

    return res.status(200).json({ text: responseText })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error processing PDF with Gemini' })
  }
}
