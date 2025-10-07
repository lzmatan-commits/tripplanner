'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Page(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [user,setUser]=useState<any>(null);
  const [err,setErr]=useState<string|null>(null);

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>setUser(data.user));
    const {data:sub}=supabase.auth.onAuthStateChange((_e,session)=>{setUser(session?.user??null);});
    return()=>{sub?.subscription.unsubscribe();};
  },[]);

  async function signIn(){ setErr(null); const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) setErr(error.message); }
  async function signUp(){ setErr(null); const {error}=await supabase.auth.signUp({email,password}); if(error) setErr(error.message); }
  async function signOut(){ await supabase.auth.signOut(); }

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">מתכנן טיולים</h1>
      {!user ? (
        <div className="card space-y-3">
          <div><div className="label">אימייל</div><input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <div><div className="label">סיסמה</div><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <div className="flex gap-2">
            <button className="btn" onClick={signIn}>התחבר</button>
            <button className="btn bg-gray-800" onClick={signUp}>הרשמה</button>
          </div>
          <p className="text-sm">הדבק את משתני ה-Supabase ב-Vercel ואז התחבר.</p>
        </div>
      ) : (
        <div className="card space-y-3">
          <p>מחובר כ־ {user.email}</p>
          <div className="flex gap-2">
            <Link className="btn" href="/admin">פאנל ניהול</Link>
            <Link className="btn" href="/trip/demo">טיול דמו</Link>
            <button className="btn bg-gray-800" onClick={signOut}>התנתק</button>
          </div>
        </div>
      )}
    </main>
  );
}
