import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { getApiErrorMessage, getFieldError, useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { CipitioSystem } from '../portfolio/visual/modules/CipitioSystem.js';

export function Contact() {
  const { csrfToken } = useAppSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [modal, setModal] = useState<{ title: string; message: string; tone: 'system' | 'success' | 'error' } | null>(null);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [messageError, setMessageError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const cipitio = new CipitioSystem({ signal: controller.signal });
    return () => {
      controller.abort();
      cipitio.destroy?.();
    };
  }, []);

  const showModal = (title: string, text: string, tone: 'system' | 'success' | 'error' = 'system') => {
    setModal({ title, message: text, tone });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const wasPrevented = event.defaultPrevented;
    event.preventDefault();
    if (wasPrevented || status === 'loading') return;
    setStatus('loading');
    setError('');
    setNameError('');
    setEmailError('');
    setMessageError('');

    try {
      const nextToken = csrfToken || (await api.fetchSession()).csrfToken;
      const payload = await api.sendContact({ name, email, message }, nextToken);
      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
      showModal('Signal Sent', payload.message, 'success');
    } catch (err) {
      setStatus('idle');
      const nextError = getApiErrorMessage(err);
      setError(nextError);
      setNameError(getFieldError(err, 'name'));
      setEmailError(getFieldError(err, 'email'));
      setMessageError(getFieldError(err, 'message'));
      showModal('Transmission Error', nextError, 'error');
    }
  };

  return (
    <div className="open-signal page-frame-wide">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="open-signal-grid"
      >
        <div className="open-signal-copy">
          <p className="open-signal-kicker">Open Signal</p>
          <h1 className="open-signal-heading">Contact</h1>
          <p className="open-signal-body">
            Send a clean signal through the codex. The route is open — messages land directly
            and are guarded by Cipitio.
          </p>
        </div>

        <div
          id="contact-panel"
          className="open-signal-form-shell"
          data-msg-name-required="Name is required."
          data-msg-email-required="Email is required."
          data-msg-email-invalid="Invalid email format."
          data-msg-message-required="Message is required."
        >
          <div id="cipitio-entity" className="cipitio-sprite" />
          <div id="cipitio-rock" className="digital-rock" />

          <form onSubmit={(event) => void handleSubmit(event)} className="open-signal-form" id="contactForm" noValidate>
            <div className="hidden" aria-hidden="true">
              <input className="signal-input" name="bot_catcher" tabIndex={-1} autoComplete="off" />
            </div>

            {error && <div className="portfolio-alert portfolio-alert-error">{error}</div>}

            <ContactField label="Name" name="name" value={name} onChange={setName} placeholder="Enter your name" error={nameError} autoComplete="name" />
            <ContactField label="Email" name="email" value={email} onChange={setEmail} placeholder="name@example.com" error={emailError} type="email" autoComplete="email" />
            <div className="signal-field">
              <label className="signal-label" htmlFor="inputMessage">Message</label>
              <textarea
                id="inputMessage"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="signal-input signal-textarea"
                placeholder="Write your message here"
              />
              {messageError && <p className="signal-field-error">{messageError}</p>}
            </div>
            <button type="submit" id="submitBtn" disabled={status === 'loading'} className="signal-submit">
              {status === 'loading' ? 'Sending...' : status === 'success' ? 'Signal Sent' : 'Send Message'}
            </button>
          </form>
        </div>
      </motion.section>

      <div id="cyber-modal" className={`signal-modal-overlay ${modal ? 'active' : ''}`}>
        <div className={`signal-modal-box signal-modal-${modal?.tone || 'system'}`}>
          <h3 className="signal-modal-title">{modal?.title || 'System'}</h3>
          <div className="signal-modal-msg">{modal?.message}</div>
          <button className="signal-modal-btn" type="button" onClick={() => setModal(null)}>Understood</button>
        </div>
      </div>
    </div>
  );
}

function ContactField({
  autoComplete,
  error,
  label,
  name,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  autoComplete?: string;
  error: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  const id = `input${label.replace(/\s+/g, '')}`;
  return (
    <div className="signal-field">
      <label className="signal-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        className="signal-input"
        placeholder={placeholder}
      />
      {error && <p className="signal-field-error">{error}</p>}
    </div>
  );
}
