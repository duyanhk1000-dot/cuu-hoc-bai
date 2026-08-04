import React, { useEffect, useRef, useState } from 'react'
// @ts-ignore
import MindMap from 'simple-mind-map'
import 'simple-mind-map/dist/simpleMindMap.esm.css'
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, AlertTriangle } from 'lucide-react'

interface MindMapViewerProps {
  mindmapData: string | object
}

export const MindMapViewer: React.FC<MindMapViewerProps> = ({ mindmapData }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mindMapInstance = useRef<MindMap | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Phân tích cú pháp dữ liệu mindmap đầu vào
  let parsedData: any = null
  try {
    if (typeof mindmapData === 'object') {
      parsedData = mindmapData
    } else if (mindmapData && typeof mindmapData === 'string' && mindmapData.trim().startsWith('{')) {
      parsedData = JSON.parse(mindmapData)
    }
  } catch (err) {
    console.error('Failed to parse mindmap JSON:', err)
  }

  useEffect(() => {
    if (error || !parsedData || !containerRef.current) return () => {}

    // Làm sạch container trước khi render
    containerRef.current.innerHTML = ''

    let cleanup = () => {}

    try {
      const isDark = document.documentElement.classList.contains('dark')
      
      const mindMap = new MindMap({
        el: containerRef.current,
        data: parsedData,
        theme: isDark ? 'dark' : 'default',
        readonly: true, // Học sinh chỉ xem, không chỉnh sửa trực tiếp
        draggable: false, // Không kéo thả node tự do (giữ form chuẩn)
        layout: 'logicalStructure', // Kiểu sơ đồ tư duy cấu trúc logic phân nhánh
        mousewheelAction: 'zoom', // Cuộn chuột để zoom
      })

      mindMapInstance.current = mindMap

      // Tự động căn chỉnh vừa màn hình sau khi render
      const timer = setTimeout(() => {
        if (mindMapInstance.current) {
          mindMapInstance.current.view.fit()
        }
      }, 350)

      cleanup = () => {
        clearTimeout(timer)
        if (mindMapInstance.current) {
          mindMapInstance.current.destroy()
          mindMapInstance.current = null
        }
      }
    } catch (err: any) {
      console.error('Error initializing simple-mind-map:', err)
      setError(err.message || 'Lỗi khởi tạo sơ đồ tư duy')
    }

    return cleanup
  }, [mindmapData, error])

  // Lắng nghe sự thay đổi Dark/Light mode để tự động đồng bộ theme sơ đồ
  useEffect(() => {
    if (!mindMapInstance.current) return
    const observer = new MutationObserver(() => {
      if (mindMapInstance.current) {
        const isDark = document.documentElement.classList.contains('dark')
        mindMapInstance.current.setTheme(isDark ? 'dark' : 'default')
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Điều khiển thu phóng
  const handleZoomIn = () => {
    if (mindMapInstance.current) {
      mindMapInstance.current.view.enlarge()
    }
  }

  const handleZoomOut = () => {
    if (mindMapInstance.current) {
      mindMapInstance.current.view.narrow()
    }
  }

  const handleReset = () => {
    if (mindMapInstance.current) {
      mindMapInstance.current.view.reset()
      mindMapInstance.current.view.fit()
    }
  }

  if (error || !parsedData) {
    return (
      <div className="p-8 text-center border border-dashed border-red-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 bg-red-500/5 text-red-400">
        <AlertTriangle className="w-10 h-10" />
        <h4 className="font-bold text-sm">Không thể hiển thị sơ đồ tư duy tương tác</h4>
        <p className="text-xs opacity-80 max-w-md">Dữ liệu sơ đồ tư duy không hợp lệ hoặc đang sử dụng định dạng Mermaid cũ cần biên soạn lại bằng AI.</p>
      </div>
    )
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 transition-all ${
      isFullscreen 
        ? 'fixed inset-0 z-50 p-6 flex flex-col h-screen w-screen bg-slate-950' 
        : 'w-full h-[60vh]'
    }`}>
      {/* Khung vẽ canvas */}
      <div 
        ref={containerRef} 
        className="w-full flex-1 h-full min-h-0 overflow-hidden cursor-grab active:cursor-grabbing"
      />

      {/* Thanh công cụ nổi */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800/80 rounded-xl shadow-xl backdrop-blur-md z-10">
        <button
          onClick={handleZoomIn}
          title="Phóng to"
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Thu nhỏ"
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          title="Đặt lại góc nhìn"
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setIsFullscreen(prev => !prev)
            setTimeout(() => {
              if (mindMapInstance.current) {
                mindMapInstance.current.view.fit()
              }
            }, 100)
          }}
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Xem toàn màn hình'}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all border-l border-slate-800 pl-3"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
