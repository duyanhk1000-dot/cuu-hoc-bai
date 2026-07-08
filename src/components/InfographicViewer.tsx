import React, { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Download, Image as ImageIcon, Loader2 } from 'lucide-react'

interface InfographicViewerProps {
  infographicUrl?: string;
}

export default function InfographicViewer({ infographicUrl }: InfographicViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleReset = () => setZoom(1)
  const toggleFullscreen = () => setIsFullscreen(prev => !prev)

  const handleDownload = () => {
    if (infographicUrl) {
      window.open(infographicUrl, '_blank')
    }
  }

  if (!infographicUrl || error) {
    return (
      <div className="w-full min-h-[220px] bg-slate-900/35 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 bg-slate-850 rounded-xl flex items-center justify-center border border-slate-800">
          <ImageIcon className="w-6 h-6 text-slate-500 animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-300">Sơ đồ giáo khoa Infographic</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[340px] leading-relaxed">
            Sơ đồ Infographic đang được hệ thống xử lý vẽ tự động, con hãy quay lại sau nhé!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 p-4 bg-slate-950' : 'w-full min-h-[350px] max-h-[500px] shadow-lg shadow-indigo-950/5'
      }`}
    >
      {/* Control Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 px-3 py-1.5 rounded-full shadow-lg">
        <button
          onClick={handleZoomIn}
          title="Phóng to"
          className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-full hover:bg-slate-900 transition-all active:scale-90"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Thu nhỏ"
          className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-full hover:bg-slate-900 transition-all active:scale-90"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          title="Đặt lại"
          className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-full hover:bg-slate-900 transition-all active:scale-90"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-1"></div>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Xem toàn màn hình'}
          className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-full hover:bg-slate-900 transition-all active:scale-90"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={handleDownload}
          title="Tải ảnh về"
          className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-full hover:bg-slate-900 transition-all active:scale-90"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Image Loading State */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-2 z-0">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-[10px] text-slate-500">Đang tải sơ đồ học tập...</span>
        </div>
      )}

      {/* Image Display Panel */}
      <div 
        className={`w-full h-full flex items-center justify-center overflow-auto scrollbar-thin ${
          isFullscreen ? 'max-h-[85vh]' : 'h-[350px]'
        }`}
      >
        <img
          src={infographicUrl}
          alt="Bài học Infographic"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
          style={{
            transform: `scale(${zoom})`,
            transition: 'transform 0.15s ease-out',
            transformOrigin: 'center center'
          }}
          className="max-w-full max-h-full object-contain pointer-events-none rounded-xl"
        />
      </div>
    </div>
  )
}
