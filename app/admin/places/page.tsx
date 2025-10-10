'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';
import { toIsoDateUTC, formatIsoForHe } from '@/lib/dateHelpers';

export default function AdminPlacesPage() {
  const supabase = createClientComponentClient<Database>();

  // טיולים
  const [trips, setTrips] = useState<any[]>([]);
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ערים
  const [cities, setCities] = useState<any[]>([]);
  const [cityName, setCityName] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('Asia/Tokyo');

  // אטרקציות
  const [types, setTypes] = useState<any[]>([]);
  const [typeName, setTypeName] = useState('');

  // טעינת נתונים מה-Supabase
  useEffect(() => {
    async function fetchData() {
      const { data: tripsData } = await supabase.from('trips').select('*');
      if (tripsData) setTrips(tripsData);

      const { data: citiesData } = await supabase.from('cities').select('*');
      if (citiesData) setCities(citiesData);

      const { data: typesData } = await supabase.from('attraction_types').select('*');
      if (typesData) setTypes(typesData);
    }
    fetchData();
  }, [supabase]);

  // יצירת טיול חדש
  async function createTrip() {
    if (!tripName || !startDate || !endDate) {
      alert('יש למלא את כל השדות');
      return;
    }

    const formattedStart = toIsoDateUTC(new Date(startDate));
    const formattedEnd = toIsoDateUTC(new Date(endDate));

    const { error } = await supabase.from('trips').insert({
      name: tripName,
      start_date: formattedStart,
      end_date: formattedEnd,
    });

    if (error) {
      alert(`שגיאה: ${error.message}`);
    } else {
      alert('הטיול נוסף בהצלחה!');
      setTripName('');
      setStartDate('');
      setEndDate('');
      const { data: updatedTrips } = await supabase.from('trips').select('*');
      setTrips(updatedTrips || []);
    }
  }

  // הוספת עיר
  async function addCity() {
    if (!cityName || !country) {
      alert('נא למלא את שם העיר והמדינה');
      return;
    }

    const { error } = await supabase.from('cities').insert({
      name: cityName,
      country,
      timezone,
    });

    if (error) {
      alert(`שגיאה: ${error.message}`);
    } else {
      alert('עיר נוספה בהצלחה!');
      setCityName('');
      setCountry('');
      const { data: updatedCities } = await supabase.from('cities').select('*');
      setCities(updatedCities || []);
    }
  }

  // הוספת סוג אטרקציה (גלובלי)
  async function addType() {
    if (!typeName) {
      alert('נא להזין שם סוג אטרקציה');
      return;
    }

    const { error } = await supabase.from('attraction_types').insert({
      name: typeName,
    });

    if (error) {
      alert(`שגיאה: ${error.message}`);
    } else {
      alert('סוג האטרקציה נוסף בהצלחה!');
      setTypeName('');
      const { data: updatedTypes } = await supabase.from('attraction_types').select('*');
      setTypes(updatedTypes || []);
    }
  }

  return (
    <main dir="rtl" className="p-8 bg-pink-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-center">פאנל ניהול טיולים</h1>

      {/* יצירת טיול חדש */}
      <section className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4">צור טיול חדש</h2>
        <div className="flex flex-wrap gap-3 mb-3">
          <input
            type="text"
            placeholder="שם טיול"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            className="border p-2 rounded-md flex-1"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border p-2 rounded-md"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border p-2 rounded-md"
          />
          <button
            onClick={createTrip}
            className="bg-pink-500 text-white px-4 py-2 rounded-md"
          >
            צור
          </button>
        </div>

        <ul className="list-disc pl-6">
          {trips.map((trip) => (
            <li key={trip.id}>
              <b>{trip.name}</b> — {formatIsoForHe(trip.start_date)} עד {formatIsoForHe(trip.end_date)}
            </li>
          ))}
        </ul>
      </section>

      {/* ניהול ערים */}
      <section className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4">ערים</h2>
        <div className="flex flex-wrap gap-3 mb-3">
          <input
            type="text"
            placeholder="שם עיר"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="border p-2 rounded-md flex-1"
          />
          <input
            type="text"
            placeholder="מדינה"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border p-2 rounded-md"
          />
          <input
            type="text"
            placeholder="איזור זמן (למשל Asia/Tokyo)"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="border p-2 rounded-md"
          />
          <button
            onClick={addCity}
            className="bg-pink-500 text-white px-4 py-2 rounded-md"
          >
            הוסף
          </button>
        </div>

        <ul className="list-disc pl-6">
          {cities.map((city) => (
            <li key={city.id}>
              {city.name} ({city.country}) — {city.timezone}
            </li>
          ))}
        </ul>
      </section>

      {/* ניהול סוגי אטרקציות */}
      <section className="bg-white p-6 rounded-2xl shadow-md">
        <h2 className="text-xl font-bold mb-4">סוגי אטרקציות</h2>
        <div className="flex flex-wrap gap-3 mb-3">
          <input
            type="text"
            placeholder="שם סוג אטרקציה"
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            className="border p-2 rounded-md flex-1"
          />
          <button
            onClick={addType}
            className="bg-pink-500 text-white px-4 py-2 rounded-md"
          >
            שמור
          </button>
        </div>

        <ul className="list-disc pl-6">
          {types.map((t) => (
            <li key={t.id}>{t.name}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
