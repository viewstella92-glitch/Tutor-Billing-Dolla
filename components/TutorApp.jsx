'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import ParentReportCard from './ParentReportCard';
import InvoiceCard, { T as INVOICE_T } from './InvoiceCard';
import MonthlyPlanner from './MonthlyPlanner';
import ScheduleTable from './ScheduleTable';
import SettingsPanel from './SettingsPanel';
import Dashboard from './Dashboard';
import { OWNER_ID as FORECAST_OWNER_ID } from '../lib/forecast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, Receipt, Download,
  Plus, Trash2, Check, Copy, X, Pencil, Circle, CheckCircle2, Send, Brain, TrendingUp, Bell
} from 'lucide-react';

// ---------- design tokens ----------
const C = {
  paper: '#FAF6EC',
  paperDeep: '#F1EAD8',
  ink: '#23282B',
  inkSoft: '#6B7270',
  line: '#DED4B8',
  surface: '#FFFFFF',
  pine: '#2E5E45',
  pineDark: '#20402F',
  pineTint: '#E7EFE7',
  gold: '#A8781F',
  goldTint: '#F5EBD4',
  brick: '#A0392A',
  brickTint: '#F5E4DF',
};

const DAY_NAMES = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function jsDayToIndex(jsDay) { return jsDay === 0 ? 6 : jsDay - 1; }
function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function hoursBetween(start, end) { return Math.max(0, (timeToMinutes(end) - timeToMinutes(start)) / 60); }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function monthStr(d) { return d.slice(0, 7); }
function fmtMoney(n) { return '฿' + Math.round(n).toLocaleString('th-TH'); }
function fmtHours(n) { return (Math.round(n * 100) / 100).toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); }
function fmtDateThai(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function daysBetween(dateStr, todayIso) { return Math.floor((new Date(todayIso) - new Date(dateStr)) / 86400000); }

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [openNavGroup, setOpenNavGroup] = useState('overview');
  const [recordRequest, setRecordRequest] = useState(null);
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState('');
  const [exceptions, setExceptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState({ display_name:'', payment_note:'', qr_data_url:null });
  const [lang, setLang] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('tutor-app:lang') === 'en' ? 'en' : 'th');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const OWNER_ID = FORECAST_OWNER_ID;

  useEffect(() => {
    const load = async () => {
      try {
        const [st, sc, se] = await Promise.all([
          supabase.from('tutor_students').select('*').eq('user_id', OWNER_ID).order('created_at'),
          supabase.from('tutor_schedule').select('*').eq('user_id', OWNER_ID),
          supabase.from('tutor_sessions').select('*').eq('user_id', OWNER_ID).order('session_date', { ascending: false }),
        ]);
        if (st.error) throw st.error;
        if (sc.error) throw sc.error;
        if (se.error) throw se.error;

        if (!st.data.length && !sc.data.length && !se.data.length) {
          const legacy = JSON.parse(window.localStorage.getItem('tutor-app:students') || '[]');
          const legacySchedule = JSON.parse(window.localStorage.getItem('tutor-app:schedule') || '[]');
          const legacySessions = JSON.parse(window.localStorage.getItem('tutor-app:sessions') || '[]');
          const idMap = new Map();
          const studentsToInsert = legacy.map((s) => {
            const id = crypto.randomUUID();
            idMap.set(s.id, id);
            return { id, user_id: OWNER_ID, name: s.name, rate: Number(s.rate), grade:s.grade||null, subjects:Array.isArray(s.subjects)?s.subjects:[], goals:s.goals||null, strengths:s.strengths||null, weaknesses:s.weaknesses||null, learning_style:s.learningStyle||null, notes:s.notes||null, status:s.status||'active', target_exam:s.targetExam||null, target_date:s.targetDate||null, baseline_score:s.baselineScore===''||s.baselineScore==null?null:Number(s.baselineScore), latest_score:s.latestScore===''||s.latestScore==null?null:Number(s.latestScore), target_score:s.targetScore===''||s.targetScore==null?null:Number(s.targetScore) };
          });
          const scheduleToInsert = legacySchedule.map((s) => ({
            id: crypto.randomUUID(), user_id: OWNER_ID, student_id: idMap.get(s.studentId) || null,
            recurring: Boolean(s.recurring), day: s.recurring ? Number(s.day) : null,
            date: s.recurring ? null : s.date, start_time: s.start, end_time: s.end,
          }));
          const slotMap = new Map();
          legacySchedule.forEach((s, i) => slotMap.set(s.id, scheduleToInsert[i]?.id));
          const sessionsToInsert = legacySessions.map((s) => ({
            id: crypto.randomUUID(), user_id: OWNER_ID, student_id: idMap.get(s.studentId) || null,
            student_name: s.studentName || '', session_date: s.date, hours: Number(s.hours),
            rate: Number(s.rate), note: s.note || '', invoiced: Boolean(s.invoiced),
            paid: Boolean(s.paid), source_slot_id: slotMap.get(s.sourceSlotId) || null,
          }));
          if (studentsToInsert.length) { const { error } = await supabase.from('tutor_students').insert(studentsToInsert); if (error) throw error; }
          if (scheduleToInsert.length) { const { error } = await supabase.from('tutor_schedule').insert(scheduleToInsert); if (error) throw error; }
          if (sessionsToInsert.length) { const { error } = await supabase.from('tutor_sessions').insert(sessionsToInsert); if (error) throw error; }
          localStorage.removeItem('tutor-app:students');
          localStorage.removeItem('tutor-app:schedule');
          localStorage.removeItem('tutor-app:sessions');
        }

        const [a,b,c,d,e,f] = await Promise.all([
          supabase.from('tutor_students').select('*').eq('user_id', OWNER_ID).order('created_at'),
          supabase.from('tutor_schedule').select('*').eq('user_id', OWNER_ID),
          supabase.from('tutor_sessions').select('*').eq('user_id', OWNER_ID).order('session_date', { ascending: false }),
          supabase.from('tutor_slot_exceptions').select('*').eq('user_id', OWNER_ID).order('date'),
          supabase.from('tutor_invoices').select('*').eq('user_id', OWNER_ID).order('created_at', { ascending: false }),
          supabase.from('tutor_settings').select('*').eq('user_id', OWNER_ID).maybeSingle(),
        ]);
        if (a.error) throw a.error;
        if (b.error) throw b.error;
        if (c.error) throw c.error;
        if (d.error) throw d.error;
        if (e.error) throw e.error;
        if (f.error) throw f.error;
        setStudents((a.data || []).map((x) => ({ id:x.id, name:x.name, rate:Number(x.rate), grade:x.grade||'', subjects:Array.isArray(x.subjects)?x.subjects:[], goals:x.goals||'', strengths:x.strengths||'', weaknesses:x.weaknesses||'', learningStyle:x.learning_style||'', notes:x.notes||'', status:x.status||'active', targetExam:x.target_exam||'', targetDate:x.target_date||'', baselineScore:x.baseline_score==null?'':Number(x.baseline_score), latestScore:x.latest_score==null?'':Number(x.latest_score), targetScore:x.target_score==null?'':Number(x.target_score) })));
        setSchedule((b.data || []).map((x) => ({ id:x.id, studentId:x.student_id, recurring:x.recurring, day:x.day ?? undefined, date:x.date ?? undefined, start:String(x.start_time).slice(0,5), end:String(x.end_time).slice(0,5) })));
        setSessions((c.data || []).map((x) => ({ id:x.id, studentId:x.student_id, studentName:x.student_name || '', date:x.session_date, hours:Number(x.hours), rate:Number(x.rate), note:x.note || '', invoiced:Boolean(x.invoiced), paid:Boolean(x.paid), sourceSlotId:x.source_slot_id || undefined })));
        setExceptions((d.data || []).map((x) => ({ id:x.id, slotId:x.slot_id, date:x.date, status:x.status })));
        setInvoices(e.data || []);
        setSettings(f.data ? { display_name:f.data.display_name||'', payment_note:f.data.payment_note||'', qr_data_url:f.data.qr_data_url||null, updated_at:f.data.updated_at } : { display_name:'', payment_note:'', qr_data_url:null });
      } catch (e) {
        console.error(e);
        showToast('เชื่อมต่อฐานข้อมูลไม่สำเร็จ');
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  useEffect(() => { try { window.localStorage.setItem('tutor-app:lang', lang); } catch {} }, [lang]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const updateExceptions = async (next, deletedIds = []) => {
    const previous = exceptions;
    try {
      if (next.length) {
        const { error } = await supabase.from('tutor_slot_exceptions').upsert(next.map(x => ({ id:x.id, user_id:OWNER_ID, slot_id:x.slotId, date:x.date, status:x.status || 'cancelled' })), { onConflict:'id' });
        if (error) throw error;
      }
      for (const id of deletedIds) {
        const { error } = await supabase.from('tutor_slot_exceptions').delete().eq('id', id).eq('user_id', OWNER_ID);
        if (error) throw error;
      }
      setExceptions(next);
    } catch (e) {
      console.error(e);
      setExceptions(previous);
      showToast(lang==='en'?'Could not save cancellation':'บันทึกสถานะยกเลิกไม่สำเร็จ ข้อมูลเดิมยังแสดงอยู่');
    }
  };

  const saveSettings = async (next) => {
    const row = { user_id:OWNER_ID, display_name:next.display_name||'', payment_note:next.payment_note||'', qr_data_url:next.qr_data_url||null, updated_at:new Date().toISOString() };
    const { data, error } = await supabase.from('tutor_settings').upsert(row, { onConflict:'user_id' }).select('*').single();
    if (error) throw error;
    setSettings({ display_name:data.display_name||'', payment_note:data.payment_note||'', qr_data_url:data.qr_data_url||null, updated_at:data.updated_at });
  };

  const createInvoice = async ({ student, dateFrom, dateTo, selectedSessions, parentName }) => {
    const ids = selectedSessions.map(s=>s.id);
    const total = selectedSessions.reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
    const { data, error } = await supabase.rpc('create_tutor_invoice', {
      p_student_id:student.id, p_period_from:dateFrom, p_period_to:dateTo,
      p_session_ids:ids, p_total:total, p_student_name:student.name, p_parent_name:parentName||''
    });
    if (error) throw error;
    const invoice = Array.isArray(data) ? data[0] : data;
    if (!invoice?.id) throw new Error('Invoice was not returned by database');
    const [sessionResult, invoiceResult] = await Promise.all([
      supabase.from('tutor_sessions').select('*').eq('user_id',OWNER_ID).order('session_date',{ascending:false}),
      supabase.from('tutor_invoices').select('*').eq('user_id',OWNER_ID).order('created_at',{ascending:false})
    ]);
    if (sessionResult.error) throw sessionResult.error;
    if (invoiceResult.error) throw invoiceResult.error;
    setSessions((sessionResult.data||[]).map(x=>({id:x.id,studentId:x.student_id,studentName:x.student_name||'',date:x.session_date,hours:Number(x.hours),rate:Number(x.rate),note:x.note||'',invoiced:Boolean(x.invoiced),paid:Boolean(x.paid),sourceSlotId:x.source_slot_id||undefined})));
    setInvoices(invoiceResult.data||[]);
    return invoice;
  };

  const updateStudents = async (next, deletedIds = []) => {
    const previous = students;
    try {
      if (next.length) {
        const { error } = await supabase.from('tutor_students').upsert(next.map(x => ({ id:x.id, user_id:OWNER_ID, name:x.name, rate:Number(x.rate), grade:x.grade||null, subjects:Array.isArray(x.subjects)?x.subjects:[], goals:x.goals||null, strengths:x.strengths||null, weaknesses:x.weaknesses||null, learning_style:x.learningStyle||null, notes:x.notes||null, status:x.status||'active', target_exam:x.targetExam||null, target_date:x.targetDate||null, baseline_score:x.baselineScore===''||x.baselineScore==null?null:Number(x.baselineScore), latest_score:x.latestScore===''||x.latestScore==null?null:Number(x.latestScore), target_score:x.targetScore===''||x.targetScore==null?null:Number(x.targetScore) })), { onConflict:'id' });
        if (error) throw error;
      }
      for (const id of deletedIds) {
        const { error } = await supabase.from('tutor_students').delete().eq('id', id).eq('user_id', OWNER_ID);
        if (error) throw error;
      }
      setStudents(next);
      return true;
    } catch (e) {
      console.error(e);
      setStudents(previous);
      showToast(lang==='en'?'Could not save student changes':'บันทึกข้อมูลนักเรียนไม่สำเร็จ ข้อมูลเดิมยังแสดงอยู่');
      return false;
    }
  };

  const updateSchedule = async (next, deletedIds = []) => {
    const previous = schedule;
    try {
      if (next.length) {
        const { error } = await supabase.from('tutor_schedule').upsert(next.map(x => ({ id:x.id, user_id:OWNER_ID, student_id:x.studentId, recurring:Boolean(x.recurring), day:x.recurring?Number(x.day):null, date:x.recurring?null:x.date, start_time:x.start, end_time:x.end })), { onConflict:'id' });
        if (error) throw error;
      }
      for (const id of deletedIds) {
        const { error } = await supabase.from('tutor_schedule').delete().eq('id', id).eq('user_id', OWNER_ID);
        if (error) throw error;
      }
      setSchedule(next);
    } catch (e) {
      console.error(e);
      setSchedule(previous);
      showToast(lang==='en'?'Could not save schedule':'บันทึกตารางสอนไม่สำเร็จ ข้อมูลเดิมยังแสดงอยู่');
    }
  };

  const updateSessions = async (next, deletedIds = []) => {
    try {
      for (const id of deletedIds) {
        const { error } = await supabase.from('tutor_sessions').delete().eq('id', id).eq('user_id', OWNER_ID);
        if (error) throw error;
      }
      if (next.length) {
        const { error } = await supabase.from('tutor_sessions').upsert(next.map(x => ({ id:x.id, user_id:OWNER_ID, student_id:x.studentId||null, student_name:x.studentName||'', session_date:x.date, hours:Number(x.hours), rate:Number(x.rate), note:x.note||'', invoiced:Boolean(x.invoiced), paid:Boolean(x.paid), source_slot_id:x.sourceSlotId||null })));
        if (error) throw error;
      }
      setSessions(next);
    } catch (e) {
      console.error(e);
      showToast('บันทึกคาบสอนไม่สำเร็จ');
      throw e;
    }
  };

  const getStudent = (id) => students.find((s) => s.id === id);

  const NAV_GROUPS = [
    { id:'overview', label:lang==='en'?'Overview':'ภาพรวม', icon:LayoutDashboard, items:[{id:'dashboard',label:lang==='en'?'Dashboard':'หน้าหลัก',icon:LayoutDashboard}] },
    { id:'students', label:lang==='en'?'Students':'นักเรียน', icon:Users, items:[{id:'students',label:lang==='en'?'Student profiles':'ข้อมูลนักเรียน',icon:Users}] },
    { id:'teaching', label:lang==='en'?'Teaching':'การสอน', icon:CalendarDays, items:[
      {id:'schedule',label:lang==='en'?'Weekly schedule':'ตารางสอน',icon:CalendarDays},
      {id:'plan',label:lang==='en'?'Monthly planner':'แพลนรายเดือน',icon:CalendarDays},
      {id:'sessions',label:lang==='en'?'Lesson records':'บันทึกคาบเรียน',icon:ClipboardList},
    ]},
    { id:'finance', label:lang==='en'?'Finance':'การเงิน', icon:Receipt, items:[
      {id:'invoice',label:lang==='en'?'Parent invoices':'ใบแจ้งค่าสอน',icon:Receipt},
      {id:'business',label:lang==='en'?'Income overview':'สรุปรายได้',icon:BarChart},
    ]},
    { id:'reports', label:lang==='en'?'Reports':'รายงาน', icon:ClipboardList, items:[
      {id:'progress',label:lang==='en'?'Learning progress':'พัฒนาการ',icon:TrendingUp},
      {id:'alerts',label:lang==='en'?'Follow-up list':'รายการติดตาม',icon:Bell},
      {id:'export',label:lang==='en'?'Export data':'ส่งออกข้อมูล',icon:Download},
    ]},
  ];
  const activeGroup = NAV_GROUPS.find(group => group.items.some(item => item.id === tab))?.id || 'overview';
  useEffect(() => { setOpenNavGroup(activeGroup); }, [activeGroup]);
  const renderNavigation = (compact = false) => NAV_GROUPS.map(group => {
    const GroupIcon = group.icon;
    const isOpen = openNavGroup === group.id;
    const isActive = activeGroup === group.id;
    return <div key={group.id} className="nav-group">
      <button type="button" onClick={() => {
        if (group.items.length === 1) { setTab(group.items[0].id); setOpenNavGroup(group.id); }
        else setOpenNavGroup(current => current === group.id ? '' : group.id);
      }} aria-expanded={isOpen} className={`nav-group-trigger ${isActive ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`}>
        <GroupIcon size={compact ? 16 : 17} />
        <span>{group.label}</span>
        {group.items.length > 1 && <span className="nav-group-count">{group.items.length}</span>}
      </button>
      {group.items.length > 1 && isOpen && <div className="nav-subitems">
        {group.items.map(item => { const ItemIcon = item.icon; return <button type="button" key={item.id} onClick={() => {setTab(item.id);setOpenNavGroup(group.id);}} className={`nav-subitem ${tab === item.id ? 'is-current' : ''}`}>
          <ItemIcon size={15} /><span>{item.label}</span>
        </button>; })}
      </div>}
    </div>;
  });

  if (!loaded) {
    return (
      <div style={{ background: C.paper, color: C.inkSoft }} className="w-full min-h-screen flex items-center justify-center text-sm">
        {lang==='en'?'Loading data…':'กำลังโหลดข้อมูล...'}
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, color: C.ink }} className="tutor-workspace w-full min-h-screen flex flex-col md:flex-row font-sans">
      {/* Desktop sidebar */}
      <div style={{ borderRight: `1px solid ${C.line}` }} className="hidden md:flex md:w-56 md:flex-col md:py-6 md:px-4 md:sticky md:top-0 md:h-screen shrink-0">
        <div className="px-2 mb-8">
          <div style={{ color: C.pine }} className="text-lg font-semibold leading-tight">สมุดสอนพิเศษ</div>
          <div style={{ color: C.inkSoft }} className="text-xs mt-1">จัดตาราง คิดค่าสอน แจ้งผู้ปกครอง</div>
        </div>
        <nav className="flex flex-col gap-2">
          {renderNavigation()}
        </nav>
      </div>

      {/* Mobile top nav */}
      <div className="md:hidden sticky top-0 z-20 mobile-nav">
        <div className="mobile-nav-groups">{renderNavigation(true)}</div>
      </div>

      <div className="flex-1 px-4 py-4 md:px-10 md:py-6 max-w-5xl mx-auto w-full">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{borderColor:C.line}}>
          <div><div className="font-semibold" style={{color:C.pineDark}}>Tutor Billing Dolla</div><div className="text-xs mt-0.5" style={{color:C.inkSoft}}>{lang==='en'?'Tutoring and invoice workspace':'จัดการคาบสอนและใบแจ้งค่าสอน'}</div></div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border p-1" style={{borderColor:C.line,background:C.surface}}><button type="button" onClick={()=>setLang('th')} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{background:lang==='th'?C.pine:C.surface,color:lang==='th'?'#fff':C.inkSoft}}>TH</button><button type="button" onClick={()=>setLang('en')} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{background:lang==='en'?C.pine:C.surface,color:lang==='en'?'#fff':C.inkSoft}}>EN</button></div>
            <button type="button" onClick={()=>setSettingsOpen(true)} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{borderColor:C.line,background:C.surface}}>{lang==='en'?'Settings':'ตั้งค่า'}</button>
          </div>
        </div>
        {tab === 'dashboard' && (
          <Dashboard students={students} schedule={schedule} sessions={sessions} exceptions={exceptions} invoices={invoices} settings={settings} lang={lang} setTab={setTab} showToast={showToast} updateExceptions={updateExceptions} onOpenLessonForm={(slot, date) => { setRecordRequest({ slot, date }); setTab('sessions'); }} />
        )}
        {tab === 'students' && <StudentsTab students={students} updateStudents={updateStudents} sessions={sessions} />}
        {tab === 'progress' && <ProgressIntelligence students={students} sessions={sessions} />}
        {tab === 'alerts' && <SmartAlerts students={students} sessions={sessions} schedule={schedule} />}
        {tab === 'business' && <BusinessIntelligence students={students} sessions={sessions} schedule={schedule} />}
        {tab === 'plan' && <MonthlyPlanner students={students} schedule={schedule} sessions={sessions} exceptions={exceptions} updateExceptions={updateExceptions} showToast={showToast} lang={lang} setTab={setTab} onOpenLessonForm={(slot, date) => { setRecordRequest({ slot, date }); setTab('sessions'); }} />}
        {tab === 'schedule' && (
          <ScheduleTable students={students} schedule={schedule} updateSchedule={updateSchedule} showToast={showToast} onOpenLessonForm={(slot, date) => { setRecordRequest({ slot, date }); setTab('sessions'); }} />
        )}
        {tab === 'sessions' && (
          <SessionsTab students={students} sessions={sessions} updateSessions={updateSessions} getStudent={getStudent} showToast={showToast} recordRequest={recordRequest} clearRecordRequest={() => setRecordRequest(null)} />
        )}
        {tab === 'invoice' && (
          <InvoiceTab students={students} sessions={sessions} invoices={invoices} settings={settings} lang={lang} onCreateInvoice={createInvoice} showToast={showToast} />
        )}
        {tab === 'export' && <ExportTab students={students} sessions={sessions} />}
      </div>

      {settingsOpen && <SettingsPanel settings={settings} lang={lang} onSave={saveSettings} showToast={showToast} onClose={()=>setSettingsOpen(false)} />}
      {toast && (
        <div style={{ background: C.ink, color: C.paper }} className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------- shared bits ----------
function Card({ children, style, className = '' }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, ...style }} className={`rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold">{children}</h1>
      {sub && <p style={{ color: C.inkSoft }} className="text-sm mt-1">{sub}</p>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ color: C.inkSoft, border: `1px dashed ${C.line}` }} className="rounded-xl p-6 text-sm text-center">
      {text}
    </div>
  );
}

// ---------- Dashboard ----------
function ProgressIntelligence({ students, sessions }) {
  const rows = students.map(s => {
    const history=sessions.filter(x=>x.studentId===s.id).sort((a,b)=>a.date.localeCompare(b.date));
    const scores=history.map(x=>Number((x.note||'').match(/คะแนน[:： ]*(\d+(?:\.\d+)?)/)?.[1])).filter(Number.isFinite);
    const current=s.latestScore!=='' ? Number(s.latestScore) : (scores.length?scores[scores.length-1]:null);
    const baseline=s.baselineScore!=='' ? Number(s.baselineScore) : (scores.length?scores[0]:null);
    const target=s.targetScore!=='' ? Number(s.targetScore) : null;
    const change=current!=null&&baseline!=null?current-baseline:null;
    const gap=current!=null&&target!=null?target-current:null;
    const trend=change==null?'ยังไม่มีข้อมูล':change>0?'ดีขึ้น':change<0?'ต้องติดตาม':'ทรงตัว';
    return {...s,historyCount:history.length,current,change,gap,trend};
  });
  const needsAttention=rows.filter(x=>x.trend==='ต้องติดตาม'||(x.gap!=null&&x.gap>10));
  const chartStudentId = rows[0]?.id || '';
  const [selectedId, setSelectedId] = useState(chartStudentId);
  const selected = rows.find(x=>x.id===selectedId) || rows[0];
  const chartData = selected ? sessions.filter(x=>x.studentId===selected.id).sort((a,b)=>a.date.localeCompare(b.date)).map((x,i)=>{ const m=(x.note||'').match(/คะแนน[:： ]*(\d+(?:\\.\d+)?)/); return m ? {date: x.date.slice(5), score:Number(m[1]), index:i+1} : null; }).filter(Boolean) : [];
  return (
    <div className="space-y-4">
      <SectionTitle sub="ดูแนวโน้มคะแนนและนักเรียนที่ควรติดตาม">Progress Intelligence</SectionTitle>
      {rows.length===0?<EmptyState text="ยังไม่มีข้อมูลนักเรียน"/>:<>
        <div className="grid grid-cols-2 gap-2">
          <Card><div className="text-xs" style={{color:C.inkSoft}}>นักเรียนทั้งหมด</div><div className="text-2xl font-semibold mt-1">{rows.length}</div></Card>
          <Card><div className="text-xs" style={{color:C.inkSoft}}>ควรติดตาม</div><div className="text-2xl font-semibold mt-1">{needsAttention.length}</div></Card>
        </div>
        {needsAttention.length>0&&<Card style={{background:C.goldTint}}>
          <div className="font-medium text-sm mb-2">ควรติดตามเป็นพิเศษ</div>
          <div className="space-y-2">{needsAttention.map(s=><div key={s.id} className="text-sm"><b>{s.name}</b> · {s.trend}{s.gap!=null?' · ห่างเป้าหมาย '+s.gap+' คะแนน':''}</div>)}</div>
        </Card>}
        {rows.length>0&&<Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div><div className="font-medium text-sm">กราฟคะแนนรายคาบ</div><div className="text-xs mt-1" style={{color:C.inkSoft}}>ดึงคะแนนจากโน้ตที่บันทึกในแต่ละคาบ</div></div>
            <select value={selected?.id||''} onChange={e=>setSelectedId(e.target.value)} style={inputStyle} className="text-sm px-2.5 py-2 rounded-lg max-w-40">
              {rows.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {chartData.length<2 ? <EmptyState text="ต้องมีคะแนนอย่างน้อย 2 คาบ จึงจะแสดงแนวโน้ม"/> :
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:8,right:8,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis domain={[0,100]}/><Tooltip formatter={(value)=>[value,'คะแนน']}/><Bar dataKey="score" fill={C.pine} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>}
        </Card>}
        <div className="space-y-2">{rows.map(s=><Card key={s.id}>
          <div className="flex justify-between gap-3">
            <div><div className="font-medium text-sm">{s.name}</div><div className="text-xs mt-1" style={{color:C.inkSoft}}>{s.historyCount} คาบ · {s.current!=null?'คะแนนล่าสุด '+s.current:'ยังไม่มีคะแนน'}</div></div>
            <div className="text-sm font-medium">{s.trend}</div>
          </div>
          <div className="text-xs mt-2" style={{color:C.inkSoft}}>
            {s.change!=null?'จากจุดเริ่มต้น '+(s.change>=0?'+':'')+s.change+' คะแนน':'ยังไม่มีข้อมูลพอสำหรับวัดแนวโน้ม'}
            {s.target!=null&&s.current!=null?' · เป้าหมาย '+s.target:''}
          </div>
        </Card>)}</div>
      </>}
    </div>
  );
}

// ---------- Smart Alerts ----------
function SmartAlerts({ students, sessions, schedule }) {
  const today=new Date(); today.setHours(0,0,0,0);
  const alerts=[];
  students.forEach(s=>{
    const history=sessions.filter(x=>x.studentId===s.id).sort((a,b)=>b.date.localeCompare(a.date));
    const last=history[0];
    if(s.status==='active' && !last) alerts.push({level:'info',text:s.name+' ยังไม่มีบันทึกคาบสอน'});
    if(last){
      const days=daysBetween(last.date,todayStr());
      if(days>=21) alerts.push({level:'warn',text:s.name+' ไม่มีคาบสอน/บันทึกคาบมาแล้ว '+days+' วัน'});
    }
    if(s.latestScore!==''&&s.targetScore!==''&&Number(s.targetScore)-Number(s.latestScore)>=10)
      alerts.push({level:'warn',text:s.name+' ยังห่างเป้าหมาย '+(Number(s.targetScore)-Number(s.latestScore))+' คะแนน'});
  });
  schedule.filter(x=>!x.recurring&&x.date).forEach(x=>{
    const days=daysBetween(todayStr(),x.date);
    if(days<0) alerts.push({level:'warn',text:'มีตารางสอนที่ยังไม่ตรวจสอบผล: '+((students.find(s=>s.id===x.studentId)||{}).name||'นักเรียน')+' · '+fmtDateThai(x.date)});
  });
  return (
    <Card>
      <div className="font-medium text-sm mb-2">Smart Alerts</div>
      {alerts.length===0?<div className="text-sm" style={{color:C.inkSoft}}>ตอนนี้ยังไม่มีรายการที่ต้องติดตาม</div>:
      <div className="space-y-1.5">{alerts.map((a,i)=><div key={i} className="text-sm">• {a.text}</div>)}</div>}
    </Card>
  );
}

function DashboardLegacy({ students, sessions, schedule, updateSessions, getStudent, showToast, setTab, onOpenLessonForm }) {
  if (students.length === 0) {
    return (
      <div>
        <SectionTitle sub="เริ่มต้นด้วยการเพิ่มนักเรียนคนแรก">ภาพรวม</SectionTitle>
        <EmptyState text="ยังไม่มีนักเรียนในระบบ ไปที่แท็บ 'นักเรียน' เพื่อเพิ่มคนแรก" />
      </div>
    );
  }

  const [prepStudent, setPrepStudent] = useState(null);
  const [prepDuration, setPrepDuration] = useState(90);

  const thisMonth = monthStr(todayStr());
  const sessionsThisMonth = sessions.filter((s) => monthStr(s.date) === thisMonth);
  const revenueThisMonth = sessionsThisMonth.reduce((sum, s) => sum + s.hours * s.rate, 0);
  const hoursThisMonth = sessionsThisMonth.reduce((sum, s) => sum + s.hours, 0);

  const unpaid = sessions.filter((s) => !s.paid);
  const outstandingTotal = unpaid.reduce((sum, s) => sum + s.hours * s.rate, 0);
  const outstandingByStudent = {};
  unpaid.forEach((s) => {
    outstandingByStudent[s.studentId] = (outstandingByStudent[s.studentId] || 0) + s.hours * s.rate;
  });
  const outstandingList = Object.entries(outstandingByStudent)
    .map(([id, amount]) => ({ id, amount, name: getStudent(id)?.name || sessions.find((s) => s.studentId === id)?.studentName || 'ไม่ทราบชื่อ' }))
    .sort((a, b) => b.amount - a.amount);

  const uninvoicedCount = sessions.filter((s) => !s.invoiced).length;
  const today = todayStr();
  const staleUninvoiced = sessions
    .filter((s) => !s.invoiced && daysBetween(s.date, today) > 30)
    .map((s) => ({ ...s, daysAgo: daysBetween(s.date, today), name: getStudent(s.studentId)?.name || s.studentName || 'ไม่ทราบชื่อ' }))
    .sort((a, b) => b.daysAgo - a.daysAgo);

  const todayIdx = jsDayToIndex(new Date().getDay());
  const todaysSlots = schedule
    .filter((sl) => (sl.recurring && sl.day === todayIdx) || (!sl.recurring && sl.date === today))
    .sort((a, b) => a.start.localeCompare(b.start));

  const markTaught = (slot) => {
    const alreadyLogged = sessions.some((s) => s.sourceSlotId === slot.id && s.date === today);
    if (alreadyLogged) return;
    onOpenLessonForm?.(slot, today);
  };

  return (
    <div>
      <SectionTitle sub={fmtDateThai(today)}>ภาพรวม</SectionTitle>

      <div style={{background:`linear-gradient(120deg, ${C.pineDark}, ${C.pine})`}} className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-4 text-white">
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest opacity-80">Tutor workspace</div>
          <h2 className="text-xl sm:text-2xl font-semibold mt-1">ภาพรวมการสอนของคุณ</h2>
          <p className="text-sm mt-2 opacity-90">ติดตามรายได้ คาบสอน และยอดที่ต้องเก็บได้จากหน้าเดียว</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => setTab('students')} className="rounded-xl bg-white px-3 py-2 text-sm font-medium" style={{color:C.pineDark}}>＋ เพิ่ม/จัดการนักเรียน</button>
            <button onClick={() => setTab('schedule')} className="rounded-xl px-3 py-2 text-sm font-medium" style={{background:'rgba(255,255,255,.15)',color:'#fff',border:'1px solid rgba(255,255,255,.3)'}}>ดูตารางสอน →</button>
            <button onClick={() => setTab('invoice')} className="rounded-xl px-3 py-2 text-sm font-medium" style={{background:'rgba(255,255,255,.15)',color:'#fff',border:'1px solid rgba(255,255,255,.3)'}}>แจ้งค่าสอน →</button>
          </div>
        </div>
        <div aria-hidden="true" className="absolute -right-5 -bottom-16 h-48 w-48 rounded-full border-[28px] opacity-10" style={{borderColor:'#fff'}} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Card style={{background:C.pineTint,borderColor:C.pineTint}}>
          <div className="flex items-center justify-between gap-2"><div style={{color:C.pineDark}} className="text-xs font-medium">รายได้เดือนนี้</div><span className="text-lg">฿</span></div>
          <div style={{color:C.pineDark}} className="text-2xl sm:text-3xl font-semibold mt-2">{fmtMoney(revenueThisMonth)}</div>
          <div className="text-xs mt-2" style={{color:C.inkSoft}}>{sessionsThisMonth.length} คาบที่บันทึกแล้ว</div>
        </Card>
        <Card style={{background:'#F0F7FC',borderColor:'#D8EAF5'}}>
          <div className="flex items-center justify-between gap-2"><div style={{color:'#365F79'}} className="text-xs font-medium">ชั่วโมงสอนเดือนนี้</div><span className="text-lg">◷</span></div>
          <div className="text-2xl sm:text-3xl font-semibold mt-2">{fmtHours(hoursThisMonth)} <span className="text-base font-normal">ชม.</span></div>
          <div className="text-xs mt-2" style={{color:C.inkSoft}}>เฉลี่ย {sessionsThisMonth.length ? fmtHours(hoursThisMonth/sessionsThisMonth.length) : '0'} ชม./คาบ</div>
        </Card>
        <Card style={outstandingTotal > 0 ? {background:C.brickTint,borderColor:C.brick} : {background:C.surface,borderColor:C.line}}>
          <div className="flex items-center justify-between gap-2"><div style={{color:outstandingTotal>0?C.brick:C.inkSoft}} className="text-xs font-medium">ค้างชำระทั้งหมด</div><span className="text-lg">◉</span></div>
          <div style={{color:outstandingTotal > 0 ? C.brick : C.ink}} className="text-2xl sm:text-3xl font-semibold mt-2">{fmtMoney(outstandingTotal)}</div>
          <div className="text-xs mt-2" style={{color:C.inkSoft}}>{unpaid.length} คาบที่ยังไม่ชำระ</div>
        </Card>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <button onClick={() => setTab('students')} className="rounded-xl border p-3 text-left transition hover:-translate-y-0.5" style={{borderColor:C.line,background:C.surface}}><div className="text-lg">👩‍🎓</div><div className="text-sm font-medium mt-1">นักเรียน</div><div className="text-xs mt-1" style={{color:C.inkSoft}}>{students.length} คนในระบบ</div></button>
        <button onClick={() => setTab('schedule')} className="rounded-xl border p-3 text-left transition hover:-translate-y-0.5" style={{borderColor:C.line,background:C.surface}}><div className="text-lg">🗓️</div><div className="text-sm font-medium mt-1">ตารางสอน</div><div className="text-xs mt-1" style={{color:C.inkSoft}}>{todaysSlots.length} คาบวันนี้</div></button>
        <button onClick={() => setTab('invoice')} className="rounded-xl border p-3 text-left transition hover:-translate-y-0.5" style={{borderColor:C.line,background:C.surface}}><div className="text-lg">🧾</div><div className="text-sm font-medium mt-1">แจ้งค่าสอน</div><div className="text-xs mt-1" style={{color:C.inkSoft}}>{uninvoicedCount} คาบรอแจ้ง</div></button>
        <div className="rounded-xl border p-3" style={{borderColor:C.line,background:C.surface}}><div className="text-lg">📊</div><div className="text-sm font-medium mt-1">รายได้ปีนี้</div><div className="text-xs mt-1" style={{color:C.inkSoft}}>{fmtMoney(sessions.filter(s=>s.date.startsWith(String(new Date().getFullYear()))).reduce((sum,s)=>sum+s.hours*s.rate,0))}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-medium">สอนวันนี้</div>
              <div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>เปิดดูข้อมูลแล้วเตรียมคาบได้ทันที</div>
            </div>
            <span style={{ color: C.pine }} className="text-xs font-medium">{todaysSlots.length} คาบ</span>
          </div>
          {todaysSlots.length === 0 && <div style={{ color: C.inkSoft }} className="text-sm">ไม่มีคาบสอนวันนี้</div>}
          <div className="flex flex-col gap-2">
            {todaysSlots.map((slot) => {
              const student = getStudent(slot.studentId);
              const logged = sessions.some((s) => s.sourceSlotId === slot.id && s.date === today);
              return (
                <div key={slot.id} style={{ borderBottom: `1px dashed ${C.line}` }} className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{student?.name || 'ไม่ทราบชื่อ'}</div>
                      <div style={{ color: C.inkSoft }} className="text-xs">{slot.start}–{slot.end}</div>
                    </div>
                    <button
                      onClick={() => student && setPrepStudent(student)}
                      disabled={!student}
                      style={{ border: `1px solid ${C.line}`, color: C.pineDark }}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg disabled:opacity-40"
                    >
                      เตรียมคาบนี้
                    </button>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={() => markTaught(slot)}
                      disabled={logged}
                      style={logged ? { color: C.pine } : { background: C.pineTint, color: C.pineDark }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      {logged ? (<><CheckCircle2 size={14} /> บันทึกแล้ว</>) : 'สอนแล้ว ✓'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-3">ยอดค้างชำระรายคน</div>
          {outstandingList.length === 0 && <div style={{ color: C.inkSoft }} className="text-sm">ไม่มียอดค้างชำระ 🎉</div>}
          <div className="flex flex-col gap-2">
            {outstandingList.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span>{o.name}</span>
                <span style={{ color: C.brick }} className="font-medium">{fmtMoney(o.amount)}</span>
              </div>
            ))}
          </div>
          {uninvoicedCount > 0 && (
            <button onClick={() => setTab('invoice')} style={{ color: C.pineDark }} className="text-xs font-medium mt-3 underline">
              มี {uninvoicedCount} คาบที่ยังไม่ได้แจ้งค่าสอน — ไปที่แท็บแจ้งค่าสอน
            </button>
          )}
        </Card>
      </div>

      {staleUninvoiced.length > 0 && (
        <Card style={{ borderColor: C.brick, background: C.brickTint }} className="mt-4">
          <div style={{ color: C.brick }} className="font-medium mb-3">ค้างแจ้งนาน (สอนไปแล้วเกิน 30 วัน ยังไม่ได้แจ้งค่าสอน)</div>
          <div className="flex flex-col gap-2">
            {staleUninvoiced.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span>{s.name} · {fmtDateThai(s.date)}</span>
                <span style={{ color: C.brick }} className="font-medium">{s.daysAgo} วันก่อน · {fmtMoney(s.hours * s.rate)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setTab('invoice')} style={{ color: C.brick }} className="text-xs font-medium mt-3 underline">
            ไปที่แท็บแจ้งค่าสอนเพื่อจัดการ
          </button>
        </Card>
      )}

      <YearSummary sessions={sessions} />

      {prepStudent && (
        <LessonPlanner
          student={prepStudent}
          sessions={sessions}
          duration={prepDuration}
          setDuration={setPrepDuration}
          onClose={() => setPrepStudent(null)}
        />
      )}
    </div>
  );
}

function YearSummary({ sessions }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const data = MONTHS_TH.map((label, i) => {
    const prefix = `${year}-${String(i + 1).padStart(2, '0')}`;
    const revenue = sessions.filter((s) => s.date.startsWith(prefix)).reduce((sum, s) => sum + s.hours * s.rate, 0);
    return { month: label, revenue };
  });
  const yearTotal = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">สรุปรายได้รายปี</div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={inputStyle} className="text-sm px-2 py-1 rounded-lg">
          {yearOptions.map((y) => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.inkSoft }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
            <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="revenue" fill={C.pine} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ color: C.inkSoft }} className="text-sm mt-2">
        รวมทั้งปี {year + 543}: <span style={{ color: C.pine }} className="font-semibold">{fmtMoney(yearTotal)}</span>
      </div>
    </Card>
  );
}

// ---------- Students ----------
function StudentsTab({ students, updateStudents, sessions }) {
  const emptyForm = { name:'', rate:'', grade:'', subjects:[], goals:'', strengths:'', weaknesses:'', learningStyle:'', notes:'', status:'active', targetExam:'', targetDate:'', baselineScore:'', latestScore:'', targetScore:'' };
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [lessonDuration, setLessonDuration] = useState(90);

  const openNew = () => { setForm({ ...emptyForm }); setEditing('new'); };
  const openEdit = (s) => { setForm({ ...emptyForm, ...s, subjects:Array.isArray(s.subjects)?s.subjects:[], baselineScore:s.baselineScore??'', latestScore:s.latestScore??'', targetScore:s.targetScore??'' }); setEditing(s.id); };
  const toggleSubject = (subject) => setForm((f) => ({ ...f, subjects:f.subjects.includes(subject)?f.subjects.filter(x=>x!==subject):[...f.subjects,subject] }));

  const save = async () => {
    const name=form.name.trim(), rate=parseFloat(form.rate);
    if (!name || !Number.isFinite(rate) || rate<=0) return;
    const student={ id:editing==='new'?uid():editing, name, rate, grade:form.grade.trim(), subjects:form.subjects, goals:form.goals.trim(), strengths:form.strengths.trim(), weaknesses:form.weaknesses.trim(), learningStyle:form.learningStyle, notes:form.notes.trim(), status:form.status, targetExam:form.targetExam.trim(), targetDate:form.targetDate, baselineScore:form.baselineScore===''?'':Number(form.baselineScore), latestScore:form.latestScore===''?'':Number(form.latestScore), targetScore:form.targetScore===''?'':Number(form.targetScore) };
    const saved=await updateStudents(editing==='new'?[...students,student]:students.map(s=>s.id===editing?{...s,...student}:s));
    if(saved) setEditing(null);
  };
  const remove = async (id) => {
    if(!confirm('ลบนักเรียนคนนี้? ประวัติการสอนเดิมจะยังอยู่')) return;
    await updateStudents(students.filter(s=>s.id!==id), [id]);
  };
  const subjectOptions=['คณิตศาสตร์','ฟิสิกส์','ภาษาอังกฤษ','ภาษาจีน','วิทยาศาสตร์'];
  const buildAnalysis = (s) => {
    const history = sessions.filter(x=>x.studentId===s.id).sort((a,b)=>a.date.localeCompare(b.date));
    const scores = history.map(x => Number((x.note||'').match(/คะแนน[:： ]*(\d+(?:\\.\d+)?)/)?.[1])).filter(Number.isFinite);
    const current = s.latestScore !== '' ? Number(s.latestScore) : (scores.length ? scores[scores.length-1] : null);
    const baseline = s.baselineScore !== '' ? Number(s.baselineScore) : (scores.length ? scores[0] : null);
    const progress = current != null && baseline != null ? current-baseline : null;
    const target = s.targetScore !== '' ? Number(s.targetScore) : null;
    const gap = target != null && current != null ? target-current : null;
    const points = [];
    if (progress !== null) points.push(progress > 0 ? `คะแนนเพิ่มขึ้น ${progress} คะแนนจากจุดเริ่มต้น` : progress < 0 ? `คะแนนลดลง ${Math.abs(progress)} คะแนน ควรหาสาเหตุจากข้อผิดพลาดล่าสุด` : 'คะแนนยังไม่เปลี่ยนจากจุดเริ่มต้น');
    if (s.weaknesses) points.push(`ควรเน้นเรื่อง ${s.weaknesses}`);
    if (gap !== null) points.push(gap > 0 ? `ยังห่างจากเป้าคะแนน ${gap} คะแนน` : 'ถึงหรือเกินเป้าคะแนนแล้ว');
    if (history.length === 0) points.push('ยังมีข้อมูลการเรียนไม่มากพอ ควรบันทึกผลหลังแต่ละคาบ');
    const recommendations = [];
    if (s.weaknesses) recommendations.push(`เริ่มคลาสด้วยโจทย์สั้น ๆ เรื่อง ${s.weaknesses}`);
    if (gap !== null && gap > 0) recommendations.push('แบ่งเป้าหมายเป็นโจทย์ระดับง่าย → กลาง → ข้อสอบจริง');
    if (s.goals) recommendations.push(`เชื่อมโจทย์กับเป้าหมาย: ${s.goals}`);
    if (s.learningStyle) recommendations.push(`ใช้วิธีที่นักเรียนตอบสนองได้ดี: ${s.learningStyle}`);
    if (!recommendations.length) recommendations.push('เก็บคะแนนและบันทึกสิ่งที่ผิดในแต่ละคาบเพิ่ม เพื่อให้ระบบวิเคราะห์ได้แม่นขึ้น');
    return { historyCount:history.length, current, baseline, target, progress, gap, points, recommendations };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <SectionTitle sub="เก็บข้อมูลที่ช่วยให้ระบบวิเคราะห์การเรียนของแต่ละคนได้">นักเรียน</SectionTitle>
        <button onClick={openNew} style={{background:C.pine,color:C.paper}} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg h-fit"><Plus size={16}/> เพิ่มนักเรียน</button>
      </div>
      {students.length===0 && <EmptyState text="ยังไม่มีนักเรียน กดปุ่ม 'เพิ่มนักเรียน' เพื่อเริ่มต้น" />}
      <div className="flex flex-col gap-3">
        {students.map((s)=>{
          const history=sessions.filter(x=>x.studentId===s.id).sort((a,b)=>a.date.localeCompare(b.date));
          const progress=s.baselineScore!==''&&s.latestScore!==''?Number(s.latestScore)-Number(s.baselineScore):null;
          return <Card key={s.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><div className="font-medium">{s.name}</div>{s.grade&&<span style={{background:C.paperDeep,color:C.inkSoft}} className="text-xs px-2 py-0.5 rounded-full">{s.grade}</span>}<span style={{background:s.status==='active'?C.pineTint:C.paperDeep,color:s.status==='active'?C.pineDark:C.inkSoft}} className="text-xs px-2 py-0.5 rounded-full">{s.status==='active'?'กำลังเรียน':s.status==='paused'?'พักเรียน':'จบคอร์ส'}</span></div>
                <div style={{color:C.gold}} className="text-sm">{fmtMoney(s.rate)} / ชม.</div>
                {s.subjects?.length>0&&<div style={{color:C.inkSoft}} className="text-xs mt-1">{s.subjects.join(' · ')}</div>}
                {s.goals&&<div className="text-xs mt-1"><span style={{color:C.inkSoft}}>เป้าหมาย:</span> {s.goals}</div>}
                {s.weaknesses&&<div style={{color:C.brick}} className="text-xs mt-1">จุดที่ต้องเน้น: {s.weaknesses}</div>}
                {(s.latestScore!==''||progress!==null)&&<div className="flex gap-3 mt-2 text-xs">{s.latestScore!==''&&<span>ล่าสุด <b>{s.latestScore}</b></span>}{progress!==null&&<span style={{color:progress>=0?C.pine:C.brick}}>{progress>=0?'↑':'↓'} {Math.abs(progress)} คะแนนจากจุดเริ่มต้น</span>}</div>}
                {history.length>0&&<div style={{color:C.inkSoft}} className="text-xs mt-1">เรียนแล้ว {history.length} คาบ</div>}
              </div>
              <div className="flex gap-1 shrink-0"><button onClick={()=>setHistoryStudent(s.id)} style={{color:C.inkSoft}} className="p-2 rounded-lg"><ClipboardList size={16}/></button><button onClick={()=>setHistoryStudent(`analysis:${s.id}`)} style={{color:C.pine}} className="p-2 rounded-lg" title="วิเคราะห์นักเรียน"><Brain size={16}/></button><button onClick={()=>setHistoryStudent(`parent:${s.id}`)} style={{color:C.gold}} className="p-2 rounded-lg" title="สร้างรายงานผู้ปกครอง"><Send size={16}/></button><button onClick={()=>openEdit(s)} style={{color:C.inkSoft}} className="p-2 rounded-lg"><Pencil size={16}/></button><button onClick={()=>remove(s.id)} style={{color:C.brick}} className="p-2 rounded-lg"><Trash2 size={16}/></button></div>
            </div>
          </Card>;
        })}
      </div>

      {editing&&<Modal onClose={()=>setEditing(null)} title={editing==='new'?'เพิ่มนักเรียน':'ข้อมูลนักเรียน'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="ชื่อนักเรียน"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="เช่น น้องมิว" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <Field label="อัตราค่าสอน (บาท/ชม.)"><input type="number" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})} placeholder="400" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <Field label="ระดับชั้น"><input value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})} placeholder="ม.3 / ม.6 / มหาวิทยาลัย" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <Field label="สถานะ"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"><option value="active">กำลังเรียน</option><option value="paused">พักเรียน</option><option value="completed">จบคอร์ส</option></select></Field>
        </div>
        <Field label="วิชาที่เรียน"><div className="flex flex-wrap gap-2">{subjectOptions.map(x=><button type="button" key={x} onClick={()=>toggleSubject(x)} style={form.subjects.includes(x)?{background:C.pineTint,color:C.pineDark,borderColor:C.pine}:{borderColor:C.line,color:C.inkSoft}} className="text-xs px-3 py-1.5 rounded-full border">{x}</button>)}</div></Field>
        <Field label="เป้าหมายการเรียน"><input value={form.goals} onChange={e=>setForm({...form,goals:e.target.value})} placeholder="เช่น เตรียมสอบเข้า / เพิ่มเกรด / ปูพื้นฐาน" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
        <Field label="จุดแข็ง"><input value={form.strengths} onChange={e=>setForm({...form,strengths:e.target.value})} placeholder="เช่น คำนวณเร็ว เข้าใจแนวคิด" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
        <Field label="จุดที่ต้องเน้น"><input value={form.weaknesses} onChange={e=>setForm({...form,weaknesses:e.target.value})} placeholder="เช่น โจทย์ปัญหา กราฟ" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="คะแนนตั้งต้น"><input type="number" min="0" max="100" value={form.baselineScore} onChange={e=>setForm({...form,baselineScore:e.target.value})} placeholder="55" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <Field label="คะแนนล่าสุด"><input type="number" min="0" max="100" value={form.latestScore} onChange={e=>setForm({...form,latestScore:e.target.value})} placeholder="72" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <Field label="เป้าคะแนน"><input type="number" min="0" max="100" value={form.targetScore} onChange={e=>setForm({...form,targetScore:e.target.value})} placeholder="85" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="เป้าหมายสอบ"><input value={form.targetExam} onChange={e=>setForm({...form,targetExam:e.target.value})} placeholder="เช่น TGAT / HSK 4 / กลางภาค" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <Field label="วันที่เป้าหมาย"><input type="date" value={form.targetDate} onChange={e=>setForm({...form,targetDate:e.target.value})} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
        </div>
        <Field label="สไตล์การเรียน / วิธีที่ได้ผล"><input value={form.learningStyle} onChange={e=>setForm({...form,learningStyle:e.target.value})} placeholder="เช่น ชอบภาพ ชอบทำโจทย์ ชอบให้ยกตัวอย่าง" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
        <Field label="โน้ตสำหรับติวเตอร์"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="ข้อมูลสำคัญเกี่ยวกับนักเรียน" style={inputStyle} className="w-full text-base px-3 py-2 rounded-lg min-h-20"/></Field>
        <ModalActions onCancel={()=>setEditing(null)} onSave={save}/>
      </Modal>}

      {historyStudent && typeof historyStudent === 'string' && !historyStudent.includes(':') && (()=>{const student=students.find(s=>s.id===historyStudent);const history=sessions.filter(s=>s.studentId===historyStudent).sort((a,b)=>b.date.localeCompare(a.date));const totalAll=history.reduce((sum,s)=>sum+s.hours*s.rate,0);return <Modal onClose={()=>setHistoryStudent(null)} title={`ประวัติการสอน · ${student?.name||''}`}>{history.length===0?<div style={{color:C.inkSoft}} className="text-sm">ยังไม่มีประวัติการสอน</div>:<><div style={{color:C.inkSoft}} className="text-xs mb-3">รวม {history.length} คาบ ตั้งแต่เริ่มเรียน · {fmtMoney(totalAll)}</div><div className="flex flex-col gap-1 max-h-80 overflow-y-auto">{history.map((s,i)=><div key={s.id} style={{borderBottom:i<history.length-1?`1px dashed ${C.line}`:'none'}} className="py-2 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{fmtDateThai(s.date)} · {fmtHours(s.hours)} ชม.</span><span style={{color:C.gold}}>{fmtMoney(s.hours*s.rate)}</span></div>{s.note&&<div style={{color:C.inkSoft}} className="text-xs mt-0.5">{s.note}</div>}</div>)}</div></> }<div className="flex mt-4"><button onClick={()=>setHistoryStudent(null)} style={{border:`1px solid ${C.line}`,color:C.inkSoft}} className="flex-1 text-sm font-medium py-2 rounded-lg">ปิด</button></div></Modal>})()}

      {typeof historyStudent === 'string' && historyStudent.startsWith('parent:') && (() => {
        const student = students.find(s => s.id === historyStudent.slice(7));
        if (!student) return null;
        return <ParentReportCard student={student} sessions={sessions} onClose={()=>setHistoryStudent(null)} />;
      })()}

      {typeof historyStudent === 'string' && historyStudent.startsWith('worksheet:') && (() => {
        const student = students.find(s => s.id === historyStudent.slice(10));
        if (!student) return null;
        return <WorksheetGenerator student={student} sessions={sessions} onClose={()=>setHistoryStudent(null)} />;
      })()}

      {typeof historyStudent === 'string' && historyStudent.startsWith('assistant:') && (() => {
        const student = students.find(s => s.id === historyStudent.slice(10));
        if (!student) return null;
        return <TutorAssistant student={student} sessions={sessions} onClose={()=>setHistoryStudent(null)} onPlanner={()=>{setLessonDuration(90);setHistoryStudent('lesson:'+student.id)}} onWorksheet={()=>setHistoryStudent('worksheet:'+student.id)} />;
      })()}

      {typeof historyStudent === 'string' && historyStudent.startsWith('lesson:') && (() => {
        const student = students.find(s => s.id === historyStudent.slice(7));
        if (!student) return null;
        return <LessonPlanner student={student} sessions={sessions} duration={lessonDuration} setDuration={setLessonDuration} onClose={()=>setHistoryStudent(null)} />;
      })()}

      {typeof historyStudent === 'string' && historyStudent.startsWith('analysis:') && (() => {
        const student = students.find(s => s.id === historyStudent.slice(9));
        if (!student) return null;
        const a = buildAnalysis(student);
        return <Modal onClose={()=>setHistoryStudent(null)} title={`AI Analysis · ${student.name}`}>
          <div className="space-y-3">
            <Card style={{background:C.pineTint,borderColor:C.pine}}>
              <div style={{color:C.pineDark}} className="text-xs font-medium mb-1">ภาพรวม</div>
              <div className="text-sm">{a.current == null ? 'ยังไม่มีคะแนนที่ระบบใช้วิเคราะห์' : `คะแนนล่าสุด ${a.current}${a.target != null ? ` / เป้าหมาย ${a.target}` : ''}`}</div>
              {a.progress !== null && <div style={{color:a.progress>=0?C.pine:C.brick}} className="text-xs mt-1">{a.progress>=0?'↑':'↓'} {Math.abs(a.progress)} คะแนนจากจุดเริ่มต้น</div>}
            </Card>
            <div>
              <div className="font-medium text-sm mb-2">สิ่งที่ระบบมองเห็น</div>
              <div className="space-y-1.5">{a.points.map((x,i)=><div key={i} className="text-sm flex gap-2"><span style={{color:C.pine}}>•</span><span>{x}</span></div>)}</div>
            </div>
            <div>
              <div className="font-medium text-sm mb-2">คำแนะนำสำหรับคาบถัดไป</div>
              <div className="space-y-1.5">{a.recommendations.map((x,i)=><div key={i} style={{background:C.paper}} className="text-sm p-2.5 rounded-lg border" >{i+1}. {x}</div>)}</div>
            </div>
            <div style={{color:C.inkSoft}} className="text-xs">อิงจากข้อมูลโปรไฟล์ + ประวัติการเรียน {a.historyCount} คาบในระบบ</div>
            <button onClick={()=>{setLessonDuration(90);setHistoryStudent('lesson:'+student.id)}} style={{background:C.pine,color:C.paper}} className="w-full text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 mt-2">
              <ClipboardList size={16}/> สร้างแผนสอนคาบถัดไป
            </button>
            <button onClick={()=>setHistoryStudent('assistant:'+student.id)} style={{border:`1px solid ${C.pine}`,color:C.pine}} className="w-full text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 mt-2">
              <Brain size={16}/> AI Tutor Assistant · เตรียมคาบนี้
            </button>
            <button onClick={()=>setHistoryStudent('parent:'+student.id)} style={{border:`1px solid ${C.gold}`,color:C.gold}} className="w-full text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 mt-2">
              <Send size={16}/> สร้างรายงานผู้ปกครอง
            </button>
          </div>
        </Modal>;
      })()}
    </div>
  );
}


// ---------- Parent Report ----------
function ParentReport({ student, sessions, onClose }) {
  const reportRef = useRef(null);
  const history = sessions.filter(x => x.studentId === student.id).sort((a,b) => a.date.localeCompare(b.date));
  const scores = history.map(x => {
    const m = (x.note || '').match(/คะแนน[:： ]*(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }).filter(Number.isFinite);
  const current = student.latestScore !== '' && student.latestScore != null ? Number(student.latestScore) : (scores.length ? scores[scores.length - 1] : null);
  const baseline = student.baselineScore !== '' && student.baselineScore != null ? Number(student.baselineScore) : (scores.length ? scores[0] : null);
  const target = student.targetScore !== '' && student.targetScore != null ? Number(student.targetScore) : null;
  const change = current != null && baseline != null ? current - baseline : null;
  const recent = history.slice(-3).reverse();
  const [mascot, setMascot] = useState('🌱');
  const [tutorNote, setTutorNote] = useState('');
  const [homework, setHomework] = useState(student.weaknesses ? 'ฝึกทบทวนเรื่อง ' + student.weaknesses : '');
  const [nextTopic, setNextTopic] = useState(student.goals || '');
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [month, setMonth] = useState(todayStr().slice(0,7));
  const monthLabel = (() => { const [y,m] = month.split('-').map(Number); return MONTHS_TH[m-1]?.replace('.','') + ' ' + (y+543); })();
  const monthSessions = history.filter(x => x.date.slice(0,7) === month);
  const monthHours = monthSessions.reduce((sum,x)=>sum+Number(x.hours||0),0);
  const monthTotal = monthSessions.reduce((sum,x)=>sum+Number(x.hours||0)*Number(x.rate||0),0);
  const allTopics = [...new Set(history.flatMap(x => (x.note || '').split(/[\n,;；。]/).map(t=>t.trim()).filter(t=>t && !/คะแนน[:： ]*\d/.test(t) && t.length<70)))];
  const mastered = allTopics.filter(t => /ทำได้เอง|คล่อง|เข้าใจแล้ว|แม่น|ผ่าน/.test(t)).slice(0,4);
  const practicing = allTopics.filter(t => /ฝึก|ทบทวน|ยัง|ผิด|จุดอ่อน|เน้น/.test(t)).slice(0,4);
  const started = allTopics.filter(t => !mastered.includes(t) && !practicing.includes(t)).slice(0,5);
  const topicsForChips = [
    ...mastered.map(t=>({label:t,status:'เชี่ยวชาญแล้ว',bg:'#DCEFE2',color:'#24583C'})),
    ...practicing.map(t=>({label:t,status:'กำลังฝึก',bg:'#FFF0D1',color:'#8A5B0C'})),
    ...started.map(t=>({label:t,status:'เริ่มเรียนแล้ว',bg:'#E6EDF8',color:'#385B8A'}))
  ];
  const observations = [];
  if (change != null) observations.push(change > 0 ? 'คะแนนล่าสุดเพิ่มขึ้น ' + change + ' คะแนนจากจุดเริ่มต้น' : change < 0 ? 'คะแนนล่าสุดลดลง ' + Math.abs(change) + ' คะแนน จึงจะเน้นทบทวนจุดที่ยังผิดพลาด' : 'คะแนนล่าสุดยังใกล้เคียงกับจุดเริ่มต้น');
  if (student.strengths) observations.push('จุดแข็ง: ' + student.strengths);
  if (student.weaknesses) observations.push('เรื่องที่กำลังเน้น: ' + student.weaknesses);
  const nextSteps = [homework, nextTopic].filter(Boolean);
  const message = [
    '📚 รายงานความก้าวหน้าการเรียนของ ' + student.name,
    'ช่วงรายงาน: ' + monthLabel,
    student.grade ? 'ระดับชั้น: ' + student.grade : '',
    student.subjects?.length ? 'วิชา: ' + student.subjects.join(' · ') : '',
    '',
    'พัฒนาการ',
    '• เรียนในเดือนนี้ ' + monthSessions.length + ' คาบ (' + fmtHours(monthHours) + ' ชั่วโมง)',
    current != null ? '• คะแนนล่าสุด: ' + current + (target != null ? ' / เป้าหมาย ' + target : '') : '• ยังไม่มีคะแนนที่บันทึกไว้',
    change != null ? '• เปลี่ยนแปลงจากจุดเริ่มต้น: ' + (change > 0 ? '+' : '') + change + ' คะแนน' : '',
    '',
    'สิ่งที่สังเกตได้',
    ...(observations.length ? observations.map(x=>'• '+x) : ['• อยู่ระหว่างเก็บข้อมูลพัฒนาการเพิ่มเติม']),
    tutorNote ? '\nข้อความจากติวเตอร์\n' + tutorNote : '',
    nextSteps.length ? '\nสิ่งที่จะทำต่อ\n' + nextSteps.map(x=>'• '+x).join('\n') : '',
    nextDate ? '\nคาบถัดไป: ' + nextDate + (nextTime ? ' เวลา ' + nextTime : '') : '',
    '',
    'ยอดของเดือนนี้: ' + fmtMoney(monthTotal) + ' (' + fmtHours(monthHours) + ' ชั่วโมง)',
    'ขอบคุณผู้ปกครองที่ร่วมสนับสนุนการเรียนรู้อย่างต่อเนื่องค่ะ'
  ].filter(Boolean).join('\n');

  const copy = async () => {
    try { await navigator.clipboard.writeText(message); onClose(); setTimeout(() => alert('คัดลอกรายงานแล้ว'), 50); }
    catch { alert('คัดลอกไม่สำเร็จ ลองเลือกข้อความจากรายงานเอง'); }
  };
  const downloadPng = async () => {
    const source = reportRef.current;
    if (!source) return;
    try {
      const clone = source.cloneNode(true);
      const copyStyles = (a,b) => {
        const computed = window.getComputedStyle(a);
        for (const prop of computed) b.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop));
        Array.from(a.children).forEach((child,i)=>{ if(b.children[i]) copyStyles(child,b.children[i]); });
      };
      copyStyles(source, clone);
      clone.style.width = '720px';
      clone.style.maxWidth = '720px';
      clone.style.margin = '0';
      clone.querySelectorAll('[data-report-hide="true"]').forEach(el=>el.remove());
      const html = new XMLSerializer().serializeToString(clone);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="' + Math.ceil(source.scrollHeight * 720 / source.scrollWidth) + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">' + html + '</div></foreignObject></svg>';
      const blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 720; canvas.height = Math.ceil(img.height * 720 / img.width);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FAF8F1'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
        URL.revokeObjectURL(url);
        const link = document.createElement('a');
        link.download = 'รายงานความก้าวหน้า-' + student.name.replace(/[^ก-๙a-zA-Z0-9_-]/g,'_') + '.png';
        link.href = canvas.toDataURL('image/png'); link.click();
      };
      img.onerror = () => { URL.revokeObjectURL(url); alert('สร้างรูปภาพไม่สำเร็จในเบราว์เซอร์นี้ ลองใช้ดาวน์โหลด PDF แทน'); };
      img.src = url;
    } catch (e) { console.error(e); alert('สร้างรูปภาพไม่สำเร็จ ลองใช้ดาวน์โหลด PDF แทน'); }
  };
  const downloadPdf = () => {
    const style = document.createElement('style');
    style.id = 'parent-report-print-style';
    style.textContent = '@media print { body * { visibility:hidden !important; } .parent-report-print-root, .parent-report-print-root * { visibility:visible !important; } .parent-report-print-root { position:absolute !important; left:0 !important; top:0 !important; width:100% !important; max-width:720px !important; margin:0 !important; box-shadow:none !important; } .no-print { display:none !important; } @page { size:A4 portrait; margin:12mm; } }';
    document.head.appendChild(style);
    window.print();
    setTimeout(()=>style.remove(),1000);
  };

  return (
    <Modal onClose={onClose} title={'รายงานความก้าวหน้า · ' + student.name}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 no-print">
          <Field label="เดือนที่รายงาน"><input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <Field label="ไอคอนประจำรายงาน"><select value={mascot} onChange={e=>setMascot(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"><option>🌱</option><option>⭐</option><option>🚀</option><option>🦊</option><option>🐼</option><option>🌈</option></select></Field>
        </div>
        <div ref={reportRef} className="parent-report-print-root" style={{width:'100%',maxWidth:720,margin:'0 auto',background:'#FAF8F1',color:'#23312A',border:'1px solid #DCE5D9',borderRadius:20,overflow:'hidden',fontFamily:'Arial, sans-serif',boxShadow:'0 8px 28px rgba(32,64,47,.10)'}}>
          <div style={{background:'linear-gradient(135deg,#20402F,#2E684B)',color:'#fff',padding:'24px 24px 22px',position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div><div style={{fontSize:12,letterSpacing:1.5,opacity:.85}}>LEARNING PROGRESS REPORT</div><div style={{fontSize:26,fontWeight:800,marginTop:8,lineHeight:1.25}}>รายงานความก้าวหน้า</div><div style={{fontSize:18,marginTop:8}}>{student.name}</div><div style={{fontSize:13,opacity:.9,marginTop:5}}>{[student.grade,student.subjects?.join(' · ')].filter(Boolean).join('  •  ') || 'บันทึกการเรียนรู้รายบุคคล'}</div></div>
              <div style={{textAlign:'right',minWidth:74}}><div style={{fontSize:34}}>{mascot}</div><div style={{background:'#FFFFFF20',border:'1px solid #FFFFFF50',borderRadius:999,padding:'6px 10px',fontSize:12,whiteSpace:'nowrap'}}>{monthLabel}</div></div>
            </div>
          </div>
          <div style={{padding:20,display:'grid',gap:14}}>
            <div style={{background:'#fff',border:'1px solid #E1E7DE',borderRadius:15,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#2E684B',marginBottom:10}}>📈 พัฒนาการของคะแนน</div>
              {current == null ? <div style={{fontSize:13,color:'#66736A',padding:'8px 0'}}>ยังไม่มีคะแนนที่บันทึกไว้ — เพิ่มคะแนนในโน้ตคาบเรียนรูปแบบ “คะแนน: 75” เพื่อแสดงกราฟความก้าวหน้า</div> : <>
                <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'end',marginBottom:8}}><div><div style={{fontSize:11,color:'#66736A'}}>คะแนนล่าสุด</div><div style={{fontSize:30,fontWeight:800,color:'#20402F'}}>{current}<span style={{fontSize:13,fontWeight:500}}> / 100</span></div></div><div style={{textAlign:'right'}}><div style={{fontSize:11,color:'#66736A'}}>คะแนนตั้งต้น {baseline == null ? '—' : baseline}</div>{target != null && <div style={{fontSize:12,color:'#A8781F',fontWeight:700}}>🏁 เป้าหมาย {target}</div>}</div></div>
                <div style={{height:15,background:'#E7EDE5',borderRadius:99,position:'relative',overflow:'visible'}}><div style={{height:'100%',width:Math.max(0,Math.min(100,current))+'%',background:'linear-gradient(90deg,#6FA77A,#2E684B)',borderRadius:99}}></div>{target != null && <div style={{position:'absolute',left:Math.max(0,Math.min(100,target))+'%',top:-5,width:3,height:25,background:'#C08A2B',borderRadius:2}}></div>}</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#78847A',marginTop:5}}><span>0</span><span>{target != null ? '🏁 เป้าหมาย ' + target : '100 คะแนน'}</span><span>100</span></div>
                {change != null && <div style={{marginTop:12,display:'inline-block',background:change>=0?'#E0F0E4':'#F8E5E1',color:change>=0?'#24583C':'#A0392A',padding:'6px 10px',borderRadius:999,fontSize:12,fontWeight:700}}>{change>=0?'↗':'↘'} {change>0?'+':''}{change} คะแนนจากตอนเริ่มเรียน</div>}
              </>}
            </div>
            <div style={{background:'#fff',border:'1px solid #E1E7DE',borderRadius:15,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#2E684B',marginBottom:10}}>🧩 ทักษะและหัวข้อที่เรียน</div>
              {topicsForChips.length ? <div style={{display:'flex',flexWrap:'wrap',gap:7}}>{topicsForChips.map((t,i)=><span key={i} title={t.status} style={{background:t.bg,color:t.color,borderRadius:999,padding:'6px 10px',fontSize:11,fontWeight:600}}>{t.status} · {t.label}</span>)}</div> : <div style={{fontSize:12,color:'#78847A'}}>เพิ่มหัวข้อหรือความคืบหน้าไว้ในโน้ตคาบเรียน เพื่อแสดงทักษะในส่วนนี้</div>}
              <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:10,color:'#66736A',marginTop:12}}><span>🟢 เชี่ยวชาญแล้ว</span><span>🟡 กำลังฝึก</span><span>🔵 เริ่มเรียนแล้ว</span></div>
            </div>
            <div style={{background:'#fff',border:'1px solid #E1E7DE',borderRadius:15,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#2E684B',marginBottom:10}}>🗓️ 3 คาบล่าสุด</div>
              {recent.length ? <div style={{display:'grid',gap:10}}>{recent.map((x,i)=><div key={x.id} style={{display:'grid',gridTemplateColumns:'18px 1fr',gap:9}}><div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{width:12,height:12,borderRadius:99,background:'#2E684B',border:'3px solid #DCEBDD'}}></div>{i<recent.length-1&&<div style={{width:2,flex:1,minHeight:22,background:'#DCE5D9'}}></div>}</div><div style={{paddingBottom:5}}><div style={{fontSize:11,fontWeight:700,color:'#2E684B'}}>{fmtDateThai(x.date)} · {fmtHours(x.hours)} ชม.</div><div style={{fontSize:12,marginTop:4,whiteSpace:'pre-wrap',lineHeight:1.5}}>{x.note || 'ฝึกทำแบบฝึกหัดและทบทวนบทเรียน'}</div><div style={{fontSize:11,color:'#A8781F',marginTop:4}}>✦ ขอบคุณที่ตั้งใจเรียนและพยายามอย่างต่อเนื่อง</div></div></div>)}</div> : <div style={{fontSize:12,color:'#78847A'}}>ยังไม่มีประวัติคาบเรียน</div>}
            </div>
            <div style={{background:'#F0F5EE',border:'1px dashed #B8CCB8',borderRadius:15,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#2E684B',marginBottom:8}}>💌 ข้อความจากติวเตอร์</div>
              <div style={{fontSize:12,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{tutorNote || 'ขอบคุณผู้ปกครองที่ช่วยสนับสนุนการเรียนของน้องอย่างต่อเนื่องนะคะ เราจะค่อย ๆ พัฒนาทักษะไปด้วยกันค่ะ'}</div>
            </div>
            <div style={{background:'#fff',border:'1px solid #E1E7DE',borderRadius:15,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#2E684B',marginBottom:8}}>🎒 สิ่งที่จะทำในคาบหน้า</div>
              <div style={{fontSize:12,lineHeight:1.7}}>{homework ? '• การบ้าน/ทบทวน: ' + homework : '• การบ้าน/ทบทวน: ยังไม่ได้ระบุ'}<br/>{nextTopic ? '• หัวข้อถัดไป: ' + nextTopic : '• หัวข้อถัดไป: กำหนดตามพัฒนาการของน้อง'}<br/>{nextDate ? '• นัดหมาย: ' + fmtDateThai(nextDate) + (nextTime ? ' เวลา ' + nextTime : '') : ''}</div>
            </div>
            <div style={{borderTop:'2px dashed #B8C7B7',paddingTop:14,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
              <div><div style={{fontSize:12,fontWeight:800,color:'#2E684B'}}>✂ ยอดของเดือนนี้</div><div style={{fontSize:10,color:'#78847A',marginTop:4}}>{monthSessions.length} คาบ · {fmtHours(monthHours)} ชั่วโมง</div><div style={{fontSize:10,color:'#78847A',marginTop:3}}>ขอบคุณที่ไว้วางใจให้เราดูแลการเรียนรู้ค่ะ</div></div>
              <div style={{textAlign:'right',borderLeft:'1px dashed #B8C7B7',paddingLeft:16}}><div style={{fontSize:10,color:'#78847A'}}>ยอดรวม</div><div style={{fontSize:24,fontWeight:800,color:'#20402F'}}>{fmtMoney(monthTotal)}</div></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 no-print">
          <Field label="ข้อความส่วนตัวจากติวเตอร์"><textarea value={tutorNote} onChange={e=>setTutorNote(e.target.value)} placeholder="เช่น วันนี้น้องทำโจทย์กราฟได้เองแล้ว ดีใจมากค่ะ" style={inputStyle} className="w-full text-base px-3 py-2 rounded-lg min-h-20"/></Field>
          <Field label="การบ้าน / สิ่งที่อยากให้ทบทวน"><textarea value={homework} onChange={e=>setHomework(e.target.value)} style={inputStyle} className="w-full text-base px-3 py-2 rounded-lg min-h-20"/></Field>
          <Field label="หัวข้อคาบถัดไป"><input value={nextTopic} onChange={e=>setNextTopic(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="วันนัดครั้งถัดไป"><input type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field><Field label="เวลา"><input type="time" value={nextTime} onChange={e=>setNextTime(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg"/></Field></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 no-print">
          <button onClick={downloadPng} style={{background:C.pine,color:C.paper}} className="text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"><Download size={16}/> ดาวน์โหลดรูปภาพ 720 px</button>
          <button onClick={downloadPdf} style={{background:C.gold,color:'#fff'}} className="text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"><Download size={16}/> ดาวน์โหลด PDF / พิมพ์</button>
          <button onClick={copy} style={{border:'1px solid '+C.line,color:C.inkSoft}} className="text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Copy size={15}/> คัดลอกข้อความส่ง LINE</button>
          <button onClick={onClose} style={{border:'1px solid '+C.line,color:C.inkSoft}} className="text-sm font-medium py-2.5 rounded-lg">ปิดรายงาน</button>
        </div>
        <div className="text-xs no-print" style={{color:C.inkSoft}}>คะแนนอ่านจากโปรไฟล์นักเรียนและโน้ตคาบเรียนรูปแบบ “คะแนน: 75” · รูปภาพขนาด 720 px · PDF ใช้หน้าต่างพิมพ์ของเบราว์เซอร์และเลือก “บันทึกเป็น PDF”</div>
      </div>
    </Modal>
  );
}

// ---------- Smart Worksheet Generator ----------
function WorksheetGenerator({ student, sessions, onClose }) {
  const subject = student.subjects?.[0] || 'วิชาหลัก';
  const weakness = student.weaknesses || 'ทบทวนพื้นฐาน';
  const [count,setCount] = useState(5);
  const [level,setLevel] = useState('กลาง');

  const build = () => {
    if (subject.includes('คณิตศาสตร์')) {
      const nums = level === 'ง่าย' ? [6,8,12,15,20] : level === 'ยาก' ? [18,24,35,42,56] : [8,12,15,18,25];
      return Array.from({length:count},(_,i)=>{
        const a=nums[i%nums.length], b=(i+2)*3;
        return {q:(i+1)+'. จงหาค่าของ '+a+' + '+b+' × 2', a:a+b*2};
      });
    }
    if (subject.includes('ฟิสิกส์')) {
      return Array.from({length:count},(_,i)=>{
        const v=(i+2)*5, t=i+1;
        return {q:(i+1)+'. วัตถุเคลื่อนที่ด้วยความเร็ว '+v+' m/s เป็นเวลา '+t+' s จงหาระยะทางที่เคลื่อนที่ได้', a:v*t+' m'};
      });
    }
    return Array.from({length:count},(_,i)=>({
      q:(i+1)+'. อธิบายแนวคิดเรื่อง “'+weakness+'” ด้วยภาษาของตัวเอง และยกตัวอย่าง 1 ตัวอย่าง',
      a:'คำตอบควรมีนิยาม/หลักการที่ถูกต้อง + ตัวอย่างที่สอดคล้อง'
    }));
  };

  const items=build();
  return (
    <Modal onClose={onClose} title={'Worksheet · '+student.name}>
      <div className="space-y-4">
        <div style={{color:C.inkSoft}} className="text-xs">หัวข้อ: {weakness} · วิชา: {subject}</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="ระดับ">
            <select value={level} onChange={e=>setLevel(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
              <option>ง่าย</option><option>กลาง</option><option>ยาก</option>
            </select>
          </Field>
          <Field label="จำนวนข้อ">
            <select value={count} onChange={e=>setCount(Number(e.target.value))} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
              <option value={5}>5 ข้อ</option><option value={10}>10 ข้อ</option>
            </select>
          </Field>
        </div>
        <Card>
          <div className="font-medium text-sm mb-3">โจทย์</div>
          <div className="space-y-3">{items.map((x,i)=><div key={i} className="text-sm leading-relaxed">{x.q}</div>)}</div>
        </Card>
        <Card style={{background:C.pineTint}}>
          <div className="font-medium text-sm mb-2">เฉลยสำหรับติวเตอร์</div>
          <div className="space-y-1.5 text-sm">{items.map((x,i)=><div key={i}>{i+1}. {x.a}</div>)}</div>
        </Card>
        <div style={{color:C.inkSoft}} className="text-xs">Worksheet นี้สร้างจากวิชา + จุดอ่อนของนักเรียน · ยังไม่ใช้ LLM</div>
      </div>
    </Modal>
  );
}

// ---------- AI Tutor Assistant ----------
function TutorAssistant({ student, sessions, onClose, onPlanner, onWorksheet }) {
  const history = sessions.filter(x=>x.studentId===student.id).sort((a,b)=>a.date.localeCompare(b.date));
  const subject = student.subjects?.[0] || 'วิชาหลัก';
  const weakness = student.weaknesses || 'จุดที่ยังไม่แม่นจากคาบก่อน';
  const goal = student.goals || 'เพิ่มความเข้าใจและความแม่นยำ';
  const latest = history[history.length-1];
  const score = student.latestScore !== '' ? Number(student.latestScore) : null;
  const target = student.targetScore !== '' ? Number(student.targetScore) : null;
  const gap = score != null && target != null ? target-score : null;

  const questions = subject.includes('ฟิสิกส์')
    ? [
        'ถ้าโจทย์นี้เปลี่ยนค่าตัวแปรหนึ่งตัว คำตอบจะเปลี่ยนอย่างไร?',
        'โจทย์กำหนดอะไรมาให้ และเราต้องหาอะไร?',
        'ทำไมจึงเลือกสูตรนี้ และหน่วยของคำตอบควรเป็นอะไร?'
      ]
    : subject.includes('คณิตศาสตร์')
    ? [
        'โจทย์กำลังถามหาอะไร และข้อมูลไหนจำเป็นจริง ๆ?',
        'มีวิธีทำอีกแบบไหม หรือวิธีนี้สั้นที่สุดเพราะอะไร?',
        'ถ้าเปลี่ยนตัวเลขในโจทย์ วิธีคิดยังใช้ได้เหมือนเดิมไหม?'
      ]
    : [
        'ลองอธิบายเรื่องนี้ด้วยภาษาของตัวเองโดยไม่ดูตัวอย่าง',
        'ส่วนไหนของโจทย์ที่ทำให้ลังเลที่สุด?',
        'ถ้าเจอโจทย์คล้ายกันอีกครั้ง จะเริ่มจากตรงไหน?'
      ];

  const moves = [
    'เริ่มจาก '+weakness+' ด้วยโจทย์สั้น 1 ข้อ เพื่อดูว่าปัญหาอยู่ที่ความเข้าใจหรือขั้นตอนการทำ',
    student.learningStyle === 'เห็นภาพ'
      ? 'ใช้ภาพ ตาราง หรือขั้นตอนบนกระดาษก่อนให้ทำโจทย์'
      : student.learningStyle === 'ทำโจทย์'
      ? 'ให้ลองทำก่อน แล้วค่อยแก้เฉพาะจุดที่ติด'
      : 'ให้นักเรียนอธิบายวิธีคิดออกเสียงก่อนเฉลย',
    gap != null && gap > 0
      ? 'ยังห่างจากเป้าหมาย '+gap+' คะแนน จึงควรเน้นความแม่นยำก่อนเพิ่มความยาก'
      : 'เมื่อทำพื้นฐานได้ ให้เพิ่มโจทย์ประยุกต์เพื่อเช็กการนำไปใช้จริง'
  ];

  const watch = [
    'อย่ารีบเฉลยในช่วงแรก ให้ดูว่านักเรียนติดที่ '+weakness+' ตรงไหน',
    latest?.note ? 'คาบล่าสุดมีบันทึกว่า “'+latest.note+'” ควรใช้เป็นจุดตั้งต้นของคำถาม' : 'หลังคาบควรบันทึกว่าผิดเพราะความเข้าใจ สูตร ขั้นตอน หรือความรอบคอบ',
  ];

  return (
    <Modal onClose={onClose} title={'AI Tutor Assistant · '+student.name}>
      <div className="space-y-4">
        <Card style={{background:C.pineTint,borderColor:C.pine}}>
          <div style={{color:C.pineDark}} className="text-xs font-medium mb-1">เป้าหมายคาบนี้</div>
          <div className="text-sm">{goal}</div>
          <div style={{color:C.inkSoft}} className="text-xs mt-1">
            {score != null ? 'คะแนนล่าสุด '+score+(target != null ? ' · เป้าหมาย '+target : '') : 'ยังไม่มีคะแนนล่าสุด'}
          </div>
        </Card>

        <div>
          <div className="font-medium text-sm mb-2">คำถามที่ควรถาม</div>
          <div className="space-y-1.5">
            {questions.map((q,i)=><div key={i} style={{background:C.paper}} className="text-sm p-2.5 rounded-lg border">{i+1}. {q}</div>)}
          </div>
        </div>

        <div>
          <div className="font-medium text-sm mb-2">วิธีสอนที่ระบบแนะนำ</div>
          <div className="space-y-1.5">
            {moves.map((x,i)=><div key={i} className="text-sm flex gap-2"><span style={{color:C.pine}}>•</span><span>{x}</span></div>)}
          </div>
        </div>

        <div>
          <div className="font-medium text-sm mb-2">จุดที่ควรระวัง</div>
          <div className="space-y-1.5">
            {watch.map((x,i)=><div key={i} style={{background:C.goldTint}} className="text-sm p-2.5 rounded-lg">{x}</div>)}
          </div>
        </div>

        <div style={{color:C.inkSoft}} className="text-xs">สร้างจากโปรไฟล์นักเรียน + ประวัติคาบสอน {history.length} คาบ · ยังไม่เรียก LLM ภายนอก</div>

        <button onClick={onPlanner} style={{background:C.pine,color:C.paper}} className="w-full text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
          <ClipboardList size={16}/> สร้างแผนสอนคาบถัดไป
        </button>
        <button onClick={onWorksheet} style={{border:`1px solid ${C.line}`,color:C.inkSoft}} className="w-full text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
          <Brain size={16}/> สร้าง Worksheet
        </button>
      </div>
    </Modal>
  );
}

// ---------- Smart Lesson Planner ----------
// Lesson plans are generated from the student's profile and teaching history.
function LessonPlanner({ student, sessions, duration, setDuration, onClose }) {
  const history = sessions.filter(x=>x.studentId===student.id).sort((a,b)=>b.date.localeCompare(a.date));
  const subject = student.subjects?.[0] || 'วิชาหลัก';
  const weakness = student.weaknesses || 'ทบทวนจุดที่ยังไม่แม่นจากคาบก่อน';
  const goal = student.goals || 'เพิ่มความเข้าใจและความแม่นยำ';
  const style = student.learningStyle || '';
  const latestNote = history.find(x=>x.note)?.note || '';
  const score = student.latestScore !== '' ? Number(student.latestScore) : null;
  const target = student.targetScore !== '' ? Number(student.targetScore) : null;
  const gap = score != null && target != null ? target-score : null;

  const buildPlan = () => {
    const warm = Math.round(duration * 0.12);
    const concept = Math.round(duration * 0.23);
    const guided = Math.round(duration * 0.30);
    const independent = Math.round(duration * 0.23);
    const exit = Math.max(5, duration - warm-concept-guided-independent);
    const practice = subject.includes('ฟิสิกส์')
      ? 'โจทย์คำนวณ 2–3 ข้อ โดยให้เขียนสิ่งที่โจทย์กำหนด → สูตร → แทนค่า → ตรวจหน่วย'
      : subject.includes('คณิตศาสตร์')
      ? 'ทำโจทย์จากง่ายไปกลาง แล้วเพิ่มโจทย์ประยุกต์ 1 ข้อเพื่อดูการถ่ายโอนความเข้าใจ'
      : 'ทำแบบฝึกหัดสั้นจากง่ายไปกลาง แล้วให้สรุปคำตอบด้วยภาษาของตัวเอง';
    return [
      {time:warm,title:'Warm-up · เช็กความพร้อม',detail:warm+' นาที · คำถามสั้น 3–5 ข้อเรื่อง '+weakness},
      {time:concept,title:'Concept · ปู/ทบทวนแนวคิด',detail:concept+' นาที · ทบทวนเฉพาะส่วนที่เกี่ยวกับ '+weakness+' และเชื่อมกับเป้าหมาย '+goal},
      {time:guided,title:'Guided Practice · ทำโจทย์ร่วมกัน',detail:guided+' นาที · '+practice},
      {time:independent,title:'Independent Practice · ให้ลองเอง',detail:independent+' นาที · ให้นักเรียนทำโจทย์โดยลดคำใบ้ลง และจดข้อที่ติดขัด'},
      {time:exit,title:'Exit Ticket · วัดผลท้ายคาบ',detail:exit+' นาที · โจทย์ใหม่ 2 ข้อ + ให้นักเรียนอธิบายว่าทำไมจึงเลือกวิธีนี้'},
    ];
  };

  const plan=buildPlan();

  return (
    <Modal onClose={onClose} title={'แผนสอน · '+student.name}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{subject}</div>
            <div style={{color:C.inkSoft}} className="text-xs mt-0.5">
              {score != null ? 'คะแนนล่าสุด '+score+(target != null ? ' · เป้าหมาย '+target : '') : 'ยังไม่มีคะแนนล่าสุด'}
            </div>
          </div>
          <select value={duration} onChange={e=>setDuration(Number(e.target.value))} style={inputStyle} className="text-sm px-2.5 py-2 rounded-lg">
            <option value="60">60 นาที</option>
            <option value="90">90 นาที</option>
            <option value="120">120 นาที</option>
          </select>
        </div>

        <Card style={{background:C.goldTint,borderColor:C.gold}}>
          <div className="text-xs font-medium" style={{color:C.gold}}>โฟกัสของคาบนี้</div>
          <div className="text-sm mt-1">เน้น: {weakness}</div>
          <div style={{color:C.inkSoft}} className="text-xs mt-1">เป้าหมาย: {goal}</div>
          {gap != null && gap > 0 && <div style={{color:C.brick}} className="text-xs mt-1">ยังห่างจากเป้าคะแนน {gap} คะแนน</div>}
          {style && <div style={{color:C.inkSoft}} className="text-xs mt-1">วิธีเรียนที่ควรใช้: {style}</div>}
        </Card>

        <div>
          <div className="font-medium text-sm mb-2">ลำดับการสอน</div>
          <div className="space-y-2">
            {plan.map((p,i)=>(
              <div key={i} style={{border:'1px solid '+C.line,background:C.surface}} className="rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{i+1}. {p.title}</div>
                  <span style={{color:C.pine}} className="text-xs font-medium whitespace-nowrap">{p.time} นาที</span>
                </div>
                <div style={{color:C.inkSoft}} className="text-xs mt-1.5 leading-relaxed">{p.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <div className="font-medium text-sm mb-2">สิ่งที่ควรบันทึกหลังคาบ</div>
          <div className="space-y-1.5 text-xs" style={{color:C.inkSoft}}>
            <div>• คะแนน/จำนวนข้อที่ทำถูก</div>
            <div>• จุดผิดที่เกิดซ้ำ</div>
            <div>• เรื่องที่นักเรียนอธิบายได้ด้วยตัวเอง</div>
            {latestNote && <div>• โน้ตล่าสุด: {latestNote}</div>}
          </div>
        </Card>

        <div style={{color:C.inkSoft}} className="text-xs">
          แผนนี้สร้างจากข้อมูลโปรไฟล์ + ประวัติคาบสอน และจะปรับตามคะแนน/จุดอ่อนของนักเรียน
        </div>
      </div>
    </Modal>
  );
}

// ---------- Schedule ----------
// ---------- Sessions log ----------
function parseLessonNote(note='') {
  const out={subject:'',topic:'',performance:'',strengths:'',score:'',stuck:'',homework:'',nextPlan:'',enTopic:'',enPerformance:'',enStuck:'',enHomework:'',note:''};
  const extra=[];
  String(note||'').split(/\r?\n/).forEach(line=>{
    const m=line.match(/^(สอน|ผลการเรียน|จุดเด่น|คะแนน|ติดขัด|การบ้าน|แผนคาบหน้า|EN topic|EN result|EN stuck|EN homework):\s*(.*)$/);
    if(!m){if(line.trim())extra.push(line);return;}
    const key={'ผลการเรียน':'performance','จุดเด่น':'strengths','คะแนน':'score','ติดขัด':'stuck','การบ้าน':'homework','แผนคาบหน้า':'nextPlan','EN topic':'enTopic','EN result':'enPerformance','EN stuck':'enStuck','EN homework':'enHomework'}[m[1]];
    if(m[1]==='สอน'){const p=m[2].split(' · ');out.subject=p.shift()||'';out.topic=p.join(' · ');}
    else if(key)out[key]=m[2];
  });
  out.note=extra.join('\n');
  return out;
}

function LessonForm({initial={},students,onSave,onDelete,onCancel}) {
  const editing=Boolean(initial?.id);
  const parsed=parseLessonNote(initial?.note||'');
  const [form,setForm]=useState(()=>({
    studentId:initial.studentId||'',date:initial.date||todayStr(),hours:String(initial.hours??1),
    rate:String(initial.rate??(students.find(s=>s.id===initial.studentId)?.rate??0)),
    sourceSlotId:initial.sourceSlotId,
    ...parsed
  }));
  const [busy,setBusy]=useState(false);
  const set=(key,value)=>setForm(p=>({...p,[key]:value}));
  const student=students.find(s=>s.id===form.studentId);
  const hours=Number(form.hours);
  const rate=Number(form.rate);
  const buildNote=()=>{
    const parts=[];
    if(form.subject||form.topic)parts.push('สอน: '+[form.subject,form.topic].filter(Boolean).join(' · '));
    if(form.performance)parts.push('ผลการเรียน: '+form.performance);
    if(form.strengths)parts.push('จุดเด่น: '+form.strengths);
    if(form.score)parts.push('คะแนน: '+form.score);
    if(form.stuck)parts.push('ติดขัด: '+form.stuck);
    if(form.homework)parts.push('การบ้าน: '+form.homework);
    if(form.nextPlan)parts.push('แผนคาบหน้า: '+form.nextPlan);
    if(form.enTopic)parts.push('EN topic: '+form.enTopic);
    if(form.enPerformance)parts.push('EN result: '+form.enPerformance);
    if(form.enStuck)parts.push('EN stuck: '+form.enStuck);
    if(form.enHomework)parts.push('EN homework: '+form.enHomework);
    if(form.note.trim())parts.push(form.note.trim());
    return parts.join('\n\n');
  };
  const note=buildNote();
  const valid=Boolean(student&&form.date&&Number.isFinite(hours)&&hours>0&&Number.isFinite(rate)&&rate>=0);
  const submit=async()=>{
    if(!valid||busy)return;
    setBusy(true);
    try{
      await onSave({
        ...(editing?initial:{}),id:editing?initial.id:uid(),
        studentId:student.id,studentName:student.name,date:form.date,
        hours,rate,note,invoiced:Boolean(initial.invoiced),paid:Boolean(initial.paid),
        sourceSlotId:form.sourceSlotId||initial.sourceSlotId||null
      });
    }finally{setBusy(false);}
  };
  const fieldStyle={background:C.paper,border:'1px solid '+C.line,color:C.ink};
  const textInput='w-full rounded-lg px-3 py-2 text-base sm:text-sm';
  const textArea='w-full rounded-xl px-3 py-3 text-base leading-7 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-700/20';
  const field=(label,key,placeholder,area=false,autoFocus=false)=>(
    <label className="mb-3 block text-xs" style={{color:C.inkSoft}}>{label}
      {area?<textarea autoFocus={autoFocus} rows={2} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} className={textArea+' mt-1 min-h-20'} style={fieldStyle}/>
      :<input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} className={textInput+' mt-1'} style={fieldStyle}/>}
    </label>
  );
  return <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{background:'rgba(35,40,43,.45)'}}>
    <div role="dialog" aria-modal="true" aria-label={editing?'แก้ไขบันทึกคาบสอน':'บันทึกคาบสอน'} className="w-full overflow-y-auto overscroll-contain rounded-t-2xl p-5 pb-32 sm:max-w-xl sm:rounded-2xl sm:p-6" style={{background:C.surface,maxHeight:'90dvh'}}>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold" style={{color:C.ink}}>{editing?'แก้ไขบันทึกคาบสอน':'บันทึกคาบสอน'}</h2><p className="mt-1 text-xs" style={{color:C.inkSoft}}>{editing?'แก้ไขรายละเอียดของคาบเดิม':'ตรวจสอบข้อมูลคาบ แล้วบันทึกเมื่อพร้อม'}</p></div><button type="button" onClick={onCancel} aria-label="ปิดฟอร์ม" className="rounded-lg p-2" style={{color:C.inkSoft}}><X size={18}/></button></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="mb-1 block text-xs" style={{color:C.inkSoft}}>นักเรียน<select value={form.studentId} onChange={e=>{const s=students.find(x=>x.id===e.target.value);setForm(p=>({...p,studentId:e.target.value,rate:p.rate===''?String(s?.rate??0):p.rate}));}} className={textInput+' mt-1'} style={fieldStyle}><option value="">เลือกนักเรียน</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="mb-1 block text-xs" style={{color:C.inkSoft}}>วันที่<input type="date" value={form.date} onChange={e=>set('date',e.target.value)} className={textInput+' mt-1'} style={fieldStyle}/></label>
        <label className="mb-1 block text-xs" style={{color:C.inkSoft}}>จำนวนชั่วโมง<input type="number" min="0.25" step="0.25" value={form.hours} onChange={e=>set('hours',e.target.value)} className={textInput+' mt-1'} style={fieldStyle}/></label>
        <label className="mb-1 block text-xs" style={{color:C.inkSoft}}>ค่าเรียนต่อชั่วโมง (บาท)<input type="number" min="0" step="1" value={form.rate} onChange={e=>set('rate',e.target.value)} className={textInput+' mt-1'} style={fieldStyle}/></label>
      </div>
      <div className="my-3 rounded-xl p-3" style={{background:C.pineTint,border:'1px solid '+C.line}}><div className="text-xs" style={{color:C.pineDark}}>ค่าเรียนคาบนี้</div><div className="mt-1 text-xl font-semibold" style={{color:C.pineDark}}>{valid?'฿'+Math.round(hours*rate).toLocaleString('th-TH'):'ตรวจสอบนักเรียน ชั่วโมง และอัตราค่าสอน'}</div></div>
      {field('วิชา','subject',student?.subjects?.[0]||'เช่น คณิตศาสตร์')}
      {field('เรื่องที่สอน','topic','ระบุหัวข้อหรือเนื้อหาที่เรียน',true,true)}
      {field('ผลการเรียน / ทำได้แค่ไหน','performance','นักเรียนเข้าใจหรือทำอะไรได้แล้วบ้าง',true)}
      {field('จุดเด่น / สิ่งที่ทำได้ดี','strengths','เช่น แก้สมการได้เอง อธิบายเหตุผลได้ดี',true)}
      {field('คะแนน (ถ้ามี)','score','เช่น 8/10')}
      {field('จุดที่ยังติด / ควรทบทวน','stuck','เรื่องที่ควรทบทวนเพิ่มเติม',true)}
      {field('การบ้าน / สิ่งที่ต้องทำต่อ','homework','แบบฝึกหัดหรือสิ่งที่ต้องเตรียม',true)}
      {field('แผนการเรียนคาบถัดไป','nextPlan','หัวข้อหรือทักษะที่จะต่อยอดในครั้งหน้า',true)}
      <div className="my-3 border-t pt-3" style={{borderColor:C.line}}><div className="mb-2 text-sm font-semibold" style={{color:C.pineDark}}>English details (optional)</div>
        {field('Lesson topic (EN)','enTopic','e.g. Linear equations',true)}
        {field('Learning outcome (EN)','enPerformance','What the student understood',true)}
        {field('Needs more practice (EN)','enStuck','Topics to review',true)}
        {field('Homework / next steps (EN)','enHomework','Homework for next lesson',true)}
      </div>
      {field('โน้ตเพิ่มเติม','note','รายละเอียดเพิ่มเติมสำหรับผู้ปกครอง',true)}
      {note&&<div className="mb-3 rounded-xl p-3 text-sm leading-6" style={{background:C.paper,border:'1px solid '+C.line,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><div className="mb-1 text-xs" style={{color:C.inkSoft}}>ตัวอย่างบันทึกที่จะถูกเก็บ</div>{note}</div>}
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onCancel} className="flex-1 rounded-lg py-2.5 text-sm" style={{border:'1px solid '+C.line,color:C.inkSoft}}>ยกเลิก</button>{editing&&onDelete&&<button type="button" onClick={()=>onDelete(initial.id)} className="rounded-lg px-4 py-2.5 text-sm" style={{background:C.brickTint,color:C.brick}}>ลบคาบ</button>}<button type="button" disabled={!valid||busy} onClick={submit} className="flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-40" style={{background:C.pine,color:C.paper}}>{busy?'กำลังบันทึก…':'บันทึกคาบนี้'}</button></div>
    </div>
  </div>;
}

function SessionsTab({ students, sessions, updateSessions, getStudent, showToast, recordRequest, clearRecordRequest }) {
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState(null);
  const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));
  useEffect(()=>{
    if(!recordRequest?.slot)return;
    const slot=recordRequest.slot;
    const student=getStudent(slot.studentId);
    if(!student){clearRecordRequest?.();return;}
    setEditing({studentId:student.id,studentName:student.name,date:recordRequest.date||todayStr(),hours:hoursBetween(slot.start,slot.end),rate:Number(student.rate)||0,note:'',invoiced:false,paid:false,sourceSlotId:slot.id});
    setShowForm(true);clearRecordRequest?.();
  },[recordRequest,getStudent,clearRecordRequest]);
  const cancel=()=>{setShowForm(false);setEditing(null);};
  const save=async(item)=>{
    const exists=sessions.some(s=>s.id===item.id);
    await updateSessions(exists?sessions.map(s=>s.id===item.id?item:s):[...sessions,item]);
    cancel();showToast(exists?'อัปเดตบันทึกคาบแล้ว':'บันทึกคาบสอนแล้ว');
  };
  const remove=async(id)=>{
    if(!confirm('ลบคาบสอนนี้?'))return;
    await updateSessions(sessions.filter(s=>s.id!==id),[id]);cancel();showToast('ลบคาบสอนแล้ว');
  };
  const togglePaid=s=>updateSessions(sessions.map(x=>x.id===s.id?{...x,paid:!x.paid}:x));
  return <div>
    <div className="mb-5 flex items-center justify-between gap-3"><SectionTitle sub="บันทึกสิ่งที่สอน ผลการเรียน และสิ่งที่ต้องติดตาม">บันทึกคาบสอน</SectionTitle><button onClick={()=>{setEditing(null);setShowForm(true);}} disabled={!students.length} style={{background:C.pine,color:C.paper}} className="flex h-fit items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"><Plus size={16}/>เพิ่มคาบสอน</button></div>
    {sorted.length===0&&<EmptyState text="ยังไม่มีบันทึกคาบสอน"/>}
    <div className="flex flex-col">{sorted.map((s,i)=>{
      const name=getStudent(s.studentId)?.name||s.studentName||'ไม่ทราบชื่อ';
      return <div key={s.id} style={{borderBottom:i<sorted.length-1?'1px dashed '+C.line:'none'}} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1"><div className="text-sm font-medium">{name}</div><div className="text-xs" style={{color:C.inkSoft}}>{fmtDateThai(s.date)} · {fmtHours(s.hours)} ชม.</div>{s.note?<div className="mt-2 whitespace-pre-wrap text-sm leading-7" style={{color:C.inkSoft,overflowWrap:'anywhere'}}>{s.note}</div>:<div className="mt-2 text-xs" style={{color:C.gold}}>ยังไม่มีโน้ต</div>}</div>
        <div className="flex shrink-0 flex-wrap items-center gap-3"><span className="text-sm font-medium" style={{color:C.gold}}>{fmtMoney(Number(s.hours||0)*Number(s.rate||0))}</span>{s.invoiced&&<span className="text-xs" style={{color:C.inkSoft}}>แจ้งแล้ว</span>}<button onClick={()=>togglePaid(s)} style={s.paid?{color:C.pine}:{color:C.brick}} className="flex items-center gap-1 text-xs font-medium">{s.paid?<><CheckCircle2 size={14}/>จ่ายแล้ว</>:<><Circle size={14}/>ยังไม่จ่าย</>}</button><button onClick={()=>{setEditing(s);setShowForm(true);}} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs" style={{background:C.pineTint,color:C.pineDark}}><Pencil size={13}/>แก้โน้ต</button><button onClick={()=>remove(s.id)} aria-label="ลบคาบสอน" style={{color:C.inkSoft}} className="p-1"><Trash2 size={14}/></button></div>
      </div>;
    })}</div>
    {showForm&&<LessonForm initial={editing||{}} students={students} onSave={save} onDelete={editing?remove:undefined} onCancel={cancel}/>}
  </div>;
}

// ---------- Invoice / message generator ----------
function InvoiceTab({ students, sessions, invoices=[], settings={}, lang='th', onCreateInvoice, showToast }) {
  const words = INVOICE_T[lang] || INVOICE_T.th;
  const firstOfMonth = todayStr().slice(0,8)+'01';
  const [studentId,setStudentId] = useState(students[0]?.id||'');
  const [dateFrom,setDateFrom] = useState(firstOfMonth);
  const [dateTo,setDateTo] = useState(todayStr());
  const [parentName,setParentName] = useState('');
  const [selected,setSelected] = useState(new Set());
  const [selectedInvoiceId,setSelectedInvoiceId] = useState('');
  const [creating,setCreating] = useState(false);
  const student = students.find(s=>s.id===studentId);
  const invoiceForSession = new Map();
  invoices.forEach(inv=>(inv.session_ids||[]).forEach(id=>invoiceForSession.set(id,inv)));
  const inRange = sessions.filter(s=>s.studentId===studentId&&s.date>=dateFrom&&s.date<=dateTo).sort((a,b)=>a.date.localeCompare(b.date));
  const candidates = inRange.filter(s=>!s.invoiced&&!invoiceForSession.has(s.id));
  useEffect(()=>{setSelected(new Set(candidates.map(s=>s.id)));setSelectedInvoiceId('');},[studentId,dateFrom,dateTo,sessions.length]);
  const chosen = candidates.filter(s=>selected.has(s.id));
  const openedInvoice = invoices.find(i=>i.id===selectedInvoiceId);
  const invoiceSessions = openedInvoice ? (openedInvoice.session_ids||[]).map(id=>sessions.find(s=>s.id===id)).filter(Boolean) : [];
  const toggle=id=>setSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const create=async()=>{
    if(!student||!chosen.length)return;
    setCreating(true);
    try{
      const invoice=await onCreateInvoice({student,dateFrom,dateTo,selectedSessions:chosen,parentName});
      setSelectedInvoiceId(invoice.id);
      setParentName('');
      showToast(lang==='en'?'Invoice created':'สร้างใบแจ้งค่าสอนแล้ว');
    }catch(e){console.error(e);showToast(e?.message?.includes('already belong')?(lang==='en'?'A selected lesson is already invoiced':'มีคาบที่อยู่ในใบแจ้งค่าสอนแล้ว'):lang==='en'?'Could not create invoice':'สร้างใบแจ้งค่าสอนไม่สำเร็จ');}
    finally{setCreating(false);}
  };
  const dateLabel=d=>d?new Date(d+'T12:00:00').toLocaleDateString(lang==='en'?'en-GB':'th-TH',{day:'numeric',month:'short',year:'numeric'}):'—';
  const fmt=n=>lang==='en'?'THB '+Math.round(Number(n)||0).toLocaleString('en-US'):'฿'+Math.round(Number(n)||0).toLocaleString('th-TH');
  return <div>
    <SectionTitle sub={lang==='en'?'Select a student and date range, then issue a fixed invoice for the chosen lessons':'เลือกนักเรียนและช่วงวันที่ จากนั้นสร้างใบแจ้งค่าสอนจากคาบที่เลือก'}>{lang==='en'?'Invoices':'แจ้งค่าสอน'}</SectionTitle>
    {students.length===0?<EmptyState text={lang==='en'?'Add a student before creating an invoice':'เพิ่มนักเรียนก่อนจึงจะออกใบแจ้งค่าสอนได้'}/>:<>
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={lang==='en'?'Student':'นักเรียน'}><select value={studentId} onChange={e=>setStudentId(e.target.value)} style={inputStyle} className="w-full rounded-lg px-3 py-2 text-base">{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label={lang==='en'?'Parent name (optional)':'ชื่อผู้ปกครอง (ไม่บังคับ)'}><input value={parentName} onChange={e=>setParentName(e.target.value)} style={inputStyle} className="w-full rounded-lg px-3 py-2 text-base" placeholder={lang==='en'?'Parent / guardian name':'ชื่อผู้ปกครอง'}/></Field>
          <Field label={lang==='en'?'From date':'จากวันที่'}><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inputStyle} className="w-full rounded-lg px-3 py-2 text-base"/></Field>
          <Field label={lang==='en'?'To date':'ถึงวันที่'}><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inputStyle} className="w-full rounded-lg px-3 py-2 text-base"/></Field>
        </div>
      </Card>
      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-sm">{lang==='en'?'Lessons in selected period':'คาบในช่วงวันที่เลือก'}</div><div className="text-xs" style={{color:C.inkSoft}}>{candidates.length} {lang==='en'?'available':'คาบที่ออกใบได้'}</div></div>
        {inRange.length===0?<EmptyState text={lang==='en'?'No lessons in this period':'ไม่มีคาบในช่วงวันที่นี้'}/>:<div className="space-y-1">
          {inRange.map(s=>{
            const prior=invoiceForSession.get(s.id);
            const locked=Boolean(s.invoiced||prior);
            return <label key={s.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm" style={{borderColor:C.line,background:locked?C.paper:'#fff',opacity:locked?0.85:1}}>
              <span className="flex min-w-0 items-start gap-2">{!locked?<input type="checkbox" className="mt-1" checked={selected.has(s.id)} onChange={()=>toggle(s.id)}/>:<span className="mt-0.5 text-xs" style={{color:C.pine}}>✓</span>}<span className="min-w-0"><span className="block font-medium">{dateLabel(s.date)} · {Number(s.hours)||0} {lang==='en'?'hrs':'ชม.'}</span><span className="mt-0.5 block break-words text-xs" style={{color:C.inkSoft}}>{(s.note||'').split('\n').find(x=>x.startsWith('EN topic:'))?.slice(9)||(s.note||'').split('\n').find(x=>x.startsWith('สอน:'))?.slice(4)|| (lang==='en'?'Lesson':'คาบเรียน')}</span>{locked&&<span className="mt-1 block text-xs font-medium" style={{color:C.brick}}>{prior?(lang==='en'?'Included in '+prior.number:'อยู่ในใบ '+prior.number):(lang==='en'?'Already marked invoiced':'ทำเครื่องหมายแจ้งแล้วจากรายการเดิม')}</span>}</span></span><span className="shrink-0 font-semibold" style={{color:C.gold}}>{fmt(Number(s.hours)*Number(s.rate))}</span>
            </label>;
          })}
        </div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{borderColor:C.line}}><div><div className="text-xs" style={{color:C.inkSoft}}>{lang==='en'?'Selected total':'ยอดคาบที่เลือก'}</div><div className="text-xl font-semibold">{fmt(chosen.reduce((sum,s)=>sum+Number(s.hours)*Number(s.rate),0))}</div></div><button type="button" disabled={!chosen.length||creating||dateTo<dateFrom} onClick={create} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:C.pine}}>{creating?(lang==='en'?'Creating…':'กำลังสร้าง…'):(lang==='en'?'Create invoice':'สร้างใบแจ้งค่าสอน')}</button></div>
      </Card>
      {invoices.length>0&&<Card className="mb-4"><div className="mb-2 font-semibold text-sm">{lang==='en'?'Previous invoices':'ใบแจ้งค่าสอนที่ออกแล้ว'}</div><div className="space-y-2">{invoices.filter(i=>!studentId||i.student_id===studentId).map(i=><button key={i.id} type="button" onClick={()=>setSelectedInvoiceId(i.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm" style={{borderColor:selectedInvoiceId===i.id?C.pine:C.line,background:selectedInvoiceId===i.id?C.pineTint:'#fff'}}><span><span className="block font-semibold">{i.number}</span><span className="mt-1 block text-xs" style={{color:C.inkSoft}}>{dateLabel(i.period_from)} – {dateLabel(i.period_to)}</span></span><span className="font-semibold">{fmt(i.total)}</span></button>)}</div></Card>}
      {openedInvoice&&<InvoiceCard invoice={openedInvoice} student={students.find(s=>s.id===openedInvoice.student_id)} sessions={invoiceSessions} settings={settings} lang={lang} showToast={showToast}/>}
      {!openedInvoice&&<div className="rounded-xl border p-4 text-sm" style={{borderColor:C.line,color:C.inkSoft,background:C.surface}}>{lang==='en'?'Create an invoice or select a previous invoice to preview and export it.':'สร้างใบแจ้งค่าสอนหรือเลือกใบเดิมเพื่อดูตัวอย่างและส่งออก'}</div>}
    </>}
  </div>;
}

// ---------- Business Intelligence ----------
function BusinessIntelligence({ students, sessions, schedule }) {
  const currentMonth = todayStr().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const monthSessions = sessions.filter(s => monthStr(s.date) === month);
  const totalRevenue = monthSessions.reduce((sum, s) => sum + Number(s.hours) * Number(s.rate), 0);
  const paid = monthSessions.filter(s => s.paid).reduce((sum, s) => sum + Number(s.hours) * Number(s.rate), 0);
  const unpaid = totalRevenue - paid;
  const invoiced = monthSessions.filter(s => s.invoiced).reduce((sum, s) => sum + Number(s.hours) * Number(s.rate), 0);
  const hours = monthSessions.reduce((sum, s) => sum + Number(s.hours), 0);
  const active = students.filter(s => s.status === 'active').length;
  const avgRate = hours ? totalRevenue / hours : 0;
  const byStudent = students.map(s => {
    const rows = monthSessions.filter(x => x.studentId === s.id);
    const h = rows.reduce((sum, x) => sum + Number(x.hours), 0);
    const amount = rows.reduce((sum, x) => sum + Number(x.hours) * Number(x.rate), 0);
    return { ...s, count: rows.length, hours: h, amount };
  }).filter(s => s.count > 0).sort((a,b) => b.amount - a.amount);
  const lastSix = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(month + '-01T00:00:00');
    d.setMonth(d.getMonth() - (5 - i));
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const rows = sessions.filter(s => monthStr(s.date) === key);
    return { key, label: MONTHS_TH[d.getMonth()], amount: rows.reduce((sum,s)=>sum+Number(s.hours)*Number(s.rate),0) };
  });
  const maxAmount = Math.max(1, ...lastSix.map(x => x.amount));
  const upcoming = schedule.filter(s => s.recurring || (s.date && s.date >= todayStr())).length;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3"><SectionTitle sub="ดูรายได้ ชั่วโมงสอน และภาพรวมธุรกิจติวเตอร์">Business Intelligence</SectionTitle><input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={inputStyle} className="text-sm px-2.5 py-2 rounded-lg" /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><div className="text-xs" style={{color:C.inkSoft}}>รายได้เดือนนี้</div><div className="text-xl font-semibold mt-1">{fmtMoney(totalRevenue)}</div></Card>
        <Card><div className="text-xs" style={{color:C.inkSoft}}>ชั่วโมงสอน</div><div className="text-xl font-semibold mt-1">{fmtHours(hours)} ชม.</div></Card>
        <Card><div className="text-xs" style={{color:C.inkSoft}}>ยังไม่ได้รับ</div><div className="text-xl font-semibold mt-1" style={{color:unpaid>0?C.brick:C.pine}}>{fmtMoney(unpaid)}</div></Card>
        <Card><div className="text-xs" style={{color:C.inkSoft}}>นักเรียน Active</div><div className="text-xl font-semibold mt-1">{active}</div></Card>
      </div>
      <Card><div className="flex justify-between gap-3 mb-3"><div className="font-medium text-sm">รายได้ย้อนหลัง 6 เดือน</div><div className="text-xs" style={{color:C.inkSoft}}>เฉลี่ย {fmtMoney(avgRate)}/ชม.</div></div><div className="flex items-end gap-2 h-36">{lastSix.map(x=><div key={x.key} className="flex-1 h-full flex flex-col justify-end items-center gap-1"><div className="text-[10px]" style={{color:C.inkSoft}}>{x.amount ? Math.round(x.amount).toLocaleString('th-TH') : ''}</div><div title={fmtMoney(x.amount)} style={{height:Math.max(4,x.amount/maxAmount*95)+'px',background:C.pine}} className="w-full max-w-10 rounded-t-md"/><div className="text-[10px]" style={{color:C.inkSoft}}>{x.label}</div></div>)}</div></Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><div className="font-medium text-sm mb-3">รายได้แยกตามนักเรียน</div>{byStudent.length===0?<EmptyState text="เดือนนี้ยังไม่มีคาบสอน"/>:<div className="space-y-2">{byStudent.map(s=><div key={s.id} className="flex justify-between gap-3 text-sm"><div><div className="font-medium">{s.name}</div><div className="text-xs" style={{color:C.inkSoft}}>{s.count} คาบ · {fmtHours(s.hours)} ชม.</div></div><div style={{color:C.gold}} className="font-medium">{fmtMoney(s.amount)}</div></div>)}</div>}</Card>
        <Card><div className="font-medium text-sm mb-3">สถานะการเก็บเงิน</div><div className="space-y-2 text-sm"><div className="flex justify-between"><span style={{color:C.inkSoft}}>แจ้งค่าสอนแล้ว</span><b>{fmtMoney(invoiced)}</b></div><div className="flex justify-between"><span style={{color:C.inkSoft}}>รับเงินแล้ว</span><b style={{color:C.pine}}>{fmtMoney(paid)}</b></div><div className="flex justify-between"><span style={{color:C.inkSoft}}>ค้างรับ</span><b style={{color:C.brick}}>{fmtMoney(unpaid)}</b></div></div><div style={{borderTop:'1px solid '+C.line}} className="mt-3 pt-3 text-xs">มีคาบในตาราง/กำหนดการ {upcoming} รายการ</div></Card>
      </div>
    </div>
  );
}

// ---------- Export ----------
function ExportTab({ students, sessions }) {
  const [studentId, setStudentId] = useState('all');
  const [dateFrom, setDateFrom] = useState(todayStr().slice(0, 8) + '01');
  const [dateTo, setDateTo] = useState(todayStr());

  const rows = sessions.filter((s) => (studentId === 'all' || s.studentId === studentId) && s.date >= dateFrom && s.date <= dateTo);

  const download = () => {
    const header = ['วันที่', 'นักเรียน', 'ชั่วโมง', 'อัตรา/ชม.', 'ยอดเงิน', 'โน้ต', 'แจ้งแล้ว', 'จ่ายแล้ว'];
    const csvCell = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const lines = [header.map(csvCell).join(',')];
    rows.forEach((s) => {
      const name = students.find((st) => st.id === s.studentId)?.name || s.studentName || '';
      const amount = s.hours * s.rate;
      const cells = [s.date, name, s.hours, s.rate, amount, s.note || '', s.invoiced ? 'ใช่' : 'ไม่', s.paid ? 'ใช่' : 'ไม่'];
      lines.push(cells.map(csvCell).join(','));
    });
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ค่าสอน-${dateFrom}-ถึง-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = rows.reduce((sum, s) => sum + s.hours * s.rate, 0);

  return (
    <div>
      <SectionTitle sub="ดาวน์โหลดประวัติคาบสอนเป็นไฟล์ CSV">ส่งออกข้อมูล</SectionTitle>
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="นักเรียน">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
              <option value="all">ทุกคน</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="จากวันที่">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <Field label="ถึงวันที่">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
        </div>
      </Card>
      <div style={{ color: C.inkSoft }} className="text-sm mb-4">{rows.length} รายการ · รวม {fmtMoney(total)}</div>
      <button onClick={download} disabled={rows.length === 0} style={{ background: C.pine, color: C.paper }} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
        <Download size={15} /> ดาวน์โหลด CSV
      </button>
    </div>
  );
}

// ---------- shared form widgets ----------
const inputStyle = { background: C.paper, border: `1px solid ${C.line}`, color: C.ink };

function Field({ label, children }) {
  return (
    <div className="mb-3 flex-1">
      <label style={{ color: C.inkSoft }} className="text-xs block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(35,40,43,0.4)' }}>
      <div
        style={{ background: C.surface, maxHeight: '90dvh', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', overscrollBehavior: 'contain' }}
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} style={{ color: C.inkSoft }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, saveLabel = 'บันทึก' }) {
  return (
    <div className="flex gap-2 mt-4">
      <button onClick={onCancel} style={{ border: `1px solid ${C.line}`, color: C.inkSoft }} className="flex-1 text-sm font-medium py-2 rounded-lg">ยกเลิก</button>
      <button onClick={onSave} style={{ background: C.pine, color: C.paper }} className="flex-1 text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1">
        <Check size={15} /> {saveLabel}
      </button>
    </div>
  );
}