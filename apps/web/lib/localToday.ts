/**
 * Today as YYYY-MM-DD in the browser's own timezone -- for client code. Never
 * `new Date().toISOString().slice(0, 10)`: that's UTC, already tomorrow on a
 * North American evening. Server code uses todayFor(userId) (lib/userTimezone.ts).
 */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
