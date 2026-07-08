import React, { useState } from 'react'
import { GraduationCap, Lock, User as UserIcon, Loader2 } from 'lucide-react'
import { dataService, User } from '../dataService'

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu!')
      return
    }

    setLoading(true)
    setError('')

    try {
      const verifiedUser = await dataService.verifyUser(username.trim(), password.trim())
      if (verifiedUser) {
        onLogin(verifiedUser)
      } else {
        setError('Sai tên đăng nhập hoặc mật khẩu!')
      }
    } catch {
      setError('Đã xảy ra lỗi kết nối cơ sở dữ liệu!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background blobs for rich aesthetics */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse-subtle"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-md p-8 rounded-2xl glass-panel glow-indigo z-10 relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 animate-bounce" style={{ animationDuration: '3s' }}>
            <GraduationCap className="w-9 h-9 text-slate-100" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            Học tập Gia đình
          </h1>
          <p className="text-slate-400 text-sm mt-1">Cổng kết nối tri thức cha mẹ và con cái</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-sm leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">Tên đăng nhập</label>
            <div className="relative">
              <UserIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập (ví dụ: phuhuynh)"
                className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">Mật khẩu</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu (ví dụ: 123456)"
                className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-slate-100 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none mt-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
