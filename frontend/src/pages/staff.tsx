import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, dayKey, errText, fmtDay, fmtFull, fmtTime, todayKey, type DayAppointment } from '../api';
import { useLoad } from '../hooks';
import { useAuth } from '../auth';
import {
  Button, Card, ConfirmAction, DayGrid, EmptyState, Notice, Pill, SegmentedControl, SkeletonRows, statusTone, TextAreaField, TextField,
  linkButtonClass, useToast, type GridEvent, type GridTone,
} from '../ui';

const shiftDay = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

function DayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="daybar">
      <Button type="button" aria-label="Previous day" onClick={() => onChange(shiftDay(value, -1))}>‹</Button>
      <Button type="button" onClick={() => onChange(todayKey())} disabled={value === todayKey()}>Today</Button>
      <Button type="button" aria-label="Next day" onClick={() => onChange(shiftDay(value, 1))}>›</Button>
      <TextField inline label="Date" type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
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

type View = 'calendar' | 'list';
const VIEW_KEY = 'clinicq.scheduleView';
const initialView = (): View => {
  try { const v = localStorage.getItem(VIEW_KEY); if (v === 'calendar' || v === 'list') return v; } catch { /* storage unavailable */ }
  return window.matchMedia?.('(max-width: 700px)').matches ? 'list' : 'calendar';
};
function useView() {
  const [view, setView] = useState<View>(initialView);
  const set = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable */ } };
  return [view, set] as const;
}
const ViewToggle = ({ view, onChange }: { view: View; onChange: (v: View) => void }) => (
  <SegmentedControl label="Schedule view" value={view} onChange={onChange} options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]} />
);

const toneOf = (status: string): GridTone => (status === 'COMPLETED' ? 'completed' : status === 'CANCELLED' ? 'cancelled' : 'booked');

/** Open (unbooked) slots for one day, as dashed blocks on the grid. */
function openEvents(slots: { id: string; doctorId: string; startAt: string; endAt: string }[], date: string, columnFor: (doctorId: string) => string): GridEvent[] {
  return slots.filter((s) => dayKey(s.startAt) === date)
    .map((s) => ({ id: `open-${s.id}`, columnId: columnFor(s.doctorId), start: s.startAt, end: s.endAt, title: 'Open', tone: 'open' as const }));
}

export function ReceptionDay() {
  const toast = useToast();
  const [date, setDate] = useState(todayKey());
  const [view, setView] = useView();
  const [selected, setSelected] = useState<string | null>(null);
  const day = useLoad(() => api.receptionDay(date), [date], 20000);
  const doctors = useLoad(api.doctors);
  const open = useLoad(async () => (await Promise.all((await api.doctors()).map((d) => api.slots(d.id)))).flat(), [], 30000);
  const [error, setError] = useState('');

  const cancel = async (id: string) => {
    try { await api.cancel(id); setSelected(null); toast('ok', 'Cancelled. The next person on the waitlist has been offered the slot.'); day.reload(); open.reload(); }
    catch (e) { setError(errText(e)); }
  };

  const appts = day.data ?? [];
  const nameOf = (id: string) => doctors.data?.find((d) => d.id === id)?.fullName ?? '';
  const columns = useMemo(() => {
    const names = new Set((doctors.data ?? []).map((d) => d.fullName));
    appts.forEach((a) => names.add(a.doctorName));
    return [...names].sort().map((n) => ({ id: n, label: n }));
  }, [doctors.data, appts]);
  const events: GridEvent[] = useMemo(() => [
    ...appts.map((a) => ({ id: a.appointmentId, columnId: a.doctorName, start: a.startAt, end: a.endAt, title: a.patientName, subtitle: a.doctorName, tone: toneOf(a.status) })),
    ...openEvents(open.data ?? [], date, nameOf),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [appts, open.data, date, doctors.data]);
  const picked = appts.find((a) => a.appointmentId === selected);

  return (
    <>
      <div className="row between pagehead"><h1>Schedule</h1><DayPicker value={date} onChange={(d) => { setDate(d); setSelected(null); }} /></div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="viewbar">{!day.loading && <Counts items={appts} />}<ViewToggle view={view} onChange={setView} /></div>
      {day.loading && !day.data ? <SkeletonRows count={4} height={56} /> : view === 'calendar' ? (
        <>
          <DayGrid label={`Schedule for ${fmtDay(`${date}T12:00:00-08:00`)}`} columns={columns} events={events} isToday={date === todayKey()}
            selectedId={selected} onSelect={(e) => setSelected(e.tone === 'open' ? null : e.id === selected ? null : e.id)} />
          {picked
            ? <AppointmentDetail appt={picked} actions={picked.status === 'BOOKED' && <ConfirmAction label="Cancel appointment" confirmLabel="Confirm cancel" onConfirm={() => cancel(picked.appointmentId)} />} />
            : <p className="muted">Select an appointment on the calendar to see details. Dashed blocks are open times.</p>}
        </>
      ) : appts.length === 0 ? <EmptyState>Nothing booked for {fmtDay(`${date}T12:00:00-08:00`)}.</EmptyState> : (
        <ul className="timeline">
          {appts.map((a) => (
            <li key={a.appointmentId} className={`slotrow ${a.status.toLowerCase()}`} data-testid="schedule-row">
              <span className="when">{fmtTime(a.startAt)}</span>
              <span><strong>{a.patientName}</strong><br /><span className="muted">{a.doctorName}</span></span>
              <span className="row">
                <Pill tone={statusTone(a.status)}>{a.status.toLowerCase()}</Pill>
                {a.status === 'BOOKED' && <ConfirmAction label="Cancel" confirmLabel="Confirm cancel" onConfirm={() => cancel(a.appointmentId)} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AppointmentDetail({ appt, actions }: { appt: DayAppointment; actions?: React.ReactNode }) {
  return (
    <Card className="detail" role="region" aria-label="Appointment details" data-testid="appointment-detail">
      <h3>{appt.patientName}</h3>
      <dl><dt>Time</dt><dd>{fmtFull(appt.startAt)} to {fmtTime(appt.endAt)}</dd><dt>Doctor</dt><dd>{appt.doctorName}</dd>
        <dt>Status</dt><dd><Pill tone={statusTone(appt.status)}>{appt.status.toLowerCase()}</Pill></dd></dl>
      <div className="row">{actions}</div>
    </Card>
  );
}

export function ReceptionQueue() {
  const { data, error, loading } = useLoad(api.receptionQueue, [], 10000);
  return (
    <>
      <h1>Waitlist</h1>
      <p className="muted">First come, first offered. Offers are held for 15 minutes.</p>
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <SkeletonRows count={3} height={60} /> : (data ?? []).length === 0 ? <EmptyState>Nobody is waiting.</EmptyState> : (
        <ol className="queue">
          {(data ?? []).map((w, i) => (
            <li key={w.id} className={`slotrow ${i === 0 ? 'next' : ''}`}>
              <span className="rank" aria-label={`Position ${i + 1}`}>{i + 1}</span>
              <span><strong>{w.patientName}</strong><br /><span className="muted">{w.doctorName} · prefers {w.preferredWindow.toLowerCase()} · joined {fmtFull(w.createdAt)}</span></span>
              <Pill tone={statusTone(w.status)}>{w.status === 'OFFERED' ? 'offer pending' : 'waiting'}</Pill>
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
  const [view, setView] = useView();
  const [selected, setSelected] = useState<string | null>(null);
  const day = useLoad(() => api.doctorDay(date), [date], 20000);
  const open = useLoad(() => api.slots(session?.userId ?? ''), [session?.userId], 30000);
  const appts = day.data ?? [];
  const me = session?.fullName ?? 'My day';
  const events: GridEvent[] = useMemo(() => [
    ...appts.map((a) => ({ id: a.appointmentId, columnId: 'me', start: a.startAt, end: a.endAt, title: a.patientName, tone: toneOf(a.status) })),
    ...openEvents(open.data ?? [], date, () => 'me'),
  ], [appts, open.data, date]);
  const picked = appts.find((a) => a.appointmentId === selected);

  return (
    <>
      <div className="row between pagehead"><h1>My day</h1><DayPicker value={date} onChange={(d) => { setDate(d); setSelected(null); }} /></div>
      <p className="muted">{session?.fullName}</p>
      {day.error && <Notice kind="error">{day.error}</Notice>}
      <div className="viewbar">{!day.loading && <Counts items={appts} />}<ViewToggle view={view} onChange={setView} /></div>
      {day.loading && !day.data ? <SkeletonRows count={4} height={56} /> : view === 'calendar' ? (
        <>
          <DayGrid label={`${me}, ${fmtDay(`${date}T12:00:00-08:00`)}`} columns={[{ id: 'me', label: me }]} events={events} isToday={date === todayKey()}
            selectedId={selected} onSelect={(e) => setSelected(e.tone === 'open' ? null : e.id === selected ? null : e.id)} />
          {picked
            ? <AppointmentDetail appt={picked} actions={picked.status !== 'CANCELLED' && <Link className={linkButtonClass('primary')} to={`/doctor/appointments/${picked.appointmentId}`}>Open record</Link>} />
            : <p className="muted">Select an appointment to open its record. Dashed blocks are open times.</p>}
        </>
      ) : appts.length === 0 ? <EmptyState>No appointments on this day.</EmptyState> : (
        <ul className="timeline">
          {appts.map((a) => (
            <li key={a.appointmentId}>
              <Link className={`slotrow link-card ${a.status.toLowerCase()}`} to={`/doctor/appointments/${a.appointmentId}`} data-testid="doctor-row">
                <span className="when">{fmtTime(a.startAt)}</span>
                <strong>{a.patientName}</strong>
                <Pill tone={statusTone(a.status)}>{a.status.toLowerCase()}</Pill>
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
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api.record(id), [id]);
  const [notes, setNotes] = useState<string | null>(null);
  const text = notes ?? data?.visitNotes ?? '';
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast('ok', ok); reload(); } catch (e) { toast('error', errText(e)); }
  };
  if (loading) return <SkeletonRows count={3} height={80} />;
  if (error || !data) return <><p><Link to="/doctor">← My day</Link></p><Notice kind="error">{error ?? 'Not found'}</Notice></>;
  return (
    <>
      <p><Link to="/doctor">← My day</Link></p>
      <div className="row between pagehead"><h1>{data.patientName}</h1></div>
      <p className="muted">Opening this record is recorded in the audit log.</p>
      <Card as="section"><h3>Patient details</h3>
        <dl>
          <dt>Phone</dt><dd>{data.phone ?? '—'}</dd>
          <dt>Date of birth</dt><dd>{data.dob ?? '—'}</dd>
          <dt>Notes from patient</dt><dd>{data.patientNotes ?? '—'}</dd>
        </dl>
      </Card>
      <Card as="section" className="stack"><h3>Visit notes</h3>
        <TextAreaField label="Notes" rows={5} value={text} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        <div className="row">
          <Button type="button" onClick={() => run(() => api.saveNotes(id, text), 'Notes saved.')}>Save notes</Button>
          {data.status === 'BOOKED' && <Button type="button" variant="primary" onClick={() => run(() => api.complete(id), 'Visit marked complete.')}>Mark visit complete</Button>}
          {data.status === 'COMPLETED' && <Pill tone="completed">completed</Pill>}
        </div>
      </Card>
    </>
  );
}
