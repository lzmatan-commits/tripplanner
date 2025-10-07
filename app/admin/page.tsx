'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

type City={id:string;name:string;country:string;tz:string};
type Place={id:string;name:string;type:string;city_id:string;lat:number;lng:number;desc_he:string;maps_url:string;duration_min:number};

export default function Admin(){
  const [user,setUser]=useState<any>(null);
  const [cities,setCities]=useState<City[]>([]);
  const [places,setPlaces]=useState<Place[]>([]);
  const [formCity,setFormCity]=useState({name:'',country:'Japan',tz:'Asia/Tokyo'});
  const [formPlace,setFormPlace]=useState({name:'',type:'attraction',city_id:'',lat:'',lng:'',desc_he:'',maps_url:'',duration_min:'60'});
  const [msg,setMsg]=useState<string|null>(null);
  const [err,setErr]=useState<string|null>(null);

  useEffect(()=>{ supabase.auth.getUser().then(({data})=>setUser(data.user)); load(); },[]);

  async function load(){
    const {data:c}=await supabase.from('cities').select('*').order('name'); setCities(c??[]);
    const {data:p}=await supabase.from('places').select('*').order('name'); setPlaces(p??[]);
  }
  async function addCity(){ setErr(null); setMsg(null); const {error}=await supabase.from('cities').insert(formCity); if(error) setErr(error.message); else {setMsg('עיר נשמרה'); setFormCity({name:'',country:'Japan',tz:'Asia/Tokyo'}); load();} }
  async function addPlace(){ setErr(null); setMsg(null); const p={...formPlace,lat:Number(formPlace.lat),lng:Number(formPlace.lng),duration_min:Number(formPlace.duration_min)}; const {error}=await supabase.from('places').insert(p); if(error) setErr(error.message); else {setMsg('אטרקציה נשמרה'); setFormPlace({name:'',type:'attraction',city_id:'',lat:'',lng:'',desc_he:'',maps_url:'',duration_min:'60'}); load();} }

  if(!user) return <main className="p-4">יש להתחבר כדי לערוך.</main>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">פאנל ניהול</h1>
      {msg && <div className="text-green-700">{msg}</div>}
      {err && <div className="text-red-700">{err}</div>}

      <section className="card space-y-3">
        <h2 className="font-semibold">עריכת ערים</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="שם עיר" value={formCity.name} onChange={e=>setFormCity({...formCity,name:e.target.value})} />
          <input className="input" placeholder="מדינה" value={formCity.country} onChange={e=>setFormCity({...formCity,country:e.target.value})} />
          <input className="input" placeholder="אזור זמן" value={formCity.tz} onChange={e=>setFormCity({...formCity,tz:e.target.value})} />
        </div>
        <button className="btn" onClick={addCity}>שמור עיר</button>
        <ul className="text-sm text-gray-700">{cities.map(c=><li key={c.id}>• {c.name} ({c.country})</li>)}</ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">עריכת אטרקציות</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={formPlace.city_id} onChange={e=>setFormPlace({...formPlace,city_id:e.target.value})}>
            <option value="">בחר עיר</option>
            {cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" placeholder="שם" value={formPlace.name} onChange={e=>setFormPlace({...formPlace,name:e.target.value})} />
          <input className="input" placeholder="lat" value={formPlace.lat} onChange={e=>setFormPlace({...formPlace,lat:e.target.value})} />
          <input className="input" placeholder="lng" value={formPlace.lng} onChange={e=>setFormPlace({...formPlace,lng:e.target.value})} />
          <input className="input" placeholder="משך (דקות)" value={formPlace.duration_min} onChange={e=>setFormPlace({...formPlace,duration_min:e.target.value})} />
          <input className="input" placeholder="קישור מפה" value={formPlace.maps_url} onChange={e=>setFormPlace({...formPlace,maps_url:e.target.value})} />
          <textarea className="input col-span-2" placeholder="תיאור (עברית)" value={formPlace.desc_he} onChange={e=>setFormPlace({...formPlace,desc_he:e.target.value})} />
          <button className="btn" onClick={addPlace}>שמור אטרקציה</button>
        </div>
        <ul className="text-sm text-gray-700 max-h-60 overflow-auto">{places.map(p=><li key={p.id}>• {p.name}</li>)}</ul>
      </section>
    </main>
  );
}
