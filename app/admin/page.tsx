'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Trip = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

type Day = {
  id: string;
  trip_id: string;
  date: string;   // YYYY-MM-DD
  order: number;  // משאיר כמותשהו בטבלת days (אם קיים אצלך)
};

type Entry = {
  id: string;
  day_id: string;
  type: 'HOTEL' | 'TRANSPORT' | 'ATTRACTION' | 'FOOD' | 'OTHER';
  name: string;
  note: string | null;
  position: number | null;     // <<< במקום order
  duration_minutes: number | null; // יישרתי לשם שהצענו
};

const DETAIL_TYPES: Entry['type'][] = ['HOTEL','TRANSPORT','ATTRACTION','FOOD','OTHER'];

export default function AdminPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<string | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newTrip, setNewTrip] = useState<Partial<Trip>>({});
  const [newDayDate, setNewDayDate] = useState<string>(''); // input type="date"

  // לשדות "הוסף פריט" לכל יום
  const [newEntryByDay, setNewEntryByDay] = useState<Record<string, Partial<Entry>>>({});

  // טעינת טיולים
  async function loadTrips() {
    const { data, error } = await supabase.from('trips').select('*').order('start_date', { ascending: true });
    if (error) { alert(error.message); return; }
    setTrips(data || []);
  }

  // טעינת ימים ופריטים לטיול
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
        .order('position', { ascending: true }); // <<< במקום order
      if (e2) { alert(e2.message); return; }
      e = (eData || []) as Entry[];
    }

    setDays((d || []) as Day[]);
    setEntries(e);
  }

  useEffect(() => { loadTrips(); }, []);
  useEffect(() => { if (activeTrip) loadTripDetails(activeTrip); }, [activeTrip]);

  // יצירת טיול חדש
  async function createTrip() {
    if (!newTrip.name) return alert('שם טיול חובה');
    const { data, error } = await supabase
      .from('trips')
      .insert({
        name: newTrip.name,
        start_date: newTrip.start_date,
        end_date: newTrip.end_date
      })
      .select('id')
      .single();

    if (error) return alert(error.message);
    setNewTrip({});
    await loadTrips();
    setActiveTrip(data!.id);
  }

  // הוסף יום (ללא prompt)
  async function addDay() {
    if (!activeTrip) return;
    if (!newDayDate) return alert('בחר תאריך (YYYY-MM-DD)');
    const { error } = await supabase
      .from('days')
      .insert({ trip_id: activeTrip, date: newDayDate, order: (days.length + 1) }); // days.order נשאר כפי שהוא אצלך
    if (error) return alert(error.message);
    setNewDayDate('');
    await loadTripDetails(activeTrip);
  }

  // helper למצב "הוסף פריט" לפי יום
  function setNewEntryField(dayId: string, patch: Partial<Entry>) {
    setNewEntryByDay(prev => ({ ...prev, [dayId]: { ...prev[dayId], ...patch } }));
  }

  // הוסף פריט (DRILL-DOWN לסוג + שדות)
  async function addEntry(dayId: string) {
    if (!activeTrip) return;
    const draft = newEntryByDay[dayId] || {};
    const type = draft.type || 'ATTRACTION';
    const name = (draft.name || '').trim();
    const duration = draft.duration_minutes ?? 60;

    if (!name) return alert('שם הפריט חובה');

    // חשב position הבא ליום הזה
    const nextPos =
      entries.filter(e => e.day_id === dayId).length + 1;

    const { error } = await supabase
      .from('day_entries')
      .insert({
        day_id: dayId,
        type,
        name,
        note: draft.note || '',
        position: nextPos,               // <<< במקום order
        duration_minutes: duration       // <<< שמה מיושר
      });

    if (error) return alert(error.message);

    // נקה שדות "הוסף" לאותו יום ורענן
    setNewEntryField(dayId, { name: '', note: '', duration_minutes: 60 });
    await loadTripDetails(activeTrip);
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

  // הזזה למעלה/למטה לפי position
  async function moveEntry(id: string, delta: number) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const sameDay = entries
      .filter(e => e.day_id === entry.day_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const idx = sameDay.findIndex(e => e.id === id);
    const swap = sameDay[idx + delta];
    if (!swap) return;

    // החלפת position בין שתי הרשומות
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

    if (activeTrip) await loadTripDetails(activeTrip);
  }

  async function deleteEntry(id: string) {
    if (!confirm('למחוק פריט זה?')) return;
    const { error } = await supabase.from('day_entries').delete().eq('id', id);
    if (error) return alert(error.message);
    if (activeTrip) await loadTripDetails(activeTrip);
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8" dir="rtl">
      <h1 className="text-3xl font-bold mb-4">פאנל ניהול טיולים</h1>

      {/* יצירת טיול חדש */}
      <section className="card space-y-4">
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
            <button
              key={t.id}
              className={`btn ${activeTrip === t.id ? '' : 'bg-gray-800'}`}
              onClick={() => setActiveTrip(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </section>

      {/* הוסף יום */}
      {activeTrip && (
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold">ימים</h2>
          <div className="flex gap-2 items-center">
            <input
              className="input"
              type="date"
              placeholder="YYYY-MM-DD"
              value={newDayDate}
              onChange={(e) => setNewDayDate(e.target.value)}
            />
            <button className="btn" onClick={addDay}>הוסף יום</button>
          </div>

          {days.map(day => (
            <section key={day.id} className="card space-y-3">
              <h3 className="text-lg font-semibold">
                יום {new Date(day.date).toLocaleDateString('he-IL')}
              </h3>

              {/* הוסף פריט ליום (inline) */}
              <div className="flex flex-wrap gap-2 items-end">
                <select
                  className="input w-36"
                  value={(newEntryByDay[day.id]?.type as Entry['type']) || 'ATTRACTION'}
                  onChange={(ev) => setNewEntryField(day.id, { type: ev.target.value as Entry['type'] })}
                >
                  {DETAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="input w-52"
                  placeholder="שם"
                  value={newEntryByDay[day.id]?.name || ''}
                  onChange={(ev) => setNewEntryField(day.id, { name: ev.target.value })}
                />
                <input
                  className="input w-24"
                  type="number"
                  min={0}
                  placeholder="משך (דק׳)"
                  value={newEntryByDay[day.id]?.duration_minutes ?? 60}
                  onChange={(ev) => setNewEntryField(day.id, { duration_minutes: Number(ev.target.value) })}
                />
                <input
                  className="input w-60"
                  placeholder="הערה"
                  value={newEntryByDay[day.id]?.note || ''}
                  onChange={(ev) => setNewEntryField(day.id, { note: ev.target.value })}
                />
                <button className="btn" onClick={() => addEntry(day.id)}>הוסף פריט</button>
              </div>

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
                  {entries
                    .filter(e => e.day_id === day.id)
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                    .map((e, i) => (
                      <tr key={e.id} className="border-t">
                        <td>{i + 1}</td>
                        <td>{e.position ?? ''}</td>
                        <td>
                          <select
                            className="input w-36"
                            value={e.type}
                            onChange={ev => (e.type = ev.target.value as Entry['type'])}
                          >
                            {DETAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td>
                          <input className="input w-52" value={e.name || ''} onChange={ev => (e.name = ev.target.value)} />
                        </td>
                        <td>
                          <input
                            className="input w-20"
                            type="number"
                            value={e.duration_minutes ?? 60}
                            onChange={ev => (e.duration_minutes = Number(ev.target.value))}
                          />
                        </td>
                        <td>
                          <input className="input w-60" value={e.note || ''} onChange={ev => (e.note = ev.target.value)} />
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
                  {entries.filter(e => e.day_id === day.id).length === 0 && (
                    <tr><td colSpan={7} className="text-gray-400">אין פריטים ביום זה</td></tr>
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
