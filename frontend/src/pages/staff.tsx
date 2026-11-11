import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errText, fmtDay, fmtFull, fmtTime, todayKey } from '../api';
import { useLoad } from '../hooks';
import { useAuth } from '../auth';

const shiftDay = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

function DayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="daybar">
      <button type="button" aria-label="Previous day" onClick={() => onChange(shiftDay(value, -1))}>‹</button>
      <button type="button" onClick={() => onChange(todayKey())} disabled={value === todayKey()}>Today</button>
      <button type="button" aria-label="Next day" onClick={() => onChange(shiftDay(value, 1))}>›</button>
      <label className="inline">Date<input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} /></label>
    </div>
  );
}

function Counts({ items }: { items: { status: string }[] }) {
  const n = (st: string) => items.filter((i) => i.status === st).length;
  return (
    <p className="counts muted">
      <span><b>{n('BOOKED')}</b> booked</span><span><b>{n('COMPLETED')}</b> completed</span><span><b>{n('CANCELLED')}</b> cancelled</span>
    </p>
  );
}

export function ReceptionDay() {
  const [date, setDate] = useState(todayKey());
  const { data, error, loading, reload } = useLoad(() => api.receptionDay(date), [date], 20000);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const cancel = async (id: string) => {
    try { await api.cancel(id); setConfirming(null); setMsg('Cancelled. The next person on the waitlist has been offered the slot.'); reload(); }
    catch (e) { setMsg(errText(e)); }
  };
  return (
    <>
      <div className="row between pagehead"><h1>Schedule</h1><DayPicker value={date} onChange={setDate} /></div>
      {error && <p role="alert" className="error">{error}</p>}
      {msg && <p role="status" className="ok">{msg}</p>}
      {!loading && <Counts items={data ?? []} />}
      {loading ? <p className="muted">Loading…</p> : (data ?? []).length === 0 ? <p className="empty">Nothing booked for {fmtDay(date + 'T12:00:00-08:00')}.</p> : (
        <ul className="timeline">
          {(data ?? []).map((a) => (
            <li key={a.appointmentId} className={`slotrow ${a.status.toLowerCase()}`} data-testid="schedule-row">
              <span className="when">{fmtTime(a.startAt)}</span>
              <span><strong>{a.patientName}</strong><br /><span className="muted">{a.doctorName}</span></span>
              <span className="row">
                <span className={`pill ${a.status.toLowerCase()}`}>{a.status.toLowerCase()}</span>
                {a.status === 'BOOKED' && (confirming === a.appointmentId
                  ? <><button className="danger" onClick={() => cancel(a.appointmentId)}>Confirm cancel</button><button onClick={() => setConfirming(null)}>Keep</button></>
                  : <button onClick={() => setConfirming(a.appointmentId)}>Cancel</button>)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ReceptionQueue() {
  const { data, error, loading } = useLoad(api.receptionQueue, [], 10000);
  return (
    <>
      <h1>Waitlist</h1>
      <p className="muted">First come, first offered. Offers are held for 15 minutes.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {loading ? <p className="muted">Loading…</p> : (data ?? []).length === 0 ? <p className="empty">Nobody is waiting.</p> : (
        <ol className="queue">
          {(data ?? []).map((w, i) => (
            <li key={w.id} className={`slotrow ${i === 0 ? 'next' : ''}`}>
              <span className="rank" aria-label={`Position ${i + 1}`}>{i + 1}</span>
              <span><strong>{w.patientName}</strong><br /><span className="muted">{w.doctorName} · prefers {w.preferredWindow.toLowerCase()} · joined {fmtFull(w.createdAt)}</span></span>
              <span className={`pill ${w.status.toLowerCase()}`}>{w.status === 'OFFERED' ? 'offer pending' : 'waiting'}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function DoctorDay() {
  const { session } = useAuth();
  const [date, setDate] = useState(todayKey());
  const { data, error, loading } = useLoad(() => api.doctorDay(date), [date], 20000);
  return (
    <>
      <div className="row between pagehead"><h1>My day</h1><DayPicker value={date} onChange={setDate} /></div>
      <p className="muted">{session?.fullName}</p>
      {error && <p role="alert" className="error">{error}</p>}
      {!loading && <Counts items={data ?? []} />}
      {loading ? <p className="muted">Loading…</p> : (data ?? []).length === 0 ? <p className="empty">No appointments on this day.</p> : (
        <ul className="timeline">
          {(data ?? []).map((a) => (
            <li key={a.appointmentId}>
              <Link className={`slotrow link-card ${a.status.toLowerCase()}`} to={`/doctor/appointments/${a.appointmentId}`} data-testid="doctor-row">
                <span className="when">{fmtTime(a.startAt)}</span>
                <strong>{a.patientName}</strong>
                <span className={`pill ${a.status.toLowerCase()}`}>{a.status.toLowerCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function PatientRecordPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useLoad(() => api.record(id), [id]);
  const [notes, setNotes] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const text = notes ?? data?.visitNotes ?? '';
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ kind: 'ok', text: ok }); reload(); } catch (e) { setMsg({ kind: 'error', text: errText(e) }); }
  };
  if (loading) return <p className="muted">Loading…</p>;
  if (error || !data) return <><p><Link to="/doctor">← My day</Link></p><p role="alert" className="error">{error ?? 'Not found'}</p></>;
  return (
    <>
      <p><Link to="/doctor">← My day</Link></p>
      <div className="row between pagehead"><h1>{data.patientName}</h1></div>
      <p className="muted">Opening this record is recorded in the audit log.</p>
      <section className="card"><h3>Patient details</h3>
        <dl>
          <dt>Phone</dt><dd>{data.phone ?? '—'}</dd>
          <dt>Date of birth</dt><dd>{data.dob ?? '—'}</dd>
          <dt>Notes from patient</dt><dd>{data.patientNotes ?? '—'}</dd>
        </dl>
      </section>
      <section className="card stack"><h3>Visit notes</h3>
        <label>Notes<textarea rows={5} value={text} onChange={(e) => setNotes(e.target.value)} maxLength={4000} /></label>
        <div className="row">
          <button onClick={() => run(() => api.saveNotes(id, text), 'Notes saved.')}>Save notes</button>
          {data.status === 'BOOKED' && <button className="primary" onClick={() => run(() => api.complete(id), 'Visit marked complete.')}>Mark visit complete</button>}
          {data.status === 'COMPLETED' && <span className="pill completed">completed</span>}
        </div>
        {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind}>{msg.text}</p>}
      </section>
    </>
  );
}
