import { ApiError, clinicMinutes, dayKey, errText, fmtTime } from './api';

describe('clinic time helpers', () => {
  it('reads times in Pacific time, whatever the browser time zone is', () => {
    expect(fmtTime('2030-03-04T17:00:00Z')).toBe('9:00 AM');
    expect(clinicMinutes('2030-03-04T17:00:00Z')).toBe(9 * 60);
    expect(clinicMinutes('2030-03-04T22:30:00Z')).toBe(14 * 60 + 30);
  });

  it('follows daylight saving time', () => {
    expect(clinicMinutes('2030-07-04T16:00:00Z')).toBe(9 * 60);
  });

  it('groups instants into clinic days', () => {
    expect(dayKey('2030-03-05T06:30:00Z')).toBe('2030-03-04');
    expect(dayKey('2030-03-05T08:30:00Z')).toBe('2030-03-05');
  });

  it('treats midnight as minute 0', () => {
    expect(clinicMinutes('2030-03-04T08:00:00Z')).toBe(0);
  });
});

describe('errText', () => {
  it('translates known API codes into plain language', () => {
    expect(errText(new ApiError(409, 'OFFER_EXPIRED'))).toBe('That offer has expired.');
  });
  it('keeps the code for unknown API errors so support can find it', () => {
    expect(errText(new ApiError(500, 'BOOM'))).toContain('BOOM');
  });
  it('treats non-API errors as a network problem', () => {
    expect(errText(new TypeError('Failed to fetch'))).toMatch(/Network problem/);
  });
});
