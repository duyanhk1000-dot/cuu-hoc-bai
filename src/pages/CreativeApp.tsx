import React, { useState, useEffect, useRef, Suspense } from 'react'
import { Tldraw, useEditor, createShapeId } from 'tldraw'
import 'tldraw/tldraw.css'
import { 
  ArrowLeft, 
  Palette, 
  Image as ImageIcon, 
  FolderOpen, 
  Heart, 
  MessageCircle, 
  Sparkles, 
  Save, 
  Send, 
  Smile, 
  X,
  MessageSquare,
  Compass,
  TrendingUp,
  Award
} from 'lucide-react'
import { dataService, CreativeDrawing, CreativeComment } from '../dataService'

// Import confetti library dynamically (or use standard CSS fallback animation if not available)
// @ts-ignore
import confetti from 'canvas-confetti'

interface CreativeAppProps {
  username: string
  onClose: () => void
}

// Inner component to get Tldraw Editor Instance
function CanvasToolbar({ 
  onSave, 
  onExhibit, 
  isSaving, 
  isExhibiting 
}: { 
  onSave: (editor: any) => void
  onExhibit: (editor: any) => void
  isSaving: boolean
  isExhibiting: boolean
}) {
  const editor = useEditor()
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[10] backdrop-blur-md">
      <button
        onClick={() => onSave(editor)}
        disabled={isSaving}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
      >
        <Save className="w-3.5 h-3.5 text-indigo-400" />
        <span>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</span>
      </button>
      <div className="w-[1px] h-4 bg-slate-800" />
      <button
        onClick={() => onExhibit(editor)}
        disabled={isExhibiting}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
      >
        <Award className="w-3.5 h-3.5 animate-bounce" />
        <span>{isExhibiting ? 'Đang treo...' : '🚪 Treo lên triển lãm'}</span>
      </button>
    </div>
  )
}

export default function CreativeApp({ username, onClose }: CreativeAppProps) {
  const [creativeTab, setCreativeTab] = useState<'canvas' | 'gallery' | 'my_drawings'>('canvas')
  const [myDrawings, setMyDrawings] = useState<CreativeDrawing[]>([])
  const [galleryDrawings, setGalleryDrawings] = useState<CreativeDrawing[]>([])
  
  // Canvas editing states
  const [activeDrawing, setActiveDrawing] = useState<CreativeDrawing | null>(null)
  const [drawingTitle, setDrawingTitle] = useState('Bức vẽ của con')
  const [isSaving, setIsSaving] = useState(false)
  const [isExhibiting, setIsExhibiting] = useState(false)
  const [tldrawSnapshot, setTldrawSnapshot] = useState<any>(null)
  
  // Confetti / Exp rewards state
  const [expEarnedNotice, setExpEarnedNotice] = useState<string | null>(null)

  // Sóc Sắc Màu (Creative Chatbot) Assistant states
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([
    { role: 'assistant', content: 'Chào bé yêu! Sóc Sắc Màu đã sẵn sàng đồng hành cùng con rồi đây! Hôm nay con muốn vẽ chủ đề gì nào? Con có thể hỏi Sóc phối màu hoặc gợi ý thử thách vẽ nhé! 🎨🐿️' }
  ])
  const [newMsg, setNewMsg] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Gallery detail modal states
  const [selectedDrawing, setSelectedDrawing] = useState<CreativeDrawing | null>(null)
  const [drawingComments, setDrawingComments] = useState<CreativeComment[]>([])
  const [drawingAiComments, setDrawingAiComments] = useState<any[]>([])
  const [newCommentText, setNewCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Load My Drawings & Gallery
  useEffect(() => {
    loadMyDrawings()
    loadGalleryDrawings()
  }, [])

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isChatOpen])

  const loadMyDrawings = async () => {
    const list = await dataService.getCreativeDrawings(username)
    setMyDrawings(list || [])
  }

  const loadGalleryDrawings = async () => {
    const list = await dataService.getExhibitionDrawings()
    setGalleryDrawings(list || [])
  }

  // Load comments for selected drawing
  useEffect(() => {
    if (selectedDrawing?.id) {
      loadDrawingComments(selectedDrawing.id)
    }
  }, [selectedDrawing])

  const loadDrawingComments = async (drawingId: string) => {
    const res = await dataService.getDrawingComments(drawingId)
    if (res) {
      setDrawingComments(res.comments)
      setDrawingAiComments(res.aiComments)
    }
  }

  // Save drawing logic
  const handleSaveDrawing = async (editor: any) => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const snapshot = editor.store.getFilters().value
      
      // Export WebP image representation
      const imageUrl = await captureWebpFromTldraw(editor)
      
      const payload: Partial<CreativeDrawing> = {
        id: activeDrawing?.id || undefined,
        student_username: username,
        title: drawingTitle.trim() || 'Bức vẽ không tên',
        image_webp_url: imageUrl || '',
        thumbnail_url: imageUrl || '',
        is_exhibited: activeDrawing?.is_exhibited || false,
        visibility: activeDrawing?.visibility || 'private'
      }

      const saved = await dataService.saveCreativeDrawing(payload, snapshot)
      if (saved) {
        setActiveDrawing(saved)
        loadMyDrawings()
        // Show subtle save indicator
        const notification = document.createElement('div')
        notification.className = 'fixed top-6 right-6 bg-slate-900 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold z-[100] shadow-2xl animate-fade-in'
        notification.innerText = '💾 Đã tự động lưu nháp!'
        document.body.appendChild(notification)
        setTimeout(() => notification.remove(), 2500)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // Hang drawing logic
  const handleExhibitDrawing = async (editor: any) => {
    if (isExhibiting) return
    setIsExhibiting(true)
    try {
      const snapshot = editor.store.getFilters().value
      const imageUrl = await captureWebpFromTldraw(editor)

      // 1. Save metadata first
      const payload: Partial<CreativeDrawing> = {
        id: activeDrawing?.id || undefined,
        student_username: username,
        title: drawingTitle.trim() || 'Bức vẽ không tên',
        image_webp_url: imageUrl || '',
        thumbnail_url: imageUrl || '',
        is_exhibited: true,
        visibility: 'public' as const
      }

      const saved = await dataService.saveCreativeDrawing(payload, snapshot)
      if (saved) {
        setActiveDrawing(saved)
        
        // 2. Exhibition actions (EXP Reward and AI scheduler pipeline)
        const rewardStatus = await dataService.hangDrawingOnExhibition(saved.id!, username, imageUrl || '')
        
        // Render fireworks / confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        })

        if (rewardStatus.claimed) {
          setExpEarnedNotice(`🎉 Con đã truyền cảm hứng nghệ thuật hôm nay! Nhận được +${rewardStatus.expEarned} EXP thú cưng nhé!`)
        } else {
          setExpEarnedNotice(`🚪 Tranh đã được treo thành công lên triển lãm ngày hôm nay!`)
        }

        loadMyDrawings()
        loadGalleryDrawings()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsExhibiting(false)
    }
  }

  // Convert tldraw canvas SVG representation to WebP client side
  const captureWebpFromTldraw = async (editor: any): Promise<string | null> => {
    const shapeIds = Array.from(editor.getCurrentPageShapeIds())
    if (shapeIds.length === 0) return null

    try {
      const svg = await editor.getSvg(shapeIds)
      if (!svg) return null
      const svgString = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const URL = window.URL || window.webkitURL || window
      const blobURL = URL.createObjectURL(svgBlob)

      return new Promise((resolve) => {
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          // Add padding for aesthetic render margins
          canvas.width = image.width + 40
          canvas.height = image.height + 40
          const context = canvas.getContext('2d')
          if (context) {
            context.fillStyle = '#ffffff'
            context.fillRect(0, 0, canvas.width, canvas.height)
            context.drawImage(image, 20, 20)
            const webpDataUrl = canvas.toDataURL('image/webp', 0.8)
            resolve(webpDataUrl)
          } else {
            resolve(null)
          }
        }
        image.onerror = () => resolve(null)
        image.src = blobURL
      })
    } catch (err) {
      console.error("captureWebpFromTldraw error:", err)
      return null
    }
  }

  // Opens an existing drawing on the canvas
  const handleOpenDrawing = async (drawing: CreativeDrawing) => {
    setActiveDrawing(drawing)
    setDrawingTitle(drawing.title)
    
    // Load heavy canvas snapshot JSON
    const snapshot = await dataService.getDrawingCanvasSnapshot(drawing.id!)
    setTldrawSnapshot(snapshot)
    setCreativeTab('canvas')
  }

  // Auto-load snapshot to Tldraw when active drawing changes
  const onMountEditor = (editor: any) => {
    if (tldrawSnapshot) {
      editor.store.loadSnapshot(tldrawSnapshot)
      setTldrawSnapshot(null) // Consume snapshot
    } else {
      editor.store.clear()
    }
  }

  // Create a new fresh drawing board
  const handleNewDrawing = () => {
    setActiveDrawing(null)
    setDrawingTitle('Bức vẽ của con')
    setTldrawSnapshot(null)
    setCreativeTab('canvas')
  }

  // Creative Chatbot (Sóc Sắc Màu) conversation
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim() || isChatLoading) return

    const userMessage = { role: 'user', content: newMsg.trim() }
    setChatMessages(prev => [...prev, userMessage])
    setNewMsg('')
    setIsChatLoading(true)

    // Build memory from local drawing themes
    const localMemory = {
      last_draw_theme: activeDrawing?.title || 'bức vẽ hiện tại',
      favorite_objects: []
    }

    try {
      const response = await fetch('/api/chat-creative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          memory: localMemory
        })
      })

      if (response.ok) {
        const data = await response.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        // Local fallback assistant mock message
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sóc đang bận suy nghĩ một chút, con vẽ tiếp nhé! Chút nữa Sóc sẽ góp ý cho bức vẽ của con thật rực rỡ! 🎨🐿️' }])
      }
    } catch (err) {
      console.error(err)
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Ôi hình như sóng ma thuật của Sóc đang bị yếu một chút. Con có thể vẽ và hỏi lại sau nhé! 🐿️🌈' }])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Like a drawing inside the Exhibition Modal
  const handleLikeDrawing = async (drawingId: string) => {
    await dataService.likeCreativeDrawing(drawingId, username)
    // Refresh likes count in selectedDrawing view
    if (selectedDrawing && selectedDrawing.id === drawingId) {
      setSelectedDrawing(prev => prev ? { ...prev, likes_count: (prev.likes_count || 0) + 1 } : null)
    }
    loadGalleryDrawings()
    loadMyDrawings()
  }

  // User comments submission inside Gallery Detail
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim() || !selectedDrawing?.id || isSubmittingComment) return
    setIsSubmittingComment(true)
    try {
      const added = await dataService.addDrawingComment(selectedDrawing.id, username, newCommentText.trim())
      if (added) {
        setNewCommentText('')
        loadDrawingComments(selectedDrawing.id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100 font-sans selection:bg-purple-500/30 select-none creative-corner-wrapper">
      {/* Top Header Navigation */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-spin-slow">🎨</span>
            <div>
              <h1 className="text-sm font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500">
                GÓC SÁNG TẠO
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Học vui vẻ - Sáng tạo tự do</p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-950/60 p-1 rounded-2xl border border-slate-800/80">
          <button
            onClick={() => setCreativeTab('canvas')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              creativeTab === 'canvas'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Vẽ Tranh</span>
          </button>
          <button
            onClick={() => {
              setCreativeTab('gallery')
              loadGalleryDrawings()
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              creativeTab === 'gallery'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Triển Lãm</span>
          </button>
          <button
            onClick={() => {
              setCreativeTab('my_drawings')
              loadMyDrawings()
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              creativeTab === 'my_drawings'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Tranh Của Con</span>
          </button>
        </div>

        {/* Exit Button */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-800 transition-all"
        >
          <span>Quay lại học</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Working Viewports */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-purple-950/20">
        
        {/* TAB 1: DRAWING CANVAS (TLDRAW WORKSPACE) */}
        {creativeTab === 'canvas' && (
          <div className="w-full h-full relative">
            <div className="absolute top-4 left-6 z-[10] flex flex-col gap-1.5 pointer-events-auto">
              <input
                type="text"
                value={drawingTitle}
                onChange={(e) => setDrawingTitle(e.target.value)}
                className="bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl text-xs text-white font-bold max-w-[200px] focus:outline-none focus:border-purple-500/50 backdrop-blur-sm"
                placeholder="Tên bức tranh..."
              />
            </div>
            
            <div className="w-full h-full relative" style={{ touchAction: 'none' }}>
              <Tldraw 
                onMount={onMountEditor}
              >
                <CanvasToolbar 
                  onSave={handleSaveDrawing}
                  onExhibit={handleExhibitDrawing}
                  isSaving={isSaving}
                  isExhibiting={isExhibiting}
                />
              </Tldraw>
            </div>
          </div>
        )}

        {/* TAB 2: TRIỂN LÃM GALLERY WALLS (PINTEREST STYLE) */}
        {creativeTab === 'gallery' && (
          <div className="w-full h-full overflow-y-auto px-10 py-8 scrollbar-thin">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex justify-between items-end border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-lg font-black tracking-wider text-slate-100 flex items-center gap-2">
                    🏆 PHÒNG TRIỂN LÃM HÔM NAY
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Hôm nay phòng triển lãm đã có <strong className="text-orange-400 font-black">{galleryDrawings.length}</strong> bức tranh tuyệt đẹp được treo!
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-800/60">
                  <TrendingUp className="w-3.5 h-3.5 text-pink-500 animate-bounce" />
                  <span>Sáng tạo không ngừng nghỉ</span>
                </div>
              </div>

              {galleryDrawings.length === 0 ? (
                <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
                  <span className="text-5xl animate-bounce">🖼️</span>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-300">Phòng triển lãm hôm nay đang chờ bức tranh đầu tiên!</p>
                    <p className="text-xs text-slate-500">Con hãy vẽ một bức tranh tuyệt vời và treo lên triển lãm nhé!</p>
                  </div>
                  <button
                    onClick={handleNewDrawing}
                    className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    🚀 Bắt đầu vẽ ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {galleryDrawings.map((draw) => (
                    <div 
                      key={draw.id}
                      onClick={() => setSelectedDrawing(draw)}
                      className="group bg-slate-900/60 border border-slate-850 hover:border-purple-500/30 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1"
                    >
                      <div className="aspect-video w-full bg-white relative overflow-hidden flex items-center justify-center">
                        <img 
                          src={draw.image_webp_url} 
                          alt={draw.title}
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-all"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/0 transition-all" />
                      </div>
                      <div className="p-4 flex flex-col gap-2 bg-slate-950/10">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-xs font-black text-slate-100 line-clamp-1 group-hover:text-purple-400 transition-all">
                            {draw.title}
                          </h3>
                          <span className="text-[10px] text-slate-500 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full shrink-0">
                            by {draw.student_username}
                          </span>
                        </div>
                        
                        {/* Likes badge representation */}
                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-850">
                          <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                            <Heart className="w-3 h-3 fill-yellow-400" />
                            <span>
                              {(draw.likes_count || 0) >= 15 ? '🎉 Nổi bật hôm nay' : 
                               (draw.likes_count || 0) >= 10 ? '🌟 Đang chú ý' : 
                               (draw.likes_count || 0) >= 5 ? '💛 Các bạn yêu thích' : '🖼️ Triển lãm'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2.5 text-slate-500 group-hover:text-slate-400 transition-all">
                            <span className="flex items-center gap-1 text-[10px]">
                              <Heart className="w-3 h-3 text-red-500/60" />
                              {draw.likes_count || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRẦN VẼ CỦA HỌC SINH (MY GALLERY) */}
        {creativeTab === 'my_drawings' && (
          <div className="w-full h-full overflow-y-auto px-10 py-8 scrollbar-thin">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex justify-between items-end border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-lg font-black tracking-wider text-slate-100 flex items-center gap-2">
                    📁 BỘ SƯU TẬP CỦA CON
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Con đã vẽ và lưu trữ <strong className="text-purple-400 font-black">{myDrawings.length}</strong> bức tranh tuyệt vời.</p>
                </div>
                <button
                  onClick={handleNewDrawing}
                  className="px-4 py-2 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
                >
                  ➕ Tạo bức vẽ mới
                </button>
              </div>

              {myDrawings.length === 0 ? (
                <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
                  <span className="text-5xl animate-bounce">📁</span>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-300">Thư mục bản vẽ của con đang trống!</p>
                    <p className="text-xs text-slate-500">Hãy vẽ bức đầu tiên để lưu kỷ niệm sáng tạo của con nhé!</p>
                  </div>
                  <button
                    onClick={handleNewDrawing}
                    className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg"
                  >
                    🎨 Bắt đầu vẽ
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {myDrawings.map((draw) => (
                    <div 
                      key={draw.id}
                      onClick={() => handleOpenDrawing(draw)}
                      className="group bg-slate-900/60 border border-slate-850 hover:border-purple-500/30 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1"
                    >
                      <div className="aspect-video w-full bg-white relative overflow-hidden flex items-center justify-center">
                        <img 
                          src={draw.image_webp_url} 
                          alt={draw.title}
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-all"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-4 bg-slate-950/10">
                        <h3 className="text-xs font-black text-slate-100 line-clamp-1 group-hover:text-purple-400 transition-all">
                          {draw.title}
                        </h3>
                        <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-slate-850">
                          <span className="text-[10px] text-slate-500">
                            {new Date(draw.created_at || '').toLocaleDateString('vi-VN')}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            draw.is_exhibited 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                              : 'bg-slate-800 border border-slate-700 text-slate-400'
                          }`}>
                            {draw.is_exhibited ? 'Đang triển lãm 🚪' : 'Bản nháp'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FLOAT 1: EXP / REWARD NOTIFICATION MODAL */}
      {expEarnedNotice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 text-center shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <span className="text-5xl animate-pulse">🎉</span>
            <h3 className="text-base font-black text-white mt-4">Tuyệt vời quá!</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">{expEarnedNotice}</p>
            <button
              onClick={() => setExpEarnedNotice(null)}
              className="mt-6 w-full py-2.5 bg-gradient-to-tr from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
            >
              Tiếp tục vẽ tranh
            </button>
          </div>
        </div>
      )}

      {/* FLOAT 2: SÓC SẮC MÀU CHAT ASSISTANT BUBBLE (FLOATING CHAT) */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-slate-100 shadow-2xl hover:scale-105 active:scale-95 transition-all z-[45] border border-purple-400/25 animate-bounce-subtle"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <span className="text-2xl">🐿️</span>}
      </button>

      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[45] animate-slide-in-bottom">
          <div className="flex items-center gap-2.5 border-b border-slate-800 p-4 bg-slate-950/20">
            <span className="text-xl animate-pulse">🐿️</span>
            <div>
              <h2 className="text-xs font-black text-slate-200 select-none">SÓC SẮC MÀU</h2>
              <p className="text-[9px] text-slate-400">Trợ lý đồng hành sáng tạo ảo</p>
            </div>
          </div>
          
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
            {chatMessages.map((m, idx) => (
              <div key={idx} className={`flex items-start gap-2 max-w-[85%] ${m.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                <div className={`w-7 h-7 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-xs overflow-hidden shadow-inner select-none shrink-0`}>
                  {m.role === 'user' ? '🎓' : '🐿️'}
                </div>
                <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-slate-100 rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-750'
                  }`}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex items-start gap-2 max-w-[85%] self-start">
                <div className="w-7 h-7 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-xs overflow-hidden shadow-inner select-none shrink-0">
                  🐿️
                </div>
                <div className="px-3 py-2 rounded-2xl text-xs bg-slate-800 text-slate-400 rounded-tl-none border border-slate-750 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150" />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-300" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form chat input */}
          <form onSubmit={handleSendChatMessage} className="p-4 border-t border-slate-800 bg-slate-950/30 flex gap-2">
            <input
              type="text"
              placeholder="Hỏi Sóc phối màu, gợi ý vẽ..."
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
            />
            <button type="submit" className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* FLOAT 3: DETAIL MODAL FOR EXHIBITED DRAWINGS */}
      {selectedDrawing && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col md:flex-row shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Left Column: Image frame */}
            <div className="flex-1 bg-white p-6 flex items-center justify-center relative min-h-[300px] md:min-h-auto">
              <img 
                src={selectedDrawing.image_webp_url} 
                alt={selectedDrawing.title}
                className="max-w-full max-h-[60vh] object-contain"
              />
              <button 
                onClick={() => setSelectedDrawing(null)}
                className="absolute top-4 left-4 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all md:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Right Column: Comments & info */}
            <div className="w-full md:w-[360px] border-t md:border-t-0 md:border-l border-slate-800 flex flex-col max-h-[40vh] md:max-h-none overflow-hidden bg-slate-950/20">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
                <div>
                  <h3 className="text-sm font-black text-white">{selectedDrawing.title}</h3>
                  <p className="text-[10px] text-slate-500">tác giả: <strong>{selectedDrawing.student_username}</strong></p>
                </div>
                <button 
                  onClick={() => setSelectedDrawing(null)}
                  className="hidden md:flex p-1.5 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Likes counter & Action */}
              <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-slate-900/10">
                <span className="text-[10px] text-slate-400 font-medium">Con có thích bức tranh này không?</span>
                <button
                  onClick={() => handleLikeDrawing(selectedDrawing.id!)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  <Heart className="w-3.5 h-3.5 fill-red-400" />
                  <span>Thích {(selectedDrawing.likes_count || 0)}</span>
                </button>
              </div>

              {/* Comments stream */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 scrollbar-thin">
                {/* AI / Friend social comments */}
                {drawingAiComments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-full bg-purple-950/30 border border-purple-500/20 flex items-center justify-center text-xs overflow-hidden shrink-0 select-none">
                      👤
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-purple-300">{comment.persona_name}</span>
                        <span className="text-[8px] text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">bạn học</span>
                      </div>
                      <p className="text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-2xl rounded-tl-none border border-slate-850/40 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Real student comments */}
                {drawingComments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs overflow-hidden shrink-0 select-none">
                      🎓
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-indigo-300">{comment.username}</span>
                      <p className="text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-2xl rounded-tl-none border border-slate-850/40 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}

                {drawingComments.length === 0 && drawingAiComments.length === 0 && (
                  <div className="py-8 text-center text-[10px] text-slate-500 font-medium">
                    Chưa có bình luận nào. Hãy gửi lời khích lệ đầu tiên!
                  </div>
                )}
              </div>

              {/* Add comment input form */}
              <form onSubmit={handleAddComment} className="p-4 border-t border-slate-800 bg-slate-950/50 flex gap-2">
                <input
                  type="text"
                  placeholder="Khen ngợi bức vẽ của bạn..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-purple-500/50 animate-pulse-subtle"
                />
                <button 
                  type="submit" 
                  disabled={isSubmittingComment}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
