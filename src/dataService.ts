import { supabase, isSupabaseConfigured } from './supabaseClient'
import { UserProfile } from './types/auth'

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
  mindmap?: string;
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

export interface StudentPet {
  id?: number;
  student_username: string;
  pet_name: string;
  current_level: number;
  current_exp: number;
  current_hp: number;
  coins: number;
  equipped_hat?: string | null;
  equipped_accessory?: string | null;
  has_renamed?: boolean;
  last_decay_at?: string;
  created_at?: string;
}

export interface PetEvent {
  id?: number;
  student_username: string;
  title: string;
  reward_coins: number;
  reward_exp: number;
  is_completed: boolean;
  reported?: boolean;
  created_at?: string;
}

export interface CreativeDrawing {
  id?: string;
  student_username: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  image_webp_url?: string;
  is_exhibited?: boolean;
  visibility?: 'public' | 'private' | 'archived';
  likes_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreativeAiComment {
  id?: string;
  drawing_id: string;
  persona_id: string;
  persona_name: string;
  persona_avatar?: string;
  content: string;
  scheduled_at: string;
  is_published: boolean;
  created_at?: string;
}

export interface CreativeCanvasSnapshot {
  drawing_id: string;
  canvas_json: any;
  updated_at?: string;
}

export interface CreativeAiAnalysis {
  drawing_id: string;
  creativity_score: number;
  dominant_emotion: string;
  detected_objects: string[];
  theme_category: string;
  color_palette: string[];
  story_seed: string;
  created_at?: string;
}

export interface CreativeAiPersonaPreference {
  persona_id: string;
  persona_name: string;
  favorite_themes: string[];
  favorite_colors: string[];
  like_probability: number;
  comment_probability: number;
  online_schedule: string;
}

export interface CreativeSocialQueue {
  id?: string;
  drawing_id: string;
  persona_id: string;
  action_type: 'like' | 'comment' | 'bookmark';
  comment_content?: string;
  scheduled_at: string;
  status: 'pending' | 'published' | 'failed';
  created_at?: string;
}

export interface CreativeDailyReward {
  id?: string;
  student_username: string;
  reward_date?: string;
  earned_exp?: number;
  created_at?: string;
}

export interface CreativeComment {
  id?: string;
  drawing_id: string;
  username: string;
  content: string;
  created_at?: string;
}

export interface CreativeLike {
  id?: string;
  drawing_id: string;
  username: string;
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

export const dataService = {
  // 1. Auth helpers
  async getCurrentProfile(): Promise<UserProfile | null> {
    // 1.1. Ưu tiên kiểm tra Mock Session để hỗ trợ đăng nhập song song
    const savedMockProfile = localStorage.getItem('family_learning_mock_profile')
    if (savedMockProfile && savedMockProfile !== 'undefined') {
      try {
        return JSON.parse(savedMockProfile)
      } catch {
        localStorage.removeItem('family_learning_mock_profile')
      }
    }

    // 1.2. Nếu có cấu hình Supabase, truy vấn theo Supabase Auth
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return null
        const { data, error } = await supabase
          .from('users')
          .select('id, username, role, auth_user_id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle()
        if (error) return null
        return data as UserProfile | null
      } catch {
        return null
      }
    }
    return null
  },

  async isAuthenticated(): Promise<boolean> {
    const savedMockProfile = localStorage.getItem('family_learning_mock_profile')
    if (savedMockProfile && savedMockProfile !== 'undefined') {
      return true
    }
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        return !!session?.user
      } catch {
        return false
      }
    }
    return false
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
      const { data } = await supabase.from('syllabus').select('subject, content, textbook_content, pdf_file_path, total_lessons').eq('subject', subject).single();
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
        .select('id, subject, lesson_number, title, lecture_content, questions, duration, flashcards, is_published, parent_feedback, infographic_url, infographic_prompt, infographic_content, mindmap')
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
        .select('id, student_username, lesson_id, answers, score, ai_feedback, submitted_at, lessons(title, lesson_number, subject)')
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
        .select('id, student_username, lesson_id, answers, score, ai_feedback, submitted_at, lessons(title, lesson_number, subject)')
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
        .select('id, sender, message, created_at')
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
  },

  // Delete specific grade submission
  async deleteGrade(gradeId: number): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('grades').delete().eq('id', gradeId);
      return !error;
    } else {
      const grades = getLocal('local_grades', []) as Grade[];
      setLocal('local_grades', grades.filter(g => g.id !== gradeId));
      return true;
    }
  },

  // Save API keys for a user (sync to Supabase if configured, else fallback to localUsers)
  async saveUserApiKeys(usernameOrId: string, apiKeys: string[]): Promise<boolean> {
    const sessionMock = localStorage.getItem('family_learning_mock_user')
    const token = sessionMock ? 'mock-parent-id' : (await supabase.auth.getSession()).data.session?.access_token;
    
    if (token) {
      try {
        const response = await fetch('/api/manage-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ apiKeys })
        });
        return response.ok;
      } catch (err) {
        console.error("Error saving API keys via API:", err);
        return false;
      }
    } else {
      const users = getLocal('local_users', []);
      const index = users.findIndex((u: any) => u.username === usernameOrId || u.auth_user_id === usernameOrId);
      if (index !== -1) {
        users[index].api_keys = JSON.stringify(apiKeys);
        setLocal('local_users', users);
        return true;
      }
      return false;
    }
  },

  // Get API keys for a user
  async getUserApiKeys(usernameOrId: string): Promise<string[]> {
    const sessionMock = localStorage.getItem('family_learning_mock_user')
    const token = sessionMock ? 'mock-parent-id' : (await supabase.auth.getSession()).data.session?.access_token;
    
    if (token) {
      try {
        const response = await fetch('/api/manage-keys', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const resData = await response.json();
          return resData.apiKeys || [];
        }
        return [];
      } catch (err) {
        console.error("Error getting API keys via API:", err);
        return [];
      }
    } else {
      const users = getLocal('local_users', []);
      const found = users.find((u: any) => u.username === usernameOrId || u.auth_user_id === usernameOrId);
      if (found && found.api_keys) {
        try {
          return JSON.parse(found.api_keys);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  async getStudentPet(username: string): Promise<StudentPet> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('studentpets')
          .select('*')
          .eq('student_username', username)
          .maybeSingle();
        if (data) {
          if (data.current_level === 0 && data.current_exp === 0 && data.coins === 0) {
            const updated = await supabase
              .from('studentpets')
              .update({ current_exp: 10, coins: 10 })
              .eq('student_username', username)
              .select()
              .single();
            if (updated.data) return updated.data as StudentPet;
          }
          return data as StudentPet;
        }
        
        // If not exists, insert default
        const defaultPet: StudentPet = {
          student_username: username,
          pet_name: 'Hamster',
          current_level: 0,
          current_exp: 10,
          current_hp: 100,
          coins: 10,
          has_renamed: false
        };
        const { data: inserted, error: insertError } = await supabase
          .from('studentpets')
          .insert(defaultPet)
          .select()
          .single();
        if (inserted) return inserted as StudentPet;
        return defaultPet;
      } catch (err) {
        console.error("Error in getStudentPet:", err);
      }
    }

    // LocalStorage Fallback
    const pets = getLocal('local_student_pets', []);
    let found = pets.find((p: any) => p.student_username === username);
    if (!found) {
      found = {
        id: Math.floor(Math.random() * 1000000),
        student_username: username,
        pet_name: 'Hamster',
        current_level: 0,
        current_exp: 10,
        current_hp: 100,
        coins: 10,
        equipped_hat: null,
        equipped_accessory: null,
        has_renamed: false
      };
      pets.push(found);
      setLocal('local_student_pets', pets);
    } else {
      if (found.current_level === 0 && found.current_exp === 0 && found.coins === 0) {
        found.current_exp = 10;
        found.coins = 10;
        found.has_renamed = false;
        setLocal('local_student_pets', pets);
      }
      if (found.has_renamed === undefined) {
        found.has_renamed = false;
        setLocal('local_student_pets', pets);
      }
    }
    return found as StudentPet;
  },

  async updateStudentPet(username: string, updates: Partial<StudentPet>): Promise<StudentPet> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('studentpets')
          .update(updates)
          .eq('student_username', username)
          .select()
          .single();
        if (data) return data as StudentPet;
      } catch (err) {
        console.error("Error in updateStudentPet:", err);
      }
    }

    // LocalStorage Fallback
    const pets = getLocal('local_student_pets', []);
    const idx = pets.findIndex((p: any) => p.student_username === username);
    if (idx !== -1) {
      pets[idx] = { ...pets[idx], ...updates };
      setLocal('local_student_pets', pets);
      return pets[idx] as StudentPet;
    }
    const newPet = {
      id: Math.floor(Math.random() * 1000000),
      student_username: username,
      pet_name: 'Hamster',
      current_level: 0,
      current_exp: 0,
      current_hp: 100,
      coins: 0,
      ...updates
    };
    pets.push(newPet);
    setLocal('local_student_pets', pets);
    return newPet as StudentPet;
  },

  async getPetEvents(username: string): Promise<PetEvent[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('petevents')
          .select('*')
          .eq('student_username', username)
          .order('id', { ascending: false });
        if (data) return data as PetEvent[];
      } catch (err) {
        console.error("Error in getPetEvents:", err);
      }
    }

    // LocalStorage Fallback
    const events = getLocal('local_pet_events', []);
    return events.filter((e: any) => e.student_username === username) as PetEvent[];
  },

  async createPetEvent(event: Partial<PetEvent>): Promise<PetEvent> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('petevents')
          .insert(event)
          .select()
          .single();
        if (data) return data as PetEvent;
      } catch (err) {
        console.error("Error in createPetEvent:", err);
      }
    }

    // LocalStorage Fallback
    const events = getLocal('local_pet_events', []);
    const newEvent = {
      id: Math.floor(Math.random() * 1000000),
      student_username: event.student_username!,
      title: event.title!,
      reward_coins: event.reward_coins || 0,
      reward_exp: event.reward_exp || 0,
      is_completed: false,
      reported: false,
      created_at: new Date().toISOString()
    };
    events.unshift(newEvent);
    setLocal('local_pet_events', events);
    return newEvent as PetEvent;
  },

  async completePetEvent(eventId: number): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('petevents')
          .update({ is_completed: true, reported: true }) // approved means also reported
          .eq('id', eventId);
        return;
      } catch (err) {
        console.error("Error in completePetEvent:", err);
      }
    }

    // LocalStorage Fallback
    const events = getLocal('local_pet_events', []);
    const idx = events.findIndex((e: any) => e.id === eventId);
    if (idx !== -1) {
      events[idx].is_completed = true;
      events[idx].reported = true;
      setLocal('local_pet_events', events);
    }
  },

  async reportPetEvent(eventId: number): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('petevents')
          .update({ reported: true })
          .eq('id', eventId);
        return;
      } catch (err) {
        console.error("Error in reportPetEvent:", err);
      }
    }

    // LocalStorage Fallback
    const events = getLocal('local_pet_events', []);
    const idx = events.findIndex((e: any) => e.id === eventId);
    if (idx !== -1) {
      events[idx].reported = true;
      setLocal('local_pet_events', events);
    }
  },

  async deletePetEvent(eventId: number): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('petevents')
          .delete()
          .eq('id', eventId);
        return;
      } catch (err) {
        console.error("Error in deletePetEvent:", err);
      }
    }

    const events = getLocal('local_pet_events', []);
    const filtered = events.filter((e: any) => e.id !== eventId);
    setLocal('local_pet_events', filtered);
  },

  // ==========================================
  // CREATIVE CORNER (GÓC SÁNG TẠO) SERVICES
  // ==========================================

  async saveCreativeDrawing(drawing: Partial<CreativeDrawing>, canvasJson: any): Promise<CreativeDrawing> {
    const defaultDrawing = {
      title: drawing.title || 'Bức vẽ không tên',
      description: drawing.description || '',
      thumbnail_url: drawing.thumbnail_url || '',
      image_webp_url: drawing.image_webp_url || '',
      is_exhibited: drawing.is_exhibited || false,
      visibility: drawing.visibility || 'private'
    }

    if (isSupabaseConfigured) {
      try {
        let drawingRecord: CreativeDrawing
        if (drawing.id) {
          // Update
          const { data, error } = await supabase
            .from('creative_drawings')
            .update({
              ...defaultDrawing,
              updated_at: new Date().toISOString()
            })
            .eq('id', drawing.id)
            .select()
            .single()
          if (error) throw error
          drawingRecord = data as CreativeDrawing
        } else {
          // Insert
          const { data, error } = await supabase
            .from('creative_drawings')
            .insert({
              ...defaultDrawing,
              student_username: drawing.student_username || 'hocsinh'
            })
            .select()
            .single()
          if (error) throw error
          drawingRecord = data as CreativeDrawing
        }

        // Save heavy canvas json to creative_canvas_snapshots
        await supabase
          .from('creative_canvas_snapshots')
          .upsert({
            drawing_id: drawingRecord.id,
            canvas_json: canvasJson,
            updated_at: new Date().toISOString()
          })

        return drawingRecord
      } catch (err) {
        console.error("Error in saveCreativeDrawing:", err)
      }
    }

    // LocalStorage Fallback
    const drawings = getLocal('local_creative_drawings', [])
    const snapshots = getLocal('local_creative_snapshots', {})
    
    let drawingRecord: CreativeDrawing
    if (drawing.id) {
      const idx = drawings.findIndex((d: any) => d.id === drawing.id)
      if (idx !== -1) {
        drawings[idx] = {
          ...drawings[idx],
          ...defaultDrawing,
          updated_at: new Date().toISOString()
        }
        drawingRecord = drawings[idx]
      } else {
        throw new Error("Drawing not found")
      }
    } else {
      drawingRecord = {
        id: Math.random().toString(36).substring(2, 9),
        student_username: drawing.student_username || 'hocsinh',
        ...defaultDrawing,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      drawings.unshift(drawingRecord)
    }

    snapshots[drawingRecord.id!] = canvasJson
    setLocal('local_creative_drawings', drawings)
    setLocal('local_creative_snapshots', snapshots)
    return drawingRecord
  },

  async getCreativeDrawings(username: string): Promise<CreativeDrawing[]> {
    if (isSupabaseConfigured) {
      try {
        const { data: drawings, error } = await supabase
          .from('creative_drawings')
          .select('*')
          .eq('student_username', username)
          .order('created_at', { ascending: false })
        if (error) throw error

        const nowIso = new Date().toISOString()
        const { data: humanLikes } = await supabase.from('creative_likes').select('drawing_id')
        const { data: aiLikes } = await supabase
          .from('creative_social_queue')
          .select('drawing_id')
          .eq('action_type', 'like')
          .lte('scheduled_at', nowIso)

        const finalDrawings = (drawings || []).map((d: any) => {
          const hCount = (humanLikes || []).filter((l: any) => l.drawing_id === d.id).length
          const aCount = (aiLikes || []).filter((l: any) => l.drawing_id === d.id).length
          return {
            ...d,
            likes_count: hCount + aCount
          }
        })
        return finalDrawings
      } catch (err) {
        console.error("Error in getCreativeDrawings:", err)
      }
    }

    const drawings = getLocal('local_creative_drawings', [])
    return drawings.filter((d: any) => d.student_username === username)
  },

  async getDrawingCanvasSnapshot(drawingId: string): Promise<any> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('creative_canvas_snapshots')
          .select('canvas_json')
          .eq('drawing_id', drawingId)
          .maybeSingle()
        if (error) throw error
        return data?.canvas_json || null
      } catch (err) {
        console.error("Error in getDrawingCanvasSnapshot:", err)
      }
    }

    const snapshots = getLocal('local_creative_snapshots', {})
    return snapshots[drawingId] || null
  },

  async getExhibitionDrawings(): Promise<CreativeDrawing[]> {
    if (isSupabaseConfigured) {
      try {
        const { data: drawings, error } = await supabase
          .from('creative_drawings')
          .select('*')
          .eq('is_exhibited', true)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
        if (error) throw error

        const nowIso = new Date().toISOString()
        const { data: humanLikes } = await supabase.from('creative_likes').select('drawing_id')
        const { data: aiLikes } = await supabase
          .from('creative_social_queue')
          .select('drawing_id')
          .eq('action_type', 'like')
          .lte('scheduled_at', nowIso)

        const finalDrawings = (drawings || []).map((d: any) => {
          const hCount = (humanLikes || []).filter((l: any) => l.drawing_id === d.id).length
          const aCount = (aiLikes || []).filter((l: any) => l.drawing_id === d.id).length
          return {
            ...d,
            likes_count: hCount + aCount
          }
        })
        return finalDrawings
      } catch (err) {
        console.error("Error in getExhibitionDrawings:", err)
      }
    }

    const drawings = getLocal('local_creative_drawings', [])
    return drawings.filter((d: any) => d.is_exhibited && d.visibility === 'public')
  },

  async hangDrawingOnExhibition(drawingId: string, username: string, imageUrl: string): Promise<{ claimed: boolean; expEarned: number }> {
    // 1. Treo tranh (is_exhibited = true, visibility = public)
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('creative_drawings')
          .update({ is_exhibited: true, visibility: 'public' })
          .eq('id', drawingId)
      } catch (err) {
        console.error("Error in hangDrawingOnExhibition:", err)
      }
    } else {
      const drawings = getLocal('local_creative_drawings', [])
      const idx = drawings.findIndex((d: any) => d.id === drawingId)
      if (idx !== -1) {
        drawings[idx].is_exhibited = true
        drawings[idx].visibility = 'public'
        setLocal('local_creative_drawings', drawings)
      }
    }

    // 2. Nhận thưởng EXP ngày (tối đa 5 EXP)
    const rewardStatus = await this.checkAndClaimDailyReward(username)

    // 3. Gọi xử lý AI ngầm qua background job / Edge Function
    if (isSupabaseConfigured) {
      fetch('/api/analyze-drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingId, imageUrl, studentUsername: username })
      }).catch(err => console.error("Error trigger AI analysis:", err))
    } else {
      // Mock Local AI Social engine
      this.mockLocalAiSocialQueue(drawingId, username)
    }

    return rewardStatus
  },

  async checkAndClaimDailyReward(username: string): Promise<{ claimed: boolean; expEarned: number }> {
    const todayStr = new Date().toISOString().split('T')[0]

    if (isSupabaseConfigured) {
      try {
        // Check if already claimed today
        const { data: existing } = await supabase
          .from('creative_daily_rewards')
          .select('id')
          .eq('student_username', username)
          .eq('reward_date', todayStr)
          .maybeSingle()

        if (existing) {
          return { claimed: false, expEarned: 0 }
        }

        // Claim
        await supabase
          .from('creative_daily_rewards')
          .insert({
            student_username: username,
            reward_date: todayStr,
            earned_exp: 5
          })

        // Add 5 EXP to student pet
        const pet = await this.getStudentPet(username)
        if (pet) {
          let nextExp = pet.current_exp + 5
          let nextLevel = pet.current_level
          const expNeeded = (nextLevel * 200) + 100
          if (nextExp >= expNeeded && nextLevel < 10) {
            nextExp -= expNeeded
            nextLevel += 1
          }
          await this.updateStudentPet(username, {
            current_exp: nextExp,
            current_level: nextLevel
          })
        }

        return { claimed: true, expEarned: 5 }
      } catch (err) {
        console.error("Error in checkAndClaimDailyReward:", err)
      }
    }

    // LocalStorage Fallback
    const rewards = getLocal('local_creative_rewards', [])
    const key = `${username}_${todayStr}`
    const claimed = rewards.includes(key)
    if (claimed) {
      return { claimed: false, expEarned: 0 }
    }

    rewards.push(key)
    setLocal('local_creative_rewards', rewards)

    // Add 5 EXP to local pet
    const pets = getLocal('local_student_pets', {})
    const pet = pets[username]
    if (pet) {
      let nextExp = pet.current_exp + 5
      let nextLevel = pet.current_level
      const expNeeded = (nextLevel * 200) + 100
      if (nextExp >= expNeeded && nextLevel < 10) {
        nextExp -= expNeeded
        nextLevel += 1
      }
      pet.current_exp = nextExp
      pet.current_level = nextLevel
      setLocal('local_student_pets', pets)
    }

    return { claimed: true, expEarned: 5 }
  },

  async likeCreativeDrawing(drawingId: string, username: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('creative_likes')
          .insert({ drawing_id: drawingId, username })
        if (error) throw error

        // Increment likes count in drawing metadata
        const { data: drawing } = await supabase
          .from('creative_drawings')
          .select('likes_count')
          .eq('id', drawingId)
          .single()

        await supabase
          .from('creative_drawings')
          .update({ likes_count: (drawing?.likes_count || 0) + 1 })
          .eq('id', drawingId)

        return
      } catch (err) {
        console.error("Error in likeCreativeDrawing:", err)
      }
    }

    // LocalStorage Fallback
    const likes = getLocal('local_creative_likes', [])
    const key = `${drawingId}_${username}`
    if (!likes.includes(key)) {
      likes.push(key)
      setLocal('local_creative_likes', likes)

      const drawings = getLocal('local_creative_drawings', [])
      const idx = drawings.findIndex((d: any) => d.id === drawingId)
      if (idx !== -1) {
        drawings[idx].likes_count = (drawings[idx].likes_count || 0) + 1
        setLocal('local_creative_drawings', drawings)
      }
    }
  },

  async getDrawingComments(drawingId: string): Promise<{ comments: CreativeComment[]; aiComments: CreativeAiComment[] }> {
    if (isSupabaseConfigured) {
      try {
        // User comments
        const { data: comments } = await supabase
          .from('creative_comments')
          .select('*')
          .eq('drawing_id', drawingId)
          .order('created_at', { ascending: true })

        // AI comments which have reached their scheduled time
        const nowIso = new Date().toISOString()
        const { data: aiComments } = await supabase
          .from('creative_social_queue')
          .select('*')
          .eq('drawing_id', drawingId)
          .eq('action_type', 'comment')
          .lte('scheduled_at', nowIso)

        const mappedAiComments = (aiComments || []).map(item => ({
          id: item.id,
          drawing_id: item.drawing_id,
          persona_id: item.persona_id,
          persona_name: item.persona_id === 'be_na' ? 'Bé Na 🌸' :
                        item.persona_id === 'minh_anh' ? 'Minh Anh 🚀' :
                        item.persona_id === 'nam_khanh' ? 'Nam Khánh 🦖' :
                        item.persona_id === 'soc_sac_mau' ? 'Họa sĩ nhí Sóc 🎨' :
                        item.persona_id === 'art_teacher_lam' ? 'Thầy giáo Lâm 👨‍🏫' :
                        item.persona_id === 'robot_r3' ? 'Robot R-3 🤖' :
                        item.persona_id === 'storyteller_rabbit' ? 'Thỏ Kể Chuyện 🐰' : 'Cáo Thám Hiểm 🦊',
          persona_avatar: '',
          content: item.comment_content,
          scheduled_at: item.scheduled_at,
          is_published: true,
          created_at: item.created_at
        }))

        return {
          comments: (comments || []) as CreativeComment[],
          aiComments: mappedAiComments as any[]
        }
      } catch (err) {
        console.error("Error in getDrawingComments:", err)
      }
    }

    // LocalStorage Fallback
    const comments = getLocal('local_creative_comments', [])
    const aiComments = getLocal('local_creative_ai_comments', [])
    const drawingComments = comments.filter((c: any) => c.drawing_id === drawingId)
    
    // Filter scheduled AI comments in mock mode too
    const now = Date.now()
    const drawingAiComments = aiComments
      .filter((c: any) => c.drawing_id === drawingId && new Date(c.scheduled_at).getTime() <= now)

    return {
      comments: drawingComments,
      aiComments: drawingAiComments
    }
  },

  async addDrawingComment(drawingId: string, username: string, content: string): Promise<CreativeComment> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('creative_comments')
          .insert({ drawing_id: drawingId, username, content })
          .select()
          .single()
        if (error) throw error
        return data as CreativeComment
      } catch (err) {
        console.error("Error in addDrawingComment:", err)
      }
    }

    // LocalStorage Fallback
    const comments = getLocal('local_creative_comments', [])
    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      drawing_id: drawingId,
      username,
      content,
      created_at: new Date().toISOString()
    }
    comments.push(newComment)
    setLocal('local_creative_comments', comments)
    return newComment
  },

  async updateDrawingVisibility(drawingId: string, visibility: 'public' | 'private' | 'archived'): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('creative_drawings')
          .update({ visibility })
          .eq('id', drawingId)
        return
      } catch (err) {
        console.error("Error in updateDrawingVisibility:", err)
      }
    }

    const drawings = getLocal('local_creative_drawings', [])
    const idx = drawings.findIndex((d: any) => d.id === drawingId)
    if (idx !== -1) {
      drawings[idx].visibility = visibility
      setLocal('local_creative_drawings', drawings)
    }
  },

  async getStudentDrawingsForParent(studentUsername: string): Promise<CreativeDrawing[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('creative_drawings')
          .select('*')
          .eq('student_username', studentUsername)
          .order('created_at', { ascending: false })
        if (error) throw error
        return data as CreativeDrawing[]
      } catch (err) {
        console.error("Error in getStudentDrawingsForParent:", err)
      }
    }

    const drawings = getLocal('local_creative_drawings', [])
    return drawings.filter((d: any) => d.student_username === studentUsername)
  },

  // Mocking AI comments & likes in offline mode
  mockLocalAiSocialQueue(drawingId: string, username: string) {
    const aiComments = getLocal('local_creative_ai_comments', [])
    const drawings = getLocal('local_creative_drawings', [])
    const idx = drawings.findIndex((d: any) => d.id === drawingId)

    const mockComments = [
      { name: 'Bé Na 🌸', text: 'Bức tranh của bạn vẽ nhiều màu sắc đáng yêu quá đi!' },
      { name: 'Thầy giáo Lâm 👨‍🏫', text: 'Nét vẽ phóng khoáng, phối màu có sự tương phản tốt. Thầy rất thích sự sáng tạo này!' },
      { name: 'Minh Anh 🚀', text: 'Đẹp tuyệt vời! Nhìn bức tranh giống như một chuyến phiêu lưu vũ trụ ấy!' },
      { name: 'Họa sĩ nhí Sóc 🎨', text: 'Bạn tô màu khéo ghê, tớ thích nhất những chi tiết nhỏ ở góc tranh đó.' }
    ]

    const now = Date.now()
    const delays = [2000, 15000, 45000, 120000] // delays in ms

    mockComments.forEach((mc, index) => {
      const scheduledTime = new Date(now + delays[index]).toISOString()
      aiComments.push({
        id: Math.random().toString(36).substring(2, 9),
        drawing_id: drawingId,
        persona_id: `mock_persona_${index}`,
        persona_name: mc.name,
        persona_avatar: '',
        content: mc.text,
        scheduled_at: scheduledTime,
        is_published: true,
        created_at: new Date().toISOString()
      })
    })

    setLocal('local_creative_ai_comments', aiComments)

    // Mock Likes over time
    if (idx !== -1) {
      setTimeout(() => {
        const list = getLocal('local_creative_drawings', [])
        const match = list.find((d: any) => d.id === drawingId)
        if (match) {
          match.likes_count = (match.likes_count || 0) + 12 // Add 12 mock likes
          setLocal('local_creative_drawings', list)
        }
      }, 5000)
    }
  }
};
