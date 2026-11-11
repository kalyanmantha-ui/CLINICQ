import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, loadSession, saveSession, type Session } from './api';

interface AuthCtx {
  session: Session | null;
  login: (email: string, password: string) => Promise<Session>;
  register: (email: string, password: string, fullName: string) => Promise<Session>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

const RENEW_WHEN_LEFT_MS = 5 * 60_000;   // renew once under 5 minutes remain...
const ACTIVE_WITHIN_MS = 10 * 60_000;     // ...but only if the person touched the page recently

function expiresAt(token: string): number {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch { return 0; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession());
  const set = (s: Session | null) => { saveSession(s); setSession(s); };
  const lastActive = useRef(Date.now());
  const renewing = useRef(false);

  // Keep the session alive while the person is actually using the app. Background polling doesn't count as activity.
  useEffect(() => {
    const mark = () => { lastActive.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);
  useEffect(() => {
    if (!session) return;
    const tick = async () => {
      const s = loadSession();
      if (!s || renewing.current) return;
      const left = expiresAt(s.token) - Date.now();
      if (left > RENEW_WHEN_LEFT_MS || Date.now() - lastActive.current > ACTIVE_WITHIN_MS) return;
      renewing.current = true;
      try { set(await api.refresh()); } catch { /* a 401 already sent us to sign-in; network blips retry next tick */ } finally { renewing.current = false; }
    };
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);
  const value: AuthCtx = {
    session,
    login: async (e, p) => { const s = await api.login(e, p); set(s); return s; },
    register: async (e, p, n) => { const s = await api.register(e, p, n); set(s); return s; },
    logout: () => set(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};
