import { User as SupabaseUser } from '@supabase/supabase-js'

export type AuthUser = SupabaseUser;

export interface UserProfile {
  id?: string;
  username: string;
  role: 'parent' | 'student';
  auth_user_id?: string;
  created_at?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<{ error: Error | null }>;
}
