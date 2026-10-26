import type { ExpenseAccount } from './report-types';

export type DateRange = { start: string; end: string };
export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function businessToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-');
}
export function presetRange(preset: 'week' | 'fourWeeks' | 'month', today = businessToday()): DateRange {
  if (preset === 'month') {
    const end = shiftDate(`${today.slice(0, 7)}-01`, -1);
    return { start: `${end.slice(0, 7)}-01`, end };
  }
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(today, -((weekday + 6) % 7));
  return { start: shiftDate(monday, preset === 'week' ? -7 : -28), end: shiftDate(monday, -1) };
}
export function rangeError(range: DateRange) {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
  if (!valid(range.start) || !valid(range.end)) return 'Enter valid start and end dates.';
  const days = (Date.parse(range.end) - Date.parse(range.start)) / 86400000;
  if (days < 0) return 'The end date must be on or after the start date.';
  if (days > 1095) return 'Choose a range of at most three years.';
  return null;
}
export function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous * 100 : null;
}
export function aggregateAccounts(rows: ExpenseAccount[], allocation: string) {
  const accounts = new Map<string, ExpenseAccount>();
  rows.filter(row => allocation === 'all' || row.allocation === allocation).forEach(row => {
    const previous = accounts.get(row.account);
    accounts.set(row.account, { ...row, current_cents: Number(row.current_cents) + (previous?.current_cents ?? 0), previous_cents: Number(row.previous_cents) + (previous?.previous_cents ?? 0), line_count: Number(row.line_count) + (previous?.line_count ?? 0) });
  });
  return [...accounts.values()];
}
export function categoryShares(rows: { category: string; sales_cents: number }[]) {
  const sums = new Map<string, number>();
  rows.forEach(row => sums.set(row.category, (sums.get(row.category) ?? 0) + Number(row.sales_cents)));
  const total = [...sums.values()].reduce((sum, value) => sum + value, 0);
  return [...sums].sort((a,b) => b[1]-a[1]).map(([category, cents]) => ({category, cents, share: total > 0 ? cents/total*100 : null}));
}
