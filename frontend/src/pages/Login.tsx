import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { getApiErrorMessage, useAppSession } from '../context/AppSessionContext';

const googleStatusMessages: Record<string, string> = {
  authlib_missing: 'Google sign-in package is unavailable on this deployment. Render is not loading Authlib correctly.',
  missing_credentials: 'Google sign-in is not active on this deployment yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render, then redeploy.',
  missing_client_id: 'Google sign-in is missing GOOGLE_CLIENT_ID in Render.',
  missing_client_secret: 'Google sign-in is missing GOOGLE_CLIENT_SECRET in Render.',
  oauth_client_unavailable: 'Google sign-in credentials exist but the OAuth client did not initialize. A fresh deploy usually fixes this.',
};

const oauthErrors: Record<string, string> = {
  google_failed: 'Google sign-in failed. Please try again.',
  google_registration_closed: 'Google sign-in is limited to existing accounts while public registration is disabled.',
  google_unavailable: 'Google sign-in is not configured yet.',
  google_unverified: 'Your Google account email must be verified before you can sign in.',
};

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authenticated, googleAuthEnabled, googleAuthStatus, loading, login, registrationEnabled } = useAppSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')) || '/', [searchParams]);
  const oauthError = searchParams.get('oauth_error');

  useEffect(() => {
    if (!loading && authenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [authenticated, loading, navigate, nextPath]);

  useEffect(() => {
    if (!oauthError) {
      return;
    }
    setError(oauthErrors[oauthError] || 'Google sign-in failed. Please try again.');
  }, [oauthError]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(email, password);
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const googleHref = nextPath && nextPath !== '/'
    ? `/auth/google/start?next=${encodeURIComponent(nextPath)}`
    : '/auth/google/start';

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
        <h1 className="font-headline text-4xl md:text-5xl italic text-glow text-primary mb-4">Enter the Void</h1>
        <p className="font-body text-on-surface-variant font-light">Log in with your existing Flask account. Admin credentials and user sessions stay on the current backend.</p>
      </motion.div>
      <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} onSubmit={handleSubmit} className="space-y-6 bg-surface-container-low/30 backdrop-blur-sm p-8 border border-primary/20 rounded-sm">
        {error && <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-sm">{error}</div>}
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="you@example.com" />
        </div>
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Password</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Your password" />
        </div>
        <button type="submit" disabled={submitting} className="w-full mt-8 py-4 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-sm uppercase tracking-[0.2em] rounded-md transition-all duration-500 shadow-[inset_0_0_12px_rgba(216,196,145,0.1)] hover:shadow-[inset_0_0_20px_rgba(216,196,145,0.3)] border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Opening...' : 'Let Me In'}</button>
        {googleAuthEnabled ? (
          <a href={googleHref} className="w-full flex items-center justify-center gap-3 py-4 border border-secondary/25 bg-surface-container-low/50 text-secondary rounded-md font-label text-sm uppercase tracking-[0.18em] hover:border-primary/35 hover:text-primary transition-all duration-300">
            <span className="material-symbols-outlined text-lg">account_circle</span>
            Continue with Google
          </a>
        ) : (
          <p className="text-center font-body text-xs text-on-surface-variant">{googleStatusMessages[googleAuthStatus] || 'Google sign-in is not active on this deployment yet.'}</p>
        )}
        {registrationEnabled && <p className="text-center font-label text-[10px] uppercase tracking-[0.3em] text-on-surface-variant"><Link to="/register" className="hover:text-primary transition-colors">Open the registration page</Link></p>}
      </motion.form>
    </div>
  );
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}
