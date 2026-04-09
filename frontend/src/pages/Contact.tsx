import { useState } from 'react';
import { motion } from 'motion/react';
import { getApiErrorMessage, getFieldError, useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';

export function Contact() {
  const { csrfToken } = useAppSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [messageError, setMessageError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setSuccessMessage('');
    setError('');
    setNameError('');
    setEmailError('');
    setPhoneError('');
    setMessageError('');

    try {
      const nextToken = csrfToken || (await api.fetchSession()).csrfToken;
      const payload = await api.sendContact({ name, email, phone, message }, nextToken);
      setStatus('success');
      setSuccessMessage(payload.message);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err) {
      setStatus('idle');
      setError(getApiErrorMessage(err));
      setNameError(getFieldError(err, 'name'));
      setEmailError(getFieldError(err, 'email'));
      setPhoneError(getFieldError(err, 'phone'));
      setMessageError(getFieldError(err, 'message'));
    }
  };

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-5xl space-y-16">
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 items-center">
        <div className="relative rounded-sm overflow-hidden border border-secondary/20 bg-surface-container-low/60 order-2 lg:order-1 min-h-[420px]">
          <img src="/static/assets/img/contact-bg.jpg" alt="Contact background" className="w-full h-full object-cover opacity-70 min-h-[420px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
        </div>
        <div className="space-y-6 order-1 lg:order-2">
          <h1 className="font-headline text-5xl md:text-7xl italic text-glow-secondary text-secondary">Contact Me</h1>
          <p className="font-body text-on-surface-variant font-light leading-relaxed text-lg">Want to get in touch? Send a message from the codex and it will travel through the live backend without removing this route from the redesign.</p>
          <form onSubmit={handleSubmit} className="space-y-5 bg-surface-container-low/60 border border-white/5 rounded-sm p-8 backdrop-blur-sm">
            {successMessage && <div className="border border-primary/20 bg-primary/10 text-primary px-4 py-3 rounded-sm font-body font-light">{successMessage}</div>}
            {error && <div className="border border-red-500/30 bg-red-900/30 text-red-200 px-4 py-3 rounded-sm font-body font-light">{error}</div>}
            <ContactField label="Name" value={name} onChange={setName} placeholder="Enter your name" error={nameError} autoComplete="name" />
            <ContactField label="Email" value={email} onChange={setEmail} placeholder="Enter your email" error={emailError} type="email" autoComplete="email" />
            <ContactField label="Phone" value={phone} onChange={setPhone} placeholder="Enter your phone number" error={phoneError} type="tel" autoComplete="tel" />
            <div>
              <label className="block font-label text-xs uppercase tracking-[0.3em] text-secondary mb-2">Message</label>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-y min-h-[10rem]" placeholder="Write your message here" />
              {messageError && <p className="mt-2 text-xs text-red-300">{messageError}</p>}
            </div>
            <button type="submit" disabled={status === 'loading'} className="w-full py-4 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-sm uppercase tracking-[0.2em] rounded-md transition-all duration-500 shadow-[inset_0_0_12px_rgba(113,215,205,0.1)] hover:shadow-[inset_0_0_20px_rgba(113,215,205,0.3)] border border-primary/20 disabled:opacity-60 disabled:cursor-not-allowed">
              {status === 'loading' ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </motion.section>
    </div>
  );
}

function ContactField({
  autoComplete,
  error,
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  autoComplete?: string;
  error: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label className="block font-label text-xs uppercase tracking-[0.3em] text-secondary mb-2">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} autoComplete={autoComplete} className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder={placeholder} />
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
