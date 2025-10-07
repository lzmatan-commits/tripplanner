'use client';
import { useEffect, useState } from 'react';

export default function TripDemo(){
  const [data,setData]=useState<any>(null);
  useEffect(()=>{
    setData({date:'2 באוקטובר',city:'קיוטו',transport:'Taxi',hotel:'MIMARU SUITES Kyoto Shijo',
      activities:[
        {name:"טירת ניג'ו",desc:'טירה מחולקת לשלושה אזורים...',duration:60,maps_url:'https://maps.app.goo.gl/'},
        {name:'גן שינסו-אן',desc:'גן בודהיסטי קטן ושקט.',duration:30,maps_url:'https://maps.app.goo.gl/'}
      ]});
  },[]);
  if(!data) return <main className='p-4'>טוען…</main>;
  return (<main className='max-w-md mx-auto p-4 space-y-3'>
    <div className='card'>
      <div className='text-sm text-gray-600'>{data.date} | {data.city}</div>
      <div className='grid grid-cols-2 gap-2 my-2 text-center'>
        <div className='card bg-rose-100'>תחבורה<br/>{data.transport}</div>
        <div className='card bg-rose-100'>מלון<br/>{data.hotel}</div>
      </div>
      {data.activities.map((a:any,i:number)=>(
        <div key={i} className='card my-2'>
          <div className='font-semibold'>{a.name}</div>
          <div className='text-sm text-gray-700'>{a.desc}</div>
          <div className='text-xs mt-1'>⏱️ {a.duration} דקות</div>
          <a className='link' href={a.maps_url} target='_blank'>הצג על מפה</a>
        </div>
      ))}
    </div>
  </main>);
}
