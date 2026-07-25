import { get, set } from 'idb-keyval';
import { STORAGE_KEY } from '../config';
import type { PersistedState } from '../types';

export async function loadPersisted(): Promise<PersistedState | null> {
  try {
    const raw = await get<PersistedState>(STORAGE_KEY);
    if (!raw || raw.version !== 1 || !Array.isArray(raw.projects)) return null;
    return raw;
  } catch {
    return null;
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;

export function savePersisted(state: PersistedState) {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    void set(STORAGE_KEY, state).catch(() => {});
  }, 400);
}
