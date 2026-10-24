import { useEffect, useState } from 'react';
import { scoreTone, fmtTotal } from '../lib/score.js';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
export const Icon = {
  back: <svg viewBox="0 0 24 24" {...P}><path d="M15 18l-6-6 6-6" /></svg>,
  chev: <svg viewBox="0 0 24 24" width="18" height="18" {...P}><path d="M9 6l6 6-6 6" /></svg>,
  check: <svg viewBox="0 0 24 24" {...P}><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  clipboard: <svg viewBox="0 0 24 24" {...P}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12l2 2 4-4" /></svg>,
  history: <svg viewBox="0 0 24 24" {...P}><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4M12 8v4l3 2" /></svg>,
  trend: <svg viewBox="0 0 24 24" {...P}><path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" /></svg>,
  gear: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5.4 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>,
  camera: <svg viewBox="0 0 24 24" {...P}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  share: <svg viewBox="0 0 24 24" {...P}><path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8" /></svg>,
  sync: <svg viewBox="0 0 24 24" {...P}><path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4" /></svg>,
  trash: <svg viewBox="0 0 24 24" {...P}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  plus: <svg viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>,
  note: <svg viewBox="0 0 24 24" {...P}><path d="M5 4h14v12l-5 5H5zM14 21v-5h5" /></svg>,
  wa: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.8c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.5 11.5 0 0 1-4.7-4.2c-.4-.5-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.8-.1 1.4z" /></svg>,
};

export function ScoreHex({ v, big, count, n }) {
  const t = scoreTone(v);
  return <div className={`score-hex${big ? ' big' : ''}`} style={v != null ? { background: t.bg, color: t.fg } : null} aria-label={v != null ? `Nilai ${fmtTotal(v)}` : 'Belum ada nilai'}>{v != null ? fmtTotal(v) : '–'}</div>;
}

let toastSet = null;
export function toast(msg) { if (toastSet) toastSet(msg); }
export function ToastHost() {
  const [m, setM] = useState('');
  useEffect(() => { toastSet = (x) => { setM(x); clearTimeout(ToastHost.t); ToastHost.t = setTimeout(() => setM(''), 2600); }; return () => { toastSet = null; }; }, []);
  return m ? <div className="toast" role="status">{m}</div> : null;
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function confirmBox(msg) { return window.confirm(msg); }
