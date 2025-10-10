// lib/supabaseRest.ts
const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const baseHeaders = {
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
};

export function toISOfromDDMMYYYY(s: string) {
  // קולט גם dd.mm.yyyy
  const [dd, mm, yyyy] = s.split(/[./]/).map((x) => Number(x));
  if (!dd || !mm || !yyyy) throw new Error('תאריך לא תקין');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${yyyy}-${pad(mm)}-${pad(dd)}`; // YYYY-MM-DD
}

// שליפת ימים של טיול מסוים (trip_id)
export async function fetchDays(tripId: string) {
  const url = `${PROJECT_URL}/rest/v1/days?select=*&trip_id=eq.${tripId}&order=order.asc`;
  const r = await fetch(url, { headers: baseHeaders, cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// יצירת יום חדש
export async function createDay(params: { trip_id: string; dateISO: string; order?: number }) {
  const r = await fetch(`${PROJECT_URL}/rest/v1/days`, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/json', Pref
