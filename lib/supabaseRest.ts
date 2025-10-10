// lib/supabaseRest.ts
const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function baseHeaders() {
  return { apikey: ANON, Authorization: `Bearer ${ANON}` };
}

/**
 * שליפת פריטים ליום בודד (ממויין לפי position.asc)
 * @param dayId UUID של היום
 */
export async function fetchEntriesForDay(dayId: string) {
  if (!dayId) return [];
  const url = `${PROJECT_URL}/rest/v1/day_entries?select=*&day_id=eq.${dayId}&order=position.asc`;
  const r = await fetch(url, { headers: baseHeaders(), cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/**
 * שליפת ימים (אם צריך)
 */
export async function fetchDays() {
  const url = `${PROJECT_URL}/rest/v1/days?select=*`;
  const r = await fetch(url, { headers: baseHeaders(), cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
