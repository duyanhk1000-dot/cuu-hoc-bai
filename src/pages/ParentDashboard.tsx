import { useState, useEffect, useRef } from 'react'
import { LogOut, BookOpen, GraduationCap, Send, MessageSquare, Plus, CheckCircle, Award, Sparkles, Loader2, ArrowRight, Upload, Clock, Trash, Trash2, Sun, Moon, Key } from 'lucide-react'
import { dataService, User, Syllabus, Lesson, Grade, Message } from '../dataService'
import { supabase, isSupabaseConfigured } from '../supabaseClient'

const renderAvatar = (username: string, sizeClass = "w-8 h-8") => {
  const isParent = username === 'phuhuynh' || username.toLowerCase().includes('parent') || username.toLowerCase().includes('phu');
  if (isParent) {
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-slate-100 shadow-md border border-indigo-400/30 overflow-hidden flex-shrink-0`}>
        <svg className="w-[60%] h-[60%]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  } else {
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-slate-100 shadow-md border border-emerald-400/30 overflow-hidden flex-shrink-0`}>
        <svg className="w-[60%] h-[60%]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>
      </div>
    );
  }
};

interface ParentDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function ParentDashboard({ user, onLogout }: ParentDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'syllabus' | 'lessons' | 'grades'>('syllabus')
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // App state
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Creation forms state
  const [newSubject, setNewSubject] = useState('')
  const [textbookContent, setTextbookContent] = useState('')
  const [totalLessons, setTotalLessons] = useState(30)
  const [generatingSyllabus, setGeneratingSyllabus] = useState(false)
  const [generatingLesson, setGeneratingLesson] = useState(false)
  const [generatingLessonNum, setGeneratingLessonNum] = useState<number | null>(null)
  const [extractingPdf, setExtractingPdf] = useState(false)
  const [pdfFileName, setPdfFileName] = useState('')

  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null)
  const [reviewingLesson, setReviewingLesson] = useState<Lesson | null>(null)
  const [reviewTab, setReviewTab] = useState<'lecture' | 'flashcards' | 'questions'>('lecture')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [parentFeedback, setParentFeedback] = useState('')
  const [publishingLesson, setPublishingLesson] = useState(false)



  // Sync feedback when reviewing lesson changes
  useEffect(() => {
    if (reviewingLesson) {
      setParentFeedback(reviewingLesson.parent_feedback || '')
    }
  }, [reviewingLesson])

  // Trigger Mermaid diagram rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((window as any).mermaid) {
        try {
          (window as any).mermaid.initialize({ startOnLoad: false, theme: 'dark' });
          (window as any).mermaid.run({
            querySelector: '.mermaid',
          });
        } catch (err) {
          console.error('Mermaid render error:', err);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, syllabus, lessons, reviewingLesson, reviewTab])

  // API Key (saved in sessionState equivalent)
  // API Keys state (supports multiple keys rotation)
  const [apiKeys, setApiKeys] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('gemini_api_keys');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading gemini_api_keys:", e);
    }
    // Migration fallback for single key
    const single = localStorage.getItem('gemini_api_key');
    return single ? [single] : [];
  })
  
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');

  const handleAddApiKey = async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (apiKeys.includes(trimmed)) {
      alert("Khóa API này đã tồn tại!");
      return;
    }
    const updated = [...apiKeys, trimmed];
    setApiKeys(updated);
    localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    await dataService.saveUserApiKeys(user.username, updated);
    setNewKeyInput('');
  };

  const handleRemoveApiKey = async (index: number) => {
    const updated = apiKeys.filter((_, i) => i !== index);
    setApiKeys(updated);
    localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    await dataService.saveUserApiKeys(user.username, updated);
  };

  // Load initial data
  useEffect(() => {
    loadSubjects()
    loadGrades()
    loadMessages()
    
    // Load keys từ Supabase và đồng bộ với localStorage
    const loadAndSyncApiKeys = async () => {
      const dbKeys = await dataService.getUserApiKeys(user.username);
      if (dbKeys && dbKeys.length > 0) {
        setApiKeys(dbKeys);
        localStorage.setItem('gemini_api_keys', JSON.stringify(dbKeys));
      }
    };
    loadAndSyncApiKeys();
    
    // Poll messages every 5 seconds
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [user.username])

  // Load syllabus and lessons when subject changes
  useEffect(() => {
    if (selectedSubject) {
      loadSyllabusAndLessons(selectedSubject)
    } else {
      setSyllabus(null)
      setLessons([])
    }
  }, [selectedSubject])

  // Trigger KaTeX math rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((window as any).renderMathInElement) {
        (window as any).renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        })
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [activeTab, syllabus, lessons, reviewingLesson, reviewTab, selectedGrade])

  // Scroll chat to bottom
  useEffect(() => {
    if (isChatOpen && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isChatOpen])



  const loadSubjects = async () => {
    const list = await dataService.getSubjects()
    setSubjects(list)
    if (list.length > 0 && !selectedSubject) {
      setSelectedSubject(list[0])
    }
  }

  const loadGrades = async () => {
    const list = await dataService.getAllGrades()
    setGrades(list)
  }

  const loadMessages = async () => {
    const list = await dataService.getMessages()
    setMessages(list)
  }

  const loadSyllabusAndLessons = async (subject: string) => {
    const syl = await dataService.getSyllabus(subject)
    setSyllabus(syl)
    const lesList = await dataService.getLessons(subject)
    setLessons(lesList)
  }

  const handleDeleteSubject = async (sub: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa môn học "${sub}"?\n\nToàn bộ lộ trình học (Syllabus) và các bài học, bài tập của môn này sẽ bị xóa vĩnh viễn khỏi hệ thống!`)) {
      return;
    }
    const ok = await dataService.deleteSubject(sub);
    if (ok) {
      alert(`Đã xóa môn học "${sub}" thành công!`);
      const remaining = subjects.filter(s => s !== sub);
      setSubjects(remaining);
      if (selectedSubject === sub) {
        if (remaining.length > 0) {
          setSelectedSubject(remaining[0]);
          await loadSyllabusAndLessons(remaining[0]);
        } else {
          setSelectedSubject('');
          setSyllabus(null);
          setLessons([]);
        }
      }
    } else {
      alert('Không thể xóa môn học!');
    }
  }

  const handleDeleteLesson = async (lessonNum: number) => {
    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa nội dung bài giảng của Buổi số ${lessonNum}?\n\nBài giảng lý thuyết, flashcards và câu hỏi bài tập liên quan của buổi học này sẽ bị xóa bỏ!`)) {
      return;
    }
    const ok = await dataService.deleteLesson(selectedSubject, lessonNum);
    if (ok) {
      alert(`Đã xóa bài học Buổi số ${lessonNum} thành công!`);
      await loadSyllabusAndLessons(selectedSubject);
    } else {
      alert('Không thể xóa bài học!');
    }
  }



  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim()) return
    await dataService.sendMessage(user.username, newMsg.trim())
    setNewMsg('')
    loadMessages()
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Chỉ chấp nhận tệp định dạng PDF!')
      return
    }
    if (isSupabaseConfigured) {
      if (file.size > 50 * 1024 * 1024) {
        alert('⚠️ Tệp PDF quá lớn! Dung lượng file tải lên Supabase Storage tối đa là 50MB.')
        return
      }
    } else {
      if (file.size > 4 * 1024 * 1024) {
        alert('⚠️ Đang ở chế độ Offline. Vui lòng chỉ chọn tệp dưới 4MB để tải trực tiếp lên Vercel.')
        return
      }
    }

    setExtractingPdf(true)
    setPdfFileName(file.name)

    if (isSupabaseConfigured) {
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        
        // Tải file trực tiếp lên Supabase Storage (bucket 'textbooks')
        const { data, error: uploadError } = await supabase.storage
          .from('textbooks')
          .upload(fileName, file)
          
        if (uploadError) {
          throw new Error(uploadError.message)
        }
        
        // Lấy Public URL của file đã tải lên
        const { data: { publicUrl } } = supabase.storage
          .from('textbooks')
          .getPublicUrl(fileName)
          
        // Gửi URL này lên Serverless Function
        const response = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            fileUrl: publicUrl,
            apiKeys: apiKeys
          })
        })
        
        const resData = await response.json()
        if (response.ok && resData.text) {
          setTextbookContent(resData.text)
        } else {
          alert(`Lỗi trích xuất PDF: ${resData.error || 'Không nhận được kết quả văn bản phản hồi từ máy chủ.'}`)
          setPdfFileName('')
        }
      } catch (err: any) {
        alert(`Lỗi tải lên hoặc xử lý tệp PDF: ${err.message || err}`)
        setPdfFileName('')
      } finally {
        setExtractingPdf(false)
      }
    } else {
      // Chế độ Offline Fallback: chuyển đổi sang base64 ở client và gửi qua body
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64Result = reader.result as string
          const base64Data = base64Result.split(',')[1]
          
          const response = await fetch('/api/extract-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fileData: base64Data,
              apiKeys: apiKeys
            })
          })
          const resData = await response.json()
          if (response.ok && resData.text) {
            setTextbookContent(resData.text)
          } else {
            alert(resData.error || 'Lỗi khi trích xuất PDF (Chế độ offline)!')
            setPdfFileName('')
          }
        } catch {
          alert('Lỗi kết nối API trích xuất PDF!')
          setPdfFileName('')
        } finally {
          setExtractingPdf(false)
        }
      }
      reader.onerror = () => {
        alert('Lỗi đọc tệp tin PDF cục bộ!')
        setExtractingPdf(false)
        setPdfFileName('')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleGenerateSyllabus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubject.trim()) return

    setGeneratingSyllabus(true)
    try {
      const response = await fetch('/api/generate-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject.trim(),
          textbookContent: textbookContent.trim(),
          totalLessons: totalLessons,
          apiKeys: apiKeys
        })
      })
      const data = await response.json()
      if (response.ok && data.content) {
        // Lưu trực tiếp lộ trình học vào database
        const ok = await dataService.saveSyllabus(
          newSubject.trim(),
          data.content,
          totalLessons,
          textbookContent.trim()
        )
        if (ok) {
          alert('Đã tạo và lưu lộ trình học môn mới thành công!');
          const sub = newSubject.trim();
          setNewSubject('')
          setTextbookContent('')
          setPdfFileName('')
          await loadSubjects()
          setSelectedSubject(sub)
        } else {
          alert('Lỗi khi lưu lộ trình học vào cơ sở dữ liệu!')
        }
      } else {
        alert(data.error || 'Lỗi khi tạo lộ trình học!')
      }
    } catch (err) {
      alert('Lỗi kết nối Serverless Function!')
    } finally {
      setGeneratingSyllabus(false)
    }
  }

  const handleDeleteGrade = async (gradeId: number) => {
    if (!confirm('⚠️ Bạn có chắc chắn muốn xóa kết quả bài thi này?\nHành động này không thể hoàn tác!')) {
      return;
    }
    const ok = await dataService.deleteGrade(gradeId);
    if (ok) {
      alert('Đã xóa bài thi thành công!');
      loadGrades();
      if (selectedGrade && selectedGrade.id === gradeId) {
        setSelectedGrade(null);
      }
    } else {
      alert('Không thể xóa kết quả bài thi!');
    }
  }

  const handleGenerateLesson = async (lessonNum: number, feedback?: string) => {
    if (!syllabus) return
    setGeneratingLesson(true)
    setGeneratingLessonNum(lessonNum)
    
    try {
      const response = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubject,
          syllabus: syllabus.content,
          lessonNumber: lessonNum,
          totalLessons: syllabus.total_lessons,
          textbookContent: syllabus.textbook_content || '',
          apiKeys: apiKeys,
          parentFeedback: feedback
        })
      })
      const data = await response.json()
      if (response.ok && data.title) {
        const lessonData = {
          subject: selectedSubject,
          lesson_number: lessonNum,
          title: data.title,
          lecture_content: data.lecture_content,
          duration: data.duration_minutes || 45,
          questions: JSON.stringify(data.questions),
          flashcards: JSON.stringify(data.flashcards),
          is_published: false,
          parent_feedback: feedback || ''
        };
        await dataService.saveLesson(lessonData)
        await loadSyllabusAndLessons(selectedSubject)
        
        // Update reviewing lesson modal state if it's currently open
        if (reviewingLesson && reviewingLesson.lesson_number === lessonNum) {
          const freshLessons = await dataService.getLessons(selectedSubject)
          const updated = freshLessons.find(l => l.lesson_number === lessonNum)
          if (updated) {
            setReviewingLesson(updated)
          }
        }
      } else {
        alert(data.error || 'Lỗi soạn bài học từ AI!')
      }
    } catch {
      alert('Lỗi kết nối Serverless Function!')
    } finally {
      setGeneratingLesson(false)
      setGeneratingLessonNum(null)
    }
  }

  // Parse Markdown Headings, Bold text, and Mermaid code blocks for clean presentation
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Regex to split text by mermaid code blocks
    const parts = text.split(/(```mermaid[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('```mermaid') && part.endsWith('```')) {
        const code = part
          .replace('```mermaid', '')
          .replace('```', '')
          .trim();
        
        return (
          <div 
            key={idx} 
            className="mermaid my-5 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center overflow-x-auto text-slate-100"
          >
            {code}
          </div>
        );
      }

      return part.split('\n').map((line, lIdx) => {
        const lineKey = `${idx}-${lIdx}`;
        if (line.startsWith('### ')) {
          return <h4 key={lineKey} className="text-sm font-bold text-indigo-300 mt-4 mb-2">{line.replace('### ', '')}</h4>
        }
        if (line.startsWith('## ')) {
          return <h3 key={lineKey} className="text-base font-bold text-indigo-200 mt-5 mb-3">{line.replace('## ', '')}</h3>
        }
        if (line.startsWith('# ')) {
          return <h2 key={lineKey} className="text-lg font-bold text-white mt-6 mb-4 border-b border-slate-700/50 pb-1">{line.replace('# ', '')}</h2>
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
          const content = line.replace(/^[\*\-]\s+/, '')
          const parts = content.split(/(\*\*.*?\*\*)/g)
          return (
            <li key={lineKey} className="text-slate-300 text-sm leading-relaxed ml-4 list-disc mb-1 font-normal">
              {parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-indigo-200 font-semibold">{p.slice(2, -2)}</strong> : p)}
            </li>
          )
        }
        
        if (line.includes('**')) {
          const parts = line.split(/(\*\*.*?\*\*)/g)
          return (
            <p key={lineKey} className="text-slate-300 text-sm leading-relaxed mb-2 font-normal">
              {parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-indigo-200 font-semibold">{p.slice(2, -2)}</strong> : p)}
            </p>
          )
        }

        return <p key={lineKey} className="text-slate-300 text-sm leading-relaxed mb-2 font-normal">{line}</p>
      });
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 glass-panel flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center glow-indigo">
            <GraduationCap className="w-6 h-6 text-slate-100" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Cổng Phụ Huynh</h1>
            <span className="text-xs text-indigo-400">Giám sát & Soạn thảo lộ trình học</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Nút quản lý danh sách API Keys */}
          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 px-3.5 py-1.5 rounded-lg border border-indigo-500/25 transition-all text-xs font-semibold"
            title="Quản lý danh sách API Keys xoay vòng"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Cấu hình API Keys ({apiKeys.length})</span>
          </button>

          {/* Nút thay đổi theme */}
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-xl hover:bg-slate-900/50 transition-all active:scale-90"
            title="Thay đổi giao diện Sáng/Tối"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <span className="text-sm text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            {renderAvatar(user.username, "w-6 h-6")}
            <span>Xin chào, <strong className="text-indigo-300">{user.username}</strong></span>
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        {/* Sidebar chat & Subject panel */}
        <aside className="lg:col-span-1 border-r border-slate-800/80 bg-slate-900/40 p-5 flex flex-col gap-6 overflow-y-auto">
          {/* Subjects selector */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Môn học đang quản lý</h2>
            {subjects.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có môn học nào. Hãy thiết kế lộ trình trước!</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {subjects.map((sub) => (
                  <div
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`group w-full text-left px-4 py-3 rounded-xl border transition-all text-sm flex items-center justify-between cursor-pointer ${
                      selectedSubject === sub
                        ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-200 shadow-md shadow-indigo-500/5'
                        : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 text-indigo-400" />
                      <span>{sub}</span>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDeleteSubject(sub, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:bg-rose-500/15 rounded-md transition-all"
                        title="Xóa môn học này"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </aside>

        {/* Dashboard Work Panel */}
        <section className="lg:col-span-3 p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Navigation Tab Bar */}
          <div className="flex border-b border-slate-800/80 pb-0.5 gap-6">
            <button
              onClick={() => setActiveTab('syllabus')}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === 'syllabus' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeTab === 'syllabus' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
              1. Lộ trình học (Syllabus)
            </button>
            <button
              onClick={() => setActiveTab('lessons')}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === 'lessons' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeTab === 'lessons' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
              2. Soạn bài giảng & Bài tập
            </button>
            <button
              onClick={() => setActiveTab('grades')}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === 'grades' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeTab === 'grades' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
              3. Kết quả thi & AI feedback
            </button>
          </div>

          {/* TAB 1: SYLLABUS */}
          {activeTab === 'syllabus' && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
              {/* Creator Form */}
              <div className="xl:col-span-2 p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-200 text-sm">Thiết kế môn học bằng AI</h3>
                </div>

                <form onSubmit={handleGenerateSyllabus} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block font-medium">Tên môn học mới</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Toán Lớp 5, Tiếng Anh Giao Tiếp..."
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                      disabled={generatingSyllabus}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block font-medium">Số buổi học dự kiến</label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={totalLessons}
                      onChange={(e) => setTotalLessons(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                      disabled={generatingSyllabus}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block font-medium">Tài liệu học tập (PDF)</label>
                    <div className="relative border border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-950/40">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handlePdfUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={extractingPdf || generatingSyllabus}
                      />
                      {extractingPdf ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                          <span className="text-xs text-slate-300">Đang quét tài liệu PDF...</span>
                        </div>
                      ) : pdfFileName ? (
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                          <span className="text-xs text-slate-200 font-medium truncate max-w-[200px]">{pdfFileName}</span>
                          <span className="text-[10px] text-slate-500">Đã trích xuất văn bản</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-5 h-5 text-slate-400" />
                          <div>
                            <span className="text-xs text-indigo-400 font-semibold block">Tải lên tệp PDF</span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">Kéo thả hoặc chọn file từ máy</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block font-medium">Văn bản trích xuất từ tài liệu (Textbook Text)</label>
                    <textarea
                      placeholder="Nội dung chữ trích xuất từ PDF sẽ hiển thị ở đây, hoặc bạn có thể tự nhập thêm văn bản..."
                      rows={5}
                      value={textbookContent}
                      onChange={(e) => setTextbookContent(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500 transition-all text-xs leading-relaxed resize-none"
                      disabled={generatingSyllabus}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={generatingSyllabus || !newSubject.trim()}
                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none shadow-md shadow-indigo-500/10"
                  >
                    {generatingSyllabus ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI đang thiết kế lộ trình...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Phát thảo lộ trình học
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Syllabus Viewer */}
              <div className="xl:col-span-3 p-6 rounded-2xl glass-panel glow-indigo min-h-[400px]">
                {selectedSubject ? (
                  syllabus ? (
                    <div>
                      <div className="flex justify-between items-center mb-4 border-b border-slate-800/80 pb-3">
                        <div>
                          <h2 className="text-lg font-bold text-white">Lộ trình học môn: {selectedSubject}</h2>
                          <span className="text-xs text-indigo-400">Độ dài: {syllabus.total_lessons} buổi học</span>
                        </div>
                      </div>
                      <div className="prose prose-invert max-w-none max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                        {renderFormattedText(syllabus.content)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center h-[350px] gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      <p className="text-slate-400 text-sm">Đang tải lộ trình học...</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-center h-[350px] gap-4">
                    <BookOpen className="w-12 h-12 text-slate-600" />
                    <div>
                      <h3 className="font-bold text-slate-300">Chưa chọn môn học</h3>
                      <p className="text-slate-500 text-xs mt-1">Hãy thiết kế một môn học mới hoặc chọn môn học ở thanh bên.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LESSONS */}
          {activeTab === 'lessons' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">Soạn thảo nội dung buổi học</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Soạn thảo giáo trình, flashcards và bộ 15 câu hỏi kiểm tra bằng AI</p>
                </div>
                {syllabus && (
                  <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
                    Môn học: <strong className="text-indigo-300">{selectedSubject}</strong> ({syllabus.total_lessons} buổi)
                  </span>
                )}
              </div>

              {!selectedSubject ? (
                <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center gap-3">
                  <BookOpen className="w-10 h-10 text-slate-600" />
                  <p className="text-slate-400 text-sm">Vui lòng chọn môn học hoặc thiết kế môn học mới trước!</p>
                </div>
              ) : !syllabus ? (
                <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                  <p className="text-slate-400 text-sm">Đang tải lộ trình học...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: syllabus.total_lessons }).map((_, idx) => {
                    const lessonNum = idx + 1;
                    const existingLesson = lessons.find(l => l.lesson_number === lessonNum);
                    
                    return (
                      <div
                        key={lessonNum}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-[180px] ${
                          existingLesson
                            ? existingLesson.is_published
                              ? 'bg-slate-900/50 border-emerald-500/20 hover:border-emerald-500/35 glow-emerald'
                              : 'bg-slate-900/50 border-amber-500/20 hover:border-amber-500/35 glow-amber'
                            : 'bg-slate-900/20 border-slate-800/80 hover:border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-indigo-400">Buổi số {lessonNum}</span>
                            <div className="flex items-center gap-1.5">
                              {existingLesson ? (
                                <>
                                  {existingLesson.is_published ? (
                                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                                      <CheckCircle className="w-3 h-3" /> Đã đăng
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-amber-500/10 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                                      <Clock className="w-3 h-3 animate-pulse" /> Chờ duyệt
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleDeleteLesson(lessonNum)}
                                    className="p-1 text-rose-500 hover:bg-rose-500/15 rounded-md transition-all hover:scale-105 active:scale-95"
                                    title="Xóa bài giảng này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] bg-slate-800 border border-slate-700/60 text-slate-500 px-2 py-0.5 rounded-full">
                                  Trống
                                </span>
                              )}
                            </div>
                          </div>
                          <h4 className="text-sm font-semibold text-slate-200 line-clamp-2">
                            {existingLesson ? existingLesson.title : 'Chưa soạn nội dung bài giảng'}
                          </h4>
                          {existingLesson && (
                            <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">
                              Thời gian làm bài tập: {existingLesson.duration} phút
                            </p>
                          )}
                        </div>

                        <div className="mt-4">
                          {existingLesson ? (
                            <button
                              onClick={() => {
                                setReviewingLesson(existingLesson)
                                setReviewTab('lecture')
                              }}
                              className={`w-full py-2 text-xs font-semibold rounded-lg border active:scale-95 transition-all flex items-center justify-center gap-1 ${
                                existingLesson.is_published
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/25'
                                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/25'
                              }`}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              {existingLesson.is_published ? 'Xem chi tiết bài giảng' : 'Xem & duyệt bài giảng'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleGenerateLesson(lessonNum)}
                              disabled={generatingLesson}
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                            >
                              {generatingLesson && generatingLessonNum === lessonNum ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  AI đang soạn bài...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  Soạn bài bằng AI
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GRADES & FEEDBACK */}
          {activeTab === 'grades' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">Bảng điểm & Nhận xét của AI</h3>
                <p className="text-xs text-slate-400 mt-0.5">Xem lịch sử làm bài tập và phản hồi chi tiết từ giáo viên AI</p>
              </div>

              {grades.length === 0 ? (
                <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center gap-3">
                  <Award className="w-12 h-12 text-slate-600" />
                  <div>
                    <h4 className="font-bold text-slate-300">Chưa có bài thi nào được nộp</h4>
                    <p className="text-slate-500 text-xs mt-1">Kết quả kiểm tra của học sinh sẽ hiển thị ở đây sau khi hoàn thành bài nộp.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                  <table className="w-full border-collapse bg-slate-900/30 text-left text-sm">
                    <thead>
                      <tr className="bg-slate-900/80 text-xs font-bold text-slate-400 border-b border-slate-800">
                        <th className="py-4 px-6">Học sinh</th>
                        <th className="py-4 px-6">Môn học</th>
                        <th className="py-4 px-6">Buổi số</th>
                        <th className="py-4 px-6">Tên bài học</th>
                        <th className="py-4 px-6 text-center">Điểm số</th>
                        <th className="py-4 px-6">Ngày nộp</th>
                        <th className="py-4 px-6 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {grades.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-900/20 text-slate-300">
                          <td className="py-4 px-6 font-medium text-slate-100">{g.student_username}</td>
                          <td className="py-4 px-6">{g.subject}</td>
                          <td className="py-4 px-6 text-center">{g.lesson_number}</td>
                          <td className="py-4 px-6 truncate max-w-[200px]">{g.lesson_title}</td>
                          <td className="py-4 px-6 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              g.score >= 8
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : g.score >= 5
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {g.score.toFixed(1)} / 10
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-400 text-xs">
                            {new Date(g.submitted_at!).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedGrade(g)}
                              className="text-xs bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
                            >
                              Xem nhận xét
                            </button>
                            <button
                              onClick={() => handleDeleteGrade(g.id!)}
                              className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded-lg border border-rose-500/20 transition-all flex items-center gap-1"
                              title="Xóa bài thi của học sinh"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Grade Feedback Details Modal */}
      {selectedGrade && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                  Chi tiết kết quả học tập
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedGrade.subject} - Buổi {selectedGrade.lesson_number}: {selectedGrade.lesson_title}
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteGrade(selectedGrade.id!)}
                  className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 px-3 py-2 rounded-xl border border-rose-500/20 transition-all flex items-center gap-1.5 font-bold"
                  title="Xóa kết quả bài thi này"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa bài thi
                </button>
                <button
                  onClick={() => setSelectedGrade(null)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700/60 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
              {/* Overall Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-slate-500">Điểm số</span>
                  <span className="text-2xl font-black text-indigo-400 mt-1">{selectedGrade.score.toFixed(1)} / 10</span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl md:col-span-3">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Đánh giá chung của giáo viên AI</span>
                  <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                    {(() => {
                      try {
                        const parsed = JSON.parse(selectedGrade.ai_feedback);
                        return parsed.overall_feedback;
                      } catch {
                        return selectedGrade.ai_feedback; // Fallback
                      }
                    })()}
                  </p>
                </div>
              </div>

              {/* Detailed questions check */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Chấm điểm chi tiết từng câu</h4>
                
                {(() => {
                  try {
                    const parsedFeedback = JSON.parse(selectedGrade.ai_feedback);
                    const detailed = parsedFeedback.detailed_feedback || [];
                    
                    return detailed.map((q: any, i: number) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border ${
                          q.is_correct
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-rose-500/5 border-rose-500/20'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-xs font-bold text-slate-300">Câu số {q.question_number}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            q.is_correct
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {q.is_correct ? 'Chính xác' : 'Chưa đúng'} (+{q.score_awarded}đ)
                          </span>
                        </div>
                        <div className="mt-3 space-y-2 text-xs">
                          <p className="text-slate-400">
                            👉 **Bài làm của con:** <span className="text-slate-100 font-medium">{q.student_answer || "(Chưa làm)"}</span>
                          </p>
                          <div className="p-3 bg-slate-950/60 rounded-lg text-slate-300 leading-relaxed">
                            <strong>Lời giải & Nhận xét của AI:</strong> {q.correct_explanation}
                          </div>
                        </div>
                      </div>
                    ));
                  } catch {
                    return <p className="text-xs text-slate-500">Không thể phân tích phản hồi chi tiết.</p>;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Review Modal */}
      {reviewingLesson && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                  Xem chi tiết nội dung buổi học
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Môn {reviewingLesson.subject} - Buổi {reviewingLesson.lesson_number}: {reviewingLesson.title}
                </h3>
              </div>
              <button
                onClick={() => setReviewingLesson(null)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700/60 p-2 rounded-xl text-sm font-semibold transition-all"
              >
                Đóng
              </button>
            </div>

            {/* Tabs for Review Modal */}
            <div className="flex border-b border-slate-800 px-6 gap-6 bg-slate-950/20">
              <button
                onClick={() => setReviewTab('lecture')}
                className={`py-3 text-xs font-bold uppercase tracking-wider relative transition-all ${
                  reviewTab === 'lecture' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {reviewTab === 'lecture' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full font-bold"></div>}
                1. Bài giảng lý thuyết
              </button>
              <button
                onClick={() => setReviewTab('flashcards')}
                className={`py-3 text-xs font-bold uppercase tracking-wider relative transition-all ${
                  reviewTab === 'flashcards' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                {reviewTab === 'flashcards' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full font-bold"></div>}
                2. Bộ thẻ Flashcards
              </button>
              <button
                onClick={() => setReviewTab('questions')}
                className={`py-3 text-xs font-bold uppercase tracking-wider relative transition-all ${
                  reviewTab === 'questions' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                {reviewTab === 'questions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full font-bold"></div>}
                3. Đề bài tập (15 câu)
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 overflow-y-auto flex-1 scrollbar-thin space-y-4">
              {/* Tab 1: Lecture Content */}
              {reviewTab === 'lecture' && (
                <div className="prose prose-invert max-w-none">
                  {renderFormattedText(reviewingLesson.lecture_content)}
                </div>
              )}



              {/* Tab 2: Flashcards */}
              {reviewTab === 'flashcards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    try {
                      const fc = JSON.parse(reviewingLesson!.flashcards || '[]');
                      if (fc.length === 0) return <p className="text-sm text-slate-500">Chưa có flashcards.</p>;
                      return fc.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Thẻ số {idx + 1}</span>
                          <div>
                            <span className="text-xs text-slate-400 font-semibold block">Mặt trước:</span>
                            <p className="text-sm text-slate-200 mt-0.5 font-medium">{item.front}</p>
                          </div>
                          <div className="border-t border-slate-850 pt-2 mt-2">
                            <span className="text-xs text-slate-400 font-semibold block">Mặt sau (Giải nghĩa):</span>
                            <p className="text-sm text-emerald-300 mt-0.5">{item.back}</p>
                          </div>
                        </div>
                      ));
                    } catch {
                      return <p className="text-sm text-slate-500">Không thể giải mã dữ liệu Flashcards.</p>;
                    }
                  })()}
                </div>
              )}

              {/* Tab 3: Test Questions */}
              {reviewTab === 'questions' && (
                <div className="space-y-4">
                  {(() => {
                    try {
                      const q = JSON.parse(reviewingLesson!.questions || '[]');
                      if (q.length === 0) return <p className="text-sm text-slate-500">Chưa có bài tập.</p>;
                      return q.map((quest: any, idx: number) => (
                        <div key={idx} className="p-5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-xs font-bold text-indigo-400">
                              Câu số {quest.question_number} - {quest.question_type === 'multiple_choice' ? 'Trắc nghiệm' : 'Tự luận'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-200 leading-relaxed">{quest.prompt}</p>
                          
                          {quest.question_type === 'multiple_choice' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {quest.options?.map((opt: string) => (
                                <div key={opt} className={`px-4 py-2.5 rounded-lg border text-xs bg-slate-950/65 ${opt.startsWith(quest.correct_answer) ? 'border-emerald-500/35 text-emerald-300' : 'border-slate-850 text-slate-400'}`}>
                                  {opt}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg text-xs text-slate-300 mt-2">
                              <strong className="text-emerald-400 block mb-1">Đáp án gợi ý / Lời giải mẫu:</strong>
                              {quest.correct_answer}
                            </div>
                          )}
                        </div>
                      ));
                    } catch {
                      return <p className="text-sm text-slate-500">Không thể giải mã dữ liệu câu hỏi.</p>;
                    }
                  })()}
                </div>
              )}
            </div>

            {/* Modal Footer / Review & Publish Actions */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex flex-col gap-4">

              {/* Feedback Area */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Góp ý chỉnh sửa từ Phụ huynh</label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Thêm ví dụ thực tế cho con dễ hiểu, sửa lại công thức động năng, thêm các câu tự luận khó hơn..."
                  value={parentFeedback}
                  onChange={(e) => setParentFeedback(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500 transition-all text-xs leading-relaxed resize-none"
                  disabled={generatingLesson || publishingLesson}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!confirm('Bạn có chắc chắn muốn hệ thống soạn thảo lại bài học này dựa trên góp ý của bạn?')) return;
                      await handleGenerateLesson(reviewingLesson!.lesson_number, parentFeedback);
                    }}
                    disabled={generatingLesson || publishingLesson}
                    className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    {generatingLesson ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Hệ thống đang sửa bài...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Yêu cầu soạn lại (Theo góp ý)
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500">
                    Trạng thái: <strong className={reviewingLesson!.is_published ? "text-emerald-400" : "text-amber-400"}>
                      {reviewingLesson!.is_published ? "Đã đăng bài" : "Bản nháp chờ duyệt"}
                    </strong>
                  </span>
                  
                  <button
                    onClick={async () => {
                      setPublishingLesson(true);
                      try {
                        await dataService.saveLesson({
                          ...reviewingLesson!,
                          is_published: true,
                          parent_feedback: parentFeedback,
                          infographic_url: undefined,
                          infographic_prompt: undefined,
                          infographic_content: undefined
                        });
                        alert('🎉 Bài giảng đã được duyệt và đăng thành công! Con đã có thể vào học bài này.');
                        await loadSyllabusAndLessons(selectedSubject);
                        setReviewingLesson(null);
                      } catch {
                        alert('Lỗi khi đăng bài giảng!');
                      } finally {
                        setPublishingLesson(false);
                      }
                    }}
                    disabled={generatingLesson || publishingLesson}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {publishingLesson ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang đăng...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Duyệt & Đăng bài giảng
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating Chat Bubble */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {/* Chat Window */}
        {isChatOpen && (
          <div className="w-[340px] h-[450px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden mb-3 animate-in slide-in-from-bottom-5 duration-200">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Trò chuyện gia đình</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Message Box */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin bg-slate-950/10">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col max-w-[85%] ${m.sender === user.username ? 'self-end items-end' : 'self-start items-start'}`}>
                  <span className="text-[9px] text-slate-500 mb-0.5">{m.sender}</span>
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.sender === user.username
                      ? 'bg-indigo-600 text-slate-100 rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex gap-2">
              <input
                type="text"
                placeholder="Nhắn tin cho con..."
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500"
              />
              <button type="submit" className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl active:scale-95 transition-all">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setIsChatOpen(prev => !prev)}
          className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all z-50 glow-indigo"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
      {/* API Key Manager Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 text-left">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cấu hình Gemini API Keys</h3>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold bg-slate-800 hover:bg-slate-700/60 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              <p className="text-xs text-slate-400 leading-relaxed">
                Nhập các Gemini API keys từ nhiều tài khoản khác nhau. Hệ thống sẽ tự động xoay vòng qua các key này khi tạo lộ trình học, soạn bài hoặc chấm điểm. Nếu một key bị quá tải (503) hoặc hết hạn ngạch (429), hệ thống sẽ tự động chuyển sang key tiếp theo.
              </p>

              {/* Add key input form */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Thêm API Key mới</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Dán Gemini API Key ở đây (AIzaSy...)"
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleAddApiKey(newKeyInput)}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-md shadow-indigo-600/10"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm
                  </button>
                </div>
              </div>

              {/* Keys list */}
              <div className="space-y-2.5">
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Danh sách API Keys đã thêm ({apiKeys.length})</label>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                    Chưa có API key nào được thiết lập. Hệ thống sẽ sử dụng API key mặc định từ máy chủ (nếu có).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {apiKeys.map((key, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          <span className="text-slate-550 text-xs select-none">#{index + 1}</span>
                          <span className="text-xs text-slate-300 font-mono truncate">
                            {key.substring(0, 8)}...{key.substring(key.length - 8)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveApiKey(index)}
                          className="text-slate-450 hover:text-rose-450 p-1.5 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="Xóa khóa này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>

    </div>
  )
}
