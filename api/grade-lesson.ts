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

  const { questions, studentAnswers } = req.body || {}
  if (!questions || !studentAnswers) {
    return res.status(400).json({ error: 'Questions and studentAnswers are required' })
  }

  const authHeader = req.headers.authorization
  const keys = await getDecryptedApiKeys(authHeader)

  if (keys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' })
  }

  try {
    let prompt = `Bạn là một giáo viên AI chấm điểm nghiêm khắc và chi tiết. Hãy chấm điểm bài làm của học sinh dựa trên danh sách câu hỏi và câu trả lời được cung cấp.\n\n`
    prompt += `ĐỀ BÀI (Questions):\n---\n${JSON.stringify(questions, null, 2)}\n---\n\n`
    prompt += `BÀI LÀM CỦA HỌC SINH (Student Answers):\n---\n${JSON.stringify(studentAnswers, null, 2)}\n---\n\n`
    prompt += `Yêu cầu chấm điểm:\n`
    prompt += `1. Tính tổng điểm trên thang điểm 10 (total_score). Trắc nghiệm đúng được 0.67 điểm (10 câu = 6.7 điểm), tự luận đúng được tối đa 0.66 điểm (5 câu = 3.3 điểm).\n`
    prompt += `2. Nhận xét tổng quan về bài làm (overall_feedback), chỉ ra điểm mạnh, điểm yếu và cách cải thiện.\n`
    prompt += `3. Phân tích chấm điểm chi tiết từng câu trong 15 câu (detailed_feedback): ghi lại câu trả lời học sinh, xác định đúng/sai (is_correct), số điểm đạt được (score_awarded), và giải thích chi tiết đáp án đúng kèm phân tích lỗi sai nếu có (correct_explanation).\n`
    
    const gradeConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          total_score: { type: 'number' },
          overall_feedback: { type: 'string' },
          detailed_feedback: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question_number: { type: 'integer' },
                student_answer: { type: 'string' },
                is_correct: { type: 'boolean' },
                score_awarded: { type: 'number' },
                correct_explanation: { type: 'string' }
              },
              required: ['question_number', 'student_answer', 'is_correct', 'score_awarded', 'correct_explanation']
            }
          }
        },
        required: ['total_score', 'overall_feedback', 'detailed_feedback']
      }
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
          contents: prompt,
          config: gradeConfig
        })
        responseText = response.text || ''
        success = true
        break
      } catch (err: any) {
        lastError = err
        reportFailedKey(key) // Tạm vô hiệu hóa khóa bị lỗi
        console.warn(`API Key ${i+1}/${keys.length} failed in grade-lesson. Error:`, err.message)
      }
    }

    if (!success) {
      return res.status(503).json({ error: `Tất cả ${keys.length} API keys đều quá tải hoặc không khả dụng. Lỗi cuối cùng: ${lastError?.message || 'Unavailable'}` })
    }

    const result = JSON.parse(responseText || '{}')
    return res.status(200).json(result)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' })
  }
}
