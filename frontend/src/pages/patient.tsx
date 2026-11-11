import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, dayKey, errText, fmtDay, fmtFull, fmtTime, type Offer, type Slot } from '../api';
import { useLoad, useNow } from '../hooks';

function Notice({ kind, children }: { kind: 'error' | 'ok'; children: React.ReactNode }) {
  return <p role={kind === 'error' ? 'alert' : 'status'} className={kind === 'error' ? 'error' : 'ok'}>{children}</p>;
}

function OfferCard({ offer, doctorName, onChange }: { offer: Offer; doctorName: string; onChange: () => void }) {
  const now = useNow();
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const left = Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - now) / 1000));
  const act = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    try { await fn(); setMsg({ kind: 'ok', text: okText }); onChange(); } catch (e) { setMsg({ kind: 'error', text: errText(e) }); onChange(); } finally { setBusy(false); }
  };
  return (
    <div className="card offer" data-testid="offer">
      <h3>A slot opened up for you</h3>
      <p><strong>{doctorName}</strong> · {fmtFull(offer.startAt)}</p>
      <p className="timer" aria-live="polite">{left > 0 ? `Offer held for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'This offer has expired'}</p>
      <div className="row">
        <button className="primary" disabled={busy || left === 0} onClick={() => act(() => api.acceptOffer(offer.id), 'Booked!')}>Book it</button>
        <button disabled={busy || left === 0} onClick={() => act(() => api.declineOffer(offer.id), 'Offer declined')}>No thanks</button>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="drain" aria-hidden="true" style={{ width: `${Math.min(100, left / 9)}%` }} />
    </div>
  );
}

const LA = 'America/Los_Angeles';
const initials = (n: string) => n.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function PatientHome() {
  const appts = useLoad(api.myAppointments, [], 15000);
  const offers = useLoad(api.myOffers, [], 5000);
  const waits = useLoad(api.myWaitlist, [], 15000);
  const docs = useLoad(api.doctors);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const name = (id: string) => docs.data?.find((d) => d.id === id)?.fullName ?? 'Doctor';
  const reloadAll = () => { appts.reload(); offers.reload(); waits.reload(); };

  const upcoming = (appts.data ?? []).filter((a) => a.status === 'BOOKED' && new Date(a.startAt) > new Date()).reverse();
  const history = (appts.data ?? []).filter((a) => !upcoming.includes(a));
  const activeWaits = (waits.data ?? []).filter((w) => w.status === 'WAITING' || w.status === 'OFFERED');

  const cancel = async (id: string) => {
    setError('');
    try { await api.cancel(id); setConfirming(null); reloadAll(); } catch (e) { setError(errText(e)); }
  };
  const leave = async (id: string) => { try { await api.leaveWaitlist(id); reloadAll(); } catch (e) { setError(errText(e)); } };

  return (
    <>
      <div className="row between"><h1>My care</h1><Link className="button primary" to="/doctors">Book an appointment</Link></div>
      {error && <Notice kind="error">{error}</Notice>}
      {(offers.data ?? []).map((o) => <OfferCard key={o.id} offer={o} doctorName={name(o.doctorId)} onChange={reloadAll} />)}

      <section aria-labelledby="up"><h2 id="up">Upcoming</h2>
        {appts.loading ? <p className="muted">Loading…</p> : upcoming.length === 0 ? <p className="muted">No upcoming appointments.</p> :
          upcoming.map((a) => (
            <div className="card appt" key={a.id} data-testid="appointment">
              <div className="stub" aria-hidden="true"><b>{new Date(a.startAt).toLocaleDateString('en-US', { day: 'numeric', timeZone: LA })}</b><span>{new Date(a.startAt).toLocaleDateString('en-US', { month: 'short', timeZone: LA })}</span></div>
              <div><strong>{fmtFull(a.startAt)}</strong><br /><span className="muted">{a.doctorName} · {a.specialty}</span></div>
              {confirming === a.id ? (
                <div className="row"><button className="danger" onClick={() => cancel(a.id)}>Yes, cancel it</button><button onClick={() => setConfirming(null)}>Keep</button></div>
              ) : <button onClick={() => setConfirming(a.id)}>Cancel</button>}
            </div>
          ))}
      </section>

      <section aria-labelledby="wl"><h2 id="wl">On your waitlist</h2>
        {activeWaits.length === 0 ? <p className="muted">You're not waiting for anyone. When a slot opens, you'll be offered it here.</p> :
          activeWaits.map((w) => (
            <div className="card row between" key={w.id} data-testid="waitlist-entry">
              <div><strong>{name(w.doctorId)}</strong><br /><span className="muted">Prefers: {w.preferredWindow.toLowerCase()} · {w.status === 'OFFERED' ? 'offer waiting for you' : 'waiting'}</span></div>
              {w.status === 'WAITING' && <button onClick={() => leave(w.id)}>Leave waitlist</button>}
            </div>
          ))}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="hist"><h2 id="hist">Past and cancelled</h2>
          {history.map((a) => (
            <div className="card row between muted" key={a.id}><span>{fmtFull(a.startAt)} · {a.doctorName}</span><span className={`pill ${a.status.toLowerCase()}`}>{a.status.toLowerCase()}</span></div>
          ))}
        </section>
      )}
    </>
  );
}

export function FindDoctor() {
  const { data, error, loading } = useLoad(api.doctors);
  return (
    <>
      <h1>Find a doctor</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {loading ? <p className="muted">Loading…</p> : (
        <div className="grid">
          {(data ?? []).map((d) => (
            <Link key={d.id} to={`/doctors/${d.id}`} className="card doctor" data-testid="doctor-card">
              <span className="avatar" aria-hidden="true">{initials(d.fullName)}</span>
              <strong>{d.fullName}</strong><span className="muted">{d.specialty}</span><span className="link">See times →</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function DoctorSlots() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const doctors = useLoad(api.doctors);
  const slots = useLoad(() => api.slots(id), [id]);
  const [picked, setPicked] = useState<{ slot: Slot; key: string } | null>(null);   // key is fixed per selection => safe retries
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [window_, setWindow] = useState('ANY');
  const [waitMsg, setWaitMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const doctor = doctors.data?.find((d) => d.id === id);

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots.data ?? []) { const k = dayKey(s.startAt); m.set(k, [...(m.get(k) ?? []), s]); }
    return [...m.entries()];
  }, [slots.data]);

  const confirm = async () => {
    if (!picked) return;
    setBusy(true); setError('');
    try { await api.book(picked.slot.id, picked.key); nav('/home'); }
    catch (e) { setError(errText(e)); setPicked(null); slots.reload(); }
    finally { setBusy(false); }
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.joinWaitlist(id, window_); setWaitMsg({ kind: 'ok', text: "You're on the waitlist. We'll offer you the next slot that opens up." }); }
    catch (err) { setWaitMsg({ kind: 'error', text: errText(err) }); }
  };

  return (
    <>
      <p><Link to="/doctors">← All doctors</Link></p>
      <h1>{doctor?.fullName ?? 'Doctor'}</h1>
      <p className="muted">{doctor?.specialty}</p>
      {error && <Notice kind="error">{error}</Notice>}
      {slots.loading ? <p className="muted">Loading times…</p> : byDay.length === 0 ? <p className="card">No open times right now. Join the waitlist below and you'll be offered the next one.</p> :
        byDay.map(([day, list]) => (
          <section key={day} className="day"><h3>{fmtDay(list[0].startAt)}</h3>
            <div className="slots">
              {list.map((s) => (
                <button key={s.id} className={picked?.slot.id === s.id ? 'primary' : ''} aria-pressed={picked?.slot.id === s.id}
                  onClick={() => setPicked({ slot: s, key: crypto.randomUUID() })}>{fmtTime(s.startAt)}</button>
              ))}
            </div>
          </section>
        ))}
      {picked && (
        <div className="card confirm" role="region" aria-label="Confirm booking">
          <p>Book <strong>{fmtFull(picked.slot.startAt)}</strong> with {doctor?.fullName}?</p>
          <div className="row"><button className="primary" disabled={busy} onClick={confirm}>Confirm booking</button><button onClick={() => setPicked(null)}>Back</button></div>
        </div>
      )}
      <section className="card" aria-labelledby="wlh"><h3 id="wlh">Can't find a time that works?</h3>
        <form className="row wrap" onSubmit={join}>
          <label>Preferred time<select value={window_} onChange={(e) => setWindow(e.target.value)}>
            <option value="ANY">Any time</option><option value="MORNING">Mornings</option><option value="AFTERNOON">Afternoons</option></select></label>
          <button>Join the waitlist</button>
        </form>
        {waitMsg && <Notice kind={waitMsg.kind}>{waitMsg.text}</Notice>}
      </section>
    </>
  );
}

export function ProfilePage() {
  const { data, loading } = useLoad(api.profile);
  const [f, setF] = useState<{ phone: string; dob: string; notes: string } | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const form = f ?? { phone: data?.phone ?? '', dob: data?.dob ?? '', notes: data?.notes ?? '' };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.saveProfile({ phone: form.phone || null, dob: form.dob || null, notes: form.notes || null }); setMsg({ kind: 'ok', text: 'Saved.' }); }
    catch (err) { setMsg({ kind: 'error', text: errText(err) }); }
  };
  if (loading) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>My details</h1>
      <p className="muted">Stored encrypted. Only you and your treating doctor can read these, and every doctor view is logged.</p>
      <form className="card stack" onSubmit={save}>
        <label>Phone<input value={form.phone} onChange={(e) => setF({ ...form, phone: e.target.value })} maxLength={40} /></label>
        <label>Date of birth<input type="date" value={form.dob} onChange={(e) => setF({ ...form, dob: e.target.value })} /></label>
        <label>Notes for your doctor<textarea rows={4} value={form.notes} onChange={(e) => setF({ ...form, notes: e.target.value })} maxLength={2000} /></label>
        <button className="primary">Save</button>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </form>
    </>
  );
}
