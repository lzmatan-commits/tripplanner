'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useMemo, useState } from 'react';

type City = { id: string; name: string; country: string; tz: string };
type PlaceType = 'attraction' | 'hotel' | 'transport';
type Place = {
  id: string; name: string; type: PlaceType; city_id: string | null;
  lat: number | null; lng: number | null; desc_he: string | null; maps_url: string | null;
  duration_min: number | null; order_idx: number | null; visit_date: string | null;
};
type Trip = { id: string; title: string; start_date: string | null; end_date: string | null };
type TripDay = {
  id: string; trip_id: string; date: string; city_id: string | null; transport: string | null; hotel_name: string | null
};

function datesBetween(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(startISO); const end = new Date(endISO);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function Admin() {
  const [user, setUser] = useState<any>(null);

  // בסיס נתונים
  const [cities, setCities] = useState<City[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);

  // בחירה
  const [activeTripId, setActiveTripId] = useState<string>('');

  // טפסים
  const [formCity, setFormCity]   = useState({ name: '', country: 'Japan', tz: 'Asia/Tokyo' });
  const [formPlace, setFormPlace] = useState({
    name: '', type: 'attraction' as PlaceType, city_id: '',
    lat: '', lng: '', desc_he: '', maps_url: '', duration_min: '60',
    visit_date: '', order_idx: '0'
  });
  const [newTrip, setNewTrip]     = useState({ title: '', start_date: '', end_date: '' });

  // הודעות
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadAll();
  }, []);

  async function loadAll() {
    const [{ data: c }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('cities').select('*').order('name'),
      supabase.from('places').select('*')
        .order('visit_date', { ascending: true, nullsFirst: false })
        .order('order_idx', { ascending: true, nullsFirst: true }).order('name'),
      supabase.from('trips').select('id, title, start_date, end_date').order('created_at', { ascending: false })
    ]);
    setCities(c ?? []); setPlaces((p ?? []) as any); setTrips(t ?? []);
    // אם אין בחירה, קח את הטיול האחרון
    if (!activeTripId && t && t.length) setActiveTripId(t[0].id);
    if (activeTripId) loadDays(activeTripId);
  }

  async function loadDays(tripId: string) {
    const { data } = await supabase.from('trip_days').select('*').eq('trip_id', tripId).order('date', { ascending: true });
    setDays(data ?? []);
  }

  // ---------- יצירת טיול ----------
  async function createTrip() {
    try {
      setErr(null); setMsg(null);
      if (!user) throw new Error('לא מחובר');
      if (!newTrip.title || !newTrip.start_date || !newTrip.end_date) throw new Error('מלא שם ותאריכים');

      const { data: t, error: e1 } = await supabase.from('trips').insert({
        user_id: user.id,
        title: newTrip.title,
        start_date: newTrip.start_date,
        end_date: newTrip.end_date,
        pace: 'normal',
        interests: []
      }).select('id').single();
      if (e1) throw e1;

      // ימים אוטומטיים
      const dts = datesBetween(newTrip.start_date, newTrip.end_date)
        .map(d => ({ trip_id: t!.id, date: d, city_id: null, transport: null, hotel_name: null }));
      if (dts.length) await supabase.from('trip_days').insert(dts);

      setMsg('טיול נוצר'); setNewTrip({ title: '', start_date: '', end_date: '' });
      setActiveTripId(t!.id);
      await loadAll();
      await loadDays(t!.id);
    } catch (e: any) { setErr(e.message ?? String(e)); }
  }

  // ---------- עדכון/מחיקה של יום ----------
  async function updateDay(d: TripDay) {
    const { error } = await supabase.from('trip_days').update({
      date: d.date, city_id: d.city_id, transport: d.transport, hotel_name: d.hotel_name
    }).eq('id', d.id);
    if (error) setErr(error.message); else { setMsg('יום עודכן'); loadDays(activeTripId); }
  }
  async function addDay() {
    if (!activeTripId) return;
    const last = days.at(-1);
    const nextDate = last ? new Date(new Date(last.date).getTime() + 86400000).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
    const { error } = await supabase.from('trip_days').insert({ trip_id: activeTripId, date: nextDate });
    if (error) setErr(error.message); else loadDays(activeTripId);
  }
  async function deleteDay(id: string) {
    if (!confirm('למחוק את היום הזה?')) return;
    const { error } = await supabase.from('trip_days').delete().eq('id', id);
    if (error) setErr(error.message); else loadDays(activeTripId);
  }

  // ---------- ערים / אטרקציות (כבר היו) ----------
  async function addCity() {
    setErr(null); setMsg(null);
    const { error } = await supabase.from('cities').insert(formCity);
    if (error) setErr(error.message);
    else { setMsg('עיר נשמרה'); setFormCity({ name: '', country: 'Japan', tz: 'Asia/Tokyo' }); loadAll(); }
  }

  async function addPlace() {
    setErr(null); setMsg(null);
    const p = {
      name: formPlace.name, type: formPlace.type,
      city_id: formPlace.city_id || null,
      lat: formPlace.lat ? Number(formPlace.lat) : null,
      lng: formPlace.lng ? Number(formPlace.lng) : null,
      desc_he: formPlace.desc_he || null,
      maps_url: formPlace.maps_url || null,
      duration_min: formPlace.duration_min ? Number(formPlace.duration_min) : null,
      visit_date: formPlace.visit_date || null,
      order_idx: formPlace.order_idx ? Number(formPlace.order_idx) : 0,
    };
    const { error } = await supabase.from('places').insert(p);
    if (error) setErr(error.message);
    else {
      setMsg('אטרקציה נשמרה');
      setFormPlace({ name:'', type:'attraction', city_id:'', lat:'', lng:'', desc_he:'', maps_url:'', duration_min:'60', visit_date:'', order_idx:'0' });
      loadAll();
    }
  }

  if (!user) return <main className="p-4">יש להתחבר כדי לערוך.</main>;

  // מפה מהירה של ערים
  const citiesMap = useMemo(() => Object.fromEntries(cities.map(c => [c.id, c.name])), [cities]);

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">פאנל ניהול</h1>
      {msg && <div className="text-green-700">{msg}</div>}
      {err && <div className="text-red-700">{err}</div>}

      {/* ----------- טיולים ----------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">צור טיול</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם טיול"
                 value={newTrip.title} onChange={e=>setNewTrip({...newTrip, title:e.target.value})}/>
          <input className="input" type="date" value={newTrip.start_date}
                 onChange={e=>setNewTrip({...newTrip, start_date:e.target.value})}/>
          <input className="input" type="date" value={newTrip.end_date}
                 onChange={e=>setNewTrip({...newTrip, end_date:e.target.value})}/>
        </div>
        <button className="btn" onClick={createTrip}>צור טיול</button>

        <div className="pt-2">
          <div className="label mb-1">הטיולים שלי</div>
          <div className="flex flex-wrap gap-2">
            {trips.map(t =>
              <button key={t.id}
                      className={`btn ${activeTripId===t.id ? '' : 'bg-gray-800'}`}
                      onClick={()=>{setActiveTripId(t.id); loadDays(t.id);}}>
                {t.title || t.id.slice(0,8)}
              </button>
            )}
          </div>
        </div>

        {/* ימים של הטיול הנבחר */}
        {activeTripId && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">ימים בטיול הנבחר</h3>
              <button className="btn" onClick={addDay}>הוסף יום</button>
            </div>
            <div className="overflow-auto mt-2">
              <table className="w-full text-sm">
                <thead><tr className="text-right text-gray-600">
                  <th className="p-2">תאריך</th><th className="p-2">עיר</th>
                  <th className="p-2">תחבורה</th><th className="p-2">מלון</th><th className="p-2">פעולות</th>
                </tr></thead>
                <tbody>
                {days.map(d => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">
                      <input className="input w-40" type="date"
                             value={d.date}
                             onChange={e=>setDays(prev=>prev.map(x=>x.id===d.id?{...x, date:e.target.value}:x))}/>
                    </td>
                    <td className="p-2">
                      <select className="input w-40"
                              value={d.city_id ?? ''}
                              onChange={e=>setDays(prev=>prev.map(x=>x.id===d.id?{...x, city_id: e.target.value || null}:x))}>
                        <option value="">—</option>
                        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      {d.city_id && <div className="text-xs text-gray-500 mt-1">{citiesMap[d.city_id]}</div>}
                    </td>
                    <td className="p-2">
                      <input className="input w-40" placeholder="Metro/Taxi"
                             value={d.transport ?? ''}
                             onChange={e=>setDays(prev=>prev.map(x=>x.id===d.id?{...x, transport:e.target.value}:x))}/>
                    </td>
                    <td className="p-2">
                      <input className="input w-56" placeholder="שם מלון"
                             value={d.hotel_name ?? ''}
                             onChange={e=>setDays(prev=>prev.map(x=>x.id===d.id?{...x, hotel_name:e.target.value}:x))}/>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button className="btn" onClick={()=>updateDay(d)}>עדכן</button>
                        <button className="btn bg-gray-800" onClick={()=>deleteDay(d.id)}>מחק</button>
                      </div>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ----------- ערים ----------- */}
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
          {cities.map(c=> <li key={c.id}>• {c.name} ({c.country})</li>)}
        </ul>
      </section>

      {/* ----------- אטרקציות ----------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">עריכת אטרקציות</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={formPlace.city_id}
                  onChange={e=>setFormPlace({...formPlace, city_id:e.target.value})}>
            <option value="">בחר עיר</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={formPlace.type}
                  onChange={e=>setFormPlace({...formPlace, type: e.target.value as PlaceType})}>
            <option value="attraction">אטרקציה</option>
            <option value="hotel">מלון</option>
            <option value="transport">תחבורה</option>
          </select>
          <input className="input" placeholder="שם"
                 value={formPlace.name} onChange={e=>setFormPlace({...formPlace, name:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="lat"
                   value={formPlace.lat} onChange={e=>setFormPlace({...formPlace, lat:e.target.value})}/>
            <input className="input" placeholder="lng"
                   value={formPlace.lng} onChange={e=>setFormPlace({...formPlace, lng:e.target.value})}/>
          </div>
          <input className="input" placeholder="קישור מפה"
                 value={formPlace.maps_url} onChange={e=>setFormPlace({...formPlace, maps_url:e.target.value})}/>
          <input className="input" placeholder="משך (דקות)"
                 value={formPlace.duration_min} onChange={e=>setFormPlace({...formPlace, duration_min:e.target.value})}/>
          <input className="input" type="date" value={formPlace.visit_date}
                 onChange={e=>setFormPlace({...formPlace, visit_date:e.target.value})}/>
          <input className="input" type="number" placeholder="סדר"
                 value={formPlace.order_idx} onChange={e=>setFormPlace({...formPlace, order_idx: e.target.value})}/>
          <textarea className="input col-span-2" placeholder="תיאור (עברית)"
                    value={formPlace.desc_he} onChange={e=>setFormPlace({...formPlace, desc_he:e.target.value})}/>
          <button className="btn" onClick={addPlace}>שמור אטרקציה</button>
        </div>

        <div className="text-sm text-gray-700 max-h-60 overflow-auto">
          {places.map(p => <div key={p.id}>• [{p.type}] {p.name}</div>)}
        </div>
      </section>
    </main>
  );
}
