import psycopg2

DB_URL = "postgresql://postgres:duyanh11111988@db.udksngnafcfubpuwcjhp.supabase.co:5432/postgres"

def main():
    print("Đang kết nối tới cơ sở dữ liệu Supabase...")
    try:
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("Đang thêm cột 'mindmap' vào bảng 'Lessons'...")
        cursor.execute("ALTER TABLE Lessons ADD COLUMN IF NOT EXISTS mindmap TEXT;")
        print("Chúc mừng! Cột 'mindmap' đã được thêm thành công vào bảng 'Lessons'.")
        
        # Verify columns
        cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lessons';")
        cols = cursor.fetchall()
        print("\nDanh sách các cột hiện tại trong bảng Lessons:")
        for col in cols:
            print(f" - {col[0]}: {col[1]}")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Lỗi khi chạy migration: {e}")
        import sys
        sys.exit(1)

if __name__ == "__main__":
    main()
