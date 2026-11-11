import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errText, fmtFull, type MyAppointment, type Offer, type Slot } from '../api';
import { useLoad, useNow } from '../hooks';
import {
  Avatar, Button, Card, ConfirmAction, EmptyState, Notice, OfferTicket, Pill, SelectField, Skeleton, SkeletonRows, SlotPicker,
  statusTone, TextAreaField, TextField, linkButtonClass, useToast,
} from '../ui';

const LA = 'America/Los_Angeles';

function OfferCard({ offer, doctorName, onAccept, onDecline }: { offer: Offer; doctorName: string; onAccept: (o: Offer) => Promise<void>; onDecline: (o: Offer) => Promise<void> }) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const run = async (fn: (o: Offer) => Promise<void>) => { setBusy(true); try { await fn(offer); } finally { setBusy(false); } };
  return <OfferTicket doctorName={doctorName} when={fmtFull(offer.startAt)} expiresAt={offer.expiresAt} now={now} busy={busy}
    onAccept={() => run(onAccept)} onDecline={() => run(onDecline)} />;
}

export function PatientHome() {
  const toast = useToast();
  const appts = useLoad(api.myAppointments, [], 15000);
  const offers = useLoad(api.myOffers, [], 5000);
  const waits = useLoad(api.myWaitlist, [], 15000);
  const docs = useLoad(api.doctors);
  const [error, setError] = useState('');
  const doctor = (id: string) => docs.data?.find((d) => d.id === id);
  const reloadAll = () => { appts.reload(); offers.reload(); waits.reload(); };

  const upcoming = (appts.data ?? []).filter((a) => a.status === 'BOOKED' && new Date(a.startAt) > new Date()).reverse();
  const history = (appts.data ?? []).filter((a) => !upcoming.includes(a));
  const activeWaits = (waits.data ?? []).filter((w) => w.status === 'WAITING' || w.status === 'OFFERED');
  const firstLoad = appts.loading && !appts.data;

  // Optimistic updates: the screen changes straight away, and rolls back if the server says no.
  const cancel = async (id: string) => {
    setError('');
    const before = appts.data;
    appts.mutate((cur) => cur && cur.map((a) => (a.id === id ? { ...a, status: 'CANCELLED' } : a)));
    try { await api.cancel(id); toast('ok', 'Appointment cancelled. The next person in line will be offered your time.'); }
    catch (e) { appts.mutate(() => before); setError(errText(e)); }
    finally { reloadAll(); }
  };
  const leave = async (id: string) => {
    const before = waits.data;
    waits.mutate((cur) => cur && cur.filter((w) => w.id !== id));
    try { await api.leaveWaitlist(id); toast('ok', 'You left the waitlist.'); }
    catch (e) { waits.mutate(() => before); setError(errText(e)); }
    finally { reloadAll(); }
  };
  const accept = async (o: Offer) => {
    const before = { offers: offers.data, appts: appts.data };
    const d = doctor(o.doctorId);
    const pending: MyAppointment = { id: `pending-${o.id}`, slotId: o.slotId, status: 'BOOKED', startAt: o.startAt, endAt: o.endAt, doctorName: d?.fullName ?? 'Doctor', specialty: d?.specialty ?? '' };
    offers.mutate((cur) => cur && cur.filter((x) => x.id !== o.id));
    appts.mutate((cur) => [pending, ...(cur ?? [])]);
    try { await api.acceptOffer(o.id); toast('ok', `Booked! ${fmtFull(o.startAt)} with ${d?.fullName ?? 'your doctor'}.`); }
    catch (e) { offers.mutate(() => before.offers); appts.mutate(() => before.appts); toast('error', errText(e)); }
    finally { reloadAll(); }
  };
  const decline = async (o: Offer) => {
    const before = offers.data;
    offers.mutate((cur) => cur && cur.filter((x) => x.id !== o.id));
    try { await api.declineOffer(o.id); toast('ok', "Offer declined. We'll offer it to the next person."); }
    catch (e) { offers.mutate(() => before); toast('error', errText(e)); }
    finally { reloadAll(); }
  };

  return (
    <>
      <div className="row between"><h1>My care</h1><Link className={linkButtonClass('primary')} to="/doctors">Book an appointment</Link></div>
      {error && <Notice kind="error">{error}</Notice>}
      {(offers.data ?? []).map((o) => <OfferCard key={o.id} offer={o} doctorName={doctor(o.doctorId)?.fullName ?? 'Doctor'} onAccept={accept} onDecline={decline} />)}

      <section aria-labelledby="up"><h2 id="up">Upcoming</h2>
        {firstLoad ? <SkeletonRows count={2} /> : upcoming.length === 0 ? <p className="muted">No upcoming appointments.</p> :
          upcoming.map((a) => (
            <Card className="appt" key={a.id} data-testid="appointment">
              <div className="stub" aria-hidden="true"><b>{new Date(a.startAt).toLocaleDateString('en-US', { day: 'numeric', timeZone: LA })}</b><span>{new Date(a.startAt).toLocaleDateString('en-US', { month: 'short', timeZone: LA })}</span></div>
              <div><strong>{fmtFull(a.startAt)}</strong><br /><span className="muted">{a.doctorName} · {a.specialty}</span></div>
              {a.id.startsWith('pending-') ? <Pill tone="booked">booking…</Pill> : <ConfirmAction label="Cancel" confirmLabel="Yes, cancel it" onConfirm={() => cancel(a.id)} />}
            </Card>
          ))}
      </section>

      <section aria-labelledby="wl"><h2 id="wl">On your waitlist</h2>
        {waits.loading && !waits.data ? <SkeletonRows count={1} height={56} /> : activeWaits.length === 0 ? <p className="muted">You're not waiting for anyone. When a slot opens, you'll be offered it here.</p> :
          activeWaits.map((w) => (
            <Card className="row between" key={w.id} data-testid="waitlist-entry">
              <div><strong>{doctor(w.doctorId)?.fullName ?? 'Doctor'}</strong><br /><span className="muted">Prefers: {w.preferredWindow.toLowerCase()} · {w.status === 'OFFERED' ? 'offer waiting for you' : 'waiting'}</span></div>
              {w.status === 'WAITING' && <Button onClick={() => leave(w.id)}>Leave waitlist</Button>}
            </Card>
          ))}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="hist"><h2 id="hist">Past and cancelled</h2>
          {history.map((a) => (
            <Card className="row between muted" key={a.id}><span>{fmtFull(a.startAt)} · {a.doctorName}</span><Pill tone={statusTone(a.status)}>{a.status.toLowerCase()}</Pill></Card>
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
      {loading ? (
        <div className="grid" aria-busy="true" aria-label="Loading doctors">{[0, 1, 2].map((i) => <Skeleton key={i} height={92} radius={14} />)}</div>
      ) : (
        <div className="grid">
          {(data ?? []).map((d) => (
            <Link key={d.id} to={`/doctors/${d.id}`} className="card doctor" data-testid="doctor-card">
              <Avatar name={d.fullName} />
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
  const toast = useToast();
  const doctors = useLoad(api.doctors);
  const slots = useLoad(() => api.slots(id), [id]);
  const [picked, setPicked] = useState<{ slot: Slot; key: string } | null>(null);   // key is fixed per selection => safe retries
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [window_, setWindow] = useState('ANY');
  const doctor = doctors.data?.find((d) => d.id === id);

  const confirm = async () => {
    if (!picked) return;
    setBusy(true); setError('');
    try { await api.book(picked.slot.id, picked.key); toast('ok', `Booked ${fmtFull(picked.slot.startAt)} with ${doctor?.fullName ?? 'your doctor'}.`); nav('/home'); }
    catch (e) { setError(errText(e)); setPicked(null); slots.reload(); }
    finally { setBusy(false); }
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.joinWaitlist(id, window_); toast('ok', "You're on the waitlist. We'll offer you the next slot that opens up."); }
    catch (err) { toast('error', errText(err)); }
  };

  return (
    <>
      <p><Link to="/doctors">← All doctors</Link></p>
      <h1>{doctor?.fullName ?? 'Doctor'}</h1>
      <p className="muted">{doctor?.specialty}</p>
      {error && <Notice kind="error">{error}</Notice>}
      {slots.loading ? <SkeletonRows count={3} height={52} /> : (slots.data ?? []).length === 0
        ? <EmptyState>No open times right now. Join the waitlist below and you'll be offered the next one.</EmptyState>
        : <SlotPicker slots={slots.data ?? []} selectedId={picked?.slot.id} onSelect={(s) => setPicked({ slot: s, key: crypto.randomUUID() })} />}
      {picked && (
        <Card className="confirm" role="region" aria-label="Confirm booking">
          <p>Book <strong>{fmtFull(picked.slot.startAt)}</strong> with {doctor?.fullName}?</p>
          <div className="row"><Button variant="primary" busy={busy} onClick={confirm}>Confirm booking</Button><Button onClick={() => setPicked(null)}>Back</Button></div>
        </Card>
      )}
      <Card as="section" aria-labelledby="wlh"><h3 id="wlh">Can't find a time that works?</h3>
        <form className="row wrap" onSubmit={join}>
          <SelectField label="Preferred time" value={window_} onChange={(e) => setWindow(e.target.value)}>
            <option value="ANY">Any time</option><option value="MORNING">Mornings</option><option value="AFTERNOON">Afternoons</option>
          </SelectField>
          <Button>Join the waitlist</Button>
        </form>
      </Card>
    </>
  );
}

export function ProfilePage() {
  const toast = useToast();
  const { data, loading } = useLoad(api.profile);
  const [f, setF] = useState<{ phone: string; dob: string; notes: string } | null>(null);
  const form = f ?? { phone: data?.phone ?? '', dob: data?.dob ?? '', notes: data?.notes ?? '' };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.saveProfile({ phone: form.phone || null, dob: form.dob || null, notes: form.notes || null }); toast('ok', 'Saved.'); }
    catch (err) { toast('error', errText(err)); }
  };
  if (loading) return <SkeletonRows count={3} height={52} />;
  return (
    <>
      <h1>My details</h1>
      <p className="muted">Stored encrypted. Only you and your treating doctor can read these, and every doctor view is logged.</p>
      <form className="card stack" onSubmit={save}>
        <TextField label="Phone" value={form.phone} onChange={(e) => setF({ ...form, phone: e.target.value })} maxLength={40} />
        <TextField label="Date of birth" type="date" value={form.dob} onChange={(e) => setF({ ...form, dob: e.target.value })} />
        <TextAreaField label="Notes for your doctor" rows={4} value={form.notes} onChange={(e) => setF({ ...form, notes: e.target.value })} maxLength={2000} />
        <Button variant="primary">Save</Button>
      </form>
    </>
  );
}
