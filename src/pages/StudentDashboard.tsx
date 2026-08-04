import { useState, useEffect, useRef, useCallback } from 'react'
import { LogOut, BookOpen, GraduationCap, Send, MessageSquare, CheckCircle, HelpCircle, Award, Sparkles, Loader2, ArrowLeft, RotateCw, AlertTriangle, Clock, X, Sun, Moon, FileText, Home, MessageCircle } from 'lucide-react'
import { dataService, User, Syllabus, Lesson, Grade, Message, StudentPet, PetEvent } from '../dataService'
import { normalizeText, parseMathAndText as customParseMathAndText, MathRenderer, cleanMermaidString } from '../utils/mathNormalizer'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../supabaseClient'
import DOMPurify from 'dompurify'
import { useChat } from '../hooks/useChat'
import { useTimer } from '../hooks/useTimer'
import { AlertModal } from '../components/AlertModal'
import { ChatPanel } from '../components/ChatPanel'
import { loadScript, loadStyle } from '../utils/lazyScriptLoader'
import { MindMapViewer } from '../components/MindMapViewer'
import { HandwritingAnswerInput } from '../components/HandwritingAnswerInput'

const renderAvatar = (roleOrUsername: string, sizeClass = "w-8 h-8") => {
  const isParent = roleOrUsername === 'parent' || 
                   roleOrUsername === 'phuhuynh' || 
                   roleOrUsername.toLowerCase().includes('phu') || 
                   roleOrUsername.toLowerCase().includes('parent');
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

export default function StudentDashboard({ onOpenCreative }: { onOpenCreative?: () => void }) {
  const { user, profile, loading, logout } = useAuth()
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const alert = (msg: string) => {
    setAlertMessage(msg)
  }

  // Text selection TTS states
  const [selectedText, setSelectedText] = useState('')
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'light'
  })

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // Navigation tabs (dashboard level)
  const [activeTab, setActiveTab] = useState<'home' | 'lessons' | 'grades'>('home')
  const [isBookOpen, setIsBookOpen] = useState(true)

  // Selected subject and lessons
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [allSyllabuses, setAllSyllabuses] = useState<Record<string, Syllabus>>({})
  const [allLessons, setAllLessons] = useState<Record<string, Lesson[]>>({})

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
  const [submittingTest, setSubmittingTest] = useState(false)
  const [submittingProgress, setSubmittingProgress] = useState(0)

  const [testResult, setTestResult] = useState<any>(null)
  
  // KaTeX load state
  const [kaTeXLoaded, setKaTeXLoaded] = useState(false)

  // Virtual Pet & Shop States
  const [studentPet, setStudentPet] = useState<StudentPet | null>(null)
  const [isPetModalOpen, setIsPetModalOpen] = useState(false)
  const [petShopTab, setPetShopTab] = useState<'interact' | 'shop' | 'rules'>('interact')
  const [ownedEvolutionItems, setOwnedEvolutionItems] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('student_pet_evolution_items') || '[]')
  })
  const [petEvents, setPetEvents] = useState<PetEvent[]>([])
  
  // States for renaming and shaking
  const [isRenameInputOpen, setIsRenameInputOpen] = useState(false)
  const [newPetName, setNewPetName] = useState('')
  const [isPetShaking, setIsPetShaking] = useState(false)

  // Victory screen animation states
  const [showVictoryPopup, setShowVictoryPopup] = useState(false)
  const [victoryCoinsEarned, setVictoryCoinsEarned] = useState(0)
  const [victoryExpEarned, setVictoryExpEarned] = useState(0)
  const [victoryTitle, setVictoryTitle] = useState('')
  const [isLevelUp, setIsLevelUp] = useState(false)

  // Custom Hooks
  const { messages, newMsg, setNewMsg, isChatOpen, setIsChatOpen, sendMessage } = useChat()
  const { timeLeft, isTimerRunning, startTimer, stopTimer, resetTimer, formatTime } = useTimer(
    () => handleSubmitTest(true)
  )

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.username) return
    await sendMessage(profile.username)
  }, [profile?.username, sendMessage])

  useEffect(() => {
    let interval: any
    if (submittingTest) {
      setSubmittingProgress(1)
      interval = setInterval(() => {
        setSubmittingProgress(prev => (prev < 4 ? prev + 1 : 4))
      }, 3500)
    } else {
      setSubmittingProgress(0)
    }
    return () => clearInterval(interval)
  }, [submittingTest])

  const speakText = (text: string) => {
    // Dừng âm thanh đang phát trước đó nếu có
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
    }

    // Xác định mã ngôn ngữ dựa vào môn học hiện tại
    let langCode = 'en-US'
    const subjectLower = selectedSubject?.toLowerCase() || ''
    if (subjectLower.includes('anh') || subjectLower.includes('english')) {
      langCode = 'en-US'
    } else if (subjectLower.includes('trung') || subjectLower.includes('chinese')) {
      langCode = 'zh-CN'
    } else if (subjectLower.includes('nhật') || subjectLower.includes('japanese')) {
      langCode = 'ja-JP'
    } else if (subjectLower.includes('hàn') || subjectLower.includes('korean')) {
      langCode = 'ko-KR'
    } else if (subjectLower.includes('việt') || subjectLower.includes('vietnamese')) {
      langCode = 'vi-VN'
    }

    // Gọi API phát âm Microsoft Edge TTS chất lượng cao, tốc độ chậm -35%
    const queryParams = new URLSearchParams({
      text: text,
      lang: langCode,
      rate: '-35%'
    })

    const audio = new Audio(`/api/speak?${queryParams.toString()}`)
    activeAudioRef.current = audio
    audio.play().catch(err => {
      console.error("Lỗi phát âm Edge TTS:", err)
    })
  }

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection()
      if (!selection) return

      const text = selection.toString().trim()
      if (!text || text.length > 200) {
        setSelectionCoords(null)
        setSelectedText('')
        return
      }

      // Chỉ hiển thị loa khi bôi đen trong nội dung bài giảng (.prose) hoặc các vùng hỗ trợ phát âm (.selectable-tts)
      const anchorNode = selection.anchorNode
      if (!anchorNode) return

      let parentEl = anchorNode.parentElement
      let isInsideSelectable = false
      while (parentEl) {
        if (parentEl.classList.contains('prose') || parentEl.classList.contains('selectable-tts')) {
          isInsideSelectable = true
          break
        }
        parentEl = parentEl.parentElement
      }

      if (!isInsideSelectable) {
        setSelectionCoords(null)
        setSelectedText('')
        return
      }

      try {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSelectionCoords({
          x: rect.left + rect.width / 2,
          y: rect.top - 12
        })
        setSelectedText(text)
      } catch (err) {
        setSelectionCoords(null)
        setSelectedText('')
      }
    }

    document.addEventListener('mouseup', handleSelection)
    document.addEventListener('touchend', handleSelection)
    
    const handleDocumentClick = (e: MouseEvent) => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim() === '') {
        setSelectionCoords(null)
        setSelectedText('')
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)

    return () => {
      document.removeEventListener('mouseup', handleSelection)
      document.removeEventListener('touchend', handleSelection)
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [selectedSubject])

  const getSubmittingProgressText = () => {
    switch (submittingProgress) {
      case 1: return '📋 Đang đọc và cấu trúc lại bài làm của bạn...'
      case 2: return '🔍 Giáo viên AI đang so khớp các đáp án trắc nghiệm...'
      case 3: return '📝 Đang chấm điểm chi tiết và viết lời khuyên cho các câu tự luận...'
      case 4: return '✨ Đang tính điểm tổng quan và đồng bộ kết quả lên hệ thống...'
      default: return 'Đang xử lý bài làm...'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Đang tải thông tin...</p>
      </div>
    )
  }

  if (!user || !profile) {
    return <p className="text-slate-400 text-center py-12">Vui lòng đăng nhập!</p>
  }

  const loadPetData = async () => {
    try {
      const pet = await dataService.getStudentPet('hocsinh')
      setStudentPet(pet)
      const evs = await dataService.getPetEvents('hocsinh')
      setPetEvents(evs)
    } catch (err) {
      console.error("Failed to load student pet data:", err)
    }
  }

  const playSound = (type: 'squeak' | 'coin' | 'level_up') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'squeak') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'coin') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'level_up') {
        osc.type = 'sawtooth';
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, idx) => {
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        });
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (err) {
      console.warn("AudioContext block:", err);
    }
  }

  // Load initial data
  useEffect(() => {
    loadSubjects()
    loadGrades()
    loadPetData()
  }, [])

  // Poll pet data & events every 10 seconds to keep synced with parent updates
  useEffect(() => {
    const timer = setInterval(() => {
      loadPetData()
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  // Load syllabus and lessons when subject changes
  useEffect(() => {
    if (selectedSubject) {
      loadSyllabusAndLessons(selectedSubject)
    } else {
      setSyllabus(null)
      setLessons([])
    }
  }, [selectedSubject])
  // Load KaTeX dynamic assets on mount
  useEffect(() => {
    const loadKaTeX = async () => {
      try {
        if (!(window as any).katex) {
          await loadStyle('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css')
          await loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js')
          await loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js')
          setKaTeXLoaded(true)
        } else {
          setKaTeXLoaded(true)
        }
      } catch (err) {
        console.error('Failed to load KaTeX dynamically:', err)
      }
    }
    loadKaTeX()
  }, [])
  const handleFeedPet = async (foodType: 'sunflower' | 'milk' | 'cheese') => {
    if (!studentPet) return
    let price = 10
    let hpRestore = 15
    let foodName = 'Hạt hướng dương'
    
    if (foodType === 'milk') {
      price = 15
      hpRestore = 25
      foodName = 'Bình sữa'
    } else if (foodType === 'cheese') {
      price = 25
      hpRestore = 40
      foodName = 'Bánh phô mai nhỏ'
    }

    if (studentPet.coins < price) {
      alert("Không đủ xu để mua thức ăn!")
      return
    }

    const nextCoins = studentPet.coins - price
    const nextHp = Math.min(100, studentPet.current_hp + hpRestore)
    
    playSound('coin')
    const updated = await dataService.updateStudentPet('hocsinh', {
      coins: nextCoins,
      current_hp: nextHp
    })
    setStudentPet(updated)
    alert(`Đã cho thú cưng ăn ${foodName}! Hồi phục +${hpRestore} HP.`)
  }

  const handleRenamePet = async () => {
    if (!studentPet) return
    const trimName = newPetName.trim()
    if (!trimName) {
      alert("Tên thú cưng không được để trống!")
      return
    }
    if (trimName.length > 20) {
      alert("Tên thú cưng tối đa 20 ký tự!")
      return
    }

    const isFirstTime = !studentPet.has_renamed
    if (isFirstTime) {
      playSound('level_up')
      const updated = await dataService.updateStudentPet('hocsinh', {
        pet_name: trimName,
        has_renamed: true
      })
      setStudentPet(updated)
      setIsRenameInputOpen(false)
      alert(`Đổi tên thú cưng thành công thành: ${trimName} (Miễn phí lần đầu)!`)
    } else {
      if (studentPet.coins < 50) {
        alert("Bạn không đủ 50 xu để mua bút đổi tên!")
        return
      }
      playSound('coin')
      const updated = await dataService.updateStudentPet('hocsinh', {
        pet_name: trimName,
        coins: studentPet.coins - 50
      })
      setStudentPet(updated)
      setIsRenameInputOpen(false)
      alert(`Đổi tên thú cưng thành công thành: ${trimName}! Chi phí: 50 xu.`)
    }
  }

  const handlePetImageClick = () => {
    playSound('squeak')
    setIsPetShaking(true)
    setTimeout(() => {
      setIsPetShaking(false)
    }, 250)
  }

  const handleCompletePetEvent = async (event: PetEvent) => {
    if (!studentPet || !event.id) return
    
    await dataService.deletePetEvent(event.id)
    
    const coinsEarned = event.reward_coins
    const expEarned = event.reward_exp
    
    let nextExp = studentPet.current_exp + expEarned
    let nextLevel = studentPet.current_level
    let didLevelUp = false

    while (true) {
      const expNeeded = (nextLevel * 200) + 100
      if (nextExp >= expNeeded && nextLevel < 10) {
        nextExp -= expNeeded
        nextLevel += 1
        didLevelUp = true
      } else {
        break
      }
    }

    const nextCoins = studentPet.coins + coinsEarned
    const nextHp = Math.min(100, studentPet.current_hp + 10)

    const updatedPet = await dataService.updateStudentPet('hocsinh', {
      coins: nextCoins,
      current_exp: nextExp,
      current_level: nextLevel,
      current_hp: nextHp
    })
    setStudentPet(updatedPet)

    const evs = await dataService.getPetEvents('hocsinh')
    setPetEvents(evs)

    setVictoryTitle(`HOÀN THÀNH SỰ KIỆN: ${event.title}`)
    setVictoryCoinsEarned(coinsEarned)
    setVictoryExpEarned(expEarned)
    setIsLevelUp(didLevelUp)
    setShowVictoryPopup(true)

    if (didLevelUp) {
      playSound('level_up')
    } else {
      playSound('coin')
    }
  }

  const handleReportPetEvent = async (event: PetEvent) => {
    if (!event.id) return
    await dataService.reportPetEvent(event.id)
    const evs = await dataService.getPetEvents('hocsinh')
    setPetEvents(evs)
    alert(`Đã gửi báo cáo hoàn thành nhiệm vụ "${event.title}"! Đợi bố mẹ duyệt nhé.`)
  }

  const handleBuyEvolutionItem = async (itemName: string, price: number) => {
    if (!studentPet) return
    if (ownedEvolutionItems.includes(itemName)) {
      alert("Bạn đã sở hữu vật phẩm này rồi!")
      return
    }
    if (studentPet.coins < price) {
      alert("Không đủ xu để mua vật phẩm này!")
      return
    }

    const nextCoins = studentPet.coins - price
    const nextItems = [...ownedEvolutionItems, itemName]
    
    playSound('coin')
    const updated = await dataService.updateStudentPet('hocsinh', { coins: nextCoins })
    setStudentPet(updated)
    setOwnedEvolutionItems(nextItems)
    localStorage.setItem('student_pet_evolution_items', JSON.stringify(nextItems))
    alert(`Mua thành công ${itemName}!`)
  }

  const getRequiredItemForLevel = (level: number): { name: string; price: number; img: string } | null => {
    switch (level) {
      case 1: return { name: 'Phô mai vàng', price: 80, img: 'gold_cheese' }
      case 2: return { name: 'Nơ xanh lịch lãm', price: 120, img: 'blue_bow' }
      case 3: return { name: 'Mũ thám hiểm', price: 180, img: 'explorer_hat' }
      case 4: return { name: 'Kính trí thức', price: 240, img: 'glasses' }
      case 5: return { name: 'Mũ phù thủy', price: 300, img: 'wizard_hat' }
      case 6: return { name: 'Mũ phi công', price: 380, img: 'aviator_goggles' }
      case 7: return { name: 'Áo choàng hoàng gia', price: 480, img: 'royal_cloak' }
      case 8: return { name: 'Kiếm thánh', price: 600, img: 'holy_sword' }
      case 9: return { name: 'Trượng quyền năng', price: 800, img: 'scepter_of_power' }
      default: return null
    }
  }

  const handleEvolvePet = async () => {
    if (!studentPet) return
    
    const neededExp = (studentPet.current_level * 200) + 100
    if (studentPet.current_exp < neededExp) {
      alert("Chưa đủ điểm kinh nghiệm (EXP) để thăng cấp!")
      return
    }
    if (studentPet.current_hp < 95) {
      alert("Thú cưng cần đạt từ 95 HP sức khỏe trở lên để tiến hóa!")
      return
    }

    const req = getRequiredItemForLevel(studentPet.current_level)
    if (req && !ownedEvolutionItems.includes(req.name)) {
      alert(`Bạn cần mua "${req.name}" trong Cửa hàng để tiến hóa thú cưng!`)
      return
    }

    const nextLevel = studentPet.current_level + 1
    const nextExp = studentPet.current_exp - neededExp
    
    let nextItems = ownedEvolutionItems
    if (req) {
      nextItems = ownedEvolutionItems.filter(item => item !== req.name)
      setOwnedEvolutionItems(nextItems)
      localStorage.setItem('student_pet_evolution_items', JSON.stringify(nextItems))
    }

    playSound('level_up')
    const updated = await dataService.updateStudentPet('hocsinh', {
      current_level: nextLevel,
      current_exp: nextExp,
      current_hp: 100
    })
    setStudentPet(updated)
    
    setIsLevelUp(true)
    setVictoryTitle("TIẾN HÓA THÀNH CÔNG!")
    setVictoryCoinsEarned(0)
    setVictoryExpEarned(0)
    setShowVictoryPopup(true)
  }
  // Trigger Mermaid diagram rendering
  useEffect(() => {
    if (workspaceTab !== 'mindmap') return

    let isMounted = true
    const runMermaid = async () => {
      try {
        if (!(window as any).mermaid) {
          await loadScript('https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js')
        }
        if (!isMounted) return

        const m = (window as any).mermaid
        m.initialize({ startOnLoad: false, theme: 'dark' })
        await m.run({ querySelector: '.mermaid' })
      } catch (err) {
        console.error('Failed to load or run Mermaid:', err)
      }
    }

    const timer = setTimeout(runMermaid, 300)
    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [activeLesson, workspaceTab])

  // Trigger KaTeX math rendering
  useEffect(() => {
    if (!kaTeXLoaded) return

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
  }, [activeTab, selectedSubject, activeLesson, workspaceTab, currentFlashcardIdx, isFlipped, testResult, kaTeXLoaded])



  const loadSubjects = async () => {
    const list = await dataService.getSubjects()
    setSubjects(list)
    if (list.length > 0 && !selectedSubject) {
      setSelectedSubject(list[0])
    }
  }

  const loadGrades = async () => {
    const list = await dataService.getGrades(profile.username)
    setGrades(list)
  }

  useEffect(() => {
    if (subjects.length > 0) {
      const fetchAllData = async () => {
        const syls: Record<string, Syllabus> = {}
        const less: Record<string, Lesson[]> = {}
        await Promise.all(
          subjects.map(async (sub) => {
            try {
              const [syl, lesList] = await Promise.all([
                dataService.getSyllabus(sub),
                dataService.getLessons(sub)
              ])
              if (syl) syls[sub] = syl
              if (lesList) less[sub] = lesList
            } catch (err) {
              console.error(`Failed to load data for subject ${sub}:`, err)
            }
          })
        )
        setAllSyllabuses(syls)
        setAllLessons(less)
      }
      fetchAllData()
    }
  }, [subjects])

  const loadSyllabusAndLessons = async (subject: string) => {
    try {
      const [syl, lesList] = await Promise.all([
        dataService.getSyllabus(subject),
        dataService.getLessons(subject)
      ])
      setSyllabus(syl)
      setLessons(lesList)
    } catch (err) {
      console.error('Failed to load syllabus and lessons in parallel:', err)
    }
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
    resetTimer()
  }

  const handleStartTest = () => {
    if (!activeLesson) return
    const durationSec = (activeLesson.duration || 45) * 60
    startTimer(durationSec)
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
    stopTimer()
    setSubmittingTest(true)

    if (autoSubmit) {
      alert('⏱️ Hết giờ làm bài! Hệ thống đang tự động nộp bài và tiến hành chấm điểm...')
    }

    try {
      const sessionMock = localStorage.getItem('family_learning_mock_user')
      const token = sessionMock ? 'mock-student-id' : (await supabase.auth.getSession()).data.session?.access_token

      const response = await fetch('/api/grade-lesson', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          questions: questions,
          studentAnswers: answers
        })
      })
      const data = await response.json()
      if (response.ok && data.total_score !== undefined) {
        setTestResult(data)
        
        // Calculate pet rewards
        let coinsEarned = 0
        let expEarned = 0
        let isFirstTime = true
        let oldScore = -1

        const prevGrades = grades.filter(g => g.student_username === profile.username && g.lesson_id === activeLesson.id)
        if (prevGrades.length > 0) {
          isFirstTime = false
          oldScore = Math.max(...prevGrades.map(g => g.score))
        }

        const newScore = data.total_score
        
        const getMilestoneReward = (score: number) => {
          if (score >= 10) return { coins: 30, exp: 50, title: 'ĐIỂM TUYỆT ĐỐI!' }
          if (score >= 8) return { coins: 20, exp: 30, title: 'ĐIỂM GIỎI XUẤT SẮC!' }
          if (score >= 5) return { coins: 10, exp: 15, title: 'ĐẠT YÊU CẦU!' }
          return { coins: 0, exp: 5, title: 'CẦN CỐ GẮNG HƠN!' }
        }

        const newMilestone = getMilestoneReward(newScore)

        if (isFirstTime) {
          coinsEarned = newMilestone.coins
          expEarned = newMilestone.exp
        } else {
          const oldMilestone = getMilestoneReward(oldScore)
          
          if (newScore > oldScore && newMilestone.coins > oldMilestone.coins) {
            coinsEarned = newMilestone.coins - oldMilestone.coins
            expEarned = newMilestone.exp - oldMilestone.exp
          } else {
            coinsEarned = 0
            expEarned = 5
          }
        }

        if (studentPet) {
          let nextExp = studentPet.current_exp + expEarned
          let nextLevel = studentPet.current_level
          let didLevelUp = false

          while (true) {
            const expNeeded = (nextLevel * 200) + 100
            if (nextExp >= expNeeded && nextLevel < 10) {
              nextExp -= expNeeded
              nextLevel += 1
              didLevelUp = true
            } else {
              break
            }
          }

          const nextCoins = studentPet.coins + coinsEarned
          const nextHp = Math.min(100, studentPet.current_hp + 10)

          const updatedPet = await dataService.updateStudentPet('hocsinh', {
            coins: nextCoins,
            current_exp: nextExp,
            current_level: nextLevel,
            current_hp: nextHp
          })
          setStudentPet(updatedPet)

          setVictoryTitle(newMilestone.title)
          setVictoryCoinsEarned(coinsEarned)
          setVictoryExpEarned(expEarned)
          setIsLevelUp(didLevelUp)
          setShowVictoryPopup(true)

          if (didLevelUp) {
            playSound('level_up')
          } else if (coinsEarned > 0) {
            playSound('coin')
          }
        }

        await dataService.saveGrade({
          student_username: profile.username,
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


  // Parse Markdown Headings, Bold text, and Mermaid code blocks for clean presentation
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Chuẩn hóa toàn bộ cấu trúc toán học bằng module Math Normalizer chuyên dụng
    const normalizedText = normalizeText(text);

    // Regex to split text by mermaid code blocks
    const parts = normalizedText.split(/(```mermaid[\s\S]*?```)/g);

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
            {cleanMermaidString(code)}
          </div>
        );
      }

      return part.split('\n').map((line, lIdx) => {
        const lineKey = `${idx}-${lIdx}`;
        if (line.startsWith('### ')) {
          return <h4 key={lineKey} className="text-base font-extrabold text-slate-900 dark:text-indigo-300 mt-4 mb-2">{customParseMathAndText(line.replace('### ', ''))}</h4>
        }
        if (line.startsWith('## ')) {
          return <h3 key={lineKey} className="text-lg font-extrabold text-slate-950 dark:text-indigo-200 mt-5 mb-3">{customParseMathAndText(line.replace('## ', ''))}</h3>
        }
        if (line.startsWith('# ')) {
          return <h2 key={lineKey} className="text-xl font-extrabold text-slate-950 dark:text-white mt-6 mb-4 border-b border-slate-200 dark:border-slate-800 pb-1">{customParseMathAndText(line.replace('# ', ''))}</h2>
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
          const content = line.replace(/^[\*\-]\s+/, '')
          const subParts = content.split(/(\*\*.*?\*\*)/g)
          return (
            <li key={lineKey} className="text-slate-800 dark:text-slate-200 text-base leading-relaxed ml-6 list-disc mb-2 font-medium">
              {subParts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-black dark:text-white font-extrabold">{customParseMathAndText(p.slice(2, -2))}</strong> : customParseMathAndText(p))}
            </li>
          )
        }
        
        if (line.includes('**')) {
          const subParts = line.split(/(\*\*.*?\*\*)/g)
          return (
            <p key={lineKey} className="text-slate-800 dark:text-slate-200 text-base leading-relaxed mb-3 font-medium">
              {subParts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-black dark:text-white font-extrabold">{customParseMathAndText(p.slice(2, -2))}</strong> : customParseMathAndText(p))}
            </p>
          )
        }

        return <p key={lineKey} className="text-slate-800 dark:text-slate-200 text-base leading-relaxed mb-3 font-medium">{customParseMathAndText(line)}</p>
      });
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* 1. SIDEBAR NAVBAR (DESKTOP) */}
      {!activeLesson && (
        <nav className="hidden md:flex flex-col w-64 h-full fixed left-0 top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 py-6 px-4 z-40">
          {/* Brand Logo */}
          <div className="mb-8 px-2">
            <h1 className="text-xl font-black text-primary dark:text-indigo-400 flex items-center gap-2.5">
              <GraduationCap className="w-7 h-7 text-primary dark:text-indigo-400" />
              <span>Cừu Học Bài</span>
            </h1>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 mb-8 px-2">
            {renderAvatar(profile.role, "w-10 h-10 border-2 border-primary object-cover shadow-sm")}
            <div className="min-w-0">
              <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{profile.username}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span>Cấp {studentPet?.current_level || 1}</span>
                <span>•</span>
                <span className="text-amber-500 font-bold">🪙 {studentPet?.coins || 0}</span>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <ul className="flex-1 space-y-1">
            <li>
              <button
                onClick={() => setActiveTab('home')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 text-sm ${
                  activeTab === 'home'
                    ? 'bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-300 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Home className="w-5 h-5" />
                <span>Trang chủ</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('lessons')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 text-sm ${
                  activeTab === 'lessons'
                    ? 'bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-300 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-5 h-5" />
                <span>Môn học</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('grades')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 text-sm ${
                  activeTab === 'grades'
                    ? 'bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-300 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Award className="w-5 h-5" />
                <span>Bảng điểm</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setIsPetModalOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-150 text-sm"
              >
                <span>🐹</span>
                <span>Thú cưng</span>
              </button>
            </li>
            <li>
              <button
                onClick={onOpenCreative}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-150 text-sm"
              >
                <span>🎨</span>
                <span>Góc sáng tạo</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setIsChatOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-150 text-sm"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Nhắn cho bố mẹ</span>
              </button>
            </li>
          </ul>

          {/* Footer of Sidebar */}
          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-auto space-y-2">
            <button
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 transition-colors text-sm"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}</span>
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </nav>
      )}

      {/* 2. MOBILE HEADER BAR */}
      {!activeLesson && (
        <header className="flex md:hidden justify-between items-center px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-40 w-full shadow-sm">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary dark:text-indigo-400" />
            <h1 className="font-bold text-slate-800 dark:text-slate-200 text-base">Cừu Học Bài</h1>
          </div>
          <div className="flex items-center gap-3">
            {studentPet && (
              <button 
                onClick={() => setIsPetModalOpen(true)}
                className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-bold"
              >
                🪙 {studentPet.coins}
              </button>
            )}
            <button
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-primary rounded-lg transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={logout} 
              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/10 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* 3. MAIN WORKSPACE / CONTENT CANVAS */}
      <div className={`flex-1 flex flex-col ${!activeLesson ? 'md:ml-64 pb-[80px] md:pb-6' : ''} overflow-y-auto`}>
        {/* CASE A: STUDENT IS STUDYING A SPECIFIC LESSON */}
        {activeLesson ? (
          <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen">
            {/* STUDY WORKSPACE HEADER */}
            <header className="border-b border-slate-800/80 glass-panel flex flex-col md:flex-row items-center justify-between py-3 px-6 h-auto md:h-16 gap-3 z-20">
              <div className="flex items-center gap-3">
                <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-bold uppercase">
                  Đang học
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">{activeLesson.subject}</h3>
                  <p className="text-xs text-indigo-300 mt-0.5">Buổi {activeLesson.lesson_number}: {activeLesson.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {studentPet && (
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-850 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-300">
                    <span>🪙 {studentPet.coins}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (isTimerRunning && !confirm('Bạn đang trong bài kiểm tra. Trở lại sẽ nộp bài ngay lập tức! Bạn có đồng ý?')) return;
                    stopTimer()
                    setActiveLesson(null)
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Trở lại danh sách buổi học
                </button>
              </div>
            </header>

            <section className="p-6 flex flex-col overflow-y-auto flex-1 bg-slate-950 text-slate-100">
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
                    activeLesson.mindmap.trim().startsWith('{') ? (
                      <MindMapViewer mindmapData={activeLesson.mindmap} />
                    ) : (
                      <div 
                        key={`${activeLesson.id}-${activeLesson.lesson_number}`}
                        className="mermaid p-6 bg-slate-950/80 border border-slate-800 rounded-2xl text-center overflow-x-auto select-none text-slate-100"
                      >
                        {cleanMermaidString(activeLesson.mindmap)}
                      </div>
                    )
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
                        className="w-full h-[65vh] border-0"
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
                  {/* Left Column: Lecture Theory Content */}
                  <div className="p-6 rounded-2xl glass-panel glow-indigo flex flex-col justify-between h-auto min-h-[60vh]">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-3">
                        Bài {activeLesson.lesson_number}: {activeLesson.title}
                      </h2>
                      <div className="prose prose-invert max-w-none max-h-[55vh] overflow-y-auto pr-3 scrollbar-thin">
                        {renderFormattedText(activeLesson.lecture_content)}
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => setWorkspaceTab('flashcards')}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold rounded-xl active:scale-95 transition-all shadow-md duration-150"
                      >
                        Chuyển sang ôn tập Flashcards
                      </button>
                    </div>
                  </div>

                  {/* Right Column: PDF Textbook Viewer */}
                  <div className="p-6 rounded-2xl glass-panel glow-indigo flex flex-col h-auto min-h-[60vh]">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                      <h3 className="text-lg font-bold text-white">Tài liệu sách giáo khoa</h3>
                      {syllabus?.pdf_file_path && (
                        <button
                          onClick={() => setIsBookOpen(prev => !prev)}
                          className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold transition-all"
                        >
                          {isBookOpen ? 'Ẩn sách' : 'Mở xem sách'}
                        </button>
                      )}
                    </div>

                    {syllabus?.pdf_file_path ? (
                      isBookOpen ? (
                        <div className="relative w-full h-[52vh] rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                          <iframe
                            src={`${syllabus.pdf_file_path}#toolbar=0`}
                            className="w-full h-full border-0"
                            title="Sách giáo khoa"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16 bg-slate-950/20 border border-dashed border-slate-850 rounded-xl">
                          <span className="text-4xl">📖</span>
                          <div>
                            <h4 className="font-bold text-slate-300 text-sm">Sách giáo khoa đã sẵn sàng</h4>
                            <p className="text-slate-500 text-xs mt-1">Nhấp nút bên dưới để mở xem sách trực tiếp.</p>
                          </div>
                          <button
                            onClick={() => setIsBookOpen(true)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                          >
                            Mở xem sách ngay
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16 bg-slate-950/20 border border-dashed border-slate-850 rounded-xl">
                        <span className="text-4xl">📭</span>
                        <div>
                          <h4 className="font-bold text-slate-400 text-sm">Chưa tải sách PDF lên</h4>
                          <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">Môn học này chưa có tài liệu sách giáo khoa PDF. Con hãy nhắc bố mẹ cập nhật ở Cổng Phụ Huynh nhé!</p>
                        </div>
                      </div>
                    )}
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
                          <div className="absolute inset-0 w-full h-full rounded-2xl glass-panel glow-indigo backface-hidden p-8 flex flex-col items-center justify-center text-center shadow-2xl selectable-tts">
                            <Sparkles className="w-6 h-6 text-indigo-400 mb-4 animate-pulse" />
                            <h3 className="text-lg font-bold text-slate-100 leading-relaxed">
                              <MathRenderer content={flashcards[currentFlashcardIdx]?.front || ''} />
                            </h3>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-6">Nhấp để xem mặt sau</span>
                          </div>

                          {/* Back Side */}
                          <div className="absolute inset-0 w-full h-full rounded-2xl bg-indigo-950/80 border border-indigo-500/35 glow-indigo backface-hidden p-8 flex flex-col items-center justify-center text-center shadow-2xl rotate-y-180 selectable-tts">
                            <CheckCircle className="w-6 h-6 text-emerald-400 mb-4" />
                            <p className="text-sm text-slate-200 leading-relaxed font-medium">
                              <MathRenderer content={flashcards[currentFlashcardIdx]?.back || ''} />
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
                    <div className="p-12 text-center rounded-2xl glass-panel glow-indigo flex flex-col items-center justify-center gap-5">
                      <div className="relative flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin" />
                        <Clock className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-white text-sm">Hệ thống đang chấm bài của bạn</h4>
                        <p className="text-slate-400 text-xs mt-1 animate-pulse">{getSubmittingProgressText()}</p>
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
                            <p className="text-sm font-semibold text-slate-100"><MathRenderer content={q.prompt} /></p>
                            
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
                                      <MathRenderer content={opt} />
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <HandwritingAnswerInput
                                value={answers[q.question_number] || ''}
                                onChange={(val) => handleAnswerSelect(q.question_number, val)}
                                questionNumber={q.question_number}
                                placeholder="Gõ câu trả lời chi tiết và trình bày cách làm của bạn vào đây..."
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
                    <p className="text-base text-black dark:text-slate-100 font-extrabold leading-relaxed">
                      <MathRenderer content={testResult.overall_feedback} />
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
                            👉 **Bài làm của bạn:** <span className="text-slate-100 font-medium"><MathRenderer content={q.student_answer || "(Chưa trả lời)"} /></span>
                          </p>
                          <div className="p-3 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-black dark:text-slate-100 font-extrabold leading-relaxed">
                            <strong className="text-black dark:text-white font-extrabold">Lời giải & Nhận xét của Giáo viên:</strong> <MathRenderer content={q.correct_explanation} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        /* CASE B: NORMAL STUDENT DASHBOARD (HOME BENTO, LESSON LIST, OR GRADES HISTORY) */
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          
          {/* CASE B-1: HOME TAB BENTO GRID */}
          {activeTab === 'home' && (
            <div className="p-6 md:p-10 flex flex-col gap-8 max-w-6xl mx-auto w-full">
              {/* Welcome banner & Pet Widget side by side */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-black dark:text-white tracking-tight">
                    Chào bạn, {profile.username}! 👋
                  </h2>
                  <p className="text-slate-500 dark:text-slate-455 text-sm mt-2 font-bold">
                    Sẵn sàng cho một ngày học tập tuyệt vời chưa?
                  </p>
                </div>
                {studentPet && (
                  <div 
                    onClick={() => setIsPetModalOpen(true)}
                    className="flex items-center gap-4 bg-tertiary-container/10 border border-tertiary/20 px-5 py-3.5 rounded-2xl cursor-pointer hover:border-tertiary/40 hover:bg-tertiary-container/15 transition-all group shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-indigo-500/20 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-all shadow-inner">
                      <img
                        src={`/assets/pets/pet_lv${studentPet.current_level}.png`}
                        alt="Pet"
                        className="w-10 h-10 object-contain animate-float"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/assets/pets/pet_lv0.png'
                        }}
                      />
                    </div>
                    <div className="text-left">
                      <h5 className="font-extrabold text-black dark:text-slate-100 text-sm flex items-center gap-1.5">
                        <span>Thú cưng Cấp {studentPet.current_level}</span>
                        <span className="text-lg">🐹</span>
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-455 mt-1 font-bold">
                        ❤️ HP: {studentPet.current_hp}% | 🪙 {studentPet.coins} xu
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Column: Subjects */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center h-8 mb-4">
                    <h3 className="text-xl font-black text-black dark:text-white flex items-center gap-2">
                      <span className="text-xl">📚</span>
                      <span>Môn học của bạn</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subjects.length === 0 ? (
                      <div className="col-span-2 p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-sm">
                        <p className="text-slate-400 text-sm font-medium">Bố mẹ chưa tạo môn học nào. Hãy nhắc bố mẹ nhé!</p>
                      </div>
                    ) : (
                      subjects.map((sub) => {
                        const sylForSub = allSyllabuses[sub] || null
                        const lessonsForSub = allLessons[sub] || []
                        const totalLessons = sylForSub?.total_lessons || 30
                        
                        // Completed count
                        const completedCount = lessonsForSub.filter(l => 
                          grades.some(g => g.student_username === profile.username && g.lesson_id === l.id && g.score >= 5)
                        ).length
                        const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

                        // Average score
                        const subGrades = grades.filter(g => g.subject === sub)
                        const avgScore = subGrades.length > 0 
                          ? (subGrades.reduce((sum, g) => sum + g.score, 0) / subGrades.length).toFixed(1)
                          : null

                        // Color configuration
                        let themeBg = 'bg-primary-container/10 text-primary'
                        let themePill = 'bg-[#0284c7]'
                        let icon = '📖'
                        if (sub.toLowerCase().includes('toán')) {
                          themeBg = 'bg-[#e0f2fe] text-[#0284c7]'
                          themePill = 'bg-[#0284c7]'
                          icon = '🧮'
                        } else if (sub.toLowerCase().includes('anh') || sub.toLowerCase().includes('english')) {
                          themeBg = 'bg-[#fce7f3] text-[#db2777]'
                          themePill = 'bg-[#db2777]'
                          icon = '🌍'
                        } else if (sub.toLowerCase().includes('văn') || sub.toLowerCase().includes('việt')) {
                          themeBg = 'bg-[#dcfce7] text-[#16a34a]'
                          themePill = 'bg-[#16a34a]'
                          icon = '✍️'
                        }

                        return (
                          <div
                            key={sub}
                            onClick={() => {
                              setSelectedSubject(sub)
                              setActiveTab('lessons')
                            }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/40 dark:hover:border-indigo-500/40 transition-all duration-200 cursor-pointer flex flex-col group relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full pointer-events-none"></div>
                            <div className="flex justify-between items-start mb-4">
                              <div className={`w-10 h-10 rounded-xl ${themeBg} flex items-center justify-center text-lg font-bold group-hover:scale-105 transition-transform`}>
                                {icon}
                              </div>
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 px-3 py-1 rounded-full text-[11px] font-bold border border-slate-200/60 dark:border-slate-700/50">
                                {totalLessons} buổi học
                              </span>
                            </div>

                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1">{sub}</h4>
                            <p className="text-slate-450 dark:text-slate-400 text-xs mb-6 truncate">{sylForSub?.textbook_content || 'Chương trình học chuẩn'}</p>

                            <div className="mt-auto space-y-2">
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {avgScore ? `Điểm TB: ${avgScore}đ` : 'Tiến độ'}
                                </span>
                                <span className="text-primary dark:text-indigo-400">{progressPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-850 rounded-full h-2 overflow-hidden">
                                <div className={`${themePill} h-2 rounded-full transition-all duration-300`} style={{ width: `${progressPercent}%` }}></div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}

                    {/* Creative Corner Banner */}
                    <div className="bg-gradient-to-r from-primary to-primary-container text-white p-6 rounded-2xl shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:col-span-2">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,white,transparent_70%)]"></div>
                      <div>
                        <span className="text-3xl mb-1.5 block">🏆</span>
                        <h4 className="font-black text-lg tracking-wider">Giải Đấu Học Tập Cuối Tuần</h4>
                        <p className="text-xs opacity-90 mt-1 max-w-md">Làm bài tập nhận xu vàng để nâng cấp nhà cho thú cưng và mở khóa những phần quà giá trị nhất!</p>
                      </div>
                      <button
                        onClick={onOpenCreative}
                        className="bg-white text-primary font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-slate-100 transition-colors shadow-lg active:scale-95 duration-150 md:shrink-0 w-fit"
                      >
                        Vào chơi ngay 🎨
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Recent Activity */}
                <div className="space-y-6">
                  <div className="flex items-center h-8 mb-4">
                    <h3 className="text-xl font-black text-black dark:text-white flex items-center gap-2">
                      <span className="text-xl">⏳</span>
                      <span>Hoạt động gần đây</span>
                    </h3>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                    {grades.length === 0 ? (
                      <p className="text-slate-400 text-xs py-6 text-center font-medium">Chưa làm bài thi nào.</p>
                    ) : (
                      [...grades]
                        .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())
                        .slice(0, 3)
                        .map((g) => {
                          const dateObj = new Date(g.submitted_at!)
                          const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dateObj.getDay()]
                          const dayNum = dateObj.getDate()

                          return (
                            <div
                              key={g.id}
                              onClick={() => {
                                const matchedLesson = lessons.find(l => l.id === g.lesson_id)
                                if (matchedLesson) {
                                  setActiveLesson(matchedLesson)
                                  setTestResult(JSON.parse(g.ai_feedback))
                                  setAnswers(JSON.parse(g.answers))
                                  setWorkspaceTab('result')
                                } else {
                                  alert('Nhấp vào bài làm ở tab Bảng điểm để xem nhận xét chi tiết nhé!')
                                }
                              }}
                              className="p-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent hover:border-slate-200/70 dark:hover:border-slate-800 transition-all cursor-pointer group flex items-center gap-3.5"
                            >
                              <div className="w-11 h-11 rounded-xl bg-primary-container/10 flex flex-col items-center justify-center shrink-0">
                                <span className="text-[10px] leading-none text-primary dark:text-indigo-400 font-bold">{dayName}</span>
                                <span className="text-sm font-black text-primary dark:text-indigo-300 mt-0.5">{dayNum}</span>
                              </div>
                              <div className="flex-1 min-w-0 font-medium">
                                <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-primary dark:group-hover:text-indigo-300 transition-colors">
                                  Buổi {g.lesson_number}: {g.lesson_title}
                                </h5>
                                <p className="text-xs text-slate-400 mt-0.5 truncate">{g.subject}</p>
                              </div>
                              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                {g.score.toFixed(1)}đ
                              </span>
                            </div>
                          )
                        })
                    )}

                    <button
                      onClick={() => setActiveTab('grades')}
                      className="w-full py-2.5 text-xs font-bold text-primary dark:text-indigo-400 hover:bg-primary-container/10 rounded-xl transition-colors mt-2"
                    >
                      Xem lịch sử chi tiết ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CASE B-2: SUBJECTS AND LESSONS CATALOG */}
          {activeTab === 'lessons' && (
            <div className="p-6 md:p-10 flex flex-col gap-6 max-w-5xl mx-auto w-full">
              {!selectedSubject ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200">Danh sách môn học</h2>
                    <p className="text-slate-400 text-xs mt-1">Chọn môn học bên dưới để vào xem danh sách bài giảng chi tiết:</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {subjects.map(sub => {
                      let icon = '📖'
                      if (sub.toLowerCase().includes('toán')) icon = '🧮'
                      else if (sub.toLowerCase().includes('anh')) icon = '🌍'
                      else if (sub.toLowerCase().includes('văn') || sub.toLowerCase().includes('việt')) icon = '✍️'

                      return (
                        <div
                          key={sub}
                          onClick={() => setSelectedSubject(sub)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl cursor-pointer hover:border-primary/50 dark:hover:border-indigo-500/40 hover:shadow-md transition-all text-center flex flex-col items-center justify-center gap-4 group"
                        >
                          <span className="text-4xl group-hover:scale-110 transition-transform duration-200">{icon}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-base">{sub}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-3 rounded-2xl shadow-sm">
                    <button 
                      onClick={() => setSelectedSubject('')}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400"
                      title="Quay lại danh sách môn học"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Đang chọn:</span>
                    <select 
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-1.5 px-3 rounded-xl font-bold text-primary dark:text-indigo-400"
                    >
                      {subjects.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {!syllabus ? (
                    <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                      <p className="text-slate-400 text-sm">Đang tải danh sách bài học...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Bài giảng môn: {selectedSubject}</h3>
                          <span className="text-xs text-slate-400">Lộ trình chốt: {syllabus.total_lessons} buổi học</span>
                        </div>
                        {syllabus.pdf_file_path && (
                          <a
                            href={syllabus.pdf_file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary dark:text-indigo-400 border border-primary/20 rounded-xl text-xs font-bold transition-all w-fit shadow-sm active:scale-95"
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
                          
                          // Find best score for this lesson
                          const lessonGrades = existingLesson
                            ? grades.filter(g => g.student_username === profile.username && g.lesson_id === existingLesson.id)
                            : []
                          const bestScore = lessonGrades.length > 0
                            ? Math.max(...lessonGrades.map(g => g.score))
                            : null

                          return (
                            <div
                              key={lessonNum}
                              className={`p-5 rounded-2xl border flex flex-col justify-between h-[180px] transition-all ${
                                existingLesson
                                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary/50 dark:hover:border-indigo-500/40 hover:shadow-md'
                                  : 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/80 opacity-55 cursor-not-allowed'
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-primary dark:text-indigo-400">Buổi số {lessonNum}</span>
                                  {existingLesson ? (
                                    <span className="text-[10px] bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1.5 font-bold">
                                      <span>Sẵn sàng</span>
                                      {bestScore !== null && (
                                        <span className="bg-primary/20 text-primary dark:bg-indigo-500/20 dark:text-indigo-200 px-1 py-0.2 rounded font-black">
                                          {bestScore}/10 đ
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 px-2 py-0.5 rounded-full">
                                      Chưa soạn
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
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
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md duration-150"
                                  >
                                    Vào học bài
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="w-full py-2 bg-slate-100 text-slate-400 text-xs font-semibold rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-650 cursor-not-allowed"
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
            </div>
          )}

          {/* CASE B-3: GRADES / QUIZ RESULTS HISTORY */}
          {activeTab === 'grades' && (
            <div className="p-6 md:p-10 flex flex-col gap-6 max-w-5xl mx-auto w-full">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">Lịch sử kết quả bài thi</h3>
                <p className="text-xs text-slate-400 mt-0.5">Nơi lưu trữ tất cả các bài tập bạn đã hoàn thành kèm theo nhận xét</p>
              </div>

              {grades.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3 shadow-sm">
                  <Award className="w-12 h-12 text-slate-400" />
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300">Chưa có kết quả thi nào</h4>
                    <p className="text-slate-400 text-xs mt-1">Kết quả bài làm của bạn sẽ xuất hiện tại đây sau khi bạn nộp bài thi.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(
                    grades.reduce((acc, g) => {
                      const sub = g.subject || 'Khác'
                      if (!acc[sub]) acc[sub] = []
                      acc[sub].push(g)
                      return acc
                    }, {} as Record<string, Grade[]>)
                  ).map(([subjectName, subjectGrades]) => (
                    <div key={subjectName} className="space-y-3 text-left">
                      <h4 className="text-sm font-bold text-primary dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800 pb-1 text-left uppercase tracking-wider flex items-center gap-2">
                        <span>📚</span> Môn học: {subjectName} ({subjectGrades.length} bài)
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {subjectGrades.map((g) => (
                          <div key={g.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all">
                            <div>
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <span className="text-[10px] bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-400 border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                                    Buổi {g.lesson_number}
                                  </span>
                                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1.5">{g.lesson_title}</h4>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                                  g.score >= 8
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : g.score >= 5
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                }`}>
                                  {g.score.toFixed(1)}đ
                                </span>
                              </div>
                              
                              <div className="mt-3 text-xs text-black dark:text-slate-100 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl leading-relaxed line-clamp-3 border border-slate-200 dark:border-slate-800/80 font-extrabold">
                                <strong>Giáo viên nhận xét:</strong> {(() => {
                                  try {
                                    return JSON.parse(g.ai_feedback).overall_feedback;
                                  } catch {
                                    return g.ai_feedback;
                                  }
                                })()}
                              </div>
                            </div>

                            <div className="flex justify-between items-center mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                              <span className="text-[10px] text-slate-400">
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
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg active:scale-95 transition-all shadow-md duration-150"
                              >
                                Xem nhận xét chi tiết
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {/* 4. BOTTOM NAVIGATION BAR (MOBILE) */}
    {!activeLesson && (
      <nav className="fixed bottom-0 left-0 w-full z-45 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800/80 flex justify-around items-center py-2 px-4 shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-90 transition-transform ${
            activeTab === 'home'
              ? 'bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-300 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Home</span>
        </button>
        
        <button
          onClick={() => setActiveTab('lessons')}
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-90 transition-transform ${
            activeTab === 'lessons'
              ? 'bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-300 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Lessons</span>
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-90 transition-transform ${
            activeTab === 'grades'
              ? 'bg-primary/10 text-primary dark:bg-indigo-500/10 dark:text-indigo-300 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Award className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Results</span>
        </button>

        <button
          onClick={() => setIsPetModalOpen(true)}
          className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 rounded-xl px-4 py-1.5 active:scale-90 transition-transform"
        >
          <span className="text-lg">🐹</span>
          <span className="text-[10px] font-bold mt-0.5">Pet</span>
        </button>

        <button
          onClick={() => setIsChatOpen(true)}
          className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 rounded-xl px-4 py-1.5 active:scale-90 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Chat</span>
        </button>
      </nav>
    )}

      {/* Floating Chat & Chat Panel */}
      <ChatPanel
        isOpen={isChatOpen}
        setIsOpen={setIsChatOpen}
        messages={messages}
        newMsg={newMsg}
        setNewMsg={setNewMsg}
        onSendMessage={handleSendMessage}
        username={profile.username}
        placeholder="Nhắn tin cho bố mẹ..."
      />

      {/* Virtual Pet Interaction & Shop Modal */}
      {isPetModalOpen && studentPet && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐹</span>
                <div className="text-left">
                  <h3 className="text-base font-bold text-white">Hệ thống thú cưng</h3>
                  <p className="text-[11px] text-slate-400">Hãy cho thú ăn và sắm đồ để tiến hóa thú nuôi nhé!</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPetModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Pet Status Header Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-slate-950/30 p-5 rounded-2xl border border-slate-800/80">
                {/* Pet Image Frame */}
                <div 
                  onClick={handlePetImageClick}
                  className="relative w-36 h-36 mx-auto bg-slate-900/60 rounded-full border border-indigo-500/20 flex items-center justify-center overflow-hidden shadow-inner p-3 cursor-pointer group"
                >
                  <img
                    src={`/assets/pets/pet_lv${studentPet.current_level}.png`}
                    alt="Pet Avatar"
                    className={`max-w-full max-h-full object-contain transition-transform select-none animate-float ${isPetShaking ? 'animate-shake' : ''}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/pets/pet_lv0.png'
                    }}
                  />
                  <div className="absolute bottom-1 text-[9px] bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    Chạm vào tớ!
                  </div>
                </div>

                {/* Pet stats details */}
                <div className="space-y-4">
                  <div className="text-left">
                    {isRenameInputOpen ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="text"
                          value={newPetName}
                          onChange={(e) => setNewPetName(e.target.value)}
                          placeholder="Nhập tên mới..."
                          className="px-2 py-1 text-xs rounded border bg-slate-950 border-slate-800 text-white w-32 focus:outline-none"
                          maxLength={20}
                        />
                        <button
                          onClick={handleRenamePet}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[10px] font-bold"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => setIsRenameInputOpen(false)}
                          className="bg-slate-850 hover:bg-slate-800 text-slate-300 px-2 py-1 rounded text-[10px] font-bold"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-indigo-300">{studentPet.pet_name}</h4>
                        <button
                          onClick={() => {
                            setNewPetName(studentPet.pet_name)
                            setIsRenameInputOpen(true)
                          }}
                          title={studentPet.has_renamed ? "Đổi tên (Tốn 50 xu)" : "Đổi tên (Miễn phí lần đầu)"}
                          className="text-slate-400 hover:text-indigo-400 transition-colors p-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {studentPet.has_renamed ? "50 xu" : "Miễn phí"}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1">Cấp độ hiện tại: <span className="font-extrabold text-slate-200">Level {studentPet.current_level}</span></p>
                  </div>

                  {/* HP & EXP sliders */}
                  <div className="space-y-2 text-left">
                    {/* HP bar */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-400">❤️ Sức khỏe (HP):</span>
                        <span className={studentPet.current_hp < 30 ? 'text-rose-455 font-black animate-pulse' : 'text-emerald-400'}>
                          {studentPet.current_hp}/100
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${studentPet.current_hp < 30 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}
                          style={{ width: `${studentPet.current_hp}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* EXP bar */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-400">⭐ Kinh nghiệm:</span>
                        <span className="text-indigo-400">
                          {studentPet.current_exp}/{(studentPet.current_level * 200) + 100} EXP
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500"
                          style={{ width: `${(studentPet.current_exp / ((studentPet.current_level * 200) + 100)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Wallet indicator */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400">Số xu hiện có:</span>
                    <span className="text-sm font-bold text-amber-300">🪙 {studentPet.coins} xu</span>
                  </div>
                </div>
              </div>

              {/* Tabs Switcher */}
              <div className="flex border-b border-slate-800/80 pb-0.5 gap-6">
                <button
                  onClick={() => setPetShopTab('interact')}
                  className={`pb-2.5 text-sm font-semibold transition-all relative ${
                    petShopTab === 'interact' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {petShopTab === 'interact' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                  Cho ăn
                </button>
                <button
                  onClick={() => setPetShopTab('shop')}
                  className={`pb-2.5 text-sm font-semibold transition-all relative ${
                    petShopTab === 'shop' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {petShopTab === 'shop' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                  Cửa hàng tiến hóa
                </button>
                <button
                  onClick={() => setPetShopTab('rules')}
                  className={`pb-2.5 text-sm font-semibold transition-all relative ${
                    petShopTab === 'rules' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {petShopTab === 'rules' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>}
                  Hệ thống thưởng điểm
                </button>
              </div>

              {/* Sub-tab 1: Interaction & Evolution */}
              {petShopTab === 'interact' && (
                <div className="space-y-4">
                  {/* Parent Events Section */}
                  {petEvents.length > 0 && (
                    <div className="p-4 bg-rose-950/20 border border-rose-500/25 rounded-2xl space-y-3 text-left">
                      <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                        <span>🎁</span> Nhiệm vụ thử thách từ bố mẹ:
                      </div>
                      
                      <div className="space-y-2">
                        {petEvents.map((ev) => (
                          <div 
                            key={ev.id}
                            className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-left animate-in slide-in-from-top duration-300"
                          >
                            <div className="space-y-1">
                              <h5 className="text-xs font-bold text-slate-200">{ev.title}</h5>
                              <div className="flex gap-2">
                                <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                                  🪙 {ev.reward_coins} xu
                                </span>
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full font-bold">
                                  ⭐ {ev.reward_exp} EXP
                                </span>
                                {ev.is_completed ? (
                                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold border border-emerald-500/20 animate-pulse">
                                    ✓ Hoàn thành
                                  </span>
                                ) : ev.reported ? (
                                  <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                                    Đang chờ duyệt...
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                                    Đang làm...
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {ev.is_completed ? (
                              <button
                                onClick={() => handleCompletePetEvent(ev)}
                                className="px-3 py-1.5 bg-gradient-to-tr from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-[10px] font-bold rounded-lg shadow-md active:scale-95 transition-all animate-pulse"
                              >
                                Nhận thưởng
                              </button>
                            ) : ev.reported ? (
                              <button
                                disabled
                                className="px-3 py-1.5 bg-slate-800 text-slate-500 text-[10px] font-bold rounded-lg cursor-not-allowed opacity-50"
                                title="Đang chờ bố mẹ duyệt hoàn thành!"
                              >
                                Đợi duyệt
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReportPetEvent(ev)}
                                className="px-3 py-1.5 bg-gradient-to-tr from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-[10px] font-bold rounded-lg shadow-md active:scale-95 transition-all"
                              >
                                Báo hoàn thành
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feed section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Cho thú ăn phục hồi sức khỏe:</h4>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {/* Sunflower item */}
                      <button
                        onClick={() => handleFeedPet('sunflower')}
                        className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl text-center transition-all flex flex-col items-center justify-between gap-1 active:scale-95 group"
                      >
                        <span className="text-2xl mt-1">🌻</span>
                        <div className="text-xs font-bold text-slate-200 mt-1">Hạt hướng dương</div>
                        <div className="text-[10px] text-emerald-400 font-semibold">+15 HP</div>
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-extrabold mt-1 group-hover:bg-amber-500/20">
                          🪙 10 xu
                        </span>
                      </button>

                      {/* Milk item */}
                      <button
                        onClick={() => handleFeedPet('milk')}
                        className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl text-center transition-all flex flex-col items-center justify-between gap-1 active:scale-95 group"
                      >
                        <span className="text-2xl mt-1">🍼</span>
                        <div className="text-xs font-bold text-slate-200 mt-1">Bình sữa sơ sinh</div>
                        <div className="text-[10px] text-emerald-400 font-semibold">+25 HP</div>
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-extrabold mt-1 group-hover:bg-amber-500/20">
                          🪙 15 xu
                        </span>
                      </button>

                      {/* Cheese item */}
                      <button
                        onClick={() => handleFeedPet('cheese')}
                        className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl text-center transition-all flex flex-col items-center justify-between gap-1 active:scale-95 group"
                      >
                        <span className="text-2xl mt-1">🧀</span>
                        <div className="text-xs font-bold text-slate-200 mt-1">Bánh phô mai nhỏ</div>
                        <div className="text-[10px] text-emerald-400 font-semibold">+40 HP</div>
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-extrabold mt-1 group-hover:bg-amber-500/20">
                          🪙 25 xu
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Level Evolution Section */}
                  <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl mt-2 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="space-y-1 text-left">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Kích hoạt tiến hóa</span>
                      <p className="text-xs text-slate-300 font-medium">
                        {studentPet.current_level >= 10 ? (
                          "Thú cưng của bạn đã đạt cấp tiến hóa cao nhất! 🎉"
                        ) : (
                          <>
                            Yêu cầu: <strong className="text-indigo-200">HP &gt;= 95</strong> & sở hữu vật phẩm{' '}
                            <strong className="text-indigo-200">
                              "{getRequiredItemForLevel(studentPet.current_level)?.name || 'Không cần'}"
                            </strong>.
                          </>
                        )}
                      </p>
                    </div>

                    {studentPet.current_level < 10 && (
                      <button
                        onClick={handleEvolvePet}
                        className="px-5 py-2.5 bg-gradient-to-tr from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                      >
                        Tiến hóa cấp {studentPet.current_level + 1}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Shop & Custom upgrades */}
              {petShopTab === 'shop' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left side: Item list */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Đồ vật Tiến hóa / Trang phục:</h4>
                      
                      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {Array.from({ length: 9 }).map((_, idx) => {
                          const lv = idx + 1
                          const req = getRequiredItemForLevel(lv)
                          if (!req) return null

                          const isOwned = ownedEvolutionItems.includes(req.name)

                          return (
                            <div
                              key={lv}
                              className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-center p-1 overflow-hidden">
                                  <img
                                    src={`/assets/items/${req.img}.png`}
                                    alt={req.name}
                                    className="max-w-full max-h-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/assets/items/gold_cheese.png'
                                    }}
                                  />
                                </div>
                                <div className="text-left">
                                  <h5 className="text-xs font-bold text-slate-200">{req.name}</h5>
                                  <p className="text-[10px] text-slate-500">Cần cho tiến hóa cấp {lv + 1}</p>
                                </div>
                              </div>

                              <div>
                                {isOwned ? (
                                  <span className="text-[10px] bg-slate-800 border border-slate-700/60 text-slate-400 px-2.5 py-1.5 rounded-lg font-bold select-none">
                                    Đã sở hữu
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleBuyEvolutionItem(req.name, req.price)}
                                    className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 px-2.5 py-1.5 rounded-lg font-extrabold active:scale-95 transition-all"
                                  >
                                    🪙 {req.price} xu
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Right side: Preview next level */}
                    <div className="p-4 bg-slate-950/30 border border-slate-800/80 rounded-2xl flex flex-col justify-between items-center text-center space-y-4">
                      <div>
                        <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          Xem trước Tiến hóa
                        </span>
                        <h4 className="text-sm font-bold text-slate-200 mt-2">Cấp độ tiếp theo</h4>
                      </div>

                      {studentPet.current_level < 10 ? (
                        <div className="space-y-4 flex flex-col items-center">
                          <div className="relative w-28 h-28 mx-auto bg-slate-900/60 rounded-full border border-slate-800 flex items-center justify-center p-2 overflow-hidden shadow-inner filter grayscale opacity-40 select-none">
                            <img
                              src={`/assets/pets/pet_lv${studentPet.current_level + 1}.png`}
                              alt="Next Evolution"
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/assets/pets/pet_lv0.png'
                              }}
                            />
                          </div>

                          <div className="text-xs text-slate-400 max-w-[200px]">
                            Đạt cấp kế tiếp và sở hữu{' '}
                            <strong className="text-indigo-300">
                              "{getRequiredItemForLevel(studentPet.current_level)?.name || 'Không cần'}"
                            </strong>{' '}
                            để mở khóa hình thú cưng này!
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-slate-500 text-xs">
                          Thú cưng đã đạt cấp tiến hóa cao nhất!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Economy & Progression rules */}
              {petShopTab === 'rules' && (
                <div className="space-y-4 text-left text-xs text-slate-300 max-h-[300px] overflow-y-auto pr-1">
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
                      <span>🪙</span> Cơ chế Kiếm Xu & EXP
                    </h4>
                    <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                      <li>
                        <strong className="text-slate-200">Hoàn thành bài kiểm tra lần đầu:</strong> Nhận đủ phần thưởng tối đa ứng với điểm số. Điểm càng cao, phần thưởng Coins & EXP càng lớn!
                      </li>
                      <li>
                        <strong className="text-slate-200">Làm lại bài kiểm tra (Chống Farm):</strong> Nhận Coins & EXP chênh lệch nếu đạt mốc điểm cao hơn kỷ lục cũ. Nếu điểm bằng hoặc thấp hơn, chỉ nhận khích lệ cố định <span className="text-indigo-400 font-bold">+5 EXP</span> (không cộng xu).
                      </li>
                      <li>
                        <strong className="text-slate-200">Sự kiện từ Phụ huynh:</strong> Hoàn thành các thử thách đặc biệt do bố mẹ giao để nhận phần thưởng lớn tức thì!
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>❤️</span> Cơ chế Sức khỏe (HP) & Cho ăn
                    </h4>
                    <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                      <li>
                        Thú cưng sẽ bị tiêu hao sức khỏe (giảm HP dần) theo thời gian nếu không được chăm sóc.
                      </li>
                      <li>
                        Sử dụng xu trong ví học tập để mua thức ăn trong tab <strong className="text-slate-300">"Cho ăn"</strong> để hồi phục HP (Hạt hướng dương: +15 HP, Bình sữa: +25 HP, Phô mai: +40 HP).
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                      <span>⚡</span> Cơ chế Tiến hóa (Evolution)
                    </h4>
                    <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                      <li>
                        Thú cưng có thể tiến hóa từ Level 0 lên tới Level 10. Mỗi cấp độ tiến hóa mang một ngoại hình đặc trưng khác nhau.
                      </li>
                      <li>
                        <strong className="text-slate-200">Điều kiện tiến hóa:</strong> Cần tích lũy đủ EXP của cấp hiện tại, giữ sức khỏe <strong className="text-emerald-400">HP &gt;= 95</strong>, và phải sở hữu vật phẩm tiến hóa tương ứng mua từ <strong className="text-slate-300">"Cửa hàng tiến hóa"</strong>.
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Victory Congratulations & Rewards Modal */}
      {showVictoryPopup && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 text-center shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none"></div>
            
            <div className="text-4xl my-4 animate-bounce">
              {isLevelUp ? '🎉 LEVEL UP! 🎉' : '🌟 CHÚC MỪNG! 🌟'}
            </div>

            <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-indigo-400 tracking-wider">
              {victoryTitle}
            </h3>

            {isLevelUp ? (
              <div className="my-6 space-y-4 flex flex-col items-center">
                <div className="relative w-32 h-32 bg-indigo-500/10 rounded-full border border-indigo-500/30 flex items-center justify-center p-3 animate-pulse">
                  <img
                    src={studentPet ? `/assets/pets/pet_lv${studentPet.current_level}.png` : '/assets/pets/pet_lv0.png'}
                    alt="New Pet"
                    className="max-w-full max-h-full object-contain animate-bounce"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/pets/pet_lv0.png'
                    }}
                  />
                </div>
                <p className="text-sm text-indigo-300 font-bold">Thú cưng của bạn đã tiến hóa lên cấp độ mới!</p>
              </div>
            ) : (
              <div className="my-6 space-y-6">
                <p className="text-xs text-slate-400 font-medium">Bạn đã hoàn thành xuất sắc thử thách làm bài kiểm tra và nhận được:</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
                    <span className="text-3xl block">🪙</span>
                    <span className="text-base font-black text-amber-300 block mt-2">+{victoryCoinsEarned} xu</span>
                    <span className="text-[10px] text-slate-500 block">Tiền vàng cộng ví</span>
                  </div>

                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl">
                    <span className="text-3xl block">⭐</span>
                    <span className="text-base font-black text-indigo-300 block mt-2">+{victoryExpEarned} EXP</span>
                    <span className="text-[10px] text-slate-500 block">Kinh nghiệm thú nuôi</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowVictoryPopup(false)
                setIsLevelUp(false)
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-500/10"
            >
              Tiếp tục học tập
            </button>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage(null)}
      />

      {selectionCoords && selectedText && (
        <div
          className="fixed z-[9999] bg-gradient-to-r from-orange-500 to-pink-500 border border-orange-400 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-white text-xs font-black animate-bounce-subtle cursor-pointer select-none"
          style={{
            left: `${selectionCoords.x}px`,
            top: `${selectionCoords.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
          onMouseDown={(e) => {
            // Ngăn chặn sự kiện mousedown xóa vùng bôi đen trước khi kích hoạt âm thanh
            e.preventDefault()
            e.stopPropagation()
            speakText(selectedText)
          }}
        >
          <span className="text-sm">🔊</span>
          <span>Phát âm chậm</span>
        </div>
      )}
    </div>
  )
}
