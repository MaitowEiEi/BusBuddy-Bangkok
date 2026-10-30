import { useCallback, useEffect, useRef, useState } from 'react';
import { readStorage, STORAGE_EVENT, writeStorage, type StorageKey } from '../lib/storage';

export function useLocalStorage<T>(key: StorageKey, initial: T, validate?: (v: unknown) => v is T) {
  const initialRef = useRef(initial);
  const validateRef = useRef(validate);
  const [value, setValue] = useState<T>(() => readStorage(key, initial, validate));
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail !== key && detail !== '*') return;
      const next = readStorage(key, initialRef.current, validateRef.current);
      valueRef.current = next;
      setValue(next);
    };
    window.addEventListener(STORAGE_EVENT, onChange);
    return () => window.removeEventListener(STORAGE_EVENT, onChange);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = (typeof next === 'function' ? (next as (prev: T) => T)(valueRef.current) : next) as T;
      valueRef.current = resolved;
      setValue(resolved);
      writeStorage(key, resolved);
    },
    [key],
  );

  return [value, update] as const;
}