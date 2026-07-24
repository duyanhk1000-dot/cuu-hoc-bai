# CỰU HỌC BÀI - ANTIGRAVITY & NOTEBOOKLM MCP INTEGRATION RULES

Bạn đang làm việc trong môi trường Google Antigravity của dự án "Cựu Học Bài" (Family Learning App). 
Để duy trì tính nhất quán tri thức về kiến trúc dự án và quy chuẩn code, bạn sẽ kết nối với Google NotebookLM thông qua Model Context Protocol (MCP) server `notebooklm`.

---

## 1. MỤC TIÊU CỐT LÕI (CORE PURPOSE)
Mọi tài liệu kiến trúc, quy chuẩn code, sơ đồ DB, và lịch sử phát triển của dự án "Cựu Học Bài" (Family Learning App) được quản lý tập trung trên NotebookLM.
- Bạn KHÔNG ĐƯỢC tự ý suy đoán kiến trúc dự án nếu chưa truy vấn NotebookLM.
- Bạn BẮT BUỘC phải tham chiếu và đồng bộ tri thức với NotebookLM trước và sau khi thực hiện các nhiệm vụ lập trình lớn.

---

## 2. QUY TRÌNH THAO TÁC VỚI NOTEBOOKLM

### 🟢 Bước 1: Trước khi thực hiện tác vụ lớn (Context Retrieval)
Trước khi bắt đầu các nhiệm vụ lớn (như thêm tính năng mới, thay đổi DB schema, cập nhật logic chấm bài hoặc thiết kế lại API):
1. Sử dụng công cụ MCP `notebooklm` để truy vấn thông tin cần thiết từ Notebook của dự án:
   - Tra cứu quy chuẩn toán học (KaTeX/MathNormalizer).
   - Tra cứu Supabase Schema (`users`, `syllabuses`, `lessons`, `grades`, `messages`).
   - Tra cứu Prompting rules cho Gemini API (`/api/generate-lesson`, `/api/grade-test`).
2. Tóm tắt ngắn gọn các quy chuẩn đã đọc trước khi tiến hành viết code.
3. *Lưu ý*: Đối với các chỉnh sửa nhỏ hoặc sửa lỗi cú pháp đơn giản, không bắt buộc phải gọi MCP để tối ưu hóa độ trễ và quota API.

### 🟡 Bước 2: Trong khi Code (Execution Rules)
1. Tuân thủ nghiêm ngặt các quy định đã tra cứu từ NotebookLM.
2. Tuyệt đối không làm gãy pipeline `<MathRenderer />` và `src/utils/mathNormalizer.tsx`.
3. Nếu phát hiện điểm mâu thuẫn giữa code thực tế hiện tại và tài liệu trên NotebookLM, hãy thông báo và cảnh báo cho người dùng trước khi tiến hành refactor.

### 🔴 Bước 3: Sau khi Code (Knowledge Sync Back)
Khi hoàn thành một tính năng hoặc refactor thành công một mô-đun quan trọng:
1. Cập nhật các file tài liệu tương ứng tại thư mục `/docs` cục bộ (ví dụ: `progress.md`, `architecture.md`, hoặc `db_schema.md`).
2. Gọi công cụ MCP `notebooklm` hoặc lệnh CLI `nlm source update` để đồng bộ tệp tin tài liệu mới nhất này lên NotebookLM vào cuối phiên làm việc. Điều này giúp hệ thống lưu giữ "kỷ niệm mới nhất" cho các phiên làm việc sau.

---

## 3. CÁC HÀM MCP & LỆNH ĐƯỢC PHÉP SỬ DỤNG
- `notebooklm_query`: Đặt câu hỏi hỏi đáp kiến trúc dự án từ NotebookLM.
- `notebooklm_list_notebooks`: Tìm notebook ID của dự án "Cựu Học Bài".
- `notebooklm_add_source` hoặc `notebooklm_update_source`: Cập nhật file `.md` tài liệu mới lên NotebookLM.
- Lệnh CLI `nlm source update <notebook-id> --file ./docs/progress.md` (chạy trên shell như phương án dự phòng).
