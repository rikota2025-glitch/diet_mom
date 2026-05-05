export function formatISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return formatISO(new Date());
}

export function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return formatISO(dt);
}

export function enumerateDates(from, to) {
  if (from > to) return [];
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

export function monthStartsBetween(from, to) {
  const starts = new Set();
  for (const iso of enumerateDates(from, to)) {
    starts.add(`${iso.slice(0, 7)}-01`);
  }
  return [...starts].sort();
}

export function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
