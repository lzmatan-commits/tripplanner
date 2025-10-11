// lib/supabaseRest.ts
// שימוש ב-Supabase REST (PostgREST) לטבלאות: days, day_entries
// דורש משתני סביבה (צד-לקוח): 
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!PROJECT_URL || !ANON) {
  // עוזר לזהות מהר בעיית קונפיגורציה בפרודקשן
  // אל תעצור כאן באכזריות באפליקציה אמיתית—מומלץ לטפל יפה יותר ב־UI
  // eslint-disable-next-line no-console
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const baseHeaders: HeadersInit = {
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
};

type DetailType = 'HOTEL' | 'TRANSPORT' | 'ATTRACTION' | 'FOOD' | 'OTHER';

export type DayRow = {
  id: string;             // uuid
  trip_id: string;        // uuid (אם אצלך שדה זה קיים)
  date: string;           // YYYY-MM-DD (Date ב-Postgres)
  order?: number | null;  // אופציונלי אם יש לך עמודת order ב-days
  created_at?: string;
  title?: string | null;
  note?: string | null;
};

export type DayEntryRow = {
  id: string;               // uuid
  day_id: string;           // uuid (FK ל-days.id)
  type: DetailType;
  name: string;
  duration_minutes?: number | null;
  group?: string | null;
  note?: string | null;
  position?: number | null; // מיון (במקום order)
  created_at?: string;
};

// ---------- עוזרים ----------

/** ממיר קלט dd/mm/yyyy או dd.mm.yyyy ל-YYYY-MM-DD */
export function toISOfromDDMMYYYY(s: string): string {
  const parts = s.split(/[./]/).map(Number);
  if (parts.length !== 3) throw new Error('תאריך לא תקין (צפה ל-dd/mm/yyyy)');
  const [dd, mm, yyyy] = parts;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${yyyy}-${pad(mm)}-${pad(dd)}`;
}

// ---------- Days ----------

/** שליפת ימים (אופציונלית: לפי tripId) */
export async function fetchDays(tripId?: string): Promise<DayRow[]> {
  const qp = new URLSearchParams({ select: '*' });
  // ממיינים לפי date כברירת מחדל ליציבות
  qp.append('order', 'date.asc');

  if (tripId) qp.append('trip_id', `eq.${tripId}`);

  // משתמשים בטבלת 'trip_days' לפי הסכימה במאגר
  const url = `${PROJECT_URL}/rest/v1/trip_days?${qp.toString()}`;
  const r = await fetch(url, { headers: baseHeaders, cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** יצירת יום חדש */
export async function createDay(params: {
  dateISO: string;         // YYYY-MM-DD
  trip_id?: string;        // אם הסכמה שלך כוללת trip_id
  title?: string | null;
  note?: string | null;
}): Promise<DayRow[]> {
  const body: any = { date: params.dateISO };
  if (params.trip_id) body.trip_id = params.trip_id;
  if (params.title !== undefined) body.title = params.title;
  if (params.note !== undefined) body.note = params.note;

  // מפרסם ל-'trip_days' לפי הסכמה
  const r = await fetch(`${PROJECT_URL}/rest/v1/trip_days`, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // PostgREST מחזיר מערך עם הרשומה(ות)
}

// ---------- Day Entries ----------

/** שליפת פריטים ליום בודד (position.asc) */
export async function fetchEntriesForDay(dayId: string): Promise<DayEntryRow[]> {
  if (!dayId) return [];
  const url = `${PROJECT_URL}/rest/v1/day_entries?select=*&day_id=eq.${dayId}&order=position.asc`;
  const r = await fetch(url, { headers: baseHeaders, cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** שליפת פריטים לכמה ימים (נמנע מקריאה אם הרשימה ריקה) */
export async function fetchEntriesForDays(dayIds: string[]): Promise<DayEntryRow[]> {
  if (!dayIds || dayIds.length === 0) return [];
  const inList = dayIds.join(','); // UUID לא דורש מרכאות
  const url = `${PROJECT_URL}/rest/v1/day_entries?select=*&day_id=in.(${inList})&order=position.asc`;
  const r = await fetch(url, { headers: baseHeaders, cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** הוספת פריט ליום */
export async function addEntry(p: {
  day_id: string;
  type: DetailType;
  name: string;
  duration_minutes?: number;
  group?: string;
  note?: string;
  position?: number; // במקום order
}): Promise<DayEntryRow[]> {
  const r = await fetch(`${PROJECT_URL}/rest/v1/day_entries`, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(p),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** עדכון פריט קיים (PATCH) */
export async function updateEntry(id: string, patch: Partial<{
  type: DetailType;
  name: string;
  duration_minutes: number;
  group: string;
  note: string;
  position: number;
}>): Promise<DayEntryRow[]> {
  const url = `${PROJECT_URL}/rest/v1/day_entries?id=eq.${id}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...baseHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** מחיקת פריט */
export async function deleteEntry(id: string): Promise<boolean> {
  const url = `${PROJECT_URL}/rest/v1/day_entries?id=eq.${id}`;
  const r = await fetch(url, { method: 'DELETE', headers: baseHeaders });
  if (!r.ok) throw new Error(await r.text());
  return true;
}
