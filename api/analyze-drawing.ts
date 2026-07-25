import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { getDecryptedApiKeys } from './utils/apiKeyManager.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ubaupchqavybpjpxjmle.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zbNs1LxLDkgdHLJ4RE6JYA_K9uJ3aFP'

// Danh sách các Persona nhỏ tuổi / giáo viên / họa sĩ ảo
const AI_PERSONAS = [
  { id: 'be_na', name: 'Bé Na 🌸', role: 'Học sinh lớp 1', personality: 'ngây ngô, dễ thương, thích màu sắc tươi sáng', tone: 'vui vẻ, hồn nhiên', fav_themes: ['cầu vồng', 'bông hoa', 'mèo', 'thú cưng'], fav_colors: ['hồng', 'vàng'], like_prob: 0.9, comment_prob: 0.7 },
  { id: 'minh_anh', name: 'Minh Anh 🚀', role: 'Học sinh lớp 3', personality: 'hiếu động, thích vũ trụ, robot và siêu nhân', tone: 'tò mò, hào hứng', fav_themes: ['vũ trụ', 'phi hành gia', 'robot', 'khủng long'], fav_colors: ['xanh dương', 'đen'], like_prob: 0.8, comment_prob: 0.6 },
  { id: 'nam_khanh', name: 'Nam Khánh 🦖', role: 'Học sinh lớp 2', personality: 'thích phiêu lưu, vẽ phương tiện giao thông', tone: 'năng động', fav_themes: ['ô tô', 'máy bay', 'khủng long', 'thám hiểm'], fav_colors: ['đỏ', 'xanh lá'], like_prob: 0.85, comment_prob: 0.5 },
  { id: 'soc_sac_mau', name: 'Họa sĩ nhí Sóc 🎨', role: 'Học sinh lớp 5', personality: 'yêu thích vẽ tranh phong cảnh, phối màu sáng tạo', tone: 'khích lệ, nghệ thuật', fav_themes: ['phong cảnh', 'thiên nhiên', 'biển', 'hoàng hôn'], fav_colors: ['tím', 'cam'], like_prob: 0.95, comment_prob: 0.8 },
  { id: 'art_teacher_lam', name: 'Thầy giáo Lâm 👨‍🏫', role: 'Giáo viên Mỹ thuật', personality: 'hiền hậu, chuyên nghiệp, luôn tìm điểm sáng tạo để khen ngợi học sinh', tone: 'ấm áp, sư phạm', fav_themes: ['all'], fav_colors: ['all'], like_prob: 0.99, comment_prob: 0.99 },
  { id: 'robot_r3', name: 'Robot R-3 🤖', role: 'Bạn công nghệ', personality: 'nói chuyện hơi máy móc nhưng rất đáng yêu', tone: 'ngạc nhiên, hài hước', fav_themes: ['khoa học', 'robot', 'xe tăng', 'vũ trụ'], fav_colors: ['bạc', 'xanh neon'], like_prob: 0.75, comment_prob: 0.5 },
  { id: 'storyteller_rabbit', name: 'Thỏ Kể Chuyện 🐰', role: 'Bạn thú bông', personality: 'thích tưởng tượng các câu chuyện thần tiên', tone: 'mơ mộng', fav_themes: ['rừng xanh', 'thần tiên', 'hoàng tử', 'công chúa'], fav_colors: ['hồng', 'trắng'], like_prob: 0.85, comment_prob: 0.7 },
  { id: 'explorer_fox', name: 'Cáo Thám Hiểm 🦊', role: 'Nhà thám hiểm', personality: 'thích tìm hiểu thế giới tự nhiên và các vùng đất mới', tone: 'tò mò, phiêu lưu', fav_themes: ['bản đồ', 'kho báu', 'rừng sâu', 'động vật'], fav_colors: ['cam', 'nâu'], like_prob: 0.8, comment_prob: 0.6 }
]

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { drawingId, imageUrl, studentUsername, cdfContext } = req.body || {}
  if (!drawingId || !imageUrl || !studentUsername) {
    return res.status(400).json({ error: 'Missing parameters' })
  }

  // 1. Khởi tạo Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  try {
    // 2. Lấy API keys của Gemini
    const keys = await getDecryptedApiKeys(req.headers.authorization)
    if (keys.length === 0) {
      console.warn("Chưa cấu hình Gemini API Key. Bỏ qua phân tích AI.")
      return res.status(200).json({ success: true, warning: 'Gemini Key not configured' })
    }

    const ai = new GoogleGenAI({ apiKey: keys[0] })

    // 3. Tải hình ảnh WebP từ Supabase Storage chuyển thành base64
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl}`)
    }
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    // 4. Gọi Gemini Vision phân tích 1 lần duy nhất
    let visionPrompt = `
      Hãy phân tích hình ảnh nét vẽ của học sinh tiểu học này. 
      Trả về định dạng JSON thuần túy (không bọc trong markdown \`\`\`json) với các thuộc tính:
      - creativity_score: điểm số sáng tạo từ 1.0 đến 10.0.
      - dominant_emotion: cảm xúc chủ đạo (vui tươi, ấm áp, khám phá...).
      - detected_objects: mảng tiếng Việt chứa các vật thể/con vật/chi tiết vẽ được nhận diện.
      - theme_category: một trong các chủ đề chính (animals, space, robot, nature, vehicles, fantasy, other).
      - color_palette: mảng các màu sắc nổi bật nhất (đỏ, xanh, vàng...).
      - story_seed: một ý tưởng câu chuyện ngắn (1-2 câu) gợi mở từ bức vẽ.
    `;

    if (cdfContext) {
      visionPrompt += `\n\nThông tin chi tiết về cấu trúc vật thể và nhãn dán trong tranh (từ vector CDF JSON):\n${cdfContext}`;
    }

    const visionResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: visionPrompt },
            {
              inlineData: {
                mimeType: 'image/webp',
                data: base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    })

    const rawText = visionResponse.text || '{}'
    const analysis = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim())

    // 5. Lưu kết quả phân tích AI vào creative_ai_analysis
    await supabase.from('creative_ai_analysis').insert({
      drawing_id: drawingId,
      creativity_score: analysis.creativity_score || 8.0,
      dominant_emotion: analysis.dominant_emotion || 'vui tươi',
      detected_objects: analysis.detected_objects || [],
      theme_category: analysis.theme_category || 'other',
      color_palette: analysis.color_palette || [],
      story_seed: analysis.story_seed || 'Một bức tranh đáng yêu của bé.'
    })

    // 6. Xử lý Social Engine lập lịch Likes & Comments cho các Persona dựa trên điểm sáng tạo
    const score = analysis.creativity_score || 8.0
    let numPersonas = 4
    let probMultiplier = 1.0

    if (score >= 8.5) {
      numPersonas = Math.floor(Math.random() * 3) + 6 // 6 đến 8 personas (điểm cao nhiều tương tác)
      probMultiplier = 1.4
    } else if (score >= 6.5) {
      numPersonas = Math.floor(Math.random() * 2) + 4 // 4 đến 5-personas (trung bình)
      probMultiplier = 1.0
    } else {
      numPersonas = Math.floor(Math.random() * 2) + 2 // 2 đến 3-personas (điểm thấp ít tương tác)
      probMultiplier = 0.5
    }

    const selectedPersonas = AI_PERSONAS.sort(() => 0.5 - Math.random()).slice(0, numPersonas)
    const now = new Date()

    // Danh sách trì hoãn thời gian cho từng Persona (theo giây) mở rộng
    const delays = [2, 15, 60, 300, 1200, 3600, 7200, 14400]

    for (let i = 0; i < selectedPersonas.length; i++) {
      const persona = selectedPersonas[i]
      const delaySec = delays[i] || 5
      const scheduledTime = new Date(now.getTime() + delaySec * 1000).toISOString()

      // A. Tính điểm Hợp gu (Matching Score)
      let matchScore = 0.4 // Base score
      const isThemeMatch = persona.fav_themes.some(t => t === analysis.theme_category || analysis.detected_objects?.some((o: string) => o.toLowerCase().includes(t)))
      const isColorMatch = persona.fav_colors.some(c => analysis.color_palette?.some((p: string) => p.toLowerCase().includes(c)))
      
      if (isThemeMatch) matchScore += 0.3
      if (isColorMatch) matchScore += 0.2
      if (score >= 9) matchScore += 0.1

      const shouldLike = Math.random() < (persona.like_prob * (matchScore / 0.5) * probMultiplier)
      const shouldComment = Math.random() < (persona.comment_prob * (matchScore / 0.5) * probMultiplier)

      // B. Nếu thỏa mãn xác suất, tạo lệnh like & comment
      if (shouldLike) {
        // Ghi trực tiếp like với mốc thời gian trì hoãn
        await supabase.from('creative_social_queue').insert({
          drawing_id: drawingId,
          persona_id: persona.id,
          action_type: 'like',
          scheduled_at: scheduledTime,
          status: 'pending'
        })
      }

      if (shouldComment) {
        // Gọi Gemini Text sinh bình luận mang phong cách đặc trưng của Persona
        const textPrompt = `
          Bạn hãy đóng vai nhân vật "${persona.name}" (Vai trò: ${persona.role}, Tính cách: ${persona.personality}, Giọng điệu: ${persona.tone}).
          Bé vừa vẽ một bức tranh có thông tin:
          - Các vật thể được nhận diện: ${analysis.detected_objects?.join(', ')}
          - Màu sắc: ${analysis.color_palette?.join(', ')}
          - Cảm xúc bức vẽ: ${analysis.dominant_emotion}
          - Gợi mở câu chuyện: ${analysis.story_seed}

          Hãy viết một bình luận ngắn (dưới 35 từ) bằng tiếng Việt gửi trực tiếp tới bé để khen ngợi bức tranh này.
          Quy tắc viết quan trọng để tạo cảm giác tự nhiên như người thật:
          - Cực kỳ khuyến khích sử dụng tiếng lóng học đường, ngôn từ trẻ con tự nhiên (ví dụ: "đỉnh chóp", "đẹp xỉu", "yêu thế", "xịn đét", "wow", "luôn á", "nè", "hén", "uây", "tớ", "cậu", "bạn ơi").
          - Đóng vai đúng với nhân vật (ví dụ: bé Na thì ngây ngô hay dùng từ đáng yêu, thầy giáo Lâm thì dùng từ ấm áp cổ vũ, robot thì có thể chèn các từ máy móc dễ thương).
          - KHÔNG sử dụng các từ ngữ sáo rỗng kiểu dịch máy (như "tác phẩm nghệ thuật của bạn", "tôi yêu bức tranh").
          - KHÔNG nhắc đến các từ kỹ thuật như "AI", "mô hình", "thuật toán", "Gemini".
          - Luôn truyền năng lượng ấm áp, tích cực.
        `

        const textResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: textPrompt
        })

        const commentText = textResponse.text?.trim() || 'Tranh của con vẽ đẹp quá!'

        await supabase.from('creative_social_queue').insert({
          drawing_id: drawingId,
          persona_id: persona.id,
          action_type: 'comment',
          comment_content: commentText,
          scheduled_at: scheduledTime,
          status: 'pending'
        })
      }
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Error in analyze-drawing serverless function:', err)
    return res.status(500).json({ error: err.message })
  }
}
