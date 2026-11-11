import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errText, RETURN_KEY } from '../api';
import { useAuth } from '../auth';
import { Button, Notice, TextField } from '../ui';

const DEMO = [
  ['Patient', 'patient@clinicq.demo'],
  ['Receptionist', 'reception@clinicq.demo'],
  ['Doctor', 'doctor@clinicq.demo'],
  ['Admin', 'admin@clinicq.demo'],
] as const;
const DEMO_PASSWORD = 'Demo#2026!';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const expired = useSearchParams()[0].get('expired') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent, em = email, pw = password) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try { await login(em, pw); const back = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); nav(back && back.startsWith('/') ? back : '/'); } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-hero">
        <strong className="brand"><span className="mark" aria-hidden="true" />ClinicQ</strong>
        <h1>A cancelled slot goes to the next person in line.</h1>
        <p>Book a visit in a few taps. If a time you wanted opens up, you get it first, and you have 15 minutes to say yes.</p>
        <div className="slotwall" aria-hidden="true">
          {['9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '1:00', '1:30'].map((t, i) => (
            <i key={t} className={i === 2 ? 'freed' : i % 3 === 0 ? 'taken' : ''}>{t}</i>
          ))}
        </div>
      </aside>
      <div className="auth">
      <h2 style={{ marginTop: 0 }}>Sign in</h2>
      {expired && <p className="info">You were signed out after a period of inactivity. Sign in to pick up where you left off.</p>}
      <form onSubmit={submit} className="card stack">
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <Notice kind="error">{error}</Notice>}
        <Button variant="primary" busy={busy}>Sign in</Button>
        <p className="muted">New patient? <Link to="/register">Create an account</Link></p>
      </form>
      <section className="card stack" aria-label="Demo accounts">
        <h2>Try a demo account</h2>
        <p className="muted">One click signs you in as each role and shows what that role can see.</p>
        <div className="row wrap">
          {DEMO.map(([label, em]) => (
            <Button key={em} type="button" onClick={() => submit(undefined, em, DEMO_PASSWORD)} disabled={busy}>{label}</Button>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await register(f.email, f.password, f.fullName); nav('/'); } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <div className="auth">
      <h1>Create your account</h1>
      <form onSubmit={submit} className="card stack">
        <TextField label="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required maxLength={100} autoComplete="name" />
        <TextField label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" />
        <TextField label="Password (8+ characters)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" />
        {error && <Notice kind="error">{error}</Notice>}
        <Button variant="primary" busy={busy}>Create account</Button>
        <p className="muted">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
