import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
}

interface AuthContextValue extends AuthState {
  signUp: (username: string, password: string) => Promise<string | null>;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

function usernameToEmail(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, '-') + '@pokemartin.local';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    displayName: '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(s => ({ ...s, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        loadDisplayName(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(s => ({ ...s, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        loadDisplayName(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadDisplayName(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();
    if (data) {
      setState(s => ({ ...s, displayName: data.display_name }));
    }
  }

  const signUp = async (username: string, password: string): Promise<string | null> => {
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: username } },
    });
    if (error?.message?.includes('already registered')) {
      return 'Ce nom de dresseur est deja pris';
    }
    return error?.message ?? null;
  };

  const signIn = async (username: string, password: string): Promise<string | null> => {
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.message?.includes('Invalid login')) {
      return 'Nom de dresseur ou mot de passe incorrect';
    }
    return error?.message ?? null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false, displayName: '' });
  };

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
