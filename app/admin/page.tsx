'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** ========= Types ========= */
type Trip = {
  id: string;
  name: string;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;   // YYYY-MM-DD
};

type Day = {
  id: string;
  trip_id: string;
  date: string;   // YYYY-MM-DD
  order: number | null; // אם יש לך עמודה כזו ב-days
};

type DetailType = 'HOTEL' | 'TRANSPORT' | 'ATTRACTION' | 'FOOD' | 'OTHER';

type Entry = {
  id: string;
  day_id: string;
  type: DetailType;
  name: string;
  note: string | null;
  position: number | null;        // מיקום ביום
  duration_minutes: number | null;
  created_at?: string;
};

const DETAIL_TYPES: DetailType[] = ['HOTEL','TRANSPORT','ATTRACTION','FOOD','OTHER'];

/** תאריכים בין שני ISO (כולל קצוות) */
function datesBetweenISO(startISO: string, endISO: string): string[] {
  const res: string[] = [];
  const s = new Date(startISO); s.setHours(0,0,0,0);
  const e = new Date(endISO);  e.setHours(0,0,0,0);
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    res.push(`${yyyy}-${mm}-${dd}`);
  }
  return res;
}

export default function AdminPage() {
  /** ======= Trips ======= */
  const [trips, setTrips] = useState<Trip[]>([]);
  const [newTrip, setNewTrip] = useState<Partial<Trip>>({});
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  /** ======= Days & Entries ======= */
  const [days, setDays] = useState<Day[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newDayDate, setNewDayDate] = useState<string>(''); // להוספת יום בודד

  /** טופס "הוסף פריט" לכל יום */
  const [draftByDay, setDraftByDay] = useState<Record<string, Partial<Entry>>>({});

  function setDraft(dayId: string, patch: Partial<Entry>) {
    setDraftByDay((prev) => ({ ...prev, [dayId]: { ...prev[dayId], ...patch } }));
  }

  /** ======= Loaders ======= */
  async function loadTrips() {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('start_date', { ascending: true });
    if (error) { alert(error.message); return; }
    setTrips(data || []);
  }

  async function loadTripDetails(tripId: string) {
    const { data: d, error: e1 } = await supabase
      .from('days')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true });

    if (e1) { alert(e1.message); return; }

    const dayIds = (d || []).map(x => x.id);
    let e: Entry[] = [];
    if (dayIds.length > 0) {
      const { data: eData, error: e2 } = await supabase
        .from('day_entries')
        .select('*')
        .in('day_id', dayIds)
        .order('position', { ascending: true });
      if (e2) { alert(e2.message); return; }
      e = (eData || []) as Entry[];
    }

    setDays((d || []) as Day[]);
    setEntries(e);
  }

  useEffect(() => { loadTrips(); }, []);
  useEffect(() => { if (activeTripId) loadTripDetails(activeTripId); }, [activeTripId]);

  /** ======= Create Trip + expand days ======= */
  async function createTrip() {
    if (!newTrip.name) return alert('שם טיול חובה');
    if (!newTrip.start_date || !newTrip.end_date) return alert('יש לבחור טווח תאריכים');

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        name: newTrip.name,
        start_date: newTrip.start_date,
        end_date: newTrip.end_date
      })
      .select('id,start_date,end_date')
      .single();
    if (error) return alert(error.message);
    const tripId = trip!.id;

    const list = datesBetweenISO(trip!.start_date!, trip!.end_date!)
      .map((dateISO, idx) => ({ trip_id: tripId, date: dateISO, order: idx + 1 }));

    if (list.length) {
      const { error: e2 } = await supabase.from('days').insert(list);
      if (e2) return alert('שגיאה בהכנסת הימים: ' + e2.message);
    }

    setNewTrip({});
    setActiveTripId(tripId);
    await loadTrips();
    await loadTripDetails(tripId);
  }

  /** ======= Add single day (optional) ======= */
  async function addDay() {
    if (!activeTripId) return;
    if (!newDayDate) return alert('בחר תאריך');
    const { error } = await supabase
      .from('days')
      .insert({ trip_id: activeTripId, date: newDayDate, order: (days.length + 1) });
    if (error) return alert(error.message);
    setNewDayDate('');
    await loadTripDetails(activeTripId);
  }

  /** ======= Entries CRUD ======= */
  async function addEntry(dayId: string) {
    if (!activeTripId) return;
    const d = draftByDay[dayId] || {};
    const name = (d.name || '').trim();
    const type = (d.type as DetailType) || 'ATTRACTION';
    const duration = d.duration_minutes ?? 60;
    const note = d.note ?? '';

    if (!name) return alert('שם הפריט חובה');

    const nextPos = entries.filter(e => e.day_id === dayId).length + 1;

    const { error } = await supabase
      .from('day_entries')
      .insert({
        day_id: dayId,
        type,
        name,
        note,
        position: nextPos,
        duration_minutes: duration
      });
    if (error) return alert(error.message);

    setDraft(dayId, { name: '', note: '', duration_minutes: 60 });
    await loadTripDetails(activeTripId);
  }

  async function saveEntry(e: Entry) {
    const { error } = await supabase
      .from('day_entries')
      .update({
        type: e.type,
        name: e.name,
        note: e.note,
        duration_minutes: e.duration_minutes
      })
      .eq('id', e.id);
    if (error) alert(error.message);
  }

  async function deleteEntry(id: string) {
    if (!confirm('למחוק פריט זה?')) return;
    const { error } = await supabase.from('day_entries').delete().eq('id', id);
    if (error) return alert(error.message);
    if (activeTripId) await loadTripDetails(activeTripId);
  }

  async function moveEntry(id: string, delta: number) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const sameDay = entries
      .filter(e => e.day_id === entry.day_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const idx = sameDay.findIndex(e => e.id === id);
    const swap = sameDay[idx + delta];
    if (!swap) return;

    const { error: e1 } = await supabase
      .from('day_entries')
      .update({ position: swap.position })
      .eq('id', entry.id);
    if (e1) return alert(e1.message);

    const { error: e2 } = await supabase
      .from('day_entries')
      .update({ position: entry.position })
      .eq('id', swap.id);
    if (e2) return alert(e2.message);

    if (activeTripId) await loadTripDetails(activeTripId);
  }

  /** קבוצת פריטים לפי יום (לנוחות הרינדור) */
  const entriesByDay = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      (map[e.day_id] ||= []).push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a,b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return map;
  }, [entries]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8" dir="rtl">
      <h1 className="text-3xl font-bold">פאנל ניהול טיולים</h1>

      {/* יצירת טיול + בחירת טיול פעיל */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">צור טיול חדש</h2>
        <div className="grid grid-cols-4 gap-3">
          <input className="input" placeholder="שם טיול"
                 value={newTrip.name || ''} onChange={e => setNewTrip(t => ({ ...t, name: e.target.value }))} />
          <input className="input" type="date"
                 value={newTrip.start_date || ''} onChange={e => setNewTrip(t => ({ ...t, start_date: e.target.value }))} />
          <input className="input" type="date"
                 value={newTrip.end_date || ''} onChange={e => setNewTrip(t => ({ ...t, end_date: e.target.value }))} />
          <button className="btn" onClick={createTrip}>צור</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {trips.map(t => (
            <button key={t.id}
                    className={`btn ${activeTripId === t.id ? '' : 'bg-gray-800'}`}
                    onClick={() => setActiveTripId(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      </section>

      {/* אזור הימים והפעילויות */}
      {activeTripId && (
        <section className="space-y-6">
          {/* הוספת יום יחיד */}
          <div className="flex items-center gap-2">
            <input className="input" type="date" value={newDayDate}
                   onChange={(e) => setNewDayDate(e.target.value)} />
            <button className="btn" onClick={addDay}>הוסף יום</button>
          </div>

          {/* כל הימים בטיול */}
          {days.map(day => (
            <section key={day.id} className="card space-y-3">
              <h3 className="text-lg font-semibold">
                {new Date(day.date).toLocaleDateString('he-IL')}
              </h3>

              {/* טופס הוספת פעילות ליום */}
              <div className="flex flex-wrap gap-2 items-end">
                <select
                  className="input w-36"
                  value={(draftByDay[day.id]?.type as DetailType) || 'ATTRACTION'}
                  onChange={(ev) => setDraft(day.id, { type: ev.target.value as DetailType })}
                >
                  {DETAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="input w-56"
                  placeholder="שם הפעילות"
                  value={draftByDay[day.id]?.name || ''}
                  onChange={(ev) => setDraft(day.id, { name: ev.target.value })}
                />
                <input
                  className="input w-28" type="number" min={0}
                  placeholder="דקות"
                  value={draftByDay[day.id]?.duration_minutes ?? 60}
                  onChange={(ev) => setDraft(day.id, { duration_minutes: Number(ev.target.value) })}
                />
                <input
                  className="input w-72"
                  placeholder="הערה"
                  value={draftByDay[day.id]?.note || ''}
                  onChange={(ev) => setDraft(day.id, { note: ev.target.value })}
                />
                <button className="btn" onClick={() => addEntry(day.id)}>הוסף פעילות</button>
              </div>

              {/* טבלת פעילויות ליום */}
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="text-gray-600">
                    <th>#</th>
                    <th>מיקום</th>
                    <th>סוג</th>
                    <th>שם</th>
                    <th>משך (דק׳)</th>
                    <th>הערה</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {(entriesByDay[day.id] || []).map((e, i) => (
                    <tr key={e.id} className="border-t">
                      <td>{i + 1}</td>
                      <td>{e.position ?? ''}</td>
                      <td>
                        <select className="input w-36" value={e.type}
                                onChange={(ev) => (e.type = ev.target.value as DetailType)}>
                          {DETAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td>
                        <input className="input w-56" value={e.name || ''} onChange={(ev) => (e.name = ev.target.value)} />
                      </td>
                      <td>
                        <input className="input w-24" type="number"
                               value={e.duration_minutes ?? 60}
                               onChange={(ev) => (e.duration_minutes = Number(ev.target.value))} />
                      </td>
                      <td>
                        <input className="input w-72" value={e.note || ''} onChange={(ev) => (e.note = ev.target.value)} />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn" onClick={() => saveEntry(e)}>שמור</button>
                          <button className="btn bg-gray-700" onClick={() => deleteEntry(e.id)}>מחק</button>
                          <button className="btn bg-gray-500" onClick={() => moveEntry(e.id, -1)}>▲</button>
                          <button className="btn bg-gray-500" onClick={() => moveEntry(e.id, 1)}>▼</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(entriesByDay[day.id] || []).length === 0 && (
                    <tr><td colSpan={7} className="text-gray-400">אין פעילויות ביום זה</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          ))}
        </section>
      )}
    </main>
  );
}
