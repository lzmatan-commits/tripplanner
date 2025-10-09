import Link from 'next/link';

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto p-8 text-center space-y-6">
      <h1 className="text-4xl font-bold">מתכנן טיולים</h1>
      <div className="flex items-center justify-center gap-3">
        <Link className="btn" href="/admin">פאנל ניהול</Link>
        <Link className="btn" href="/admin/places">ניהול אטרקציות</Link>
      </div>
    </main>
  );
}
