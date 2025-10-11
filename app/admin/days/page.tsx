'use client'
import { useState, useEffect } from 'react'
import { toISOfromDDMMYYYY, createDay, fetchDays } from '@/lib/supabaseRest'

const TRIP_ID = '<<ה-trip_id שלך>>' // החלף לערך הנכון

export default function AddDayBlock() {
  const [uiDate, setUiDate] = useState('')   // dd/mm/yyyy
  const [days, setDays] = useState<any[]>([])

  useEffect(() => {
    (async () => setDays(await fetchDays(TRIP_ID)))()
  }, [])

  async function onAddDay() {
    try {
      // אם אתה משתמש בקלט type=date – תוכל לשלוח ישירות את value (שהוא yyyy-mm-dd)
      // כאן אני תומך גם ב-dd/mm/yyyy:
      const dateISO = uiDate.includes('-') ? uiDate : toISOfromDDMMYYYY(uiDate)
      await createDay({ trip_id: TRIP_ID, dateISO })
      setDays(await fetchDays(TRIP_ID))
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
