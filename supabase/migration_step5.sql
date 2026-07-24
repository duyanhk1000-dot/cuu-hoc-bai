-- ==========================================
-- BƯỚC 5: SQL MIGRATION - XÓA PASSWORD & THIẾT LẬP RLS
-- Hướng dẫn: Sao chép toàn bộ nội dung file này và chạy trong SQL Editor của Supabase Dashboard.
-- ==========================================

-- 1. XÓA CỘT PASSWORD KHỎI BẢNG USERS (ĐỂ ĐẢM BẢO BẢO MẬT)
ALTER TABLE public.users DROP COLUMN IF EXISTS password;

-- 2. KÍCH HOẠT ROW LEVEL SECURITY (RLS) CHO CÁC BẢNG
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. THIẾT LẬP RLS POLICIES (HỖ TRỢ SONG SONG CẢ ANON KEY/MOCK SESSION VÀ AUTHENTICATED USERS)

-- 3.1 Bảng Users
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users 
    FOR SELECT TO anon, authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow public update users" ON public.users;
CREATE POLICY "Allow public update users" ON public.users 
    FOR UPDATE TO anon, authenticated 
    USING (true);

-- 3.2 Bảng Syllabus
DROP POLICY IF EXISTS "Allow public read syllabus" ON public.syllabus;
CREATE POLICY "Allow public read syllabus" ON public.syllabus 
    FOR SELECT TO anon, authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow public write syllabus" ON public.syllabus;
CREATE POLICY "Allow public write syllabus" ON public.syllabus 
    FOR ALL TO anon, authenticated 
    USING (true);

-- 3.3 Bảng Lessons
DROP POLICY IF EXISTS "Allow public read lessons" ON public.lessons;
CREATE POLICY "Allow public read lessons" ON public.lessons 
    FOR SELECT TO anon, authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow public write lessons" ON public.lessons;
CREATE POLICY "Allow public write lessons" ON public.lessons 
    FOR ALL TO anon, authenticated 
    USING (true);

-- 3.4 Bảng Grades
DROP POLICY IF EXISTS "Allow public read grades" ON public.grades;
CREATE POLICY "Allow public read grades" ON public.grades 
    FOR SELECT TO anon, authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow public write grades" ON public.grades;
CREATE POLICY "Allow public write grades" ON public.grades 
    FOR ALL TO anon, authenticated 
    USING (true);

-- 3.5 Bảng Messages
DROP POLICY IF EXISTS "Allow public read messages" ON public.messages;
CREATE POLICY "Allow public read messages" ON public.messages 
    FOR SELECT TO anon, authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow public write messages" ON public.messages;
CREATE POLICY "Allow public write messages" ON public.messages 
    FOR ALL TO anon, authenticated 
    USING (true);

-- ==========================================
-- HOÀN TẤT MIGRATION
-- ==========================================
