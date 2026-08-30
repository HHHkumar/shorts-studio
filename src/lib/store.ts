import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'shorts-studio:';

/**
 * A piece of state that survives a page refresh. Used for the API keys, the
 * form settings and the last generated question, so a stray F5 never costs you
 * work (or another API call).
 */
export function useStoredState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      // Merge so that new fields added in an update still get their defaults.
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && initial && typeof initial === 'object') {
        return { ...(initial as object), ...(parsed as object) } as T;
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // storage full or blocked - not worth interrupting the user over
    }
  }, [key, value]);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [value, update];
}

export function clearStored(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
