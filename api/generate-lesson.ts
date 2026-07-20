import { GoogleGenAI } from '@google/genai';

async function generateWithRetry(ai: any, model: string, options: any, maxRetries = 3, delayMs = 1500) {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        ...options
      });
      return response;
    } catch (err: any) {
      lastErr = err;
      const errMsg = err.message || '';
      const errStatus = err.status || '';
      
      // Chỉ thử lại với mã lỗi 503 (quá tải hệ thống tạm thời)
      const isTemporary = 
        errStatus === 'UNAVAILABLE' || 
        errStatus === 503 || 
        errMsg.includes('503') || 
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('experiencing high demand') ||
        errMsg.includes('overloaded');
      
      // Không bao giờ thử lại với lỗi 429 (hết hạn ngạch quota sử dụng) hoặc lỗi phân quyền
      const isQuotaExceeded = 
        errStatus === 429 || 
        errMsg.includes('429') || 
        errMsg.includes('Quota exceeded') || 
        errMsg.includes('RESOURCE_EXHAUSTED');
      
      if (isTemporary && !isQuotaExceeded && attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed with temporary 503 error. Retrying in ${delayMs}ms... Error: ${errMsg}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, syllabus, lessonNumber, totalLessons = 30, textbookContent, apiKey: clientApiKey, apiKeys: clientApiKeys, parentFeedback, lessonReferenceText } = req.body || {};
  if (!subject || !syllabus || !lessonNumber) {
    return res.status(400).json({ error: 'Subject, syllabus, and lessonNumber are required' });
  }

  // Thu thập danh sách keys hỗ trợ xoay vòng
  let keys: string[] = [];
  if (Array.isArray(clientApiKeys) && clientApiKeys.length > 0) {
    keys = clientApiKeys;
  } else if (clientApiKey) {
    keys = [clientApiKey];
  } else if (process.env.GEMINI_API_KEY) {
    keys = process.env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(Boolean);
  }

  if (keys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' });
  }

  try {
    let prompt = `Bạn là một gia sư AI thân thiện và chuyên nghiệp. Hãy soạn thảo chi tiết nội dung học tập cho Buổi số ${lessonNumber} trong tổng số ${totalLessons} buổi học của môn "${subject}".\n\n`;
    
    if (lessonReferenceText) {
      prompt += `⚠️ ĐẶC BIỆT QUAN TRỌNG - TÀI LIỆU THAM KHẢO CHÍNH XÁC CỦA BÀI HỌC NÀY:\n`;
      prompt += `Bạn BẮT BUỘC phải soạn nội dung bài giảng (lecture_content), danh sách 15 flashcards và bộ 15 câu hỏi bài tập (questions) dựa trên đúng nội dung chữ, kiến thức, ví dụ minh họa, định nghĩa và công thức toán học/khoa học được ghi trong văn bản dưới đây. Hãy bám sát văn bản này để học sinh học chính xác theo bài học trong sách giáo khoa của mình:\n`;
      prompt += `---\n${lessonReferenceText}\n---\n\n`;
    }
    
    prompt += `Lộ trình học tập tổng thể (Syllabus):\n---\n${syllabus}\n---\n\n`;
    if (textbookContent && !lessonReferenceText) {
      prompt += `Nội dung tài liệu/sách giáo khoa bổ trợ:\n---\n${textbookContent.substring(0, 30000)}\n---\n\n`;
    }
    if (parentFeedback) {
      prompt += `Ý KIẾN ĐÓNG GÓP/YÊU CẦU ĐIỀU CHỈNH CỦA PHỤ HUYNH:\n---\n${parentFeedback}\n---\n👉 Hãy thực hiện soạn bài học và điều chỉnh nội dung phù hợp theo đúng ý kiến đóng góp trên của phụ huynh!\n\n`;
    }
    
    prompt += `YÊU CẦU NỘI DUNG soạn thảo cần tuân thủ cấu trúc sau:\n`;
    prompt += `1. Tiêu đề buổi học (title): Rõ ràng, hấp dẫn.\n`;
    prompt += `2. Nội dung bài giảng (lecture_content): Trình bày chi tiết, dễ hiểu bằng Markdown. Hãy chia nội dung thành các phần rõ rệt, có tiêu đề phụ (dùng ## hoặc ###), và bạn BẮT BUỘC phải dùng hai ký tự xuống dòng liên tiếp (\\n\\n) giữa các đoạn văn để chúng phân tách rõ ràng trên giao diện, không bị dính chữ. Nếu có công thức toán học/khoa học hãy viết bằng LaTeX dạng $...$ hoặc $$...$$. Tuyệt đối KHÔNG chèn mã sơ đồ tư duy hay mã Mermaid vào phần này.\n`;
    prompt += `3. Thời gian làm bài tập (duration_minutes): Một số nguyên từ 30 đến 60 phút.\n`;
    prompt += `4. Danh sách đúng 15 thẻ Flashcard (flashcards): Các khái niệm quan trạng nhất của bài học, mỗi thẻ gồm mặt trước (câu hỏi/khái niệm nhanh) và mặt sau (giải thích ngắn gọn).\n`;
    prompt += `5. Đề bài tập kiểm tra đúng 15 câu hỏi (questions): Gồm 10 câu trắc nghiệm (multiple_choice) có 4 lựa chọn bắt đầu bằng 'A. ', 'B. ', 'C. ', 'D. ', và 5 câu tự luận (essay) có correct_answer là hướng dẫn giải chi tiết.\n`;
    prompt += `6. Sơ đồ tư duy (mindmap): Viết mã nguồn vẽ sơ đồ tư duy bằng cú pháp Mermaid.js (dùng đồ thị graph TD hoặc cấu trúc mindmap tùy bài, không viết các thẻ nháy \`\`\`mermaid) để tóm tắt và trực quan hóa toàn bộ kiến thức của bài học này giúp học sinh dễ ghi nhớ. LƯU Ý QUAN TRỌNG: Tất cả các nhãn của nút (node labels) chứa tiếng Việt, dấu cách hoặc ký tự đặc biệt BẮT BUỘC phải bọc trong dấu ngoặc kép (ví dụ: A["Tên bài học"] --> B["Khái niệm chính"]). Không được viết tiếng Việt ngoài dấu ngoặc kép của nhãn nút để tránh lỗi vẽ sơ đồ.\n`;
    prompt += `\nLƯU Ý CỰC KỲ QUAN TRỌNG VỀ ĐỊNH DẠNG TOÁN HỌC (LaTeX):\n`;
    prompt += `- Do đầu ra được cấu hình là JSON, mọi ký tự gạch chéo ngược '\\' của lệnh LaTeX BẮT BUỘC phải được viết kép thành '\\\\' trong phản hồi (ví dụ: viết '\\\\times', '\\\\frac', '\\\\text', '\\\\rightarrow', '\\\\lbrace', '\\\\rbrace').\n`;
    prompt += `- Đối với các từ ngữ, chữ tiếng Việt có dấu xuất hiện bên trong công thức toán LaTeX ($...$ hoặc $$...$$), bạn BẮT BUỘC phải bọc chúng trong thẻ '\\\\text{...}' (ví dụ: viết '$A \\\\rightarrow \\\\text{Nhân}/\\\\text{Chia} \\\\rightarrow B$' hoặc '$100 - \\\\text{hiệu số} = 50$'). Không được để chữ tiếng Việt tự do ngoài thẻ '\\\\text{}' trong công thức toán.\n`;
    prompt += `- Tuyệt đối KHÔNG viết '\\\\text{...}' ở bên ngoài môi trường toán học (tức là trong các câu văn xuôi thông thường bên ngoài dấu $ hoặc $$). Chỉ sử dụng '\\\\text{}' khi nó nằm thực sự bên trong công thức toán học.\n`;

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
    };

    let responseText = '';
    let success = false;
    let lastError: any = null;

    // Xoay vòng các API key cho đến khi có key thành công
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await generateWithRetry(ai, 'gemini-2.5-flash', {
          contents: prompt,
          config: generateConfig
        });
        responseText = response.text || '';
        success = true;
        break; // Thành công, thoát vòng lặp
      } catch (err: any) {
        lastError = err;
        console.warn(`API Key ${i+1}/${keys.length} failed in generate-lesson. Error:`, err.message);
      }
    }

    if (!success) {
      return res.status(503).json({ error: `Tất cả ${keys.length} API keys đều quá tải hoặc không khả dụng. Lỗi cuối cùng: ${lastError?.message || 'Unavailable'}` });
    }

    const result = JSON.parse(responseText || '{}');
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
