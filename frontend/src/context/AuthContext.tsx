import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { deriveUserName } from '../lib/formatters';
import { verifyAdminAccess } from '../services/authService';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  userEmail: string;
  userName: string;
  loading: boolean;
  isAuthorizedAdmin: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  refreshAdminCheck: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState<boolean>(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  const checkAdmin = async (currentSession: Session | null) => {
    if (!currentSession) {
      setIsAuthorizedAdmin(false);
      return;
    }
    const ok = await verifyAdminAccess();
    setIsAuthorizedAdmin(ok);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await checkAdmin(data.session);
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(nextSession);
      await checkAdmin(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const userEmail = user?.email ?? '';
  const userName = deriveUserName(userEmail);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userEmail,
        userName,
        loading,
        isAuthorizedAdmin,
        isPasswordRecovery,
        clearPasswordRecovery: () => setIsPasswordRecovery(false),
        refreshAdminCheck: () => checkAdmin(session),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

