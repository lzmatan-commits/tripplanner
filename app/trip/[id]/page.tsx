'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DrivePickerButton from '@/app/components/DrivePickerButton';

/* ============== Types ============== */
type City = { id: string; name: string; country: string; tz: string };
type PlaceType = 'hotel' | 'transport' | 'restaurant' | 'activity';
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
};
type Trip = { id: string; title: string; start_date: string | null; end_date: string | null };
type TripDay = { id: string; trip_id: string; date: string; city_id: string | null };
type Entry = {
  id: string;
  day_id: string;
  order_idx: number;
  kind: 'place' | 'note';
  ref_id: string | null;
  duration_min: number | null;
  note_he: string | null;
  place?: { name: string | null; maps_url: string | null; type?: PlaceType | null };
};

/* ============== Utils ============== */
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

/* ============== Files viewer for entry ============== */
function EntryFilesViewer({ entryId }: { entryId: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('entry_files')
      .select('id, file:drive_files(id, name, web_view_link, icon_link)')
      .eq('entry_id', entryId);
    setFiles(data ?? []);
    setLoading(false);
  }

  async function removeLink(id: string) {
    if (!confirm('להסיר קובץ מפריט זה?')) return;
    await supabase.from('entry_files').delete().eq('id', id);
    await load();
  }

  useEffect(() => {
    void load();
  }, [entryId]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <DrivePickerButton entryId={entryId} onSaved={load} label="בחר מדרייב" />
        {loading && <span className="text-xs text-gray-500">טוען…</span>}
      </div>
      {files.length === 0 ? (
        <div className="text-xs text-gray-500">אין קבצים</div>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              {f.file?.icon_link && <img src={f.file.icon_link} className="w-4 h-4" alt="" />}
              <a className="link" href={f.file?.web_view_link || '#'} target="_blank">
                {f.file?.name || 'קובץ'}
              </a>
              <button className="text-xs text-gray-500" onClick={() => removeLink(f.id)}>
                הסר
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============== Admin Page ============== */
export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, Entry[]>>({});
  const [activeTripId, setActiveTripId] = useState('');
  const params = useParams();
  const [newTrip, setNewTrip] = useState({ title: '', start_date: '', end_date: '' });
  const [formCity, setFormCity] = useState({ name: '', country: 'Japan', tz: 'Asia/Tokyo' });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    // If this page is visited at /trip/<id>, pick the id from the route and use it
    const p = (params as any) || {};
    if (p.id) setActiveTripId(p.id);
    void loadAll();
  }, [params]);

  async function loadAll() {
    const [cRes, pRes, tRes] = await Promise.all([
      supabase.from('cities').select('*').order('name'),
      supabase.from('places').select('*').order('name'),
      supabase.from('trips').select('id,title,start_date,end_date').order('created_at', { ascending: false }),
    ]);
    setCities(cRes.data ?? []);
    setPlaces(pRes.data ?? []);
    setTrips(tRes.data ?? []);
  }

  async function createTrip() {
    try {
      if (!user) throw new Error('יש להתחבר');
      const { title, start_date, end_date } = newTrip;
      if (!title || !start_date || !end_date) throw new Error('מלא שם ותאריכים');
      const { data: t } = await supabase
        .from('trips')
        .insert({ user_id: user.id, title, start_date, end_date })
        .select('id')
        .single();
      const rows = datesBetween(start_date, end_date).map((d) => ({ trip_id: t!.id, date: d }));
      if (rows.length) await supabase.from('trip_days').insert(rows);
      setActiveTripId(t!.id);
      await loadAll();
      setMsg('טיול נוצר');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function loadDays(tripId: string) {
    const { data } = await supabase.from('trip_days').select('*').eq('trip_id', tripId).order('date', { ascending: true });
    setDays(data ?? []);
  }

  async function addPlaceToDay(dayId: string, placeId: string, duration = 60) {
    const order = (entriesByDay[dayId]?.length ?? 0);
    const { error } = await supabase.from('day_entries').insert({ day_id: dayId, kind: 'place', ref_id: placeId, duration_min: duration, order_idx: order });
    if (error) setErr(error.message);
  }

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">פאנל ניהול</h1>

      {/* צור טיול */}
      <section className="card space-y-3">
        <h2 className="font-semibold">צור טיול חדש</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם טיול" value={newTrip.title} onChange={(e) => setNewTrip({ ...newTrip, title: e.target.value })} />
          <input className="input" type="date" value={newTrip.start_date} onChange={(e) => setNewTrip({ ...newTrip, start_date: e.target.value })} />
          <input className="input" type="date" value={newTrip.end_date} onChange={(e) => setNewTrip({ ...newTrip, end_date: e.target.value })} />
        </div>
        <button className="btn" onClick={createTrip}>צור</button>
      </section>

      {/* ימים */}
      {days.map((day) => (
        <section key={day.id} className="card space-y-3">
          <h3 className="font-semibold">יום {new Date(day.date).toLocaleDateString('he-IL')}</h3>
          <AddToDay
            dayId={day.id}
            places={places}
            cityId={day.city_id}
            onAdd={(placeId: string | number, duration: number) => addPlaceToDay(day.id, String(placeId), duration)}
          />
        </section>
      ))}
    </main>
  );
}

/* ===== AddToDay component ===== */
function AddToDay({
  dayId,
  places,
  cityId,
  onAdd,
}: {
  dayId: string;
  places: Place[];
  cityId: string | null;
  onAdd: (placeId: string | number, duration: number) => void;
}) {
  const [typeSel, setTypeSel] = useState<PlaceType>('activity');
  const [placeSel, setPlaceSel] = useState<string>('');
  const [dur, setDur] = useState<number>(60);

  const options = useMemo(() => {
    return places.filter((p) => (!cityId || p.city_id === cityId) && p.type === typeSel);
  }, [places, cityId, typeSel]);

  return (
    <div className="grid grid-cols-4 gap-2">
      <select className="input" value={typeSel} onChange={(e) => setTypeSel(e.target.value as PlaceType)}>
        <option value="hotel">מלון</option>
        <option value="transport">תחבורה</option>
        <option value="restaurant">מסעדה</option>
        <option value="activity">פעילות</option>
      </select>
      <select className="input" value={placeSel} onChange={(e) => setPlaceSel(e.target.value)}>
        <option value="">בחר {typeSel}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input className="input" type="number" value={dur} onChange={(e) => setDur(Number(e.target.value || 60))} placeholder="דקות" />
      <button className="btn" onClick={() => placeSel && onAdd(placeSel, dur)}>
        הוסף ליום
      </button>
    </div>
  );
}
