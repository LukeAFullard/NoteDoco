import { act, renderHook } from '@testing-library/react';
import { useDebouncedSave } from './useDebouncedSave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('saves only the last value after the delay', () => {
  const save = vi.fn();
  const { result } = renderHook(() => useDebouncedSave(save, 300));
  act(() => {
    result.current.schedule('a');
    result.current.schedule('ab');
  });
  expect(save).not.toHaveBeenCalled();
  act(() => void vi.advanceTimersByTime(300));
  expect(save).toHaveBeenCalledExactlyOnceWith('ab');
});

it('flushes a pending save on unmount so nothing is lost', () => {
  const save = vi.fn();
  const { result, unmount } = renderHook(() => useDebouncedSave(save, 300));
  act(() => result.current.schedule('last words'));
  unmount();
  expect(save).toHaveBeenCalledExactlyOnceWith('last words');
});
