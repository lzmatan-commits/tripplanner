'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** ========= Types ========= */
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

type TripDay = {
  id: string;
  trip_id: string;
  date: string; // YYYY-MM-DD
  city_id: string | null;
  transport: string | null;
  hotel_name: string | null;
};

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

/** ========= Utils ========= */
function datesBetween(startISO: string, endISO: string) {
  const out: string[] = [];
  if (!startISO || !endISO) return out;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(+start) || Number.isNaN(+end)) return out;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** ========= Component ========= */
export default function AdminPage() {
  const [user, setUser] = useState<any>(null);

  // DB data
  const [cities, setCities] = useState<City[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, Entry[]>>({});

  // selection
  const [activeTripId, setActiveTripId] = useState<string>('');

  // forms
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

  // messages
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** ----- Init ----- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    try {
      const [cRes, pRes, tRes] = await Promise.all([
        supabase.from('cities').select('*').order('name'),
        supabase.from('places').select('*').order('name'),
        supabase.from('trips').select('id, title, start_date, end_date').order('created_at', { ascending: false })
      ]);
      setCities(cRes.data ?? []);
      setPlaces(pRes.data ?? []);
      setTrips(tRes.data ?? []);
      const firstTripId = tRes.data?.[0]?.id;
      if (!activeTripId && firstTripId) {
        setActiveTripId(firstTripId);
        await loadDays(firstTripId);
      } else if (activeTripId) {
        await loadDays(activeTripId);
      }
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  async function loadDays(tripId: string) {
    const { data, error } = await supabase
      .from('trip_days')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true });
    if (error) { setErr(error.message); return; }
    setDays(data ?? []);
    const ids = (data ?? []).map(d => d.id);
    await loadEntriesForDays(ids);
  }

  async function loadEntriesForDays(dayIds: string[]) {
    if (!dayIds?.length) { setEntriesByDay({}); return; }
    const { data, error } = await supabase
      .from('day_entries')
      .select('id, day_id, order_idx, kind, ref_id, duration_min, note_he, place:ref_id(name, maps_url)')
      .in('day_id', dayIds)
      .order('order_idx', { ascending: true });
    if (error) { setErr(error.message); return; }
    const map: Record<string, Entry[]> = {};
    for (const e of (data ?? [])) {
      const row: Entry = {
        id: e.id, day_id: e.day_id, order_idx: e.order_idx, kind: e.kind,
        ref_id: e.ref_id, duration_min: e.duration_min, note_he: e.note_he, place: e.place
      };
      map[row.day_id] = [...(map[row.day_id] ?? []), row];
    }
    setEntriesByDay(map);
  }

  /** ----- Trips ----- */
  async function createTrip() {
    try {
      setMsg(null); setErr(null);
      if (!user) throw new Error('יש להתחבר');
      const { title, start_date, end_date } = newTrip;
      if (!title || !start_date || !end_date) throw new Error('מלא שם ותאריכים');

      const { data: t, error: e1 } = await supabase
        .from('trips')
        .insert({ user_id: user.id, title, start_date, end_date })
        .select('id')
        .single();
      if (e1) throw e1;

      const daysRows = datesBetween(start_date, end_date).map(d => ({ trip_id: t!.id, date: d }));
      if (daysRows.length) await supabase.from('trip_days').insert(daysRows);

      setNewTrip({ title: '', start_date: '', end_date: '' });
      setActiveTripId(t!.id);
      await loadAll();
      await loadDays(t!.id);
      setMsg('טיול נוצר בהצלחה');
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  /** ----- Entries helpers ----- */
  function patchEntryInState(dayId: string, entryId: string, patch: Partial<Entry>) {
    setEntriesByDay(prev => {
      const list = prev[dayId] ?? [];
      const next = list.map(x => x.id === entryId ? { ...x, ...patch } : x);
      return { ...prev, [dayId]: next };
    });
  }

  async function addPlaceToDay(dayId: string, placeId: string, duration = 60) {
    const order = (entriesByDay[dayId]?.length ?? 0);
    const { error } = await supabase.from('day_entries').insert({
      day_id: dayId, kind: 'place', ref_id: placeId, duration_min: duration, order_idx: order
    });
    if (error) setErr(error.message); else await loadEntriesForDays([dayId]);
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
    if (error) setErr(error.message); else await loadEntriesForDays([dayId]);
  }

  /** ----- Cities & Places ----- */
  async function addCity() {
    const { error } = await supabase.from('cities').insert(formCity);
    if (error) setErr(error.message);
    else { setFormCity({ name: '', country: 'Japan', tz: 'Asia/Tokyo' }); await loadAll(); }
  }

  async function addPlace() {
    const p = {
      name: formPlace.name,
      type: formPlace.type,
      city_id: formPlace.city_id || null,
      lat: formPlace.lat ? Number(formPlace.lat) : null,
      lng: formPlace.lng ? Number(formPlace.lng) : null,
      desc_he: formPlace.desc_he || null,
      maps_url: formPlace.maps_url || null,
      duration_min: formPlace.duration_min ? Number(formPlace.duration_min) : null
    };
    const { error } = await supabase.from('places').insert(p);
    if (error) setErr(error.message);
    else {
      setFormPlace({ name: '', type: 'attraction', city_id: '', lat: '', lng: '', desc_he: '', maps_url: '', duration_min: '60' });
      await loadAll();
    }
  }

  /** ----- Safe memo (prevents React #310) ----- */
  const citiesMap = useMemo(() => {
    try {
      if (!Array.isArray(cities)) return {};
      const pairs = cities
        .filter((c: any) => c && c.id != null)
        .map((c: any) => [String(c.id), c.name ?? '']);
      return Object.fromEntries(pairs);
    } catch { return {}; }
  }, [cities]);

  if (!user) return <main className="p-4">יש להתחבר כדי לערוך.</main>;

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">פאנל ניהול</h1>
      {msg && <div className="text-green-700">{msg}</div>}
      {err && <div className="text-red-700">{err}</div>}

      {/* ----- Trips ----- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">צור טיול</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם טיול"
                 value={newTrip.title} onChange={e=>setNewTrip({...newTrip, title:e.target.value})}/>
          <input className="input" type="date"
                 value={newTrip.start_date} onChange={e=>setNewTrip({...newTrip, start_date:e.target.value})}/>
          <input className="input" type="date"
                 value={newTrip.end_date} onChange={e=>setNewTrip({...newTrip, end_date:e.target.value})}/>
        </div>
        <button className="btn" onClick={createTrip}>צור טיול</button>

        <div className="pt-2">
          <div className="label mb-1">הטיולים שלי</div>
          <div className="flex flex-wrap gap-2">
            {trips.map(t =>
              <button key={t.id}
                      className={`btn ${activeTripId===t.id ? '' : 'bg-gray-800'}`}
                      onClick={()=>{ setActiveTripId(t.id); void loadDays(t.id); }}>
                {t.title || t.id.slice(0,8)}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ----- Days + Entries ----- */}
      {days.map(day => {
        const entries = entriesByDay[day.id] ?? [];
        const availablePlaces = places.filter(p => !day.city_id || p.city_id === day.city_id);
        return (
          <section key={day.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                יום {new Date(day.date).toLocaleDateString('he-IL')}
                {day.city_id && <> · {citiesMap[day.city_id]}</>}
              </h3>
            </div>

            {/* Add place to day */}
            <div className="grid grid-cols-3 gap-2">
              <select id={`add-place-${day.id}`} className="input">
                <option value="">בחר אטרקציה להוספה</option>
                {availablePlaces.map(p => (
                  <option key={p.id} value={p.id}>[{p.type}] {p.name}</option>
                ))}
              </select>
              <input id={`dur-${day.id}`} className="input" type="number" placeholder="משך (דקות)" defaultValue={60}/>
              <button className="btn" onClick={()=>{
                const sel = document.getElementById(`add-place-${day.id}`) as HTMLSelectElement | null;
                const dur = document.getElementById(`dur-${day.id}`) as HTMLInputElement | null;
                if (sel?.value) void addPlaceToDay(day.id, sel.value, Number(dur?.value || 60));
              }}>הוסף ליום</button>
            </div>

            {/* Entries table */}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-gray-600">
                    <th className="p-2">#</th>
                    <th className="p-2">שם</th>
                    <th className="p-2">משך</th>
                    <th className="p-2">הערה</th>
                    <th className="p-2">מפה</th>
                    <th className="p-2">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{i+1}</td>
                    <td className="p-2">{e.place?.name ?? '—'}</td>
                    <td className="p-2">
                      <input className="input w-20" type="number" value={e.duration_min ?? 0}
                             onChange={ev=>patchEntryInState(day.id, e.id, { duration_min: Number(ev.target.value) })}/>
                    </td>
                    <td className="p-2">
                      <input className="input w-64" value={e.note_he ?? ''}
                             onChange={ev=>patchEntryInState(day.id, e.id, { note_he: ev.target.value })}/>
                    </td>
                    <td className="p-2">
                      {e.place?.maps_url ? <a className="link" href={e.place.maps_url} target="_blank">מפה</a> : '—'}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button className="btn" onClick={()=>updateEntry(e)}>שמור</button>
                        <button className="btn bg-gray-800" onClick={()=>removeEntry(e.id, day.id)}>מחק</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td className="p-2 text-gray-500" colSpan={6}>אין פריטים ליום זה.</td></tr>
                )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* ----- Cities ----- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">עריכת ערים</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם עיר"
                 value={formCity.name} onChange={e=>setFormCity({...formCity, name:e.target.value})}/>
          <input className="input" placeholder="מדינה"
                 value={formCity.country} onChange={e=>setFormCity({...formCity, country:e.target.value})}/>
          <input className="input" placeholder="אזור זמן"
                 value={formCity.tz} onChange={e=>setFormCity({...formCity, tz:e.target.value})}/>
        </div>
        <button className="btn" onClick={addCity}>שמור עיר</button>
        <ul className="text-sm text-gray-700">
          {(cities ?? []).map(c => <li key={String(c.id)}>• {c.name} ({c.country})</li>)}
        </ul>
      </section>

      {/* ----- Places ----- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">עריכת אטרקציות</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={formPlace.city_id} onChange={e=>setFormPlace({...formPlace, city_id:e.target.value})}>
            <option value="">בחר עיר</option>
            {(cities ?? []).map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
          </select>
          <select className="input" value={formPlace.type} onChange={e=>setFormPlace({...formPlace, type: e.target.value as PlaceType})}>
            <option value="attraction">אטרקציה</option>
            <option value="hotel">מלון</option>
            <option value="transport">תחבורה</option>
          </select>
          <input className="input" placeholder="שם"
                 value={formPlace.name} onChange={e=>setFormPlace({...formPlace, name:e.target.value})}/>
          <input className="input" placeholder="קישור מפה"
                 value={formPlace.maps_url} onChange={e=>setFormPlace({...formPlace, maps_url:e.target.value})}/>
          <input className="input" placeholder="תיאור"
                 value={formPlace.desc_he} onChange={e=>setFormPlace({...formPlace, desc_he:e.target.value})}/>
          <button className="btn" onClick={addPlace}>שמור אטרקציה</button>
        </div>
      </section>
    </main>
  );
}

/* ======== tiny utility classes (if לא קיימות כבר ב-globals.css) ========
.input { @apply w-full rounded-xl border border-gray-300/60 bg-white/60 px-3 py-2 text-right; }
.btn   { @apply rounded-xl bg-pink-600 px-4 py-2 text-white hover:opacity-90; }
.card  { @apply rounded-2xl border border-gray-200/60 bg-white/70 p-4 shadow-sm; }
.label { @apply text-sm text-gray-600; }
.link  { @apply text-pink-700 underline; }
*/
