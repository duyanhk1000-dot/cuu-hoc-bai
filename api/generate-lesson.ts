import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, syllabus, lessonNumber, totalLessons = 30, textbookContent, apiKey: clientApiKey, parentFeedback } = req.body || {};
  if (!subject || !syllabus || !lessonNumber) {
    return res.status(400).json({ error: 'Subject, syllabus, and lessonNumber are required' });
  }

  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let prompt = `Bạn là một gia sư AI thân thiện và chuyên nghiệp. Hãy soạn thảo chi tiết nội dung học tập cho Buổi số ${lessonNumber} trong tổng số ${totalLessons} buổi học của môn "${subject}".\n\n`;
    prompt += `Lộ trình học tập tổng thể (Syllabus):\n---\n${syllabus}\n---\n\n`;
    if (textbookContent) {
      prompt += `Nội dung tài liệu/sách giáo khoa bổ trợ:\n---\n${textbookContent.substring(0, 30000)}\n---\n\n`;
    }
    if (parentFeedback) {
      prompt += `Ý KIẾN ĐÓNG GÓP/YÊU CẦU ĐIỀU CHỈNH CỦA PHỤ HUYNH:\n---\n${parentFeedback}\n---\n👉 Hãy thực hiện soạn bài học và điều chỉnh nội dung phù hợp theo đúng ý kiến đóng góp trên của phụ huynh!\n\n`;
    }
    
    prompt += `YÊU CẦU NỘI DUNG soạn thảo cần tuân thủ cấu trúc sau:\n`;
    prompt += `1. Tiêu đề buổi học (title): Rõ ràng, hấp dẫn.\n`;
    prompt += `2. Nội dung bài giảng (lecture_content): Trình bày chi tiết, dễ hiểu bằng Markdown. Nếu có công thức toán học/khoa học hãy viết bằng LaTeX dạng $...$ hoặc $$...$$. ĐẶC BIỆT, hãy chèn thêm ít nhất 1 hoặc 2 sơ đồ, bản đồ tư duy (mindmap) hoặc lưu đồ quy trình bằng cú pháp Mermaid.js (bọc trong thẻ \`\`\`mermaid và kết thúc bằng \`\`\`) để trực quan hóa kiến thức giúp con dễ tiếp thu. LƯU Ý CÚ PHÁP MERMAID: Tất cả các nhãn của nút (node labels) chứa tiếng Việt, dấu cách hoặc ký tự đặc biệt BẮT BUỘC phải bọc trong dấu ngoặc kép. Ví dụ: A["Thế năng cực đại"] --> B["Động năng tăng"]. Tuyệt đối không để tiếng Việt tự do ngoài ngoặc kép của nút vì sẽ gây lỗi Syntax Error.\n`;
    prompt += `3. Thời gian làm bài tập (duration_minutes): Một số nguyên từ 30 đến 60 phút.\n`;
    prompt += `4. Danh sách đúng 15 thẻ Flashcard (flashcards): Các khái niệm quan trọng nhất của bài học, mỗi thẻ gồm mặt trước (câu hỏi/khái niệm nhanh) và mặt sau (giải thích ngắn gọn).\n`;
    prompt += `5. Đề bài tập kiểm tra đúng 15 câu hỏi (questions): Gồm 10 câu trắc nghiệm (multiple_choice) có 4 lựa chọn bắt đầu bằng 'A. ', 'B. ', 'C. ', 'D. ', và 5 câu tự luận (essay) có correct_answer là hướng dẫn giải chi tiết.\n`;

    const generateConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          lecture_content: { type: 'string' },
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
        required: ['title', 'lecture_content', 'duration_minutes', 'flashcards', 'questions']
      }
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: generateConfig
      });
    } catch (err: any) {
      console.warn("Gemini 2.5 Flash failed, falling back to 1.5 Flash. Error:", err.message);
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: generateConfig
      });
    }

    const result = JSON.parse(response.text || '{}');
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
