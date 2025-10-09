'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DrivePickerButton from '@/app/components/DrivePickerButton';

type Trip = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

type Day = {
  id: string;
  trip_id: string;
  date: string;
  order: number;
};

type Entry = {
  id: string;
  day_id: string;
  type: string;
  name: string;
  note: string | null;
  order: number;
  duration_min: number | null;
};

export default function AdminPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<string | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newTrip, setNewTrip] = useState<Partial<Trip>>({});
  const [loading, setLoading] = useState(false);

  // טעינת טיולים
  async function loadTrips() {
    const { data } = await supabase.from('trips').select('*').order('start_date');
    setTrips(data || []);
  }

  // טעינת ימים ופריטים
  async function loadTripDetails(tripId: string) {
    const { data: d } = await supabase.from('days').select('*').eq('trip_id', tripId).order('date');
    const { data: e } = await supabase.from('day_entries').select('*').in('day_id', d?.map(x => x.id) || []).order('order');
    setDays(d || []);
    setEntries(e || []);
  }

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    if (activeTrip) loadTripDetails(activeTrip);
  }, [activeTrip]);

  async function createTrip() {
    if (!newTrip.name) return alert('שם טיול חובה');
    const { data, error } = await supabase.from('trips').insert({
      name: newTrip.name,
      start_date: newTrip.start_date,
      end_date: newTrip.end_date
    }).select('id').single();
    if (error) return alert(error.message);
    setNewTrip({});
    await loadTrips();
    setActiveTrip(data.id);
  }

  async function addDay() {
    if (!activeTrip) return;
    const date = prompt('הזן תאריך (YYYY-MM-DD)');
    if (!date) return;
    await supabase.from('days').insert({ trip_id: activeTrip, date, order: days.length + 1 });
    await loadTripDetails(activeTrip);
  }

  async function addEntry(dayId: string) {
    const type = prompt('בחר סוג (מלון, תחבורה, מסעדה, פעילות)');
    const name = prompt('שם האטרקציה / המקום');
    if (!name) return;
    await supabase.from('day_entries').insert({
      day_id: dayId,
      type,
      name,
      note: '',
      order: (entries.filter(e => e.day_id === dayId).length) + 1,
      duration_min: 60
    });
    await loadTripDetails(activeTrip!);
  }

  async function saveEntry(e: Entry) {
    const { error } = await supabase.from('day_entries')
      .update({
        type: e.type,
        name: e.name,
        note: e.note,
        duration_min: e.duration_min
      })
      .eq('id', e.id);
    if (error) alert(error.message);
  }

  async function deleteEntry(id: string) {
    if (!confirm('למחוק פריט זה?')) return;
    await supabase.from('day_entries').delete().eq('id', id);
    await loadTripDetails(activeTrip!);
  }

  async function moveEntry(id: string, delta: number) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const sameDay = entries.filter(e => e.day_id === entry.day_id).sort((a, b) => a.order - b.order);
    const idx = sameDay.findIndex(e => e.id === id);
    const swap = sameDay[idx + delta];
    if (!swap) return;
    await supabase.from('day_entries').update({ order: swap.order }).eq('id', entry.id);
    await supabase.from('day_entries').update({ order: entry.order }).eq('id', swap.id);
    await loadTripDetails(activeTrip!);
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold mb-4">פאנל ניהול טיולים</h1>

      {/* יצירת טיול חדש */}
      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">צור טיול חדש</h2>
        <div className="grid grid-cols-4 gap-3">
          <input className="input" placeholder="שם טיול" value={newTrip.name || ''} onChange={e => setNewTrip(t => ({ ...t, name: e.target.value }))} />
          <input className="input" type="date" value={newTrip.start_date || ''} onChange={e => setNewTrip(t => ({ ...t, start_date: e.target.value }))} />
          <input className="input" type="date" value={newTrip.end_date || ''} onChange={e => setNewTrip(t => ({ ...t, end_date: e.target.value }))} />
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

      {/* ימים */}
      {activeTrip && (
        <>
          <button className="btn" onClick={addDay}>הוסף יום</button>

          {days.map(day => (
            <section key={day.id} className="card space-y-3">
              <h3 className="text-lg font-semibold">
                יום {new Date(day.date).toLocaleDateString('he-IL')}
              </h3>

              <button className="btn" onClick={() => addEntry(day.id)}>הוסף פריט</button>

              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="text-gray-600">
                    <th>#</th>
                    <th>סוג</th>
                    <th>שם</th>
                    <th>משך (דק')</th>
                    <th>הערה</th>
                    <th>קבצים</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.filter(e => e.day_id === day.id).sort((a, b) => a.order - b.order).map((e, i) => (
                    <tr key={e.id} className="border-t">
                      <td>{i + 1}</td>
                      <td>
                        <input className="input w-24" value={e.type || ''} onChange={ev => (e.type = ev.target.value)} />
                      </td>
                      <td>
                        <input className="input w-52" value={e.name || ''} onChange={ev => (e.name = ev.target.value)} />
                      </td>
                      <td>
                        <input className="input w-20" type="number" value={e.duration_min || 60} onChange={ev => (e.duration_min = Number(ev.target.value))} />
                      </td>
                      <td>
                        <textarea className="input w-60" value={e.note || ''} onChange={ev => (e.note = ev.target.value)} />
                      </td>
                      <td>
                        <DrivePickerButton entryId={e.id} />
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
        </>
      )}
    </main>
  );
}
