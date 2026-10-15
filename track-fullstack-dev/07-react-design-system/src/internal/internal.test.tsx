import { renderHook, act } from '@testing-library/react';
import { composeRefs, useControllableState } from './utils';

describe('useControllableState', () => {
  it('updates itself when uncontrolled and reports changes', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 'a', onChange }));
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not change when controlled, only reports', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ value: 'a', defaultValue: 'x', onChange }));
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('a');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('composeRefs', () => {
  it('assigns callback and object refs', () => {
    const cb = vi.fn();
    const obj = { current: null as HTMLDivElement | null };
    const node = document.createElement('div');
    composeRefs(cb, obj, undefined)(node);
    expect(cb).toHaveBeenCalledWith(node);
    expect(obj.current).toBe(node);
  });
});
