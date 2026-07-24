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

  const { subject, syllabus, lessonNumber, totalLessons = 30, textbookContent = '', parentFeedback = '', lessonReferenceText = '' } = req.body || {}
  if (!subject || !syllabus || !lessonNumber) {
    return res.status(400).json({ error: 'Subject, syllabus, and lessonNumber are required' })
  }

  // AI Security: Bổ sung kiểm tra giới hạn độ dài Prompt đầu vào (Phòng chống Token Exhaustion)
  if (
    subject.length > 500 || 
    syllabus.length > 50000 || 
    textbookContent.length > 150000 || 
    parentFeedback.length > 5000 || 
    lessonReferenceText.length > 100000
  ) {
    return res.status(400).json({ error: 'Dữ liệu đầu vào quá lớn! Vui lòng rút ngắn nội dung tài liệu tham khảo.' })
  }

  const authHeader = req.headers.authorization
  const keys = await getDecryptedApiKeys(authHeader)

  if (keys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' })
  }

  try {
    // 1. Phân tách System Instructions (Chỉ thị hệ thống)
    const systemInstruction = `Bạn là một gia sư AI thân thiện và chuyên nghiệp. Nhiệm vụ của bạn là soạn thảo chi tiết nội dung bài giảng, danh sách flashcards và bộ câu hỏi bài tập dựa trên lộ trình và dữ liệu được cung cấp.

YÊU CẦU NỘI DUNG soạn thảo cần tuân thủ cấu trúc schema sau:
1. Tiêu đề buổi học (title): Rõ ràng, hấp dẫn.
2. Nội dung bài giảng (lecture_content): Trình bày chi tiết, dễ hiểu bằng Markdown. Hãy chia nội dung thành các phần rõ rệt, có tiêu đề phụ (dùng ## hoặc ###), và bạn BẮT BUỘC phải dùng hai ký tự xuống dòng liên tiếp (\\n\\n) giữa các đoạn văn để chúng phân tách rõ ràng trên giao diện, không bị dính chữ. Nếu có công thức toán học/khoa học hãy viết bằng LaTeX dạng $...$ hoặc $$...$$. Tuyệt đối KHÔNG chèn mã sơ đồ tư duy hay mã Mermaid vào phần này.
3. Thời gian làm bài tập (duration_minutes): Một số nguyên từ 30 đến 60 phút.
4. Danh sách đúng 15 thẻ Flashcard (flashcards): Các khái niệm quan trọng nhất của bài học, mỗi thẻ gồm mặt trước (câu hỏi/khái niệm nhanh) và mặt sau (giải thích ngắn gọn).
5. Đề bài tập kiểm tra đúng 15 câu hỏi (questions): Gồm 10 câu trắc nghiệm (multiple_choice) có 4 lựa chọn bắt đầu bằng 'A. ', 'B. ', 'C. ', 'D. ', và 5 câu tự luận (essay) có correct_answer là hướng dẫn giải chi tiết.
6. Sơ đồ tư duy (mindmap): Viết mã nguồn vẽ sơ đồ tư duy bằng cú pháp Mermaid.js (dùng đồ thị graph TD hoặc cấu trúc mindmap tùy bài, không viết các thẻ nháy \`\`\`mermaid) để tóm tắt và trực quan hóa toàn bộ kiến thức của bài học này giúp học sinh dễ ghi nhớ. LƯU Ý QUAN TRỌNG: Tất cả các nhãn của nút (node labels) chứa tiếng Việt, dấu cách hoặc ký tự đặc biệt BẮT BUỘC phải bọc trong dấu ngoặc kép (ví dụ: A["Tên bài học"] --> B["Khái niệm chính"]). Không được viết tiếng Việt ngoài dấu ngoặc kép của nhãn nút để tránh lỗi vẽ sơ đồ.

LƯU Ý CỰC KỲ QUAN TRỌNG VỀ ĐỊNH DẠNG TOÁN HỌC (LaTeX):
- Do đầu ra được cấu hình là JSON, mọi ký tự gạch chéo ngược '\\' của lệnh LaTeX BẮT BUỘC phải được viết kép thành '\\\\' trong phản hồi (ví dụ: viết '\\\\times', '\\\\frac', '\\\\text', '\\\\rightarrow', '\\\\lbrace', '\\\\rbrace').
- Đối với các từ ngữ, chữ tiếng Việt có dấu xuất hiện bên trong công thức toán LaTeX ($...$ hoặc $$...$$), bạn BẮT BUỘC phải bọc chúng trong thẻ '\\\\text{...}' (ví dụ: viết '$A \\\\rightarrow \\\\text{Nhân}/\\\\text{Chia} \\\\rightarrow B$' hoặc '$100 - \\\\text{hiệu số} = 50$'). Không được để chữ tiếng Việt tự do ngoài thẻ '\\\\text{}' trong công thức toán.
- Tuyệt đối KHÔNG viết '\\\\text{...}' ở bên ngoài môi trường toán học (tức là trong các câu văn xuôi thông thường bên ngoài dấu $ hoặc $$). Chỉ sử dụng '\\\\text{}' khi nó nằm thực sự bên trong công thức toán học.`

    // 2. Xây dựng User Content (Dữ liệu đầu vào của người dùng)
    let userPrompt = `Hãy soạn thảo chi tiết nội dung học tập cho Buổi số ${lessonNumber} trong tổng số ${totalLessons} buổi học của môn "${subject}".\n\n`
    
    if (lessonReferenceText) {
      userPrompt += `⚠️ TÀI LIỆU THAM KHẢO CHÍNH XÁC CỦA BÀI HỌC NÀY:\n`
      userPrompt += `Hãy soạn nội dung bài giảng, flashcards và câu hỏi bài tập dựa trên văn bản này:\n`
      userPrompt += `---\n${lessonReferenceText}\n---\n\n`
    }
    
    userPrompt += `Lộ trình học tập tổng thể (Syllabus):\n---\n${syllabus}\n---\n\n`
    if (textbookContent && !lessonReferenceText) {
      userPrompt += `Nội dung tài liệu/sách giáo khoa bổ trợ:\n---\n${textbookContent.substring(0, 30000)}\n---\n\n`
    }
    if (parentFeedback) {
      userPrompt += `Ý KIẾN ĐÓNG GÓP/YÊU CẦU ĐIỀU CHỈNH CỦA PHỤ HUYNH:\n---\n${parentFeedback}\n---\n👉 Hãy thực hiện soạn bài học và điều chỉnh nội dung phù hợp theo đúng yêu cầu trên của phụ huynh.\n`
    }

    const generateConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          lecture_content: { type: 'string' },
          mindmap: { type: 'string' },
          duration_minutes: { type: 'integer' },
          flashcards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string' },
                back: { type: 'string' }
              },
              required: ['front', 'back']
            }
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question_number: { type: 'integer' },
                question_type: { type: 'string', enum: ['multiple_choice', 'essay'] },
                prompt: { type: 'string' },
                options: {
                  type: 'array',
                  items: { type: 'string' }
                },
                correct_answer: { type: 'string' }
              },
              required: ['question_number', 'question_type', 'prompt', 'correct_answer']
            }
          }
        },
        required: ['title', 'lecture_content', 'mindmap', 'duration_minutes', 'flashcards', 'questions']
      }
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
            ...generateConfig,
            systemInstruction
          }
        })
        responseText = response.text || ''
        success = true
        break
      } catch (err: any) {
        lastError = err
        reportFailedKey(key) // Tạm vô hiệu hóa khóa bị lỗi
        console.warn(`API Key ${i+1}/${keys.length} failed in generate-lesson. Error:`, err.message)
      }
    }

    if (!success) {
      return res.status(503).json({ error: 'Dịch vụ AI hiện tại đang bận hoặc quá tải. Vui lòng thử lại sau.' })
    }

    const result = JSON.parse(responseText || '{}')
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('[GenerateLesson Error]:', error)
    // AI Security: Ẩn stack trace lỗi hệ thống thô để tránh rò rỉ thông tin nhạy cảm
    return res.status(500).json({ error: 'Đã xảy ra lỗi trong quá trình xử lý bài học bằng AI.' })
  }
}
