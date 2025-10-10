'use client';

import { useEffect, useState } from 'react';
import { fetchDays, fetchEntriesForDay } from '@/lib/supabaseRest';

export default function AdminDaysPage() {
  const [days, setDays] = useState<any[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingDays(true);
      try {
        const d = await fetchDays();
        setDays(d);
        if (d?.length) setSelectedDayId(d[0].id);
      } finally {
        setLoadingDays(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedDayId) { setEntries([]); return; }
      setLoadingEntries(true);
      try {
        const rows = await fetchEntriesForDay(selectedDayId);
        setEntries(rows);
      } finally {
        setLoadingEntries(false);
      }
    })();
  }, [selectedDayId]);

  return (
    <div style={{ display:'grid', gap:16 }}>
      <h2>ניהול ימים ופריטים</h2>

      <div>
        <label>בחר יום: </label>
        {loadingDays ? (
          <span>טוען ימים…</span>
        ) : (
          <select value={selectedDayId} onChange={(e) => setSelectedDayId(e.target.value)}>
            <option value="">— בחר יום —</option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.date} {d.title ? `— ${d.title}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <h3>פריטים ביום</h3>
        {loadingEntries ? (
          <p>טוען פריטים…</p>
        ) : entries.length === 0 ? (
          <p>אין פריטים ליום שנבחר</p>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th align="left">#</th>
                <th align="left">מיקום</th>
                <th align="left">סוג</th>
                <th align="left">שם</th>
                <th align="left">משך (דק׳)</th>
                <th align="left">קבוצה</th>
                <th align="left">הערה</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((it:any, idx:number) => (
                <tr key={it.id} style={{ borderTop:'1px solid #eee' }}>
                  <td>{idx+1}</td>
                  <td>{it.position ?? ''}</td>
                  <td>{it.type}</td>
                  <td>{it.name}</td>
                  <td>{it.duration_minutes ?? ''}</td>
                  <td>{it.group ?? ''}</td>
                  <td>{it.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
