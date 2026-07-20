import { useState, useEffect, useRef } from 'react'
import { LogOut, BookOpen, GraduationCap, Send, MessageSquare, CheckCircle, HelpCircle, Award, Sparkles, Loader2, ArrowLeft, RotateCw, AlertTriangle, Clock, X, Sun, Moon, FileText } from 'lucide-react'
import { dataService, User, Syllabus, Lesson, Grade, Message } from '../dataService'

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

interface StudentDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function StudentDashboard({ user, onLogout }: StudentDashboardProps) {
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

  // Navigation tabs (dashboard level)
  const [activeTab, setActiveTab] = useState<'lessons' | 'grades'>('lessons')

  // Selected subject and lessons
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [grades, setGrades] = useState<Grade[]>([])

  // Active workspace (when student is study/taking test)
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<'lecture' | 'flashcards' | 'test' | 'result' | 'pdf' | 'mindmap'>('lecture')
  
  // Flashcard states
  const [flashcards, setFlashcards] = useState<any[]>([])
  const [currentFlashcardIdx, setCurrentFlashcardIdx] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  // Quiz states
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [submittingTest, setSubmittingTest] = useState(false)

  // Test result state
  const [testResult, setTestResult] = useState<any>(null)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load initial data
  useEffect(() => {
    loadSubjects()
    loadGrades()
    loadMessages()
    
    // Poll messages every 5 seconds
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load syllabus and lessons when subject changes
  useEffect(() => {
    if (selectedSubject) {
      loadSyllabusAndLessons(selectedSubject)
    } else {
      setSyllabus(null)
      setLessons([])
    }
  }, [selectedSubject])
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
  }, [activeLesson, workspaceTab])

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
  }, [activeTab, selectedSubject, activeLesson, workspaceTab, currentFlashcardIdx, isFlipped, testResult])

  // Scroll chat to bottom
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen])
  // Quiz Timer countdown logic
  useEffect(() => {
    let timerId: any
    if (isTimerRunning && timeLeft > 0) {
      timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (isTimerRunning && timeLeft === 0) {
      setIsTimerRunning(false)
      // Auto submit test when time runs out!
      handleSubmitTest(true)
    }
    return () => clearTimeout(timerId)
  }, [isTimerRunning, timeLeft])

  const loadSubjects = async () => {
    const list = await dataService.getSubjects()
    setSubjects(list)
    if (list.length > 0 && !selectedSubject) {
      setSelectedSubject(list[0])
    }
  }

  const loadGrades = async () => {
    const list = await dataService.getGrades(user.username)
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim()) return
    await dataService.sendMessage(user.username, newMsg.trim())
    setNewMsg('')
    loadMessages()
  }

  // Study workspace operations
  const startLesson = (lesson: Lesson) => {
    setActiveLesson(lesson)
    setWorkspaceTab('lecture')
    
    // Set up flashcards
    try {
      const fc = JSON.parse(lesson.flashcards || '[]')
      setFlashcards(fc)
      setCurrentFlashcardIdx(0)
      setIsFlipped(false)
    } catch {
      setFlashcards([])
    }

    // Set up questions
    try {
      const q = JSON.parse(lesson.questions || '[]')
      setQuestions(q)
      // Clear previous answers
      const defaultAnswers: Record<number, string> = {}
      q.forEach((quest: any) => {
        defaultAnswers[quest.question_number] = ''
      })
      setAnswers(defaultAnswers)
    } catch {
      setQuestions([])
    }

    // Reset results
    setTestResult(null)
    setIsTimerRunning(false)
  }

  const handleStartTest = () => {
    if (!activeLesson) return
    const durationSec = (activeLesson.duration || 45) * 60
    setTimeLeft(durationSec)
    setIsTimerRunning(true)
    setWorkspaceTab('test')
  }

  const handleAnswerSelect = (qNum: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [qNum]: value
    }))
  }

  const handleSubmitTest = async (autoSubmit: boolean = false) => {
    if (!activeLesson) return
    
    // Stop the timer
    setIsTimerRunning(false)
    setSubmittingTest(true)

    if (autoSubmit) {
      alert('⏱️ Hết giờ làm bài! Hệ thống đang tự động nộp bài và tiến hành chấm điểm...')
    }

    try {
      const response = await fetch('/api/grade-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: questions,
          studentAnswers: answers
        })
      })
      const data = await response.json()
      if (response.ok && data.total_score !== undefined) {
        setTestResult(data)
        // Save score to DB
        await dataService.saveGrade({
          student_username: user.username,
          lesson_id: activeLesson.id!,
          answers: JSON.stringify(answers),
          score: data.total_score,
          ai_feedback: JSON.stringify(data)
        })
        await loadGrades()
        setWorkspaceTab('result')
      } else {
        alert(data.error || 'Lỗi từ hệ thống chấm bài!')
      }
    } catch {
      alert('Lỗi kết nối hệ thống chấm bài!')
    } finally {
      setSubmittingTest(false)
    }
  }

  // Formatting utility
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Parse Markdown Headings, Bold text, and Mermaid code blocks for clean presentation
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Chuẩn hóa và tự động thêm xuống dòng trước các thẻ Markdown nếu bị dính chữ (defensive parsing)
    const cleanedText = text
      .replace(/([a-zA-Z0-9.\"\!\?\)\_])(##+\s+)/g, '$1\n\n$2') // Thêm dòng trống trước ## hoặc ###
      .replace(/([a-zA-Z0-9.\"\!\?\)\_])(\d+\.\s+\*\*)/g, '$1\n\n$2') // Thêm dòng trống trước 1. ** hoặc 2. **
      .replace(/([a-zA-Z0-9.\"\!\?\)\_])([\*\-]\s+\*\*)/g, '$1\n\n$2') // Thêm dòng trống trước * ** hoặc - **
      .replace(/([a-zA-Z0-9.\"\!\?\)\_])(\s+[\*\-]\s+)/g, '$1\n\n$2'); // Thêm dòng trống trước danh sách * hoặc -

    // Regex to split text by mermaid code blocks
    const parts = cleanedText.split(/(```mermaid[\s\S]*?```)/g);

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
            dangerouslySetInnerHTML={{ __html: code }}
          />
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
      {/* Top Header Bar */}
      <header className="h-16 border-b border-slate-800/80 glass-panel flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center glow-indigo animate-pulse-subtle">
            <GraduationCap className="w-6 h-6 text-slate-100" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Cổng Học Sinh</h1>
            <span className="text-xs text-indigo-400">Không gian học tập & luyện đề thi</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
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
            <span>Học sinh: <strong className="text-indigo-300">{user.username}</strong></span>
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

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        {/* Sidebar chat & Subject selector */}
        <aside className="lg:col-span-1 border-r border-slate-800/80 bg-slate-900/40 p-5 flex flex-col gap-6 overflow-y-auto">
          {/* Active Lesson Header or normal select */}
          {!activeLesson ? (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chọn môn học</h2>
              {subjects.length === 0 ? (
                <p className="text-xs text-slate-500">Chưa có môn học nào được thiết kế. Vui lòng nhắc bố mẹ soạn bài trước!</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {subjects.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setSelectedSubject(sub)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm flex items-center justify-between ${
                        selectedSubject === sub
                          ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-200'
                          : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <BookOpen className="w-4 h-4" />
                        <span>{sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 bg-indigo-950/20 border border-indigo-500/25 p-4 rounded-2xl glow-indigo">
              <div>
                <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-bold uppercase">
                  Đang học
                </span>
                <h3 className="text-sm font-bold text-slate-200 mt-2">{activeLesson.subject}</h3>
                <p className="text-xs text-indigo-300 mt-0.5">Buổi {activeLesson.lesson_number}: {activeLesson.title}</p>
              </div>

              {/* Back to list button */}
              <button
                onClick={() => {
                  if (isTimerRunning && !confirm('Bạn đang trong bài kiểm tra. Trở lại sẽ nộp bài ngay lập tức! Bạn có đồng ý?')) return;
                  setIsTimerRunning(false)
                  setActiveLesson(null)
                }}
                className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Trở lại danh sách buổi học
              </button>
            </div>
          )}

        </aside>

        {/* Dashboard Work Panel */}
        <section className="lg:col-span-3 p-6 flex flex-col overflow-y-auto">
          {/* CASE A: STUDENT IS STUDYING A SPECIFIC LESSON */}
          {activeLesson ? (
            <div className="flex-1 flex flex-col gap-5">
              {/* Workspace Navigation Bar */}
              <div className="flex border-b border-slate-800/80 pb-0.5 justify-between items-center">
                <div className="flex gap-6">
                  <button
                    onClick={() => setWorkspaceTab('lecture')}
                    disabled={isTimerRunning}
                    className={`pb-3 text-sm font-semibold transition-all relative disabled:opacity-40 ${
                      workspaceTab === 'lecture' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {workspaceTab === 'lecture' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                    Lý thuyết bài giảng
                  </button>
                  <button
                    onClick={() => setWorkspaceTab('mindmap')}
                    disabled={isTimerRunning}
                    className={`pb-3 text-sm font-semibold transition-all relative disabled:opacity-40 ${
                      workspaceTab === 'mindmap' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {workspaceTab === 'mindmap' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                    Sơ đồ tư duy
                  </button>
                  <button
                    onClick={() => setWorkspaceTab('flashcards')}
                    disabled={isTimerRunning}
                    className={`pb-3 text-sm font-semibold transition-all relative disabled:opacity-40 ${
                      workspaceTab === 'flashcards' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {workspaceTab === 'flashcards' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                    Học qua Flashcard ({flashcards.length})
                  </button>
                  <button
                    onClick={() => setWorkspaceTab('pdf')}
                    disabled={isTimerRunning}
                    className={`pb-3 text-sm font-semibold transition-all relative disabled:opacity-40 ${
                      workspaceTab === 'pdf' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {workspaceTab === 'pdf' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                    Tài liệu sách PDF
                  </button>
                  <button
                    onClick={() => {
                      if (testResult) {
                        setWorkspaceTab('result')
                      } else {
                        if (!isTimerRunning) {
                          if (confirm('LƯU Ý: Bắt đầu làm bài thi hệ thống sẽ tự kích hoạt đếm ngược thời gian. Bạn đã sẵn sàng chưa?')) {
                            handleStartTest()
                          }
                        } else {
                          setWorkspaceTab('test')
                        }
                      }
                    }}
                    className={`pb-3 text-sm font-semibold transition-all relative ${
                      workspaceTab === 'test' || workspaceTab === 'result' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {(workspaceTab === 'test' || workspaceTab === 'result') && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                    {testResult ? 'Xem điểm & Nhận xét' : 'Làm đề kiểm tra (15 câu)'}
                  </button>
                </div>

                {/* Download PDF button on the right of the tabs menu */}
                {!isTimerRunning && syllabus?.pdf_file_path && (
                  <a
                    href={syllabus.pdf_file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pb-3 inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-350 text-xs font-bold transition-all select-none hover:translate-y-[-1px]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Xem & Tải Tài Liệu
                  </a>
                )}

                {/* Pulsing Timer pill during test */}
                {isTimerRunning && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold animate-pulse">
                    <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                    <span>Thời gian làm bài: {formatTime(timeLeft)}</span>
                  </div>
                )}
              </div>

              {/* Tab: Mindmap */}
              {workspaceTab === 'mindmap' && (
                <div className="p-6 rounded-2xl glass-panel glow-indigo max-w-4xl space-y-4 text-left">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-xl font-bold text-white">Sơ đồ tư duy bài học</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Học nhanh kiến thức qua sơ đồ trực quan</p>
                    </div>
                  </div>
                  {activeLesson?.mindmap ? (
                    <div 
                      key={`${activeLesson.id}-${activeLesson.lesson_number}`}
                      className="mermaid p-6 bg-slate-950/80 border border-slate-800 rounded-2xl text-center overflow-x-auto select-none text-slate-100"
                      dangerouslySetInnerHTML={{ __html: activeLesson.mindmap }}
                    />
                  ) : (
                    <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-950/20">
                      <Sparkles className="w-10 h-10 text-indigo-500/50 mx-auto" />
                      <div>
                        <h4 className="font-bold text-slate-300 text-sm">Chưa có sơ đồ tư duy cho bài này</h4>
                        <p className="text-slate-500 text-xs mt-1">Bài giảng này được tạo trước đây và chưa tích hợp sơ đồ tư duy riêng biệt.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: PDF Textbook Document */}
              {workspaceTab === 'pdf' && (
                <div className="p-6 rounded-2xl glass-panel glow-indigo max-w-4xl space-y-4 text-left">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-xl font-bold text-white">Sách giáo khoa & Tài liệu PDF</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Xem hoặc tải về tài liệu môn học này bên dưới</p>
                    </div>
                    {syllabus?.pdf_file_path && (
                      <a
                        href={syllabus.pdf_file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95"
                      >
                        <FileText className="w-4 h-4" />
                        Tải về máy tính
                      </a>
                    )}
                  </div>

                  {syllabus?.pdf_file_path ? (
                    <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <iframe
                        src={`${syllabus.pdf_file_path}#toolbar=0`}
                        className="w-full h-[65vh]"
                        title="Tài liệu môn học"
                      />
                    </div>
                  ) : (
                    <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 bg-slate-950/20">
                      <FileText className="w-10 h-10 text-slate-600" />
                      <div>
                        <h4 className="font-bold text-slate-300 text-sm">Chưa có file tài liệu PDF</h4>
                        <p className="text-slate-500 text-xs mt-1">Môn học này chưa có sách giáo khoa PDF đi kèm. Hãy nhờ bố mẹ tải lên tài liệu nhé!</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 1: Lecture Content */}
              {workspaceTab === 'lecture' && (
                <div className="p-6 rounded-2xl glass-panel glow-indigo max-w-4xl">
                  <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-3">
                    Bài {activeLesson.lesson_number}: {activeLesson.title}
                  </h2>
                  <div className="prose prose-invert max-w-none max-h-[60vh] overflow-y-auto pr-3 scrollbar-thin">
                    {renderFormattedText(activeLesson.lecture_content)}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setWorkspaceTab('flashcards')}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-500/10"
                    >
                      Chuyển sang ôn tập Flashcards
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Flipping Flashcards */}
              {workspaceTab === 'flashcards' && (
                <div className="flex flex-col items-center gap-6 py-6 max-w-lg mx-auto w-full">
                  {flashcards.length === 0 ? (
                    <p className="text-slate-500 text-sm">Buổi học này chưa được cấu hình Flashcard.</p>
                  ) : (
                    <>
                      <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
                        Thẻ số {currentFlashcardIdx + 1} / {flashcards.length}
                      </span>

                      {/* 3D Flipping Card Container */}
                      <div
                        onClick={() => setIsFlipped(prev => !prev)}
                        className="w-full h-[280px] perspective-1000 cursor-pointer"
                      >
                        <div className={`w-full h-full transform-style-3d transition-transform duration-500 relative ${isFlipped ? 'rotate-y-180' : ''}`}>
                          {/* Front Side */}
                          <div className="absolute inset-0 w-full h-full rounded-2xl glass-panel glow-indigo backface-hidden p-8 flex flex-col items-center justify-center text-center shadow-2xl">
                            <Sparkles className="w-6 h-6 text-indigo-400 mb-4 animate-pulse" />
                            <h3 className="text-lg font-bold text-slate-100 leading-relaxed">
                              {flashcards[currentFlashcardIdx]?.front}
                            </h3>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-6">Nhấp để xem mặt sau</span>
                          </div>

                          {/* Back Side */}
                          <div className="absolute inset-0 w-full h-full rounded-2xl bg-indigo-950/80 border border-indigo-500/35 glow-indigo backface-hidden p-8 flex flex-col items-center justify-center text-center shadow-2xl rotate-y-180">
                            <CheckCircle className="w-6 h-6 text-emerald-400 mb-4" />
                            <p className="text-sm text-slate-200 leading-relaxed font-medium">
                              {flashcards[currentFlashcardIdx]?.back}
                            </p>
                            <span className="text-[10px] text-indigo-400 uppercase tracking-widest mt-6">Nhấp để xem câu hỏi</span>
                          </div>
                        </div>
                      </div>

                      {/* Control Panel */}
                      <div className="flex items-center gap-4 w-full mt-4">
                        <button
                          onClick={() => {
                            setCurrentFlashcardIdx(prev => Math.max(0, prev - 1))
                            setIsFlipped(false)
                          }}
                          disabled={currentFlashcardIdx === 0}
                          className="flex-1 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-all disabled:opacity-30"
                        >
                          Thẻ trước
                        </button>
                        <button
                          onClick={() => setIsFlipped(prev => !prev)}
                          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-400 rounded-xl transition-all"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setCurrentFlashcardIdx(prev => Math.min(flashcards.length - 1, prev + 1))
                            setIsFlipped(false)
                          }}
                          disabled={currentFlashcardIdx === flashcards.length - 1}
                          className="flex-1 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-all disabled:opacity-30"
                        >
                          Thẻ sau
                        </button>
                      </div>

                      {currentFlashcardIdx === flashcards.length - 1 && (
                        <button
                          onClick={handleStartTest}
                          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-xs rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-500/10"
                        >
                          Đã thuộc bài! Bắt đầu kiểm tra nào
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Tab 3: Take Test */}
              {workspaceTab === 'test' && (
                <div className="max-w-3xl space-y-6">
                  {submittingTest ? (
                    <div className="p-12 text-center rounded-2xl glass-panel glow-indigo flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                      <div>
                        <h4 className="font-bold text-white">Bài đang được hệ thống chấm điểm</h4>
                        <p className="text-slate-400 text-xs mt-1">Giáo viên đang xem xét chi tiết bài giải của bạn. Vui lòng đợi trong giây lát...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-amber-600/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-300 leading-relaxed">
                          <strong>Lưu ý làm bài:</strong> Bài kiểm tra gồm 10 câu hỏi trắc nghiệm và 5 câu tự luận. Bạn cần chọn đáp án hoặc gõ lời giải. Nhấp nút <strong>"Nộp bài thi"</strong> bên dưới để hoàn tất. Hết thời gian đếm ngược hệ thống sẽ tự động nộp bài!
                        </div>
                      </div>

                      <div className="space-y-6">
                        {questions.map((q, idx) => (
                          <div key={idx} className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
                            <span className="text-xs font-bold text-indigo-400 block">Câu {q.question_number}: {q.question_type === 'multiple_choice' ? 'Trắc nghiệm' : 'Tự luận'}</span>
                            <p className="text-sm font-semibold text-slate-100">{q.prompt}</p>
                            
                            {q.question_type === 'multiple_choice' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {q.options?.map((opt: string) => {
                                  const letter = opt.substring(0, 1) // A, B, C, D
                                  const isSelected = answers[q.question_number] === letter
                                  return (
                                    <button
                                      key={opt}
                                      onClick={() => handleAnswerSelect(q.question_number, letter)}
                                      className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-medium transition-all ${
                                        isSelected
                                          ? 'bg-indigo-600/20 border-indigo-500 text-slate-100 shadow-md shadow-indigo-500/5'
                                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <textarea
                                placeholder="Gõ câu trả lời chi tiết và trình bày cách làm của bạn vào đây..."
                                rows={4}
                                value={answers[q.question_number] || ''}
                                onChange={(e) => handleAnswerSelect(q.question_number, e.target.value)}
                                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500 transition-all resize-none leading-relaxed"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 flex justify-end">
                        <button
                          onClick={() => {
                            if (confirm('Bạn có chắc chắn muốn nộp bài thi ngay lập tức để hệ thống chấm điểm?')) {
                              handleSubmitTest(false)
                            }
                          }}
                          className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-500/10 text-sm"
                        >
                          Nộp bài thi & Chấm điểm
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab 4: Show AI test results */}
              {workspaceTab === 'result' && testResult && (
                <div className="max-w-3xl space-y-6">
                  {/* Results summary box */}
                  <div className="p-6 rounded-2xl glass-panel glow-indigo flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-2 text-center md:text-left">
                      <span className="text-xs bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 px-3 py-1 rounded-full font-bold uppercase tracking-wide">
                        Bài nộp thành công
                      </span>
                      <h3 className="text-lg font-bold text-white">Kết quả thi được chấm bởi Hệ thống</h3>
                      <p className="text-xs text-slate-400">Thời điểm nộp bài: Vừa xong</p>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center">
                      <span className="text-xs text-slate-500 font-semibold uppercase">Điểm đạt được</span>
                      <span className="text-3xl font-black text-indigo-400 mt-1">{testResult.total_score.toFixed(1)} / 10</span>
                    </div>
                  </div>

                  {/* Overall Feedback */}
                  <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nhận xét tổng quát của Giáo viên</span>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                      {testResult.overall_feedback}
                    </p>
                  </div>

                  {/* Detailed question by question check */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Chấm câu chi tiết</h4>
                    
                    {testResult.detailed_feedback?.map((q: any, i: number) => (
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
                            👉 **Bài làm của bạn:** <span className="text-slate-100 font-medium">{q.student_answer || "(Chưa trả lời)"}</span>
                          </p>
                          <div className="p-3 bg-slate-950/60 rounded-lg text-slate-300 leading-relaxed">
                            <strong>Lời giải & Nhận xét của Giáo viên:</strong> {q.correct_explanation}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* CASE B: NORMAL STUDENT DASHBOARD (LESSON LIST & GRADES HISTORY) */
            <div className="flex-1 flex flex-col gap-6">
              {/* Tab Navigation */}
              <div className="flex border-b border-slate-800/80 pb-0.5 gap-6">
                <button
                  onClick={() => setActiveTab('lessons')}
                  className={`pb-3 text-sm font-semibold transition-all relative ${
                    activeTab === 'lessons' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {activeTab === 'lessons' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                  Danh sách buổi học
                </button>
                <button
                  onClick={() => setActiveTab('grades')}
                  className={`pb-3 text-sm font-semibold transition-all relative ${
                    activeTab === 'grades' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {activeTab === 'grades' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                  Bảng điểm & Nhận xét
                </button>
              </div>

              {/* Sub-Tab 1: List of Lessons of selected subject */}
              {activeTab === 'lessons' && (
                <div className="space-y-4">
                  {!selectedSubject ? (
                    <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center gap-3">
                      <BookOpen className="w-10 h-10 text-slate-600" />
                      <p className="text-slate-400 text-sm font-medium">Bố mẹ chưa thiết kế môn học nào cho bạn. Hãy nhắc bố mẹ nhé!</p>
                    </div>
                  ) : !syllabus ? (
                    <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                      <p className="text-slate-400 text-sm">Đang tải danh sách bài học...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/40 p-4 border border-slate-800/80 rounded-2xl">
                        <div>
                          <h3 className="font-bold text-white text-base">Bài giảng môn: {selectedSubject}</h3>
                          <span className="text-xs text-slate-400">Lộ trình chốt: {syllabus.total_lessons} buổi học</span>
                        </div>
                        {syllabus.pdf_file_path && (
                          <a
                            href={syllabus.pdf_file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all w-fit shadow-sm shadow-indigo-500/5 active:scale-95"
                          >
                            <FileText className="w-4 h-4" />
                            Xem & Tải Tài Liệu Sách PDF
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {Array.from({ length: syllabus.total_lessons }).map((_, idx) => {
                          const lessonNum = idx + 1
                          const existingLesson = lessons.find(l => l.lesson_number === lessonNum)

                          return (
                            <div
                              key={lessonNum}
                              className={`p-5 rounded-2xl border flex flex-col justify-between h-[180px] transition-all ${
                                existingLesson
                                  ? 'bg-slate-900/50 border-slate-800 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5'
                                  : 'bg-slate-900/20 border-slate-800/80 opacity-55 cursor-not-allowed'
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-indigo-400">Buổi số {lessonNum}</span>
                                  {existingLesson ? (
                                    <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 px-2 py-0.5 rounded-full">
                                      Sẵn sàng
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                                      Chưa soạn
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-semibold text-slate-200 line-clamp-2">
                                  {existingLesson ? existingLesson.title : 'Chờ bố mẹ biên soạn nội dung bài giảng'}
                                </h4>
                                {existingLesson && (
                                  <span className="text-[10px] text-slate-400 mt-2 block">
                                    Thời lượng thi thử: {existingLesson.duration} phút
                                  </span>
                                )}
                              </div>

                              <div className="mt-4">
                                {existingLesson ? (
                                  <button
                                    onClick={() => startLesson(existingLesson)}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md shadow-indigo-500/5"
                                  >
                                    Vào học bài
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="w-full py-2 bg-slate-900 text-slate-600 text-xs font-semibold rounded-lg border border-slate-800 cursor-not-allowed"
                                  >
                                    Đang khóa
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Grade History List */}
              {activeTab === 'grades' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-white text-base">Lịch sử kết quả bài thi</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Nơi lưu trữ tất cả các bài tập bạn đã hoàn thành kèm theo nhận xét</p>
                  </div>

                  {grades.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center gap-3">
                      <Award className="w-12 h-12 text-slate-600" />
                      <div>
                        <h4 className="font-bold text-slate-300">Chưa có kết quả thi nào</h4>
                        <p className="text-slate-500 text-xs mt-1">Kết quả bài làm của bạn sẽ xuất hiện tại đây sau khi bạn nộp bài thi.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {grades.map((g) => (
                        <div key={g.id} className="p-5 rounded-2xl glass-panel glow-indigo border border-slate-800 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                <span className="text-xs font-bold text-indigo-400">{g.subject}</span>
                                <h4 className="text-sm font-semibold text-slate-100 mt-1">Buổi {g.lesson_number}: {g.lesson_title}</h4>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                                g.score >= 8
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : g.score >= 5
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {g.score.toFixed(1)}đ
                              </span>
                            </div>
                            
                            <div className="mt-3 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg leading-relaxed line-clamp-3">
                              <strong>Giáo viên nhận xét:</strong> {(() => {
                                try {
                                  return JSON.parse(g.ai_feedback).overall_feedback;
                                } catch {
                                  return g.ai_feedback;
                                }
                              })()}
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-2 border-t border-slate-800/80 pt-3">
                            <span className="text-[10px] text-slate-500">
                              Ngày thi: {new Date(g.submitted_at!).toLocaleDateString('vi-VN')}
                            </span>
                            <button
                              onClick={() => {
                                const matchedLesson = lessons.find(l => l.id === g.lesson_id)
                                if (matchedLesson) {
                                  setActiveLesson(matchedLesson)
                                  setTestResult(JSON.parse(g.ai_feedback))
                                  setAnswers(JSON.parse(g.answers))
                                  setWorkspaceTab('result')
                                } else {
                                  alert('Bài học liên quan không được tải sẵn trong môn học này.')
                                }
                              }}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg active:scale-95 transition-all"
                            >
                              Xem nhận xét chi tiết
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Floating Chat Bubble */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-slate-100 shadow-xl glow-indigo hover:scale-105 active:scale-95 transition-all z-45 border border-indigo-400/25"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Floating Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-45 animate-in slide-in-from-bottom duration-250">
          <div className="flex items-center gap-2 border-b border-slate-800 p-4 bg-slate-950/20">
            <MessageSquare className="w-4 h-4 text-indigo-400 animate-pulse" />
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Trò chuyện gia đình</h2>
          </div>
          
          {/* Messages box */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-2 max-w-[85%] ${m.sender === user.username ? 'self-end flex-row-reverse' : 'self-start'}`}>
                {renderAvatar(m.sender, "w-7 h-7")}
                <div className={`flex flex-col ${m.sender === user.username ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-0.5">{m.sender}</span>
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.sender === user.username
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
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/30 flex gap-2">
            <input
              type="text"
              placeholder="Nhắn tin cho bố mẹ..."
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
    </div>
  )
}
