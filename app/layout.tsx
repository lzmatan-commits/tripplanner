import './globals.css';
import '../styles/globals.css';

export const metadata = {
  title: 'מתכנן טיולים',
  description: 'Trip planner admin'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-rose-50 text-neutral-900">{children}</body>
    </html>
  );
}
