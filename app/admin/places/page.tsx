'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PlaceType = 'hotel' | 'transport' | 'restaurant' | 'activity';

type Place = {
  id: string;
  name: string;
  type: PlaceType;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  desc_he: string | null;
  duration_min: number | null;
};

const TYPES: { key: PlaceType; label: string }[] = [
  { key: 'hotel',      label: 'מלון' },
  { key: 'transport',  label: 'תחבורה' },
  { key: 'restaurant', label: 'מסעדה' },
  { key: 'activity',   label: 'פעילות' },
];

export default function PlacesAdminPage() {
  const [activeType, setActiveType] = useState<PlaceType>('activity');
  const [allPlaces, setAllPlaces]   = useState<Place[]>([]);
  const [loading, setLoading]       = useState(true);
  const [q, setQ]                   = useState(''); // חיפוש
  const [creating, setCreating]     = useState<Partial<Place>>({
    name: '',
    type: 'activity',
    lat: null,
    lng: null,
    maps_url: '',
    desc_he: '',
    duration_min: 60,
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('places').select('*').order('name');
    if (!error) setAllPlaces(data ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const filteredByType = useMemo(
    () => allPlaces.filter(p => p.type === activeType),
    [allPlaces, activeType]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return filteredByType;
    return filteredByType.filter(p =>
      (p.name ?? '').toLowerCase().includes(term) ||
      (p.desc_he ?? '').toLowerCase().includes(term)
    );
  }, [filteredByType, q]);

  async function createPlace() {
    const payload = {
      name: (creating.name ?? '').trim(),
      type: (creating.type as PlaceType) || 'activity',
      lat: creating.lat ?? null,
      lng: creating.lng ?? null,
      maps_url: creating.maps_url || null,
      desc_he: creating.desc_he || null,
      duration_min: Number(creating.duration_min ?? 60),
    };
    if (!payload.name) return alert('שם חובה');
    const { error } = await supabase.from('places').insert(payload);
    if (error) return alert(error.message);
    setCreating({ name: '', type: activeType, lat: null, lng: null, maps_url: '', desc_he: '', duration_min: 60 });
    await load();
  }

  async function savePlace(p: Place) {
    const { error } = await supabase
      .from('places')
      .update({
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        maps_url: p.maps_url,
        desc_he: p.desc_he,
        duration_min: p.duration_min,
      })
      .eq('id', p.id);
    if (error) return alert(error.message);
    await load();
  }

  async function removePlace(id: string) {
    if (!confirm('למחוק רשומה זו?')) return;
    await supabase.from('places').delete().eq('id', id);
    await load();
  }

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">ניהול אטרקציות</h1>
        <div className="flex gap-2 flex-wrap">
          {TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveType(t.key); setCreating(c => ({ ...c, type: t.key })); }}
              className={`btn ${activeType === t.key ? '' : 'bg-gray-800'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* חיפוש + הוספה */}
      <section className="card space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <input
            className="input"
            placeholder="חיפוש בשם/תיאור…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <h2 className="font-semibold">הוסף {TYPES.find(t => t.key === activeType)?.label}</h2>
        <div className="grid grid-cols-6 gap-2">
          <input
            className="input col-span-2"
            placeholder="שם"
            value={(creating.name as any) || ''}
            onChange={e => setCreating(r => ({ ...r, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="lat"
            value={(creating.lat as any) ?? ''}
            onChange={e => setCreating(r => ({ ...r, lat: e.target.value === '' ? null : Number(e.target.value) }))}
          />
          <input
            className="input"
            placeholder="lng"
            value={(creating.lng as any) ?? ''}
            onChange={e => setCreating(r => ({ ...r, lng: e.target.value === '' ? null : Number(e.target.value) }))}
          />
          <input
            className="input col-span-2"
            placeholder="קישור מפה (לא חובה)"
            value={(creating.maps_url as any) || ''}
            onChange={e => setCreating(r => ({ ...r, maps_url: e.target.value }))}
          />
          <textarea
            className="input col-span-5"
            placeholder="תיאור"
            value={(creating.desc_he as any) || ''}
            onChange={e => setCreating(r => ({ ...r, desc_he: e.target.value }))}
          />
          <input
            className="input"
            type="number"
            placeholder="משך (דקות)"
            value={(creating.duration_min as any) ?? 60}
            onChange={e => setCreating(r => ({ ...r, duration_min: Number(e.target.value || 60) }))}
          />
          <button className="btn col-span-2" onClick={createPlace}>שמור</button>
        </div>
      </section>

      {/* טבלה */}
      <section className="card">
        {loading ? (
          <div className="p-4 text-gray-500">טוען…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-gray-600">
                  <th className="p-2">#</th>
                  <th className="p-2">שם</th>
                  <th className="p-2">lat</th>
                  <th className="p-2">lng</th>
                  <th className="p-2">מפה</th>
                  <th className="p-2">משך</th>
                  <th className="p-2">תיאור</th>
                  <th className="p-2">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">
                      <input
                        className="input w-56"
                        value={p.name}
                        onChange={e => (p.name = e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-28"
                        value={p.lat ?? ''}
                        onChange={e => (p.lat = e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-28"
                        value={p.lng ?? ''}
                        onChange={e => (p.lng = e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-56"
                        value={p.maps_url ?? ''}
                        onChange={e => (p.maps_url = e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-20"
                        type="number"
                        value={p.duration_min ?? 60}
                        onChange={e => (p.duration_min = Number(e.target.value || 60))}
                      />
                    </td>
                    <td className="p-2">
                      <textarea
                        className="input w-72"
                        value={p.desc_he ?? ''}
                        onChange={e => (p.desc_he = e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button className="btn" onClick={() => savePlace(p)}>שמור</button>
                        <button className="btn bg-gray-800" onClick={() => removePlace(p.id)}>מחק</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={8}>אין רשומות</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

/* מחלקות Tailwind אם אינן קיימות ב-globals.css:
.input { @apply w-full rounded-xl border border-gray-300/60 bg-white/60 px-3 py-2 text-right; }
.btn   { @apply rounded-xl bg-pink-600 px-3 py-2 text-white hover:opacity-90; }
.card  { @apply rounded-2xl border border-gray-200/60 bg-white/70 p-4 shadow-sm; }
*/
