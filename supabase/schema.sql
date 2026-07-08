-- 1. Bảng Users
CREATE TABLE IF NOT EXISTS Users (
    username VARCHAR(100) PRIMARY KEY,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('parent', 'student'))
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
