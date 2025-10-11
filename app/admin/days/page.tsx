'use client'
import { useState, useEffect } from 'react'
import { toISOfromDDMMYYYY, createDay, fetchDays } from '@/lib/supabaseRest'

export default function AddDayBlock() {
  // הזן כאן את trip_id של הטיול או הדבק אותו מהפאנל הראשי
  const [tripId, setTripId] = useState('')
  const [uiDate, setUiDate] = useState('')   // dd/mm/yyyy
  const [days, setDays] = useState<any[]>([])

  useEffect(() => {
    if (!tripId) { setDays([]); return; }
    (async () => setDays(await fetchDays(tripId)))()
  }, [tripId])

  async function onAddDay() {
    try {
      // אם אתה משתמש בקלט type=date – תוכל לשלוח ישירות את value (שהוא yyyy-mm-dd)
      // כאן אני תומך גם ב-dd/mm/yyyy:
  if (!tripId) throw new Error('חסר trip_id — הכנס/י את מזהה הטיול לפני ההוספה')
  const dateISO = uiDate.includes('-') ? uiDate : toISOfromDDMMYYYY(uiDate)
  await createDay({ trip_id: tripId, dateISO })
  setDays(await fetchDays(tripId))
      setUiDate('')
      // אופציונלי: הודעת הצלחה UI ולא alert
    } catch (e: any) {
      alert('שמירה נכשלה: ' + (e?.message || 'שגיאה'))
    }
  }

  return (
    <div style={{display:'grid', gap:8}}>
      {/* עדיף type="date" בנייד */}
      <input
        type="text"
        placeholder="trip id (paste here)"
        value={tripId}
        onChange={(e) => setTripId(e.target.value)}
      />

      <input
        type="date"
        placeholder="YYYY-MM-DD"
        value={uiDate}
        onChange={(e) => setUiDate(e.target.value)}
      />
      {/* אם אתה חייב פורמט dd/mm/yyyy—החלף את type="date" ל-text והשתמש ב-toISOfromDDMMYYYY */}
      <button type="button" onClick={onAddDay}>הוסף יום</button>

      {/* הדפסה קצרה לבדיקה */}
      <ul>
        {days.map((d:any) => <li key={d.id}>{d.date}</li>)}
      </ul>
    </div>
  )
}
