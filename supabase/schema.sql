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
    has_renamed BOOLEAN DEFAULT FALSE,
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
    reported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Bảng creative_drawings (Bản vẽ)
CREATE TABLE IF NOT EXISTS creative_drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_username VARCHAR(100) NOT NULL REFERENCES Users(username) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    image_webp_url TEXT,
    is_exhibited BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Bảng creative_canvas_snapshots (Snapshot nét vẽ tldraw)
CREATE TABLE IF NOT EXISTS creative_canvas_snapshots (
    drawing_id UUID PRIMARY KEY REFERENCES creative_drawings(id) ON DELETE CASCADE,
    canvas_json JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Bảng creative_ai_analysis (Kết quả phân tích tranh từ Gemini Vision)
CREATE TABLE IF NOT EXISTS creative_ai_analysis (
    drawing_id UUID PRIMARY KEY REFERENCES creative_drawings(id) ON DELETE CASCADE,
    creativity_score NUMERIC(3,1),
    dominant_emotion VARCHAR(50),
    detected_objects TEXT[],
    theme_category VARCHAR(50),
    color_palette TEXT[],
    story_seed TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Bảng creative_ai_persona_preferences (Sở thích của các Persona)
CREATE TABLE IF NOT EXISTS creative_ai_persona_preferences (
    persona_id VARCHAR(50) PRIMARY KEY,
    persona_name VARCHAR(100) NOT NULL,
    favorite_themes TEXT[],
    favorite_colors TEXT[],
    like_probability NUMERIC(3,2) DEFAULT 0.50,
    comment_probability NUMERIC(3,2) DEFAULT 0.30,
    online_schedule VARCHAR(50)
);

-- 13. Bảng creative_social_queue (Hàng đợi bình luận và lượt thích AI)
CREATE TABLE IF NOT EXISTS creative_social_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID NOT NULL REFERENCES creative_drawings(id) ON DELETE CASCADE,
    persona_id VARCHAR(50) NOT NULL REFERENCES creative_ai_persona_preferences(persona_id) ON DELETE CASCADE,
    action_type VARCHAR(20) CHECK (action_type IN ('like', 'comment', 'bookmark')),
    comment_content TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Bảng creative_daily_rewards (Nhận thưởng 5 EXP hàng ngày)
CREATE TABLE IF NOT EXISTS creative_daily_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_username VARCHAR(100) NOT NULL REFERENCES Users(username) ON DELETE CASCADE,
    reward_date DATE DEFAULT CURRENT_DATE,
    earned_exp INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_username, reward_date)
);

-- 15. Bảng creative_likes (Thích tranh người thật)
CREATE TABLE IF NOT EXISTS creative_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID NOT NULL REFERENCES creative_drawings(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL REFERENCES Users(username) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(drawing_id, username)
);

-- 16. Bảng creative_comments (Bình luận người thật)
CREATE TABLE IF NOT EXISTS creative_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID NOT NULL REFERENCES creative_drawings(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL REFERENCES Users(username) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
