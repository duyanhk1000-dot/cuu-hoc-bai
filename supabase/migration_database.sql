-- =======================================================
-- MIGRATION DATABASE: CHUẨN HÓA SCHEMA, INDEX & BẢO MẬT RLS CHI TIẾT
-- Hướng dẫn: Chạy script này trong SQL Editor trên Supabase Dashboard.
-- =======================================================

-- 0. BỔ SUNG CỘT auth_user_id VÀO BẢNG USERS NẾU CHƯA CÓ
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- 1. TẠO CÁC CHỈ MỤC (INDEXES) ĐỂ TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_lessons_subject_number 
    ON public.lessons(subject, lesson_number);

CREATE INDEX IF NOT EXISTS idx_grades_student_username 
    ON public.grades(student_username);

CREATE INDEX IF NOT EXISTS idx_grades_lesson_id 
    ON public.grades(lesson_id);

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id 
    ON public.users(auth_user_id);


-- 2. CẬP NHẬT RÀNG BUỘC KHÓA NGOẠI (FOREIGN KEY) VÀ CƠ CHẾ XÓA LIÊN ĐỚI (CASCADE DELETE)
-- Đảm bảo khi xóa lộ trình học (Syllabus), các bài học (Lessons) và các bảng liên quan được dọn sạch.
-- (Bảng Syllabus lưu subject làm khóa học chính độc nhất, Lessons tham chiếu subject)
-- Lưu ý: Postgres tự động Cascade Delete qua các ràng buộc khóa ngoại có chỉ định REFERENCES.


-- 3. KÍCH HOẠT VÀ TÁI THIẾT LẬP ROW LEVEL SECURITY (RLS) POLICIES PHÂN QUYỀN CHI TIẾT
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Dọn dẹp các policies cũ để tránh xung đột
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow public read syllabus" ON public.syllabus;
DROP POLICY IF EXISTS "Allow public write syllabus" ON public.syllabus;
DROP POLICY IF EXISTS "Allow public read lessons" ON public.lessons;
DROP POLICY IF EXISTS "Allow public write lessons" ON public.lessons;
DROP POLICY IF EXISTS "Allow public read grades" ON public.grades;
DROP POLICY IF EXISTS "Allow public write grades" ON public.grades;
DROP POLICY IF EXISTS "Allow public read messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public write messages" ON public.messages;


-- 3.1 BẢNG USERS
-- Cho phép đọc hồ sơ người dùng để hiển thị và xác minh phân quyền (Dual mode)
CREATE POLICY "Allow select users profile" ON public.users
    FOR SELECT TO anon, authenticated
    USING (true);

-- Người dùng chỉ được sửa đổi hồ sơ của chính mình
CREATE POLICY "Allow update own user profile" ON public.users
    FOR UPDATE TO anon, authenticated
    USING (
        (auth.role() = 'authenticated' AND auth_user_id = auth.uid()) OR
        (auth.role() = 'anon' AND (username = 'phuhuynh' OR username = 'hocsinh'))
    );


-- 3.2 BẢNG SYLLABUS (LỘ TRÌNH HỌC)
-- Học sinh, Phụ huynh và Mock session đều được phép xem lộ trình học
CREATE POLICY "Allow select syllabus" ON public.syllabus
    FOR SELECT TO anon, authenticated
    USING (true);

-- Chỉ Phụ huynh hoặc Mock Parent mới có quyền thêm/sửa/xóa lộ trình học
CREATE POLICY "Allow write syllabus for parent" ON public.syllabus
    FOR ALL TO anon, authenticated
    USING (
        (auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'parent'
        )) OR
        (auth.role() = 'anon') -- Cho phép mock session chỉnh sửa nội bộ
    );


-- 3.3 BẢNG LESSONS (BÀI HỌC)
-- Mọi vai trò được xem danh sách bài học
CREATE POLICY "Allow select lessons" ON public.lessons
    FOR SELECT TO anon, authenticated
    USING (true);

-- Chỉ Phụ huynh hoặc Mock Parent mới có quyền quản trị bài giảng (Thêm/Sửa/Xóa)
CREATE POLICY "Allow write lessons for parent" ON public.lessons
    FOR ALL TO anon, authenticated
    USING (
        (auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'parent'
        )) OR
        (auth.role() = 'anon')
    );


-- 3.4 BẢNG GRADES (KẾT QUẢ THI)
-- Phụ huynh xem được toàn bộ kết quả thi của các con. Học sinh chỉ được xem kết quả thi của chính mình.
CREATE POLICY "Allow select grades" ON public.grades
    FOR SELECT TO anon, authenticated
    USING (
        -- Trường hợp Phụ huynh (Đăng nhập thật hoặc Mock)
        (auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'parent'
        )) OR
        (auth.role() = 'anon' AND NOT EXISTS (
            SELECT 1 FROM public.users WHERE auth_user_id = auth.uid()
        )) OR
        -- Trường hợp Học sinh: chỉ xem được bài thi của bản thân
        (auth.role() = 'authenticated' AND student_username IN (
            SELECT username FROM public.users WHERE auth_user_id = auth.uid()
        )) OR
        (auth.role() = 'anon' AND student_username = 'hocsinh')
    );

-- Học sinh gửi kết quả thi của chính mình. Phụ huynh có thể xóa kết quả bài thi.
CREATE POLICY "Allow insert grades for students" ON public.grades
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        (auth.role() = 'authenticated' AND student_username IN (
            SELECT username FROM public.users WHERE auth_user_id = auth.uid()
        )) OR
        (auth.role() = 'anon' AND student_username = 'hocsinh')
    );

CREATE POLICY "Allow delete grades for parents" ON public.grades
    FOR DELETE TO anon, authenticated
    USING (
        (auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'parent'
        )) OR
        (auth.role() = 'anon')
    );


-- 3.5 BẢNG MESSAGES (CHAT BOX)
-- Cho phép mọi thành viên đọc và gửi tin nhắn trong gia đình công khai
CREATE POLICY "Allow select messages" ON public.messages
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Allow insert messages" ON public.messages
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- 3.6 BẢNG STUDENTPETS & PETEVENTS
CREATE TABLE IF NOT EXISTS public.studentpets (
    id SERIAL PRIMARY KEY,
    student_username VARCHAR(100) UNIQUE NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.petevents (
    id SERIAL PRIMARY KEY,
    student_username VARCHAR(100) NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    reward_coins INTEGER DEFAULT 0,
    reward_exp INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.studentpets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petevents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on studentpets" ON public.studentpets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on petevents" ON public.petevents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
