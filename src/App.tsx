import { Loader2 } from 'lucide-react'
import Login from './pages/Login'
import ParentDashboard from './pages/ParentDashboard'
import StudentDashboard from './pages/StudentDashboard'
import { isSupabaseConfigured } from './supabaseClient'
import { AuthProvider, useAuth } from './components/AuthProvider'

function AppContent() {
  const { user, profile, loading, logout } = useAuth()

  // 1. Hiển thị màn hình chờ khi đang tải thông tin phiên làm việc
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Đang tải thông tin phiên đăng nhập...</p>
      </div>
    )
  }

  // 2. Nếu chưa đăng nhập hoặc chưa tải được profile, chuyển về trang Login
  if (!user || !profile) {
    return <Login />
  }

  return (
    <main className="w-full">
      {profile.role === 'parent' ? (
        <ParentDashboard />
      ) : (
        <StudentDashboard />
      )}
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 bg-slate-950">
        {/* Top Banner indicating local fallback state (chỉ hiển thị khi Supabase chưa cấu hình) */}
        {!isSupabaseConfigured && (
          <div className="bg-amber-600/90 text-amber-50 text-center py-1.5 px-4 text-xs font-medium backdrop-blur border-b border-amber-500/20 z-50 relative animate-pulse-subtle">
            ⚠️ <strong>Đang chạy chế độ Offline:</strong> Supabase chưa được cấu hình. Mọi thay đổi dữ liệu sẽ được lưu trữ cục bộ (LocalStorage) trên trình duyệt này.
          </div>
        )}

        <AppContent />
      </div>
    </AuthProvider>
  )
}

export default App
