'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type City = { id: string; name: string; country: string; tz: string };
type PlaceType = 'attraction' | 'hotel' | 'transport';
type Place = {
  id: string;
  name: string;
  type: PlaceType;
  city_id: string | null;
  lat: number | null;
  lng: number | null;
  desc_he: string | null;
  maps_url: string | null;
  duration_min: number | null;
  order_idx: number | null;
  visit_date: string | null;
};

type Trip = { id: string; title: string; start_date: string | null; end_date: string | null };
type TripDay = { id: string; trip_id: string; date: string; city_id: string | null; transport: string | null; hotel_name: string | null };
type Entry = {
  id: string;
  day_id: string;
  order_idx: number;
  kind: 'place' | 'note';
  ref_id: string | null;
  duration_min: number | null;
  note_he: string | null;
  place?: { name: string | null; maps_url: string | null };
};

// Utility – create date range
function datesBetween(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(startISO);
  const end = new Date(endISO);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, Entry[]>>({});
  const [activeTripId, setActiveTripId] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Forms
  const [newTrip, setNewTrip] = useState({ title: '', start_date: '', end_date: '' });
  const [formCity, setFormCity] = useState({ name: '', country: 'Japan', tz: 'Asia/Tokyo' });
  const [formPlace, setFormPlace] = useState({
    name: '',
    type: 'attraction' as PlaceType,
    city_id: '',
    lat: '',
    lng: '',
    desc_he: '',
    maps_url: '',
    duration_min: '60'
  });

  // Init
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadAll();
  }, []);

  async function loadAll() {
    const [{ data: c }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('cities').select('*').order('name'),
      supabase.from('places').select('*').order('name'),
      supabase.from('trips').select('id, title, start_date, end_date').order('created_at', { ascending: false })
    ]);
    setCities(c ?? []);
    setPlaces(p ?? []);
    setTrips(t ?? []);
    if (t && t.length && !activeTripId) {
      setActiveTripId(t[0].id);
      await loadDays(t[0].id);
    }
  }

  async function loadDays(tripId: string) {
    const { data } = await supabase.from('trip_days').select('*').eq('trip_id', tripId).order('date', { ascending: true });
    setDays(data ?? []);
    if (data && data.length) loadEntries(data.map((d) => d.id));
  }

  async function loadEntries(dayIds: string[]) {
    if (!dayIds.length) return;
    const { data } = await supabase
      .from('day_entries')
      .select('id, day_id, order_idx, kind, ref_id, duration_min, note_he, place:ref_id(name, maps_url)')
      .in('day_id', dayIds)
      .order('order_idx', { ascending: true });
    const map: Record<string, Entry[]> = {};
    (data ?? []).forEach((e: any) => {
      const item: Entry = {
        id: e.id,
        day_id: e.day_id,
        order_idx: e.order_idx,
        kind: e.kind,
        ref_id: e.ref_id,
        duration_min: e.duration_min,
        note_he: e.note_he,
        place: e.place
      };
      map[item.day_id] = [...(map[item.day_id] ?? []), item];
    });
    setEntriesByDay(map);
  }

  /** Trips **/
  async function createTrip() {
    try {
      if (!user) throw new Error('Not logged in');
      if (!newTrip.title || !newTrip.start_date || !newTrip.end_date) throw new Error('Fill all fields');

      const { data: t } = await supabase
        .from('trips')
        .insert({ user_id: user.id, title: newTrip.title, start_date: newTrip.start_date, end_date: newTrip.end_date })
        .select('id')
        .single();

      const dates = datesBetween(newTrip.start_date, newTrip.end_date).map((d) => ({
        trip_id: t.id,
        date: d
      }));
      await supabase.from('trip_days').insert(dates);
      setActiveTripId(t.id);
      setNewTrip({ title: '', start_date: '', end_date: '' });
      loadAll();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  /** Day + Entries **/
  async function addPlaceToDay(dayId: string, placeId: string) {
    const { error } = await supabase.from('day_entries').insert({
      day_id: dayId,
      kind: 'place',
      ref_id: placeId,
      order_idx: entriesByDay[dayId]?.length ?? 0,
      duration_min: 60
    });
    if (error) setErr(error.message);
    else loadEntries([dayId]);
  }

  function patchEntryInState(dayId: string, entryId: string, patch: Partial<Entry>) {
    setEntriesByDay((prev) => {
      const list = prev[dayId] ?? [];
      return { ...prev, [dayId]: list.map((x) => (x.id === entryId ? { ...x, ...patch } : x)) };
    });
  }

  async function updateEntry(e: Entry) {
    const { error } = await supabase
      .from('day_entries')
      .update({ order_idx: e.order_idx, duration_min: e.duration_min, note_he: e.note_he })
      .eq('id', e.id);
    if (error) setErr(error.message);
  }

  async function removeEntry(id: string, dayId: string) {
    const { error } = await supabase.from('day_entries').delete().eq('id', id);
    if (error) setErr(error.message);
    else loadEntries([dayId]);
  }

  /** City & Place **/
  async function addCity() {
    const { error } = await supabase.from('cities').insert(formCity);
    if (error) setErr(error.message);
    else setFormCity({ name: '', country: 'Japan', tz: 'Asia/Tokyo' });
    loadAll();
  }

  async function addPlace() {
    const { error } = await supabase.from('places').insert({
      name: formPlace.name,
      city_id: formPlace.city_id,
      type: formPlace.type,
      lat: formPlace.lat ? Number(formPlace.lat) : null,
      lng: formPlace.lng ? Number(formPlace.lng) : null,
      desc_he: formPlace.desc_he,
      maps_url: formPlace.maps_url,
      duration_min: Number(formPlace.duration_min)
    });
    if (error) setErr(error.message);
    else setFormPlace({ name: '', type: 'attraction', city_id: '', lat: '', lng: '', desc_he: '', maps_url: '', duration_min: '60' });
    loadAll();
  }

  const citiesMap = useMemo(() => Object.fromEntries(cities.map((c) => [c.id, c.name])), [cities]);

  if (!user) return <main className="p-4">יש להתחבר</main>;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-2">פאנל ניהול טיולים</h1>
      {msg && <div className="text-green-700">{msg}</div>}
      {err && <div className="text-red-700">{err}</div>}

      {/* --- Trips --- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">צור טיול חדש</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם טיול" value={newTrip.title} onChange={(e) => setNewTrip({ ...newTrip, title: e.target.value })} />
          <input className="input" type="date" value={newTrip.start_date} onChange={(e) => setNewTrip({ ...newTrip, start_date: e.target.value })} />
          <input className="input" type="date" value={newTrip.end_date} onChange={(e) => setNewTrip({ ...newTrip, end_date: e.target.value })} />
        </div>
        <button className="btn" onClick={createTrip}>צור</button>

        {trips.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {trips.map((t) => (
              <button key={t.id} className={`btn ${t.id === activeTripId ? '' : 'bg-gray-800'}`} onClick={() => loadDays(t.id)}>
                {t.title}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* --- Days + Entries --- */}
      {days.map((day) => {
        const entries = entriesByDay[day.id] ?? [];
        const placesForCity = places.filter((p) => !day.city_id || p.city_id === day.city_id);
        return (
          <section key={day.id} className="card space-y-3">
            <h3 className="font-semibold">
              יום {new Date(day.date).toLocaleDateString('he-IL')} {day.city_id && `(${citiesMap[day.city_id]})`}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <select id={`sel-${day.id}`} className="input">
                <option value="">בחר אטרקציה</option>
                {placesForCity.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.type}] {p.name}
                  </option>
                ))}
              </select>
              <button className="btn" onClick={() => {
                const sel = document.getElementById(`sel-${day.id}`) as HTMLSelectElement;
                if (sel?.value) addPlaceToDay(day.id, sel.value);
              }}>הוסף ליום</button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-600">
                  <th>#</th><th>שם</th><th>משך</th><th>הערה</th><th>קישורים</th><th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className="border-t">
                    <td>{i + 1}</td>
                    <td>{e.place?.name}</td>
                    <td>
                      <input className="input w-20" type="number" value={e.duration_min ?? 0}
                        onChange={(ev) => patchEntryInState(day.id, e.id, { duration_min: Number(ev.target.value) })}/>
                    </td>
                    <td>
                      <input className="input w-64" value={e.note_he ?? ''} onChange={(ev) => patchEntryInState(day.id, e.id, { note_he: ev.target.value })}/>
                    </td>
                    <td>{e.place?.maps_url ? <a className="link" href={e.place.maps_url} target="_blank">מפה</a> : '—'}</td>
                    <td>
                      <button className="btn" onClick={() => updateEntry(e)}>שמור</button>
                      <button className="btn bg-gray-800" onClick={() => removeEntry(e.id, day.id)}>מחק</button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && <tr><td colSpan={6} className="text-gray-500">אין פריטים</td></tr>}
              </tbody>
            </table>
          </section>
        );
      })}

      {/* --- Cities --- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">ערים</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם עיר" value={formCity.name} onChange={(e) => setFormCity({ ...formCity, name: e.target.value })}/>
          <input className="input" placeholder="מדינה" value={formCity.country} onChange={(e) => setFormCity({ ...formCity, country: e.target.value })}/>
          <input className="input" placeholder="אזור זמן" value={formCity.tz} onChange={(e) => setFormCity({ ...formCity, tz: e.target.value })}/>
        </div>
        <button className="btn" onClick={addCity}>הוסף</button>
      </section>

      {/* --- Places --- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">אטרקציות</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={formPlace.city_id} onChange={(e) => setFormPlace({ ...formPlace, city_id: e.target.value })}>
            <option value="">בחר עיר</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="input" value={formPlace.type} onChange={(e) => setFormPlace({ ...formPlace, type: e.target.value as PlaceType })}>
            <option value="attraction">אטרקציה</option>
            <option value="hotel">מלון</option>
            <option value="transport">תחבורה</option>
          </select>
          <input className="input" placeholder="שם" value={formPlace.name} onChange={(e) => setFormPlace({ ...formPlace, name: e.target.value })}/>
          <input className="input" placeholder="קישור מפה" value={formPlace.maps_url} onChange={(e) => setFormPlace({ ...formPlace, maps_url: e.target.value })}/>
          <input className="input" placeholder="תיאור" value={formPlace.desc_he} onChange={(e) => setFormPlace({ ...formPlace, desc_he: e.target.value })}/>
          <button className="btn" onClick={addPlace}>שמור</button>
        </div>
      </section>
    </main>
  );
}
