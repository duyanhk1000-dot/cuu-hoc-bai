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

  const { fileUrl, fileData } = req.body || {}
  if (!fileUrl && !fileData) {
    return res.status(400).json({ error: 'Empty file URL or file data' })
  }

  // AI Security: Giới hạn kích thước file dữ liệu base64 thô truyền lên để tránh quá tải
  if (fileData && fileData.length > 8 * 1024 * 1024) {
    return res.status(400).json({ error: 'Kích thước tệp tin của bạn vượt quá giới hạn cho phép (tối đa 6MB).' })
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

    // 1. Phân tách System Instructions
    const systemInstruction = `Bạn là một trợ lý AI chuyên nghiệp chuyên trích xuất tài liệu học tập. Nhiệm vụ của bạn là đọc kỹ tài liệu PDF sách giáo khoa hoặc chương trình học được cung cấp, chuyển đổi và tóm tắt toàn bộ kiến thức cốt lõi sang ngôn ngữ Markdown (.md) sạch sẽ.

Yêu cầu đầu ra:
- Phải viết hoàn toàn bằng tiếng Việt.
- Liệt kê đầy đủ danh sách các chương, các bài học và nội dung tóm tắt chi tiết của từng bài học để làm căn cứ soạn giáo trình.`

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
            'Hãy trích xuất và chuyển đổi toàn bộ kiến thức sách giáo khoa/chương trình học trong tài liệu PDF này sang định dạng Markdown.'
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
        console.warn(`API Key ${i+1}/${keys.length} failed in extract-pdf. Error:`, err.message)
      }
    }

    if (!success) {
      return res.status(503).json({ error: 'Dịch vụ trích xuất PDF bằng AI đang quá tải. Vui lòng thử lại sau.' })
    }

    return res.status(200).json({ text: responseText })
  } catch (error: any) {
    console.error('[ExtractPdf Error]:', error)
    return res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống khi trích xuất tài liệu PDF.' })
  }
}
