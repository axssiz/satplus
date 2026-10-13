"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store shared across components and tabs.
 * Always wrapped in try/catch: storage may be unavailable (private mode, blocked).
 */
const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  let value: T = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function write<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep working in memory for this session.
    cache.set(key, { raw: JSON.stringify(value), value });
  }
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, cb: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(cb);
  const onStorage = (e: StorageEvent) => e.key === key && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLocalStore<T>(key: string, fallback: T): [T, (updater: (prev: T) => T) => void, boolean] {
  const value = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => read(key, fallback),
    () => fallback,
  );
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const update = useCallback((updater: (prev: T) => T) => write(key, updater(read(key, fallback))), [key, fallback]);
  return [value, update, hydrated];
}
