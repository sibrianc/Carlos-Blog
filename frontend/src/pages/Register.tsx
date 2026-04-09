import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { getApiErrorMessage, getFieldError, useAppSession } from '../context/AppSessionContext';

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authenticated, googleAuthEnabled, loading, register, registrationEnabled } = useAppSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')) || '/', [searchParams]);
  const googleHref = nextPath && nextPath !== '/'
    ? `/auth/google/start?next=${encodeURIComponent(nextPath)}`
    : '/auth/google/start';

  useEffect(() => {
    if (!loading && authenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [authenticated, loading, navigate, nextPath]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNameError('');
    setEmailError('');
    setPasswordError('');

    try {
      await register(name, email, password);
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setNameError(getFieldError(err, 'name'));
      setEmailError(getFieldError(err, 'email'));
      setPasswordError(getFieldError(err, 'password'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!registrationEnabled) {
    return (
      <div className="container mx-auto px-6 md:px-8 max-w-3xl">
        <div className="bg-surface-container-low/30 backdrop-blur-sm p-8 border border-secondary/20 rounded-sm text-center space-y-6">
          <div>
            <h1 className="font-headline text-4xl italic text-secondary text-glow-secondary mb-4">Registration Sealed</h1>
            <p className="font-body text-on-surface-variant font-light">Public registration is currently disabled.</p>
          </div>
          {googleAuthEnabled ? (
            <a href={googleHref} className="w-full flex items-center justify-center gap-3 py-4 border border-secondary/25 bg-surface-container-low/50 text-secondary rounded-md font-label text-sm uppercase tracking-[0.18em] hover:border-primary/35 hover:text-primary transition-all duration-300">
              <span className="material-symbols-outlined text-lg">account_circle</span>
              Continue with Google
            </a>
          ) : null}
          <Link to="/login" className="font-label text-[10px] uppercase tracking-[0.3em] text-primary hover:text-secondary transition-colors">Return to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
        <h1 className="font-headline text-4xl md:text-5xl italic text-glow text-primary mb-4">Inscribe Your Name</h1>
        <p className="font-body text-on-surface-variant font-light">Create a local account without replacing the existing Flask auth model or the persisted admin credentials.</p>
      </motion.div>
      <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} onSubmit={handleSubmit} className="space-y-6 bg-surface-container-low/30 backdrop-blur-sm p-8 border border-primary/20 rounded-sm">
        {error && <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-sm">{error}</div>}
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} type="text" required className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Your public name" />
          {nameError && <p className="mt-2 text-xs text-red-300">{nameError}</p>}
        </div>
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="you@example.com" />
          {emailError && <p className="mt-2 text-xs text-red-300">{emailError}</p>}
        </div>
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Password</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Minimum 12 characters" />
          {passwordError && <p className="mt-2 text-xs text-red-300">{passwordError}</p>}
        </div>
        <button type="submit" disabled={submitting} className="w-full mt-8 py-4 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-sm uppercase tracking-[0.2em] rounded-md transition-all duration-500 shadow-[inset_0_0_12px_rgba(113,215,205,0.1)] hover:shadow-[inset_0_0_20px_rgba(113,215,205,0.3)] border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Inscribing...' : 'Sign Me Up!'}</button>
        {googleAuthEnabled ? (
          <a href={googleHref} className="w-full flex items-center justify-center gap-3 py-4 border border-secondary/25 bg-surface-container-low/50 text-secondary rounded-md font-label text-sm uppercase tracking-[0.18em] hover:border-primary/35 hover:text-primary transition-all duration-300">
            <span className="material-symbols-outlined text-lg">account_circle</span>
            Continue with Google
          </a>
        ) : (
          <p className="text-center font-body text-xs text-on-surface-variant">Google sign-in is not active on this deployment yet. Confirm <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and redeploy on Render.</p>
        )}
        <p className="text-center font-label text-[10px] uppercase tracking-[0.3em] text-on-surface-variant"><Link to="/login" className="hover:text-primary transition-colors">Return to login</Link></p>
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
