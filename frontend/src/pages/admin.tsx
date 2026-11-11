import { useState, type FormEvent } from 'react';
import { api, errText, fmtFull, todayKey, type Role } from '../api';
import { useLoad } from '../hooks';

export function AdminUsers() {
  const { data, error, loading, reload } = useLoad(api.users);
  const [f, setF] = useState({ fullName: '', email: '', password: '', role: 'RECEPTIONIST' as Role, specialty: '' });
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({ ...f, specialty: f.role === 'DOCTOR' ? f.specialty : undefined });
      setMsg({ kind: 'ok', text: 'Account created.' }); setF({ ...f, fullName: '', email: '', password: '', specialty: '' }); reload();
    } catch (err) { setMsg({ kind: 'error', text: errText(err) }); }
  };
  const toggle = async (id: string, enabled: boolean) => { try { await api.setEnabled(id, enabled); reload(); } catch (e) { setMsg({ kind: 'error', text: errText(e) }); } };
  return (
    <>
      <h1>Users</h1>
      {error && <p role="alert" className="error">{error}</p>}
      <form className="card stack" onSubmit={create} aria-label="Add staff">
        <h3>Add staff</h3>
        <div className="formgrid">
          <label>Full name<input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></label>
          <label>Email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
          <label>Temporary password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} /></label>
          <label>Role<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="RECEPTIONIST">Receptionist</option><option value="DOCTOR">Doctor</option><option value="ADMIN">Admin</option></select></label>
          {f.role === 'DOCTOR' && <label>Specialty<input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} required /></label>}
        </div>
        <button className="primary">Create account</button>
        {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind}>{msg.text}</p>}
      </form>
      {loading ? <p className="muted">Loading…</p> : (
        <div className="card tablecard"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>{(data ?? []).map((u) => (
            <tr key={u.id}><td>{u.fullName}</td><td>{u.email}</td><td><span className="pill role">{u.role.toLowerCase()}</span></td>
              <td><span className={`pill ${u.enabled ? 'booked' : 'cancelled'}`}>{u.enabled ? 'active' : 'disabled'}</span></td>
              <td><button onClick={() => toggle(u.id, !u.enabled)}>{u.enabled ? 'Disable' : 'Enable'}</button></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

export function AdminSlots() {
  const docs = useLoad(api.doctors);
  const [f, setF] = useState({ doctorId: '', date: todayKey(), startHour: 9, endHour: 17, minutes: 30 });
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const doctorId = f.doctorId || docs.data?.[0]?.id || '';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { const r = await api.genSlots({ ...f, doctorId }); setMsg({ kind: 'ok', text: `${r.created} slot(s) created.` }); }
    catch (err) { setMsg({ kind: 'error', text: errText(err) }); }
  };
  return (
    <>
      <h1>Create slots</h1>
      <form className="card stack" onSubmit={submit}>
        <div className="formgrid">
          <label>Doctor<select value={doctorId} onChange={(e) => setF({ ...f, doctorId: e.target.value })}>
            {(docs.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></label>
          <label>Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
          <label>From (hour)<input type="number" min={0} max={23} value={f.startHour} onChange={(e) => setF({ ...f, startHour: +e.target.value })} /></label>
          <label>To (hour)<input type="number" min={1} max={24} value={f.endHour} onChange={(e) => setF({ ...f, endHour: +e.target.value })} /></label>
          <label>Minutes each<input type="number" min={10} max={120} step={5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} /></label>
        </div>
        <button className="primary">Create slots</button>
        {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind}>{msg.text}</p>}
      </form>
      <p className="muted">Times are clinic-local (Pacific). Existing slots are never duplicated.</p>
    </>
  );
}

export function AdminAudit() {
  const { data, error, loading } = useLoad(api.audit, [], 10000);
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Who viewed or changed what. Ids only, never patient details.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {loading ? <p className="muted">Loading…</p> : (
        <div className="card tablecard"><table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr></thead>
          <tbody>{(data ?? []).map((a) => (
            <tr key={a.id}><td>{fmtFull(a.occurredAt)}</td><td>{a.actorLabel.toLowerCase()}</td><td><code>{a.action}</code></td><td><code>{a.entityType}/{a.entityId.slice(0, 8)}</code></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
