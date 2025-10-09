// app/admin/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ================== Types ================== */
type City = { id: string; name: string; country: string; tz: string };

type PlaceType = 'hotel' | 'transport' | 'restaurant' | 'activity' | 'attraction';

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
  date: string;          // YYYY-MM-DD
  city_id: string | null;
  transport: string | null;
  hotel_name: string | null;
};

type Entry = {
  id: string;
  day_id: string;
  order_idx: number;
  kind: 'place' | 'note';
  ref_id: string | null;          // place id
  duration_min: number | null;
  note_he: string | null;
  place?: { name: string | null; maps_url: string | null };
};

/* ================== Utils ================== */
function datesBetween(startISO: string, endISO: string) {
  const out: string[] = [];
  if (!startISO || !endISO) return out;
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(+s) || Number.isNaN(+e)) return out;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function mapsHref(p: { maps_url?: string | null; lat?: number | null; lng?: number | null }) {
  if (p?.maps_url) return p.maps_url!;
  if (p?.lat != null && p?.lng != null) {
    const q = `${p.lat},${p.lng}`;
    return `https://maps.google.com/?q=${encodeURIComponent(q)}`; // נפתח אפליקציה ברוב המכשירים
  }
  return '';
}

/* ================== PlacesAdmin (CRUD) ================== */
function PlacesAdmin(props: {
  cities: { id: string; name: string }[];
  places: Place[];
  onReload: () => Promise<void>;
}) {
  const { cities, places, onReload } = props;

  const [filterCity, setFilterCity] = useState<string>('');
  const [filterType, setFilterType] = useState<PlaceType | ''>('');
  const [newRow, setNewRow] = useState<Partial<Place>>({
    name: '',
    type: 'activity',
    city_id: '',
    duration_min: 60,
  });

  const filtered = useMemo(
    () =>
      places.filter(
        (p) => (!filterCity || p.city_id === filterCity) && (!filterType || p.type === filterType)
      ),
    [places, filterCity, filterType]
  );

  async function createPlace() {
    const payload = {
      name: newRow.name?.trim() || '',
      type: (newRow.type as PlaceType) || 'activity',
      city_id: newRow.city_id || null,
      lat: newRow.lat ?? null,
      lng: newRow.lng ?? null,
      maps_url: newRow.maps_url || null,
      desc_he: newRow.desc_he || null,
      duration_min: Number(newRow.duration_min ?? 60),
    };
    if (!payload.name) return alert('שם חובה');
    const { error } = await supabase.from('places').insert(payload);
    if (error) return alert(error.message);
    setNewRow({ name: '', type: 'activity', city_id: '', duration_min: 60 });
    await onReload();
  }

  async function savePlace(p: Place) {
    const { error } = await supabase
      .from('places')
      .update({
        name: p.name,
        type: p.type,
        city_id: p.city_id,
        lat: p.lat,
        lng: p.lng,
        maps_url: p.maps_url,
        desc_he: p.desc_he,
        duration_min: p.duration_min,
      })
      .eq('id', p.id);
    if (error) return alert(error.message);
    await onReload();
  }

  async function removePlace(id: string) {
    if (!confirm('למחוק אטרקציה זו?')) return;
    const { error } = await supabase.from('places').delete().eq('id', id);
    if (error) return alert(error.message);
    await onReload();
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">אטרקציות — ניהול</h2>

      {/* סינון */}
      <div className="grid grid-cols-3 gap-2">
        <select className="input" value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
          <option value="">כל הערים</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
        >
          <option value="">כל הסוגים</option>
          <option value="hotel">מלון</option>
          <option value="transport">תחבורה</option>
          <option value="restaurant">מסעדה</option>
          <option value="activity">פעילות</option>
        </select>
        <div />
      </div>

      {/* הוספה מהירה */}
      <div className="grid grid-cols-6 gap-2">
        <select
          className="input"
          value={(newRow.city_id as any) ?? ''}
          onChange={(e) => setNewRow((r) => ({ ...r, city_id: e.target.value }))}
        >
          <option value="">בחר עיר</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={newRow.type as any}
          onChange={(e) => setNewRow((r) => ({ ...r, type: e.target.value as PlaceType }))}
        >
          <option value="hotel">מלון</option>
          <option value="transport">תחבורה</option>
          <option value="restaurant">מסעדה</option>
          <option value="activity">פעילות</option>
        </select>
        <input
          className="input"
          placeholder="שם"
          value={(newRow.name as any) ?? ''}
          onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
        />
        <input
          className="input"
          placeholder="lat"
          value={(newRow.lat as any) ?? ''}
          onChange={(e) => setNewRow((r) => ({ ...r, lat: Number(e.target.value || 0) }))}
        />
        <input
          className="input"
          placeholder="lng"
          value={(newRow.lng as any) ?? ''}
          onChange={(e) => setNewRow((r) => ({ ...r, lng: Number(e.target.value || 0) }))}
        />
        <input
          className="input"
          placeholder="קישור מפה (לא חובה)"
          value={(newRow.maps_url as any) ?? ''}
          onChange={(e) => setNewRow((r) => ({ ...r, maps_url: e.target.value }))}
        />
        <textarea
          className="input col-span-4"
          placeholder="תיאור"
          value={(newRow.desc_he as any) ?? ''}
          onChange={(e) => setNewRow((r) => ({ ...r, desc_he: e.target.value }))}
        />
        <input
          className="input"
          type="number"
          placeholder="משך (דקות)"
          value={(newRow.duration_min as any) ?? 60}
          onChange={(e) =>
            setNewRow((r) => ({ ...r, duration_min: Number(e.target.value || 60) }))
          }
        />
        <button className="btn col-span-1" onClick={createPlace}>
          הוסף
        </button>
      </div>

      {/* טבלת עריכה */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-gray-600">
              <th className="p-2">#</th>
              <th className="p-2">עיר</th>
              <th className="p-2">סוג</th>
              <th className="p-2">שם</th>
              <th className="p-2">lat</th>
              <th className="p-2">lng</th>
              <th className="p-2">קישור מפה</th>
              <th className="p-2">משך</th>
              <th className="p-2">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">
                  <select
                    className="input w-36"
                    value={p.city_id ?? ''}
                    onChange={(e) => {
                      p.city_id = e.target.value || null;
                    }}
                  >
                    <option value="">—</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <select
                    className="input w-36"
                    value={p.type}
                    onChange={(e) => {
                      p.type = e.target.value as PlaceType;
                    }}
                  >
                    <option value="hotel">מלון</option>
                    <option value="transport">תחבורה</option>
                    <option value="restaurant">מסעדה</option>
                    <option value="activity">פעילות</option>
                  </select>
                </td>
                <td className="p-2">
                  <input
                    className="input w-56"
                    value={p.name}
                    onChange={(e) => {
                      p.name = e.target.value;
                    }}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="input w-28"
                    value={p.lat ?? ''}
                    onChange={(e) => {
                      p.lat = Number(e.target.value || 0);
                    }}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="input w-28"
                    value={p.lng ?? ''}
                    onChange={(e) => {
                      p.lng = Number(e.target.value || 0);
                    }}
                  />
                </td>
                <td className="p-2">
                  <div className="flex gap-2 items-center">
                    <input
                      className="input w-56"
                      placeholder="https://maps..."
                      value={p.maps_url ?? ''}
                      onChange={(e) => {
                        p.maps_url = e.target.value;
                      }}
                    />
                    {mapsHref(p) && (
                      <a className="link" href={mapsHref(p)} target="_blank">
                        פתח
                      </a>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <input
                    className="input w-20"
                    type="number"
                    value={p.duration_min ?? 60}
                    onChange={(e) => {
                      p.duration_min = Number(e.target.value || 60);
                    }}
                  />
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button className="btn" onClick={() => savePlace(p)}>
                      שמור
                    </button>
                    <button className="btn bg-gray-800" onClick={() => removePlace(p.id)}>
                      מחק
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan={9}>
                  אין רשומות תואמות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ================== Admin Page ================== */
export default function AdminPage() {
  const [user, setUser] = useState<any>(null);

  const [cities, setCities] = useState<City[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, Entry[]>>({});

  const [activeTripId, setActiveTripId] = useState<string>('');

  const [newTrip, setNewTrip] = useState({ title: '', start_date: '', end_date: '' });
  const [formCity, setFormCity] = useState({ name: '', country: 'Japan', tz: 'Asia/Tokyo' });

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // init
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
        supabase.from('trips').select('id, title, start_date, end_date').order('created_at', { ascending: false }),
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
    await loadEntriesForDays((data ?? []).map(d => d.id));
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

  // Trips
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

      const rows = datesBetween(start_date, end_date).map(d => ({ trip_id: t!.id, date: d }));
      if (rows.length) await supabase.from('trip_days').insert(rows);

      setNewTrip({ title: '', start_date: '', end_date: '' });
      setActiveTripId(t!.id);
      await loadAll();
      await loadDays(t!.id);
      setMsg('טיול נוצר בהצלחה');
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  // Entries helpers
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

  // City quick add
  async function addCity() {
    const { error } = await supabase.from('cities').insert(formCity);
    if (error) setErr(error.message);
    else { setFormCity({ name: '', country: 'Japan', tz: 'Asia/Tokyo' }); await loadAll(); }
  }

  // Memo
  const citiesMap = useMemo(() => {
    try {
      if (!Array.isArray(cities)) return {};
      return Object.fromEntries(cities.filter(c=>c && c.id!=null).map(c=>[String(c.id), c.name ?? '']));
    } catch { return {}; }
  }, [cities]);

  if (!user) return <main className="p-4">יש להתחבר כדי לערוך.</main>;

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">פאנל ניהול טיולים</h1>
      {msg && <div className="text-green-700">{msg}</div>}
      {err && <div className="text-red-700">{err}</div>}

      {/* ----- צור טיול ----- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">צור טיול חדש</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם טיול" value={newTrip.title}
                 onChange={(e)=>setNewTrip({...newTrip, title:e.target.value})}/>
          <input className="input" type="date" value={newTrip.start_date}
                 onChange={(e)=>setNewTrip({...newTrip, start_date:e.target.value})}/>
          <input className="input" type="date" value={newTrip.end_date}
                 onChange={(e)=>setNewTrip({...newTrip, end_date:e.target.value})}/>
        </div>
        <button className="btn" onClick={createTrip}>צור</button>

        {trips.length>0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {trips.map(t=>(
              <button key={t.id}
                      className={`btn ${t.id===activeTripId ? '' : 'bg-gray-800'}`}
                      onClick={()=>{ setActiveTripId(t.id); void loadDays(t.id); }}>
                {t.title}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ----- ימים + פריטים ----- */}
      {days.map(day=>{
        const entries = entriesByDay[day.id] ?? [];
        const availablePlaces = places.filter(p=>!day.city_id || p.city_id===day.city_id);
        return (
          <section key={day.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                יום {new Date(day.date).toLocaleDateString('he-IL')}
                {day.city_id && <> · {citiesMap[day.city_id]}</>}
              </h3>
            </div>

            {/* הוספת פריט ליום */}
            <div className="grid grid-cols-3 gap-2">
              <button className="btn"
                      onClick={()=>{
                        const sel = document.getElementById(`sel-${day.id}`) as HTMLSelectElement | null;
                        const dur = document.getElementById(`dur-${day.id}`) as HTMLInputElement | null;
                        if (sel?.value) void addPlaceToDay(day.id, sel.value, Number(dur?.value || 60));
                      }}>
                הוסף ליום
              </button>
              <select id={`sel-${day.id}`} className="input">
                <option value="">בחר אטרקציה</option>
                {availablePlaces.map(p=><option key={p.id} value={p.id}>[{p.type}] {p.name}</option>)}
              </select>
              <input id={`dur-${day.id}`} className="input" type="number" defaultValue={60} placeholder="דקות"/>
            </div>

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
                {entries.map((e,i)=>(
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
                {entries.length===0 && (
                  <tr><td className="p-2 text-gray-500" colSpan={6}>אין פריטים</td></tr>
                )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* ----- ערים מהירות ----- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">ערים</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם עיר"
                 value={formCity.name} onChange={e=>setFormCity({...formCity, name:e.target.value})}/>
          <input className="input" placeholder="מדינה"
                 value={formCity.country} onChange={e=>setFormCity({...formCity, country:e.target.value})}/>
          <input className="input" placeholder="אזור זמן"
                 value={formCity.tz} onChange={e=>setFormCity({...formCity, tz:e.target.value})}/>
        </div>
        <button className="btn" onClick={addCity}>הוסף</button>
      </section>

      {/* ----- ניהול אטרקציות (CRUD) ----- */}
      <PlacesAdmin cities={cities} places={places} onReload={loadAll} />
    </main>
  );
}

/* ====== מחלקות עזר (אם אין לך ב-globals.css) ======
.input { @apply w-full rounded-xl border border-gray-300/60 bg-white/60 px-3 py-2 text-right; }
.btn   { @apply rounded-xl bg-pink-600 px-4 py-2 text-white hover:opacity-90; }
.card  { @apply rounded-2xl border border-gray-200/60 bg-white/70 p-4 shadow-sm; }
.link  { @apply text-pink-700 underline; }
*/
