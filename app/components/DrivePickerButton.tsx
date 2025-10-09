'use client';

import { supabase } from '@/lib/supabaseClient';

export default function DrivePickerButton({
  entryId,
  onSaved,
  label = 'בחר מדרייב'
}: {
  entryId: string;
  onSaved?: () => void | Promise<void>;
  label?: string;
}) {
  async function pick() {
    const webView = prompt('הדבק קישור לצפייה (Google Drive "Anyone with the link")');
    if (!webView) return;
    const name = prompt('שם קובץ להצגה (אופציונלי)') || 'מסמך';
    try {
      const { data: file, error } = await supabase
        .from('drive_files')
        .insert({ name, web_view_link: webView })
        .select('id')
        .single();
      if (error) throw error;
      await supabase.from('entry_files').insert({ entry_id: entryId, file_id: file!.id });
      if (onSaved) await onSaved();
      alert('נשמר');
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <button className="btn" onClick={pick}>
      {label}
    </button>
  );
}
