import React, { useRef, useEffect } from 'react'
import { MessageSquare, X, Send } from 'lucide-react'
import { Message } from '../dataService'

interface ChatPanelProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  messages: Message[]
  newMsg: string
  setNewMsg: (msg: string) => void
  onSendMessage: (e: React.FormEvent) => void
  username: string
  placeholder?: string
}

const renderAvatar = (roleOrUsername: string, sizeClass = "w-7 h-7") => {
  const isParent = roleOrUsername === 'parent' || 
                   roleOrUsername === 'phuhuynh' || 
                   roleOrUsername.toLowerCase().includes('phu') || 
                   roleOrUsername.toLowerCase().includes('ba');
  
  return (
    <div className={`${sizeClass} rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] overflow-hidden shadow-inner select-none`}>
      {isParent ? '👨‍👩‍👧' : '🎓'}
    </div>
  )
}

export const ChatPanel = React.memo(({
  isOpen,
  setIsOpen,
  messages,
  newMsg,
  setNewMsg,
  onSendMessage,
  username,
  placeholder = "Nhắn tin..."
}: ChatPanelProps) => {
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll chat to bottom when messages or open state change
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-slate-100 shadow-xl glow-indigo hover:scale-105 active:scale-95 transition-all z-[45] border border-indigo-400/25"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[45] animate-slide-in-bottom">
          <div className="flex items-center gap-2 border-b border-slate-800 p-4 bg-slate-950/20">
            <MessageSquare className="w-4 h-4 text-indigo-400 animate-pulse" />
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider select-none">Trò chuyện gia đình</h2>
          </div>
          
          {/* Messages box */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-2 max-w-[85%] ${m.sender === username ? 'self-end flex-row-reverse' : 'self-start'}`}>
                {renderAvatar(m.sender, "w-7 h-7")}
                <div className={`flex flex-col ${m.sender === username ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-0.5">{m.sender}</span>
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.sender === username
                      ? 'bg-indigo-600 text-slate-100 rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    {m.message}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <form onSubmit={onSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/30 flex gap-2">
            <input
              type="text"
              placeholder={placeholder}
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500"
            />
            <button type="submit" className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
})
