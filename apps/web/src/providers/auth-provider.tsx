'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useSupabase } from './supabase-provider';
import type { Profile } from '@golf/core';

interface AuthContext {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Context = createContext<AuthContext>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!cancelled) setProfile(data);
    }

    async function handleSession(session: { user: User } | null) {
      if (cancelled || initialized) return;
      initialized = true;
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      }
      if (!cancelled) setLoading(false);
    }

    // Explicit initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Also listen for auth state changes — INITIAL_SESSION acts as a fallback
    // in case getSession() misses the cookie-based session (e.g. after redirects)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === 'INITIAL_SESSION') {
        // Fallback: if getSession() already resolved, skip; otherwise use this
        handleSession(session);
        return;
      }
      // Subsequent events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
      initialized = true; // Prevent late INITIAL_SESSION from overriding
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return (
    <Context.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  return useContext(Context);
}
