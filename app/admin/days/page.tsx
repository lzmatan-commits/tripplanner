'use client';

import { useEffect, useState } from 'react';
import { toISOfromDDMMYYYY, createDay, fetchDays, fetchEntriesForDay } from '@/lib/supabaseRest';

// אם יש לכם trip_id דינמי – קח אותו מה-URL/בחירה. בינתיים נשתמש בערך ידוע:
const TRIP_ID = '8a3071a7-da9b-4d2b-8f27-2ef564053622'; // החלף ל-trip_id שלך

export default function AdminDaysPage() {
  const [from, setFrom] = useState('');        // dd/mm/yyyy מהאינפוט
  const [title, setTitle] = useState('');      // אם יש שדה שם/כותרת
  const [days, setDays] = useState<any[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const d = await fetchDays(TRIP_ID);
      setDays(d);
      if (d?.length) setSelectedDayId(d[0].id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedDayId) { setEntries([]); return; }
      const rows = await fetchEntriesForDay(selectedDayId);
      setEntries(rows);
    })();
  }, [selectedDayId]);

  async function onAddDay() {
    try {
      const dateISO = toISOfromDDMMYYYY(from);      // המרה מ-dd/mm/yyyy ל-YYYY-MM-DD
      await createDay({ trip_id: TRIP_ID, dateISO });
      const d = await fetchDays(TRIP_ID);           // רענון רשימת ימים
      setDays(d);
      if (!selectedDayId && d?.length) setSelectedDayId(d[0].id);
      setFrom(''); setTitle('');
      alert('יום נשמר בהצלחה');
    } catch (e:any) {
      alert('שמירה נכשלה: ' + (e?.message || 'unknown error'));
    }
  }

  return (
    <div style={{ padding: 16, direction: 'rtl' }}>
      <h1>פאנל ניהול טיולים</h1>

      <h3>צור יום חדש</h3>
      <div style={{ display:'grid', gridTemplateColumns:'220px 220px 160px', gap: 8, alignItems:'center' }}>
        <input
          place
