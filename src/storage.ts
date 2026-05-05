import type { AppState, DayLog } from "./types";

const KEY = "diet-mom-v1";

export function defaultDay(): DayLog {
  return { foodKcal: 0, walkKm: 0, bikeKm: 0, radioSets: 0 };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { profile: null, logs: {} };
    const j = JSON.parse(raw) as Partial<AppState>;
    return { profile: j.profile ?? null, logs: j.logs ?? {} };
  } catch {
    return { profile: null, logs: {} };
  }
}

export function saveState(s: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
