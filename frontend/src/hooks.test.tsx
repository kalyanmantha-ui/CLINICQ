import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from './api';
import { useLoad } from './hooks';

const setHidden = (hidden: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });

describe('useLoad', () => {
  afterEach(() => { vi.useRealTimers(); setHidden(false); });

  it('loads data and reports loading until it arrives', async () => {
    const { result } = renderHook(() => useLoad(() => Promise.resolve('hello')));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('hello'));
    expect(result.current.loading).toBe(false);
  });

  it('ignores an older response that arrives after a newer one', async () => {
    let resolveSlow!: (v: string) => void;
    const fn = vi.fn().mockImplementationOnce(() => new Promise<string>((r) => { resolveSlow = r; })).mockResolvedValue('fresh');
    const { result, rerender } = renderHook(({ k }) => useLoad(fn, [k]), { initialProps: { k: 1 } });
    rerender({ k: 2 });
    await waitFor(() => expect(result.current.data).toBe('fresh'));
    await act(async () => { resolveSlow('stale'); });
    expect(result.current.data).toBe('fresh');
  });

  it('shows an optimistic change at once and reconciles on reload', async () => {
    const fn = vi.fn<() => Promise<string[]>>().mockResolvedValueOnce(['a', 'b']).mockResolvedValue(['a']);
    const { result } = renderHook(() => useLoad(fn));
    await waitFor(() => expect(result.current.data).toEqual(['a', 'b']));
    act(() => result.current.mutate((cur) => (cur ? cur.filter((x) => x !== 'b') : cur)));
    expect(result.current.data).toEqual(['a']);
    await act(async () => { await result.current.reload(); });
    expect(result.current.data).toEqual(['a']);
  });

  it('polls while the tab is visible and stops while it is hidden', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue('x');
    renderHook(() => useLoad(fn, [], 5000));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const afterMount = fn.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fn.mock.calls.length).toBe(afterMount + 1);
    setHidden(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(fn.mock.calls.length).toBe(afterMount + 1);
  });

  it('turns a failed request into a readable message', async () => {
    const { result } = renderHook(() => useLoad(() => Promise.reject(new ApiError(409, 'SLOT_TAKEN'))));
    await waitFor(() => expect(result.current.error).toMatch(/Someone just took that time/));
  });
});
