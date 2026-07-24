-- 1. Bảng Users
CREATE TABLE IF NOT EXISTS Users (
    username VARCHAR(100) PRIMARY KEY,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('parent', 'student')),
    api_keys TEXT -- Lưu danh sách API Keys dưới dạng chuỗi JSON
);

-- 2. Bảng Syllabus
CREATE TABLE IF NOT EXISTS Syllabus (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(200) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    textbook_content TEXT,
    pdf_file_path TEXT,
    total_lessons INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Lessons
CREATE TABLE IF NOT EXISTS Lessons (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(200) NOT NULL,
    lesson_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    lecture_content TEXT NOT NULL,
    questions TEXT NOT NULL, -- Lưu danh sách câu hỏi dạng JSON
    duration INTEGER NOT NULL, -- Thời gian làm bài (phút)
    flashcards TEXT, -- Lưu danh sách 15 flashcards dạng JSON
    is_published BOOLEAN DEFAULT FALSE,
    parent_feedback TEXT,
    infographic_url VARCHAR(500),
    infographic_prompt TEXT,
    infographic_content TEXT,
    mindmap TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject, lesson_number)
);

-- 4. Bảng Grades
CREATE TABLE IF NOT EXISTS Grades (
    id SERIAL PRIMARY KEY,
    student_username VARCHAR(100) NOT NULL,
    lesson_id INTEGER NOT NULL REFERENCES Lessons(id) ON DELETE CASCADE,
    answers TEXT NOT NULL, -- Lưu câu trả lời của học sinh dạng JSON
    score REAL NOT NULL,
    ai_feedback TEXT NOT NULL, -- Phản hồi chấm điểm của AI dạng JSON
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_username) REFERENCES Users(username) ON DELETE CASCADE
);

-- 5. Bảng Messages
CREATE TABLE IF NOT EXISTS Messages (
    id SERIAL PRIMARY KEY,
    sender VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gieo dữ liệu tài khoản mặc định
INSERT INTO Users (username, password, role)
VALUES 
    ('phuhuynh', '123456', 'parent'),
    ('hocsinh', '123456', 'student')
ON CONFLICT (username) DO NOTHING;

-- 6. Khởi tạo Storage Bucket cho tệp PDF và chính sách bảo mật (Storage policies)
-- Tạo bucket 'textbooks' nếu chưa tồn tại
INSERT INTO storage.buckets (id, name, public) 
VALUES ('textbooks', 'textbooks', true)
ON CONFLICT (id) DO NOTHING;

-- Thiết lập Policy cho phép upload (INSERT) file không cần đăng nhập (dành cho client anon key)
CREATE POLICY "Cho phép upload sách công khai" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'textbooks');

-- Thiết lập Policy cho phép xem sách công khai
CREATE POLICY "Cho phép xem sách công khai" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'textbooks');

-- 7. Bảng StudentPets (Lưu trữ trạng thái thú cưng)
CREATE TABLE IF NOT EXISTS StudentPets (
    id SERIAL PRIMARY KEY,
    student_username VARCHAR(100) UNIQUE NOT NULL REFERENCES Users(username) ON DELETE CASCADE,
    pet_name VARCHAR(100) DEFAULT 'Hamster',
    current_level INTEGER DEFAULT 0,
    current_exp INTEGER DEFAULT 0,
    current_hp INTEGER DEFAULT 100,
    coins INTEGER DEFAULT 0,
    equipped_hat VARCHAR(100) DEFAULT NULL,
    equipped_accessory VARCHAR(100) DEFAULT NULL,
    last_decay_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Bảng PetEvents (Nhiệm vụ/Sự kiện từ phụ huynh)
CREATE TABLE IF NOT EXISTS PetEvents (
    id SERIAL PRIMARY KEY,
    student_username VARCHAR(100) NOT NULL REFERENCES Users(username) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    reward_coins INTEGER DEFAULT 0,
    reward_exp INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
