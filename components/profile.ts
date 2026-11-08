"use client";
import { useSyncExternalStore } from "react";
import { parseChord } from "../lib/music/chords";
const key = "meu-tom:chords";
const empty: string[] = [];
let cachedRaw: string | null = null;
let cached: string[] = empty;
function read() {
  try {
    const raw = localStorage.getItem(key);
    if (raw === cachedRaw) return cached;
    const value: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (c): c is string =>
                typeof c === "string" && c.length < 40 && !!parseChord(c),
            ),
          ),
        ].slice(0, 40)
      : empty;
    cachedRaw = raw;
    return cached;
  } catch {
    // Keep the current-session profile usable when browser storage is disabled.
    return cached;
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("meu-tom:profile", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("meu-tom:profile", cb);
  };
};
export function useProfile() {
  const known = useSyncExternalStore(subscribe, read, () => empty);
  return [
    known,
    (value: string[]) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
      cachedRaw = null;
      cached = value;
      window.dispatchEvent(new Event("meu-tom:profile"));
    },
  ] as const;
}
