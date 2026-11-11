import { useState, type FormEvent } from 'react';
import { api, errText, fmtFull, todayKey, type AuditRow, type Role, type UserRow } from '../api';
import { useLoad } from '../hooks';
import { Button, DataTable, Notice, Pill, SelectField, SkeletonRows, TextField, useToast, type Column } from '../ui';

export function AdminUsers() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(api.users);
  const [f, setF] = useState({ fullName: '', email: '', password: '', role: 'RECEPTIONIST' as Role, specialty: '' });
  const [busy, setBusy] = useState(false);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createUser({ ...f, specialty: f.role === 'DOCTOR' ? f.specialty : undefined });
      toast('ok', 'Account created.'); setF({ ...f, fullName: '', email: '', password: '', specialty: '' }); reload();
    } catch (err) { toast('error', errText(err)); } finally { setBusy(false); }
  };
  const toggle = async (id: string, enabled: boolean) => { try { await api.setEnabled(id, enabled); reload(); } catch (e) { toast('error', errText(e)); } };
  const columns: Column<UserRow>[] = [
    { key: 'name', header: 'Name', render: (u) => u.fullName },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'role', header: 'Role', render: (u) => <Pill tone="role">{u.role.toLowerCase()}</Pill> },
    { key: 'status', header: 'Status', render: (u) => <Pill tone={u.enabled ? 'booked' : 'cancelled'}>{u.enabled ? 'active' : 'disabled'}</Pill> },
    { key: 'act', header: 'Actions', render: (u) => <Button type="button" onClick={() => toggle(u.id, !u.enabled)}>{u.enabled ? 'Disable' : 'Enable'}</Button> },
  ];
  return (
    <>
      <h1>Users</h1>
      {error && <Notice kind="error">{error}</Notice>}
      <form className="card stack" onSubmit={create} aria-label="Add staff">
        <h3>Add staff</h3>
        <div className="formgrid">
          <TextField label="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required />
          <TextField label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          <TextField label="Temporary password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} hint="At least 8 characters." />
          <SelectField label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="RECEPTIONIST">Receptionist</option><option value="DOCTOR">Doctor</option><option value="ADMIN">Admin</option>
          </SelectField>
          {f.role === 'DOCTOR' && <TextField label="Specialty" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} required />}
        </div>
        <Button variant="primary" busy={busy}>Create account</Button>
      </form>
      {loading && !data ? <SkeletonRows count={4} height={48} /> : <DataTable caption="Staff and patient accounts" rows={data ?? []} columns={columns} rowKey={(u) => u.id} pageSize={20} />}
    </>
  );
}

export function AdminSlots() {
  const toast = useToast();
  const docs = useLoad(api.doctors);
  const [f, setF] = useState({ doctorId: '', date: todayKey(), startHour: 9, endHour: 17, minutes: 30 });
  const [busy, setBusy] = useState(false);
  const doctorId = f.doctorId || docs.data?.[0]?.id || '';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { const r = await api.genSlots({ ...f, doctorId }); toast('ok', `${r.created} slot(s) created.`); }
    catch (err) { toast('error', errText(err)); } finally { setBusy(false); }
  };
  return (
    <>
      <h1>Create slots</h1>
      <form className="card stack" onSubmit={submit}>
        <div className="formgrid">
          <SelectField label="Doctor" value={doctorId} onChange={(e) => setF({ ...f, doctorId: e.target.value })}>
            {(docs.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </SelectField>
          <TextField label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />
          <TextField label="From (hour)" type="number" min={0} max={23} value={f.startHour} onChange={(e) => setF({ ...f, startHour: +e.target.value })} />
          <TextField label="To (hour)" type="number" min={1} max={24} value={f.endHour} onChange={(e) => setF({ ...f, endHour: +e.target.value })} />
          <TextField label="Minutes each" type="number" min={10} max={120} step={5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} />
        </div>
        <Button variant="primary" busy={busy}>Create slots</Button>
      </form>
      <p className="muted">Times are clinic-local (Pacific). Existing slots are never duplicated.</p>
    </>
  );
}

export function AdminAudit() {
  const { data, error, loading } = useLoad(api.audit, [], 10000);
  const columns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', render: (a) => fmtFull(a.occurredAt) },
    { key: 'who', header: 'Who', render: (a) => a.actorLabel.toLowerCase() },
    { key: 'action', header: 'Action', render: (a) => <code>{a.action}</code> },
    { key: 'record', header: 'Record', render: (a) => <code>{a.entityType}/{a.entityId.slice(0, 8)}</code> },
  ];
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Who viewed or changed what. Ids only, never patient details.</p>
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? <SkeletonRows count={6} height={44} /> : <DataTable caption="Audit log" rows={data ?? []} columns={columns} rowKey={(a) => String(a.id)} pageSize={20} />}
    </>
  );
}

