import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileUrl, fileData, apiKey: clientApiKey } = req.body || {};
  if (!fileUrl && !fileData) {
    return res.status(400).json({ error: 'Empty file URL or file data' });
  }

  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please enter your Gemini Key in the web header or configure it in a .env file.' });
  }

  try {
    let base64Data = fileData;
    
    // Nếu truyền lên dạng URL, tải file về và chuyển đổi sang base64 ngay trên serverless
    if (fileUrl) {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Không thể tải tệp tin từ URL Supabase: ${fileResponse.statusText}`);
      }
      const arrayBuffer = await fileResponse.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
    }

    if (!base64Data) {
      return res.status(400).json({ error: 'Không tìm thấy dữ liệu tệp PDF để xử lý' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data
          }
        },
        {
          text: 'Bạn là một trợ lý AI chuyên nghiệp. Hãy đọc tài liệu PDF này (sách giáo khoa/chương trình học) và trích xuất/chuyển đổi toàn bộ nội dung kiến thức cốt lõi, danh sách các chương, các bài học và tóm tắt nội dung chi tiết của từng bài học sang định dạng Markdown (.md) sạch sẽ, rõ ràng, dễ đọc để làm căn cứ soạn giáo trình dạy học. Hãy viết toàn bộ bằng tiếng Việt.'
        }
      ]
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error processing PDF with Gemini' });
  }
}
