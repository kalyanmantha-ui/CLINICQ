export type Role = 'PATIENT' | 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN';
export interface Session { token: string; userId: string; role: Role; fullName: string }
export interface Doctor { id: string; fullName: string; specialty: string }
export interface Slot { id: string; doctorId: string; startAt: string; endAt: string; status: string }
export interface MyAppointment { id: string; slotId: string; status: string; startAt: string; endAt: string; doctorName: string; specialty: string }
export interface Offer { id: string; slotId: string; doctorId: string; startAt: string; endAt: string; expiresAt: string }
export interface WaitEntry { id: string; doctorId: string; preferredWindow: string; status: string; createdAt: string }
export interface Profile { phone: string | null; dob: string | null; notes: string | null }
export interface DayAppointment { appointmentId: string; slotId: string; startAt: string; endAt: string; status: string; patientName: string; doctorName: string }
export interface PatientRecord { patientName: string; phone: string | null; dob: string | null; patientNotes: string | null; visitNotes: string | null; status: string }
export interface QueueEntry { id: string; patientName: string; doctorName: string; preferredWindow: string; status: string; createdAt: string }
export interface UserRow { id: string; email: string; fullName: string; role: Role; enabled: boolean }
export interface AuditRow { id: number; actorId: string | null; actorLabel: string; action: string; entityType: string; entityId: string; occurredAt: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

const KEY = 'clinicq.session';
export const RETURN_KEY = 'clinicq.returnTo';
export const loadSession = (): Session | null => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; }
};
export const saveSession = (s: Session | null) => {
  if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY);
};

async function req<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const s = loadSession();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && s) {            // token expired or revoked: back to login, remembering where we were
    saveSession(null);
    try { sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search); } catch { /* storage unavailable */ }
    window.location.assign('/login?expired=1');
  }
  if (!res.ok) {
    let code = 'ERROR';
    try { code = (await res.json()).error ?? code; } catch { /* no body */ }
    throw new ApiError(res.status, code);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  login: (email: string, password: string) => req<Session>('POST', '/auth/login', { email, password }),
  register: (email: string, password: string, fullName: string) => req<Session>('POST', '/auth/register', { email, password, fullName }),
  refresh: () => req<Session>('POST', '/auth/refresh'),
  doctors: () => req<Doctor[]>('GET', '/doctors'),
  slots: (doctorId: string) => req<Slot[]>('GET', `/slots?doctorId=${doctorId}`),
  book: (slotId: string, idempotencyKey: string) => req<{ id: string }>('POST', '/appointments', { slotId }, { 'Idempotency-Key': idempotencyKey }),
  myAppointments: () => req<MyAppointment[]>('GET', '/appointments/mine'),
  cancel: (id: string) => req<void>('DELETE', `/appointments/${id}`),
  joinWaitlist: (doctorId: string, preferredWindow: string) => req<WaitEntry>('POST', '/waitlist', { doctorId, preferredWindow }),
  myWaitlist: () => req<WaitEntry[]>('GET', '/waitlist/mine'),
  leaveWaitlist: (id: string) => req<void>('DELETE', `/waitlist/${id}`),
  myOffers: () => req<Offer[]>('GET', '/offers/mine'),
  acceptOffer: (id: string) => req<{ id: string }>('POST', `/offers/${id}/accept`),
  declineOffer: (id: string) => req<void>('POST', `/offers/${id}/decline`),
  profile: () => req<Profile>('GET', '/patients/me'),
  saveProfile: (p: Profile) => req<void>('PUT', '/patients/me', p),
  receptionDay: (date: string) => req<DayAppointment[]>('GET', `/reception/schedule?date=${date}`),
  receptionQueue: () => req<QueueEntry[]>('GET', '/reception/waitlist'),
  doctorDay: (date: string) => req<DayAppointment[]>('GET', `/doctor/schedule?date=${date}`),
  record: (id: string) => req<PatientRecord>('GET', `/doctor/appointments/${id}/record`),
  saveNotes: (id: string, visitNotes: string) => req<void>('PUT', `/doctor/appointments/${id}/notes`, { visitNotes }),
  complete: (id: string) => req<void>('POST', `/doctor/appointments/${id}/complete`),
  users: () => req<UserRow[]>('GET', '/admin/users'),
  createUser: (u: { email: string; password: string; fullName: string; role: Role; specialty?: string }) => req<UserRow>('POST', '/admin/users', u),
  setEnabled: (id: string, enabled: boolean) => req<void>('PATCH', `/admin/users/${id}`, { enabled }),
  genSlots: (g: { doctorId: string; date: string; startHour: number; endHour: number; minutes: number }) => req<{ created: number }>('POST', '/admin/slots', g),
  audit: () => req<AuditRow[]>('GET', '/admin/audit?limit=100'),
};

const MESSAGES: Record<string, string> = {
  SLOT_TAKEN: 'Someone just took that time. Pick another, or join the waitlist.',
  CONFLICT: 'That time was just taken by someone else.',
  BAD_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_TAKEN: 'That email is already registered.',
  ALREADY_WAITING: "You're already on this doctor's waitlist.",
  OFFER_EXPIRED: 'That offer has expired.',
  OFFER_NOT_AVAILABLE: 'That offer is no longer available.',
  RESPOND_TO_OFFER_FIRST: 'Accept or decline your offer first.',
  FORBIDDEN: "You don't have access to that.",
  INVALID_REQUEST: 'Please check the form and try again.',
};
export const errText = (e: unknown) => (e instanceof ApiError ? MESSAGES[e.code] ?? `Something went wrong (${e.code}).` : 'Network problem. Please try again.');

// ---- clinic-local time helpers (the clinic runs on Pacific time) ----
const TZ = 'America/Los_Angeles';
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
export const fmtFull = (iso: string) => `${fmtDay(iso)} · ${fmtTime(iso)}`;
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
export const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

/** Minutes since midnight, clinic time, for an instant. Used to place appointments on the day grid. */
const hm = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
export const clinicMinutes = (iso: string) => {
  const parts = hm.formatToParts(new Date(iso));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (n('hour') % 24) * 60 + n('minute');
};
export const fmtWeekday = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
export const fmtDayNumber = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' });
export const fmtMonthDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric' });
