import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, textbookContent, totalLessons = 30, apiKey: clientApiKey } = req.body || {};
  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let prompt = `Bạn là một chuyên gia giáo dục xuất sắc. Hãy thiết kế một lộ trình học tập (Syllabus) chi tiết gồm đúng ${totalLessons} buổi học cho môn học: "${subject}".\n`;
    if (textbookContent) {
      prompt += `Dưới đây là nội dung sách giáo khoa hoặc tài liệu tham khảo được cung cấp để bạn thiết kế lộ trình bám sát:\n---\n${textbookContent.substring(0, 40000)}\n---\n`;
    }
    prompt += `Yêu cầu lộ trình học tập phải cực kỳ chi tiết, khoa học, phân bổ thời gian hợp lý.\n`;
    prompt += `Hãy trả về lộ trình bằng định dạng Markdown chi tiết cho từng buổi học từ Buổi 1 đến Buổi ${totalLessons}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.status(200).json({ content: response.text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
