import { GoogleGenAI } from '@google/genai'
import { getDecryptedApiKeys } from './utils/apiKeyManager.js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, memory } = req.body || {}
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages parameter' })
  }

  try {
    // Lấy API keys của Gemini
    const keys = await getDecryptedApiKeys(req.headers.authorization)
    if (keys.length === 0) {
      return res.status(400).json({ error: 'Chưa cấu hình API Key cho Gemini' })
    }

    const ai = new GoogleGenAI({ apiKey: keys[0] })

    // Xây dựng System Prompt của Sóc Sắc Màu với Conversational Memory
    const lastDrawTheme = memory?.last_draw_theme || 'chưa vẽ gì'
    const favoriteObjects = memory?.favorite_objects?.join(', ') || 'chưa rõ'
    
    const systemPrompt = `
      Bạn là "✨ Sóc Sắc Màu" - Người bạn đồng hành sáng tạo đáng yêu trong Góc sáng tạo của trẻ em.
      Tính cách: tinh nghịch, hay tò mò, cực kỳ tích cực, yêu màu sắc và những câu chuyện kỳ diệu.

      Thông tin về bé (Kỷ niệm sáng tạo gần đây của bé):
      - Bức vẽ gần đây nhất có chủ đề: "${lastDrawTheme}".
      - Các chi tiết bé hay vẽ: "${favoriteObjects}".

      Cách ứng xử và trả lời:
      1. Nếu bé muốn gợi ý ý tưởng vẽ: Hãy đưa ra Thử thách vẽ ngẫu nhiên thú vị (Ví dụ: "Hôm nay con thử vẽ một bạn thỏ đang lái phi thuyền quả dưa hấu xem sao?").
      2. Nếu bé muốn gợi ý phối màu: Đưa ra cặp màu tươi vui (Ví dụ: "Hôm nay hãy thử dùng màu xanh mint phối với cam hồng nhé, nhìn sẽ cực kỳ ngọt ngào!").
      3. Nếu bé nói chuyện tự do: Hãy kể những câu chuyện ngắn đáng yêu về các nét vẽ hoặc hỏi han kích thích cốt truyện tranh vẽ của bé.

      Quy tắc bắt buộc:
      - Tuyệt đối không giải bài tập học thuật (Toán, Tiếng Anh...).
      - Dùng nhiều emoji sinh động (🎨, ✨, 🦊, 🐰, 🌈, 🖌️).
      - Ngôn ngữ nói chuyện siêu đáng yêu, xưng hô là "Sóc" và gọi trẻ là "con" hoặc "bé yêu". Tránh các câu từ quá dài dòng, giữ câu dưới 60 từ.
      - KHÔNG nhắc đến "AI", "mô hình", "Gemini", "thuật toán". Hãy làm bé tin rằng Sóc là một người bạn sóc ma thuật thực sự đang trò chuyện cùng bé.
    `

    // Format chat history for @google/genai
    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || m.message || '' }]
    }))

    // Thêm system instruction vào cuộc gọi
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt
      }
    })

    const replyText = response.text || 'Sóc đang nghe đây! Con muốn vẽ gì cùng Sóc nào? 🎨'
    return res.status(200).json({ reply: replyText })
  } catch (err: any) {
    console.error('Error in chat-creative serverless function:', err)
    return res.status(500).json({ error: err.message })
  }
}
