import { supabase, isSupabaseConfigured } from './supabaseClient'

export interface User {
  username: string;
  role: 'parent' | 'student';
}

export interface Syllabus {
  id?: number;
  subject: string;
  content: string;
  textbook_content?: string;
  pdf_file_path?: string;
  total_lessons: number;
}

export interface Lesson {
  id?: number;
  subject: string;
  lesson_number: number;
  title: string;
  lecture_content: string;
  questions: string; // JSON string
  duration: number;
  flashcards?: string; // JSON string
  is_published?: boolean;
  parent_feedback?: string;
  infographic_url?: string;
  infographic_prompt?: string;
  infographic_content?: string;
}

export interface Grade {
  id?: number;
  student_username: string;
  lesson_id: number;
  answers: string; // JSON string
  score: number;
  ai_feedback: string; // JSON string
  submitted_at?: string;
  lesson_title?: string;
  lesson_number?: number;
  subject?: string;
}

export interface Message {
  id?: number;
  sender: string;
  message: string;
  created_at?: string;
}

// Helper: LocalStorage Fallback database
const getLocal = (key: string, def: any) => {
  const val = localStorage.getItem(key);
  if (!val || val === 'undefined') return def;
  try {
    return JSON.parse(val);
  } catch {
    return def;
  }
};
const setLocal = (key: string, val: any) => {
  localStorage.setItem(key, JSON.stringify(val));
};

// Seed default users in localStorage if empty
if (!localStorage.getItem('local_users')) {
  setLocal('local_users', [
    { username: 'phuhuynh', password: '123456', role: 'parent' },
    { username: 'hocsinh', password: '123456', role: 'student' }
  ]);
}

export const dataService = {
  // 1. Auth: Verify user login credentials
  async verifyUser(username: string, password: string): Promise<User | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username, role')
          .eq('username', username)
          .eq('password', password)
          .single();
        if (error || !data) return null;
        return data as User;
      } catch {
        return null;
      }
    } else {
      const users = getLocal('local_users', []);
      const found = users.find((u: any) => u.username === username && u.password === password);
      return found ? { username: found.username, role: found.role } : null;
    }
  },

  // 2. Syllabus: Get all subjects
  async getSubjects(): Promise<string[]> {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('syllabus').select('subject');
      return data ? data.map(d => d.subject) : [];
    } else {
      const syllabusList = getLocal('local_syllabus', []) as Syllabus[];
      return syllabusList.map(s => s.subject);
    }
  },

  // Syllabus: Get by subject
  async getSyllabus(subject: string): Promise<Syllabus | null> {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('syllabus').select('*').eq('subject', subject).single();
      return data;
    } else {
      const syllabusList = getLocal('local_syllabus', []) as Syllabus[];
      return syllabusList.find(s => s.subject === subject) || null;
    }
  },

  // Syllabus: Save
  async saveSyllabus(
    subject: string, 
    content: string, 
    totalLessons: number = 30, 
    textbookContent?: string, 
    pdfFilePath?: string
  ): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('syllabus').upsert({
        subject,
        content,
        total_lessons: totalLessons,
        textbook_content: textbookContent,
        pdf_file_path: pdfFilePath
      }, { onConflict: 'subject' });
      return !error;
    } else {
      const syllabusList = getLocal('local_syllabus', []) as Syllabus[];
      const idx = syllabusList.findIndex(s => s.subject === subject);
      const newSyllabus: Syllabus = { 
        subject, 
        content, 
        total_lessons: totalLessons,
        textbook_content: textbookContent,
        pdf_file_path: pdfFilePath
      };
      if (idx >= 0) {
        syllabusList[idx] = newSyllabus;
      } else {
        syllabusList.push(newSyllabus);
      }
      setLocal('local_syllabus', syllabusList);
      return true;
    }
  },

  // 3. Lessons: Get lessons of a subject
  async getLessons(subject: string, onlyPublished: boolean = false): Promise<Lesson[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('subject', subject);
      
      if (onlyPublished) {
        query = query.eq('is_published', true);
      }
      
      const { data } = await query.order('lesson_number', { ascending: true });
      return data || [];
    } else {
      const lessons = getLocal('local_lessons', []) as Lesson[];
      let filtered = lessons.filter(l => l.subject === subject);
      if (onlyPublished) {
        filtered = filtered.filter(l => l.is_published);
      }
      return filtered.sort((a, b) => a.lesson_number - b.lesson_number);
    }
  },

  // Lessons: Save
  async saveLesson(lesson: Omit<Lesson, 'id'>): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('lessons').upsert(lesson, { onConflict: 'subject,lesson_number' });
      return !error;
    } else {
      const lessons = getLocal('local_lessons', []) as Lesson[];
      const idx = lessons.findIndex(l => l.subject === lesson.subject && l.lesson_number === lesson.lesson_number);
      const newLesson = { ...lesson, id: idx >= 0 ? lessons[idx].id : Date.now() };
      if (idx >= 0) {
        lessons[idx] = newLesson;
      } else {
        lessons.push(newLesson);
      }
      setLocal('local_lessons', lessons);
      return true;
    }
  },

  // 4. Grades: Save student submission
  async saveGrade(grade: Omit<Grade, 'id'>): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('grades').insert(grade);
      return !error;
    } else {
      const grades = getLocal('local_grades', []) as Grade[];
      const newGrade = { ...grade, id: Date.now(), submitted_at: new Date().toISOString() };
      grades.push(newGrade);
      setLocal('local_grades', grades);
      return true;
    }
  },

  // Grades: Get for student
  async getGrades(studentUsername: string): Promise<Grade[]> {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('grades')
        .select(`
          *,
          lessons (title, lesson_number, subject)
        `)
        .eq('student_username', studentUsername)
        .order('submitted_at', { ascending: false });
      
      return (data || []).map((d: any) => ({
        ...d,
        lesson_title: d.lessons?.title,
        lesson_number: d.lessons?.lesson_number,
        subject: d.lessons?.subject
      }));
    } else {
      const grades = getLocal('local_grades', []) as Grade[];
      const lessons = getLocal('local_lessons', []) as Lesson[];
      return grades
        .filter(g => g.student_username === studentUsername)
        .map(g => {
          const l = lessons.find(les => les.id === g.lesson_id);
          return {
            ...g,
            lesson_title: l?.title,
            lesson_number: l?.lesson_number,
            subject: l?.subject
          };
        })
        .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime());
    }
  },

  // Grades: Get all grades (for parent)
  async getAllGrades(): Promise<Grade[]> {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('grades')
        .select(`
          *,
          lessons (title, lesson_number, subject)
        `)
        .order('submitted_at', { ascending: false });
      
      return (data || []).map((d: any) => ({
        ...d,
        lesson_title: d.lessons?.title,
        lesson_number: d.lessons?.lesson_number,
        subject: d.lessons?.subject
      }));
    } else {
      const grades = getLocal('local_grades', []) as Grade[];
      const lessons = getLocal('local_lessons', []) as Lesson[];
      return grades
        .map(g => {
          const l = lessons.find(les => les.id === g.lesson_id);
          return {
            ...g,
            lesson_title: l?.title,
            lesson_number: l?.lesson_number,
            subject: l?.subject
          };
        })
        .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime());
    }
  },

  // 5. Messages: Get messages
  async getMessages(): Promise<Message[]> {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      return data || [];
    } else {
      return getLocal('local_messages', []) as Message[];
    }
  },

  // Messages: Send
  async sendMessage(sender: string, message: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('messages').insert({ sender, message });
      return !error;
    } else {
      const messages = getLocal('local_messages', []) as Message[];
      messages.push({
        id: Date.now(),
        sender,
        message,
        created_at: new Date().toISOString()
      });
      setLocal('local_messages', messages);
      return true;
    }
  },

  // Delete subject (Syllabus and its lessons)
  async deleteSubject(subject: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error: lessonErr } = await supabase.from('lessons').delete().eq('subject', subject);
      const { error: syllabusErr } = await supabase.from('syllabus').delete().eq('subject', subject);
      return !lessonErr && !syllabusErr;
    } else {
      const syllabusList = getLocal('local_syllabus', []) as Syllabus[];
      const lessonsList = getLocal('local_lessons', []) as Lesson[];
      setLocal('local_syllabus', syllabusList.filter(s => s.subject !== subject));
      setLocal('local_lessons', lessonsList.filter(l => l.subject !== subject));
      return true;
    }
  },

  // Delete specific lesson
  async deleteLesson(subject: string, lessonNumber: number): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('lessons').delete().eq('subject', subject).eq('lesson_number', lessonNumber);
      return !error;
    } else {
      const lessonsList = getLocal('local_lessons', []) as Lesson[];
      setLocal('local_lessons', lessonsList.filter(l => !(l.subject === subject && l.lesson_number === lessonNumber)));
      return true;
    }
  }
};
