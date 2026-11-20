import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { deriveUserName } from '../lib/formatters';
import { fetchAdminProfile, updateAdminNickname, verifyAdminAccess } from '../services/authService';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  userEmail: string;
  userName: string;
  nickname: string;
  updateNickname: (newNickname: string) => Promise<void>;
  loading: boolean;
  isAuthorizedAdmin: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  refreshAdminCheck: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [adminChecking, setAdminChecking] = useState<boolean>(false);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState<boolean>(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [customNickname, setCustomNickname] = useState<string | null>(null);

  const loadAdminProfile = useCallback(async () => {
    try {
      const profile = await fetchAdminProfile();
      if (profile && (profile.nickname || profile.display_name)) {
        setCustomNickname(profile.nickname || profile.display_name);
      }
    } catch {
      // Ignore background fetch error
    }
  }, []);

  const runAdminCheck = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setIsAuthorizedAdmin(false);
      setAdminChecking(false);
      setCustomNickname(null);
      return;
    }
    setAdminChecking(true);
    try {
      const ok = await verifyAdminAccess();
      setIsAuthorizedAdmin(ok);
      if (ok) {
        await loadAdminProfile();
      }
    } finally {
      setAdminChecking(false);
    }
  }, [loadAdminProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) setAdminChecking(true);
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      if (nextSession) setAdminChecking(true);
      else {
        setIsAuthorizedAdmin(false);
        setCustomNickname(null);
      }
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || authLoading) return;
    void runAdminCheck(session);
  }, [session, authLoading, runAdminCheck]);

  const user = session?.user ?? null;
  const userEmail = user?.email ?? '';
  const metaName = (user?.user_metadata?.nickname ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    '') as string;
  const effectiveNickname = customNickname || metaName || '';
  const userName = effectiveNickname || deriveUserName(userEmail);

  const handleUpdateNickname = async (newNickname: string) => {
    const saved = await updateAdminNickname(newNickname);
    setCustomNickname(saved || null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userEmail,
        userName,
        nickname: effectiveNickname,
        updateNickname: handleUpdateNickname,
        loading: authLoading || adminChecking,
        isAuthorizedAdmin,
        isPasswordRecovery,
        clearPasswordRecovery: () => setIsPasswordRecovery(false),
        refreshAdminCheck: () => runAdminCheck(session),
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
