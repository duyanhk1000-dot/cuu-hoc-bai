import React from 'react'
import { Sparkles } from 'lucide-react'

interface AlertModalProps {
  message: string | null
  onClose: () => void
}

export const AlertModal = React.memo(({ message, onClose }: AlertModalProps) => {
  if (!message) return null

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl animate-zoom-in">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-white">Thông báo từ hệ thống</h4>
          <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all w-full shadow-md shadow-indigo-600/10"
        >
          Đồng ý
        </button>
      </div>
    </div>
  )
})
