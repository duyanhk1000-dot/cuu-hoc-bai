import { useState, useEffect } from 'react'
import Login from './pages/Login'
import ParentDashboard from './pages/ParentDashboard'
import StudentDashboard from './pages/StudentDashboard'
import { isSupabaseConfigured } from './supabaseClient'
import { User } from './dataService'

function App() {
  const [user, setUser] = useState<User | null>(null)

  // Load user from session on start
  useEffect(() => {
    const savedUser = localStorage.getItem('family_learning_user')
    if (savedUser && savedUser !== 'undefined') {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('family_learning_user')
      }
    }
  }, [])

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser)
    localStorage.setItem('family_learning_user', JSON.stringify(loggedInUser))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('family_learning_user')
  }

  return (
    <div className="min-h-screen text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Banner indicating local fallback state */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-600/90 text-amber-50 text-center py-1.5 px-4 text-xs font-medium backdrop-blur border-b border-amber-500/20 z-50 relative animate-pulse-subtle">
          ⚠️ <strong>Đang chạy chế độ Offline:</strong> Supabase chưa được cấu hình. Mọi thay đổi dữ liệu sẽ được lưu trữ cục bộ (LocalStorage) trên trình duyệt này.
        </div>
      )}

      {/* Main Container */}
      <main className="w-full">
        {!user ? (
          <Login onLogin={handleLogin} />
        ) : user.role === 'parent' ? (
          <ParentDashboard user={user} onLogout={handleLogout} />
        ) : (
          <StudentDashboard user={user} onLogout={handleLogout} />
        )}
      </main>
    </div>
  )
}

export default App
