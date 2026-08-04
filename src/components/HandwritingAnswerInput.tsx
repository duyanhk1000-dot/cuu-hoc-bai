import React, { useEffect, useRef, useState } from 'react'
import { Keyboard, Edit3, Trash, Sparkles, Loader2, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react'
import { MathRenderer } from '../utils/mathNormalizer'

interface HandwritingAnswerInputProps {
  value: string
  onChange: (val: string) => void
  questionNumber: number
  placeholder?: string
}

type ModeState = 'TYPING' | 'DRAWING' | 'RECOGNIZING' | 'CONFIRMING'

export const HandwritingAnswerInput: React.FC<HandwritingAnswerInputProps> = ({
  value,
  onChange,
  questionNumber,
  placeholder = "Gõ câu trả lời chi tiết và trình bày cách làm của bạn vào đây..."
}) => {
  const [mode, setMode] = useState<ModeState>('TYPING')
  const [tempResult, setTempResult] = useState<string>('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)

  // Initialize Canvas context
  useEffect(() => {
    if (mode !== 'DRAWING' || !canvasRef.current) return

    const canvas = canvasRef.current
    // Cấu hình kích thước canvas thực tế khớp với kích thước hiển thị
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = 320 * 2 // Cố định chiều cao 320px
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `320px`

    const context = canvas.getContext('2d')
    if (context) {
      context.scale(2, 2)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = '#a5b4fc' // Màu nét vẽ indigo/purple sáng
      context.lineWidth = 3
      contextRef.current = context

      // Đặt nền canvas trong suốt để dùng lưới CSS
      context.fillStyle = 'rgba(0,0,0,0)'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Listener thay đổi kích thước cửa sổ để resize canvas
    const handleResize = () => {
      if (!canvasRef.current) return
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const tempImage = canvas.toDataURL()
      
      canvas.width = rect.width * 2
      canvas.style.width = `${rect.width}px`
      
      const context = canvas.getContext('2d')
      if (context) {
        context.scale(2, 2)
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = '#a5b4fc'
        context.lineWidth = 3
        contextRef.current = context
        
        // Vẽ lại hình ảnh cũ sau khi resize
        const img = new Image()
        img.onload = () => {
          context.drawImage(img, 0, 0, rect.width, 320)
        }
        img.src = tempImage
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mode])

  // Drawing event handlers using Pointer Events for unified Mobile & PC support
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!contextRef.current || !canvasRef.current) return
    
    // Đảm bảo chỉ bắt sự kiện vẽ khi nhấn nút trái chuột hoặc chạm tay
    canvasRef.current.setPointerCapture(e.pointerId)
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    contextRef.current.beginPath()
    contextRef.current.moveTo(x, y)
    setIsDrawing(true)
    setError(null)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
  }

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return
    canvasRef.current.releasePointerCapture(e.pointerId)
    contextRef.current?.closePath()
    setIsDrawing(false)
  }

  // Clear canvas action
  const clearCanvas = () => {
    if (!canvasRef.current || !contextRef.current) return
    const canvas = canvasRef.current
    contextRef.current.clearRect(0, 0, canvas.width, canvas.height)
    setError(null)
  }

  // OCR Recognition API invocation
  const recognizeHandwriting = async () => {
    if (!canvasRef.current) return

    setLoading(true)
    setMode('RECOGNIZING')
    setError(null)

    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      
      const sessionMock = localStorage.getItem('family_learning_mock_user')
      const token = sessionMock ? 'mock-student-id' : undefined // Token auth if implemented

      const response = await fetch('/api/ocr-handwriting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ imageData: dataUrl })
      })

      const result = await response.json()
      if (response.ok && result.text !== undefined) {
        setTempResult(result.text)
        setMode('CONFIRMING')
      } else {
        throw new Error(result.error || 'Nhận diện thất bại.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Không thể kết nối dịch vụ OCR. Vui lòng thử lại.')
      setMode('DRAWING')
    } finally {
      setLoading(false)
    }
  }

  const confirmResult = () => {
    onChange(tempResult)
    setMode('TYPING')
  }

  return (
    <div className="space-y-3 text-left">
      {/* Tab Switcher Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider block">
          Câu trả lời tự luận
        </span>
        <div className="flex gap-1.5 p-0.5 bg-slate-900 rounded-lg border border-slate-800/60">
          <button
            type="button"
            onClick={() => setMode('TYPING')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-extrabold transition-all ${
              mode === 'TYPING' || mode === 'CONFIRMING'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Bàn phím
          </button>
          <button
            type="button"
            onClick={() => setMode('DRAWING')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-extrabold transition-all ${
              mode === 'DRAWING' || mode === 'RECOGNIZING'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Viết tay
          </button>
        </div>
      </div>

      {/* TYPING MODE (Original Textarea or confirmed state) */}
      {(mode === 'TYPING' || mode === 'CONFIRMING') && (
        <div className="space-y-2">
          {value ? (
            // Confirmed visual box with LaTeX rendered output
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 relative group">
              <div className="text-xs text-slate-400 font-medium">Kết quả câu trả lời đã lưu:</div>
              <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-lg text-slate-100 text-sm overflow-x-auto min-h-[50px] flex items-center">
                <MathRenderer content={value} />
              </div>
              <div className="flex justify-between items-center text-[10px] text-emerald-400 font-bold">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã xác nhận câu trả lời
                </div>
                <button
                  type="button"
                  onClick={() => setMode('DRAWING')}
                  className="px-3 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-indigo-400 rounded-lg font-extrabold transition-all active:scale-95"
                >
                  Sửa lại
                </button>
              </div>
            </div>
          ) : (
            <textarea
              placeholder={placeholder}
              rows={4}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500 transition-all resize-none leading-relaxed font-medium"
            />
          )}
        </div>
      )}

      {/* DRAWING MODE (Canvas area with helper buttons) */}
      {mode === 'DRAWING' && (
        <div className="space-y-2.5">
          <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px]">
            {/* Drawing Canvas */}
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              className="w-full touch-none block"
              style={{ height: '320px' }}
            />
            
            {/* Helper overlay advice */}
            <div className="absolute top-2 left-3 pointer-events-none select-none text-[9px] text-slate-500 font-bold uppercase tracking-wider bg-slate-950/80 px-2 py-0.5 rounded border border-slate-900">
              Bảng viết vẽ tay (Hỗ trợ cảm ứng & Touch)
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex justify-between items-center gap-3">
            <button
              type="button"
              onClick={clearCanvas}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-extrabold transition-all active:scale-95"
            >
              <Trash className="w-3.5 h-3.5" />
              Xóa nét vẽ
            </button>
            <button
              type="button"
              onClick={recognizeHandwriting}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-500/10 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI dịch câu trả lời
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}
        </div>
      )}

      {/* RECOGNIZING STATE (AI computing loader) */}
      {mode === 'RECOGNIZING' && (
        <div className="p-12 text-center border border-slate-800 bg-slate-950/60 rounded-xl flex flex-col items-center justify-center gap-3 h-[320px]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <div>
            <h4 className="font-bold text-slate-200 text-xs">AI đang dịch chữ viết của bạn...</h4>
            <p className="text-[10px] text-slate-500 mt-1">Đang phân tích nét vẽ và chuyển đổi sang công thức toán / chữ viết.</p>
          </div>
        </div>
      )}

      {/* CONFIRMING STATE (KaTeX rendered results checker) */}
      {mode === 'CONFIRMING' && (
        <div className="p-5 border border-indigo-500/30 bg-slate-950/80 rounded-xl space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-extrabold text-indigo-400">Kết quả nhận diện của Giáo viên AI</h4>
            <p className="text-[10px] text-slate-500">Vui lòng kiểm tra lại công thức hiển thị bên dưới xem đã chính xác chưa.</p>
          </div>

          {/* Pretty display using KaTeX rendering */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm overflow-x-auto min-h-[70px] flex items-center justify-center">
            <MathRenderer content={tempResult || "(Không nhận diện được ký tự nào)"} />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setMode('DRAWING')}
              className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Vẽ lại
            </button>
            <button
              type="button"
              onClick={confirmResult}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1 active:scale-95 shadow-md shadow-indigo-600/15"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đúng rồi, dùng đáp án này
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
