import { createContext, useContext, useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { GoogleAuthStatus, SessionPayload, SessionUser } from '../types';

interface SessionContextValue {
  loading: boolean;
  user: SessionUser | null;
  authenticated: boolean;
  registrationEnabled: boolean;
  googleAuthEnabled: boolean;
  googleAuthStatus: GoogleAuthStatus;
  csrfToken: string;
  error: string;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppSessionContext = createContext<SessionContextValue | null>(null);

const defaultSession: SessionPayload = {
  authenticated: false,
  user: null,
  registrationEnabled: false,
  googleAuthEnabled: false,
  googleAuthStatus: 'missing_credentials',
  csrfToken: '',
};

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionPayload>(defaultSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshSession = async () => {
    try {
      const payload = await api.fetchSession();
      setSession(payload);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load session.';
      setSession(defaultSession);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const ensureCsrfToken = async () => {
    if (session.csrfToken) {
      return session.csrfToken;
    }

    const payload = await api.fetchSession();
    setSession(payload);
    return payload.csrfToken;
  };

  const login = async (email: string, password: string) => {
    const csrfToken = await ensureCsrfToken();
    const payload = await api.login(email, password, csrfToken);
    setSession(payload);
    setError('');
  };

  const register = async (name: string, email: string, password: string) => {
    const csrfToken = await ensureCsrfToken();
    const payload = await api.register(name, email, password, csrfToken);
    setSession(payload);
    setError('');
  };

  const logout = async () => {
    const csrfToken = await ensureCsrfToken();
    await api.logout(csrfToken);
    const payload = await api.fetchSession();
    setSession(payload);
    setError('');
  };

  return (
    <AppSessionContext.Provider
      value={{
        loading,
        user: session.user,
        authenticated: session.authenticated,
        registrationEnabled: session.registrationEnabled,
        googleAuthEnabled: session.googleAuthEnabled,
        googleAuthStatus: session.googleAuthStatus,
        csrfToken: session.csrfToken,
        error,
        refreshSession,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const context = useContext(AppSessionContext);

  if (!context) {
    throw new Error('useAppSession must be used inside AppSessionProvider.');
  }

  return context;
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected request failure.';
}

export function getFieldError(error: unknown, fieldName: string) {
  if (error instanceof ApiError) {
    return error.fieldErrors[fieldName]?.[0] || '';
  }

  return '';
}
