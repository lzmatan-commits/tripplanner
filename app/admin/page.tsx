'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

type City = { id: string; name: string; country: string; tz: string };
type PlaceType = 'attraction' | 'hotel' | 'transport';

type Place = {
  id: string;
  name: string;
  type: PlaceType;
  city_id: string;
  lat: number | null;
  lng: number | null;
  desc_he: string | null;
  maps_url: string | null;
  duration_min: number | null;
  order_idx: number | null;
  visit_date: string | null; // YYYY-MM-DD
};

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // טפסי יצירה
  const [formCity, setFormCity] = useState({ name: '', country: 'Japan', tz: 'Asia/Tokyo' });
  const [formPlace, setFormPlace] = useState({
    name: '',
    type: 'attraction' as PlaceType,
    city_id: '',
    lat: '',
    lng: '',
    desc_he: '',
    maps_url: '',
    duration_min: '60',
    visit_date: '',     // חדש
    order_idx: '0',     // חדש
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    load();
  }, []);

  async function load() {
    const { data: cities } = await supabase.from('cities').select('*').order('name');
    setCities(cities ?? []);

    const { data: places } = await supabase
      .from('places')
      .select('*')
      .order('visit_date', { ascending: true, nullsFirst: false })
      .order('order_idx', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });
    setPlaces((places ?? []) as any);
  }

  // יצירת עיר
  async function addCity() {
    setErr(null); setMsg(null);
    const { error } = await supabase.from('cities').insert(formCity);
    if (error) setErr(error.message);
    else { setMsg('עיר נשמרה'); setFormCity({ name: '', country: 'Japan', tz: 'Asia/Tokyo' }); load(); }
  }

  // יצירת אטרקציה
  async function addPlace() {
    setErr(null); setMsg(null);
    const p = {
      name: formPlace.name,
      type: formPlace.type,
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
      setFormPlace({
        name: '', type: 'attraction', city_id: '',
        lat: '', lng: '', desc_he: '', maps_url: '',
        duration_min: '60', visit_date: '', order_idx: '0'
      });
      load();
    }
  }

  // עדכון שורה קיימת
  async function updatePlace(row: Place) {
    setErr(null); setMsg(null);
    const { error } = await supabase.from('places').update({
      name: row.name,
      type: row.type,
      city_id: row.city_id,
      lat: row.lat,
      lng: row.lng,
      desc_he: row.desc_he,
      maps_url: row.maps_url,
      duration_min: row.duration_min,
      visit_date: row.visit_date,
      order_idx: row.order_idx ?? 0
    }).eq('id', row.id);
    if (error) setErr(error.message); else { setMsg('עודכן'); load(); }
  }

  // מחיקה
  async function deletePlace(id: string) {
    if (!confirm('למחוק את הרשומה?')) return;
    setErr(null); setMsg(null);
    const { error } = await supabase.from('places').delete().eq('id', id);
    if (error) setErr(error.message); else { setMsg('נמחק'); load(); }
  }

  // הזזה למעלה/למטה
  async function bump(id: string, delta: number) {
    const row = places.find(p => p.id === id);
    if (!row) return;
    const newIdx = (row.order_idx ?? 0) + delta;
    const { error } = await supabase.from('places').update({ order_idx: newIdx }).eq('id', id);
    if (!error) load();
  }

  if (!user) return <main className="p-4">יש להתחבר כדי לערוך.</main>;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">פאנל ניהול</h1>
      {msg && <div className="text-green-700">{msg}</div>}
      {err && <div className="text-red-700">{err}</div>}

      {/* --- ערים --- */}
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

      {/* --- אטרקציות --- */}
      <section className="card space-y-3">
        <h2 className="font-semibold">עריכת אטרקציות</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={formPlace.city_id}
                  onChange={e=>setFormPlace({...formPlace, city_id:e.target.value})}>
            <option value="">בחר עיר</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* סוג */}
          <select className="input" value={formPlace.type}
                  onChange={e=>setFormPlace({...formPlace, type: e.target.value as PlaceType})}>
            <option value="attraction">אטרקציה</option>
            <option value="hotel">מלון</option>
            <option value="transport">תחבורה</option>
          </select>

          <input className="input" placeholder="שם" value={formPlace.name}
                 onChange={e=>setFormPlace({...formPlace, name:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="lat" value={formPlace.lat}
                   onChange={e=>setFormPlace({...formPlace, lat:e.target.value})}/>
            <input className="input" placeholder="lng" value={formPlace.lng}
                   onChange={e=>setFormPlace({...formPlace, lng:e.target.value})}/>
          </div>

          <input className="input" placeholder="קישור מפה"
                 value={formPlace.maps_url} onChange={e=>setFormPlace({...formPlace, maps_url:e.target.value})}/>
          <input className="input" placeholder="משך (דקות)"
                 value={formPlace.duration_min} onChange={e=>setFormPlace({...formPlace, duration_min:e.target.value})}/>

          {/* תאריך + סדר */}
          <input className="input" type="date" value={formPlace.visit_date}
                 onChange={e=>setFormPlace({...formPlace, visit_date:e.target.value})}/>
          <input className="input" type="number" placeholder="סדר" value={formPlace.order_idx}
                 onChange={e=>setFormPlace({...formPlace, order_idx: e.target.value})}/>

          <textarea className="input col-span-2" placeholder="תיאור (עברית)"
                    value={formPlace.desc_he} onChange={e=>setFormPlace({...formPlace, desc_he:e.target.value})}/>
          <button className="btn" onClick={addPlace}>שמור אטרקציה</button>
        </div>

        {/* טבלת עריכה */}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
            <tr className="text-right text-gray-600">
              <th className="p-2">#</th>
              <th className="p-2">תאריך</th>
              <th className="p-2">סוג</th>
              <th className="p-2">שם</th>
              <th className="p-2">עיר</th>
              <th className="p-2">משך</th>
              <th className="p-2">מפה</th>
              <th className="p-2">עריכה</th>
            </tr>
            </thead>
            <tbody>
            {places.map((p, idx) => (
              <tr key={p.id} className="border-t">
                <td className="p-2 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button className="btn px-2" onClick={()=>bump(p.id, -1)}>↑</button>
                    <button className="btn px-2 bg-gray-800" onClick={()=>bump(p.id, +1)}>↓</button>
                    <input className="input w-20" type="number"
                           value={p.order_idx ?? 0}
                           onChange={e => setPlaces(prev => prev.map(r => r.id===p.id ? ({...r, order_idx: Number(e.target.value)}) : r))}/>
                  </div>
                </td>
                <td className="p-2">
                  <input className="input w-40" type="date"
                         value={p.visit_date ?? ''}
                         onChange={e => setPlaces(prev => prev.map(r => r.id===p.id ? ({...r, visit_date: e.target.value}) : r))}/>
                </td>
                <td className="p-2">
                  <select className="input"
                          value={p.type}
                          onChange={e => setPlaces(prev => prev.map(r => r.id===p.id ? ({...r, type: e.target.value as PlaceType}) : r))}>
                    <option value="attraction">אטרקציה</option>
                    <option value="hotel">מלון</option>
                    <option value="transport">תחבורה</option>
                  </select>
                </td>
                <td className="p-2">
                  <input className="input w-56" value={p.name}
                         onChange={e => setPlaces(prev => prev.map(r => r.id===p.id ? ({...r, name: e.target.value}) : r))}/>
                </td>
                <td className="p-2">
                  <select className="input w-40"
                          value={p.city_id ?? ''}
                          onChange={e => setPlaces(prev => prev.map(r => r.id===p.id ? ({...r, city_id: e.target.value}) : r))}>
                    <option value="">—</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <input className="input w-20" type="number"
                         value={p.duration_min ?? 0}
                         onChange={e => setPlaces(prev => prev.map(r => r.id===p.id ? ({...r, duration_min: Number(e.target.value)}) : r))}/>
                </td>
                <td className="p-2">
                  <input className="input w-48"
                         value={p.maps_url ?? ''}
                         onChange={e => setPlaces(prev => prev.map(r => r.id===p.id ? ({...r, maps_url: e.target.value}) : r))}/>
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button className="btn" onClick={()=>updatePlace(p)}>עדכן</button>
                    <button className="btn bg-gray-800" onClick={()=>deletePlace(p.id)}>מחק</button>
                  </div>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
