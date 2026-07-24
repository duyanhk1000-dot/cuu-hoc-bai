import React, { useState } from 'react'
import { GraduationCap, Lock, Mail, Loader2 } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateEmail = (inputEmail: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(inputEmail)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword) {
      setError('Vui lòng điền đầy đủ email và mật khẩu!')
      return
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Email không hợp lệ! Vui lòng nhập đúng định dạng email.')
      return
    }

    setLoading(true)

    try {
      const { error: loginError } = await login(trimmedEmail, trimmedPassword)
      if (loginError) {
        const errMsg = loginError.message.toLowerCase()
        if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid credentials')) {
          setError('Sai email hoặc mật khẩu!')
        } else if (errMsg.includes('email') || errMsg.includes('invalid email')) {
          setError('Email không hợp lệ!')
        } else if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('failed to fetch')) {
          setError('Lỗi kết nối mạng! Vui lòng kiểm tra lại đường truyền.')
        } else {
          setError('Đăng nhập thất bại! Vui lòng thử lại sau.')
        }
      }
    } catch {
      setError('Đã xảy ra lỗi kết nối mạng!')
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
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">Email đăng nhập</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email đăng nhập (ví dụ: phuhuynh@example.com)"
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
                placeholder="Nhập mật khẩu"
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
