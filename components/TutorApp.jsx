'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, Receipt, Download,
  Plus, Trash2, Check, Copy, X, Pencil, Circle, CheckCircle2, Send, Brain
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
function todayStr() { return new Date().toISOString().slice(0, 10); }
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
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState('');

  const OWNER_ID = '7d7c0b4e-9f42-4a93-b8b4-7f5a7d6c1e21';

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
          if (studentsToInsert.length) await supabase.from('tutor_students').insert(studentsToInsert);
          if (scheduleToInsert.length) await supabase.from('tutor_schedule').insert(scheduleToInsert);
          if (sessionsToInsert.length) await supabase.from('tutor_sessions').insert(sessionsToInsert);
          try {
            localStorage.removeItem('tutor-app:students');
            localStorage.removeItem('tutor-app:schedule');
            localStorage.removeItem('tutor-app:sessions');
          } catch {}
        }

        const [a,b,c] = await Promise.all([
          supabase.from('tutor_students').select('*').eq('user_id', OWNER_ID).order('created_at'),
          supabase.from('tutor_schedule').select('*').eq('user_id', OWNER_ID),
          supabase.from('tutor_sessions').select('*').eq('user_id', OWNER_ID).order('session_date', { ascending: false }),
        ]);
        setStudents((a.data || []).map((x) => ({ id:x.id, name:x.name, rate:Number(x.rate), grade:x.grade||'', subjects:Array.isArray(x.subjects)?x.subjects:[], goals:x.goals||'', strengths:x.strengths||'', weaknesses:x.weaknesses||'', learningStyle:x.learning_style||'', notes:x.notes||'', status:x.status||'active', targetExam:x.target_exam||'', targetDate:x.target_date||'', baselineScore:x.baseline_score==null?'':Number(x.baseline_score), latestScore:x.latest_score==null?'':Number(x.latest_score), targetScore:x.target_score==null?'':Number(x.target_score) })));
        setSchedule((b.data || []).map((x) => ({ id:x.id, studentId:x.student_id, recurring:x.recurring, day:x.day ?? undefined, date:x.date ?? undefined, start:String(x.start_time).slice(0,5), end:String(x.end_time).slice(0,5) })));
        setSessions((c.data || []).map((x) => ({ id:x.id, studentId:x.student_id, studentName:x.student_name || '', date:x.session_date, hours:Number(x.hours), rate:Number(x.rate), note:x.note || '', invoiced:Boolean(x.invoiced), paid:Boolean(x.paid), sourceSlotId:x.source_slot_id || undefined })));
      } catch (e) {
        console.error(e);
        showToast('เชื่อมต่อฐานข้อมูลไม่สำเร็จ');
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const updateStudents = async (next) => {
    setStudents(next);
    try {
      const { data: old } = await supabase.from('tutor_students').select('id').eq('user_id', OWNER_ID);
      const keep = new Set(next.map(x => x.id));
      for (const row of old || []) if (!keep.has(row.id)) await supabase.from('tutor_students').delete().eq('id', row.id).eq('user_id', OWNER_ID);
      if (next.length) await supabase.from('tutor_students').upsert(next.map(x => ({ id:x.id, user_id:OWNER_ID, name:x.name, rate:Number(x.rate), grade:x.grade||null, subjects:Array.isArray(x.subjects)?x.subjects:[], goals:x.goals||null, strengths:x.strengths||null, weaknesses:x.weaknesses||null, learning_style:x.learningStyle||null, notes:x.notes||null, status:x.status||'active', target_exam:x.targetExam||null, target_date:x.targetDate||null, baseline_score:x.baselineScore===''||x.baselineScore==null?null:Number(x.baselineScore), latest_score:x.latestScore===''||x.latestScore==null?null:Number(x.latestScore), target_score:x.targetScore===''||x.targetScore==null?null:Number(x.targetScore) })));
    } catch (e) { console.error(e); showToast('บันทึกนักเรียนไม่สำเร็จ'); }
  };

  const updateSchedule = async (next) => {
    setSchedule(next);
    try {
      const { data: old } = await supabase.from('tutor_schedule').select('id').eq('user_id', OWNER_ID);
      const keep = new Set(next.map(x => x.id));
      for (const row of old || []) if (!keep.has(row.id)) await supabase.from('tutor_schedule').delete().eq('id', row.id).eq('user_id', OWNER_ID);
      if (next.length) await supabase.from('tutor_schedule').upsert(next.map(x => ({ id:x.id, user_id:OWNER_ID, student_id:x.studentId, recurring:Boolean(x.recurring), day:x.recurring?Number(x.day):null, date:x.recurring?null:x.date, start_time:x.start, end_time:x.end })));
    } catch (e) { console.error(e); showToast('บันทึกตารางสอนไม่สำเร็จ'); }
  };

  const updateSessions = async (next) => {
    setSessions(next);
    try {
      const { data: old } = await supabase.from('tutor_sessions').select('id').eq('user_id', OWNER_ID);
      const keep = new Set(next.map(x => x.id));
      for (const row of old || []) if (!keep.has(row.id)) await supabase.from('tutor_sessions').delete().eq('id', row.id).eq('user_id', OWNER_ID);
      if (next.length) await supabase.from('tutor_sessions').upsert(next.map(x => ({ id:x.id, user_id:OWNER_ID, student_id:x.studentId||null, student_name:x.studentName||'', session_date:x.date, hours:Number(x.hours), rate:Number(x.rate), note:x.note||'', invoiced:Boolean(x.invoiced), paid:Boolean(x.paid), source_slot_id:x.sourceSlotId||null })));
    } catch (e) { console.error(e); showToast('บันทึกคาบสอนไม่สำเร็จ'); }
  };

  const getStudent = (id) => students.find((s) => s.id === id);

  const NAV = [
    { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
    { id: 'students', label: 'นักเรียน', icon: Users },
    { id: 'schedule', label: 'ตารางสอน', icon: CalendarDays },
    { id: 'calendar', label: 'ปฏิทินเรียน', icon: Send },
    { id: 'sessions', label: 'บันทึกคาบสอน', icon: ClipboardList },
    { id: 'invoice', label: 'แจ้งค่าสอน', icon: Receipt },
    { id: 'export', label: 'ส่งออกข้อมูล', icon: Download },
  ];

  if (!loaded) {
    return (
      <div style={{ background: C.paper, color: C.inkSoft }} className="w-full min-h-screen flex items-center justify-center text-sm">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, color: C.ink }} className="w-full min-h-screen flex flex-col md:flex-row font-sans">
      {/* Desktop sidebar */}
      <div style={{ borderRight: `1px solid ${C.line}` }} className="hidden md:flex md:w-56 md:flex-col md:py-6 md:px-4 md:sticky md:top-0 md:h-screen shrink-0">
        <div className="px-2 mb-8">
          <div style={{ color: C.pine }} className="text-lg font-semibold leading-tight">สมุดสอนพิเศษ</div>
          <div style={{ color: C.inkSoft }} className="text-xs mt-1">จัดตาราง คิดค่าสอน แจ้งผู้ปกครอง</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={active ? { background: C.pineTint, color: C.pineDark } : { color: C.inkSoft }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left"
              >
                <Icon size={17} />
                {n.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile top nav */}
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.paper }} className="md:hidden sticky top-0 z-20 overflow-x-auto">
        <div className="flex gap-1 px-3 py-3 min-w-max">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={active ? { background: C.pineTint, color: C.pineDark } : { color: C.inkSoft }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
              >
                <Icon size={16} />
                {n.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-10 md:py-10 max-w-4xl mx-auto w-full">
        {tab === 'dashboard' && (
          <Dashboard students={students} sessions={sessions} schedule={schedule} updateSessions={updateSessions} getStudent={getStudent} showToast={showToast} setTab={setTab} />
        )}
        {tab === 'students' && <StudentsTab students={students} updateStudents={updateStudents} sessions={sessions} />}
        {tab === 'schedule' && (
          <ScheduleTab students={students} schedule={schedule} updateSchedule={updateSchedule} sessions={sessions} updateSessions={updateSessions} getStudent={getStudent} showToast={showToast} />
        )}
        {tab === 'calendar' && <CalendarTab students={students} schedule={schedule} showToast={showToast} />}
        {tab === 'sessions' && (
          <SessionsTab students={students} sessions={sessions} updateSessions={updateSessions} getStudent={getStudent} showToast={showToast} />
        )}
        {tab === 'invoice' && (
          <InvoiceTab students={students} sessions={sessions} updateSessions={updateSessions} showToast={showToast} />
        )}
        {tab === 'export' && <ExportTab students={students} sessions={sessions} />}
      </div>

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
function Dashboard({ students, sessions, schedule, updateSessions, getStudent, showToast, setTab }) {
  if (students.length === 0) {
    return (
      <div>
        <SectionTitle sub="เริ่มต้นด้วยการเพิ่มนักเรียนคนแรก">ภาพรวม</SectionTitle>
        <EmptyState text="ยังไม่มีนักเรียนในระบบ ไปที่แท็บ 'นักเรียน' เพื่อเพิ่มคนแรก" />
      </div>
    );
  }

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
    const student = getStudent(slot.studentId);
    if (!student) return;
    const alreadyLogged = sessions.some((s) => s.sourceSlotId === slot.id && s.date === today);
    if (alreadyLogged) return;
    const hours = hoursBetween(slot.start, slot.end);
    const next = [
      ...sessions,
      { id: uid(), studentId: student.id, studentName: student.name, date: today, hours, rate: student.rate, note: '', invoiced: false, paid: false, sourceSlotId: slot.id },
    ];    updateSessions(next);    showToast(`บันทึกคาบสอนของ ${student.name} แล้ว`);
  };

  return (
    <div>
      <SectionTitle sub={fmtDateThai(today)}>ภาพรวม</SectionTitle>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <div style={{ color: C.inkSoft }} className="text-xs mb-1">รายได้เดือนนี้</div>
          <div style={{ color: C.pine }} className="text-2xl font-semibold">{fmtMoney(revenueThisMonth)}</div>
        </Card>
        <Card>
          <div style={{ color: C.inkSoft }} className="text-xs mb-1">ชั่วโมงสอนเดือนนี้</div>
          <div className="text-2xl font-semibold">{fmtHours(hoursThisMonth)} ชม.</div>
        </Card>
        <Card style={outstandingTotal > 0 ? { borderColor: C.brick } : {}}>
          <div style={{ color: C.inkSoft }} className="text-xs mb-1">ค้างชำระทั้งหมด</div>
          <div style={{ color: outstandingTotal > 0 ? C.brick : C.ink }} className="text-2xl font-semibold">{fmtMoney(outstandingTotal)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="font-medium mb-3">สอนวันนี้</div>
          {todaysSlots.length === 0 && <div style={{ color: C.inkSoft }} className="text-sm">ไม่มีคาบสอนวันนี้</div>}
          <div className="flex flex-col gap-2">
            {todaysSlots.map((slot) => {
              const student = getStudent(slot.studentId);
              const logged = sessions.some((s) => s.sourceSlotId === slot.id && s.date === today);
              return (
                <div key={slot.id} style={{ borderBottom: `1px dashed ${C.line}` }} className="flex items-center justify-between pb-2">
                  <div>
                    <div className="text-sm font-medium">{student?.name || 'ไม่ทราบชื่อ'}</div>
                    <div style={{ color: C.inkSoft }} className="text-xs">{slot.start}–{slot.end}</div>
                  </div>
                  <button
                    onClick={() => markTaught(slot)}
                    disabled={logged}
                    style={logged ? { color: C.pine } : { background: C.pineTint, color: C.pineDark }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    {logged ? (<><CheckCircle2 size={14} /> บันทึกแล้ว</>) : 'สอนแล้ว ✓'}
                  </button>
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

  const save = () => {
    const name=form.name.trim(), rate=parseFloat(form.rate);
    if (!name || !rate || rate<=0) return;
    const student={ id:editing==='new'?uid():editing, name, rate, grade:form.grade.trim(), subjects:form.subjects, goals:form.goals.trim(), strengths:form.strengths.trim(), weaknesses:form.weaknesses.trim(), learningStyle:form.learningStyle, notes:form.notes.trim(), status:form.status, targetExam:form.targetExam.trim(), targetDate:form.targetDate, baselineScore:form.baselineScore===''?'':Number(form.baselineScore), latestScore:form.latestScore===''?'':Number(form.latestScore), targetScore:form.targetScore===''?'':Number(form.targetScore) };
    updateStudents(editing==='new'?[...students,student]:students.map(s=>s.id===editing?{...s,...student}:s));
    setEditing(null);
  };
  const remove = (id) => { if(confirm('ลบนักเรียนคนนี้? ประวัติการสอนเดิมจะยังอยู่')) updateStudents(students.filter(s=>s.id!==id)); };
  const subjectOptions=['คณิตศาสตร์','ฟิสิกส์','ภาษาอังกฤษ','ภาษาจีน','วิทยาศาสตร์'];
  const buildAnalysis = (s) => {
    const history = sessions.filter(x=>x.studentId===s.id).sort((a,b)=>a.date.localeCompare(b.date));
    const scores = history.map(x => Number((x.note||'').match(/คะแนน[:： ]*(\\d+(?:\\.\\d+)?)/)?.[1])).filter(Number.isFinite);
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
              <div className="flex gap-1 shrink-0"><button onClick={()=>setHistoryStudent(s.id)} style={{color:C.inkSoft}} className="p-2 rounded-lg"><ClipboardList size={16}/></button><button onClick={()=>setHistoryStudent(`analysis:${s.id}`)} style={{color:C.pine}} className="p-2 rounded-lg" title="วิเคราะห์นักเรียน"><Brain size={16}/></button><button onClick={()=>openEdit(s)} style={{color:C.inkSoft}} className="p-2 rounded-lg"><Pencil size={16}/></button><button onClick={()=>remove(s.id)} style={{color:C.brick}} className="p-2 rounded-lg"><Trash2 size={16}/></button></div>
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
        <Field label="โน้ตสำหรับติวเตอร์"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="ข้อมูลสำคัญเกี่ยวกับนักเรียน" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg min-h-20"/></Field>
        <ModalActions onCancel={()=>setEditing(null)} onSave={save}/>
      </Modal>}

      {historyStudent&&(()=>{const student=students.find(s=>s.id===historyStudent);const history=sessions.filter(s=>s.studentId===historyStudent).sort((a,b)=>b.date.localeCompare(a.date));const totalAll=history.reduce((sum,s)=>sum+s.hours*s.rate,0);return <Modal onClose={()=>setHistoryStudent(null)} title={`ประวัติการสอน · ${student?.name||''}`}>{history.length===0?<div style={{color:C.inkSoft}} className="text-sm">ยังไม่มีประวัติการสอน</div>:<><div style={{color:C.inkSoft}} className="text-xs mb-3">รวม {history.length} คาบ ตั้งแต่เริ่มเรียน · {fmtMoney(totalAll)}</div><div className="flex flex-col gap-1 max-h-80 overflow-y-auto">{history.map((s,i)=><div key={s.id} style={{borderBottom:i<history.length-1?`1px dashed ${C.line}`:'none'}} className="py-2 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{fmtDateThai(s.date)} · {fmtHours(s.hours)} ชม.</span><span style={{color:C.gold}}>{fmtMoney(s.hours*s.rate)}</span></div>{s.note&&<div style={{color:C.inkSoft}} className="text-xs mt-0.5">{s.note}</div>}</div>)}</div></> }<div className="flex mt-4"><button onClick={()=>setHistoryStudent(null)} style={{border:`1px solid ${C.line}`,color:C.inkSoft}} className="flex-1 text-sm font-medium py-2 rounded-lg">ปิด</button></div></Modal>})()}

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
          </div>
        </Modal>;
      })()}
    </div>
  );
}


// ---------- Smart Lesson Planner ----------
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
function ScheduleTab({ students, schedule, updateSchedule, sessions, updateSessions, getStudent, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', recurring: true, day: 0, date: todayStr(), start: '16:00', end: '17:30' });
  const [confirmSlot, setConfirmSlot] = useState(null); // {slot, date, hours}

  const addSlot = () => {
    if (!form.studentId) return;
    const slot = {
      id: uid(),
      studentId: form.studentId,
      recurring: form.recurring,
      day: form.recurring ? Number(form.day) : undefined,
      date: form.recurring ? undefined : form.date,
      start: form.start,
      end: form.end,
    };    updateSchedule([...schedule, slot]);
    setShowForm(false);  };

  const removeSlot = (id) => {
    if (!confirm('ลบคาบนี้ออกจากตาราง?')) return;
    updateSchedule(schedule.filter((s) => s.id !== id));
  };

  const openConfirm = (slot, date) => {
    setConfirmSlot({ slot, date, hours: hoursBetween(slot.start, slot.end), note: '' });
  };

  const saveConfirm = () => {
    const { slot, date, hours, note } = confirmSlot;
    const student = getStudent(slot.studentId);
    if (!student) return;
    updateSessions([
      ...sessions,
      { id: uid(), studentId: student.id, studentName: student.name, date, hours: Number(hours), rate: student.rate, note: note || '', invoiced: false, paid: false, sourceSlotId: slot.id },
    ]);
    showToast(`บันทึกคาบสอนของ ${student.name} แล้ว`);
    setConfirmSlot(null);
  };

  const recurringSlots = schedule.filter((s) => s.recurring);
  const oneOffSlots = [...schedule.filter((s) => !s.recurring)].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <SectionTitle sub="ตารางประจำสัปดาห์และคาบสอนแบบครั้งเดียว">ตารางสอน</SectionTitle>
        <button
          onClick={() => setShowForm(true)}
          disabled={students.length === 0}
          style={{ background: C.pine, color: C.paper }}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg h-fit disabled:opacity-40"
        >
          <Plus size={16} /> เพิ่มคาบ
        </button>
      </div>

      {students.length === 0 && <EmptyState text="เพิ่มนักเรียนก่อน แล้วค่อยมาตั้งตารางสอน" />}

      {students.length > 0 && (
        <>
          <div className="font-medium text-sm mb-3" style={{ color: C.inkSoft }}>ตารางประจำ</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {DAY_NAMES.map((dayName, idx) => {
              const slots = recurringSlots.filter((s) => s.day === idx).sort((a, b) => a.start.localeCompare(b.start));
              return (
                <Card key={idx} style={{ background: idx === jsDayToIndex(new Date().getDay()) ? C.pineTint : C.surface }}>
                  <div className="text-sm font-medium mb-2">{dayName}</div>
                  {slots.length === 0 && <div style={{ color: C.inkSoft }} className="text-xs">ไม่มีคาบ</div>}
                  <div className="flex flex-col gap-2">
                    {slots.map((slot) => {
                      const student = getStudent(slot.studentId);
                      const loggedToday = sessions.some((s) => s.sourceSlotId === slot.id && s.date === todayStr());
                      return (
                        <div key={slot.id} style={{ borderBottom: `1px dashed ${C.line}` }} className="pb-2">
                          <div className="text-sm">{student?.name || 'ไม่ทราบชื่อ'}</div>
                          <div style={{ color: C.inkSoft }} className="text-xs mb-1">{slot.start}–{slot.end}</div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openConfirm(slot, todayStr())}
                              disabled={idx !== jsDayToIndex(new Date().getDay()) || loggedToday}
                              style={{ color: C.pineDark }}
                              className="text-xs font-medium disabled:opacity-30"
                            >
                              {loggedToday ? 'บันทึกวันนี้แล้ว' : 'สอนแล้ว ✓'}
                            </button>
                            <button onClick={() => removeSlot(slot.id)} style={{ color: C.brick }} className="text-xs">ลบ</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="font-medium text-sm mb-3" style={{ color: C.inkSoft }}>คาบครั้งเดียว (ไม่ประจำ)</div>
          {oneOffSlots.length === 0 && <EmptyState text="ไม่มีคาบสอนแบบครั้งเดียวที่ตั้งไว้" />}
          <div className="flex flex-col gap-2">
            {oneOffSlots.map((slot) => {
              const student = getStudent(slot.studentId);
              const logged = sessions.some((s) => s.sourceSlotId === slot.id && s.date === slot.date);
              return (
                <Card key={slot.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{student?.name || 'ไม่ทราบชื่อ'}</div>
                    <div style={{ color: C.inkSoft }} className="text-xs">{fmtDateThai(slot.date)} · {slot.start}–{slot.end}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openConfirm(slot, slot.date)}
                      disabled={logged}
                      style={logged ? { color: C.pine } : { background: C.pineTint, color: C.pineDark }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg"
                    >
                      {logged ? 'บันทึกแล้ว' : 'สอนแล้ว ✓'}
                    </button>
                    <button onClick={() => removeSlot(slot.id)} style={{ color: C.brick }} className="p-1"><Trash2 size={15} /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="เพิ่มคาบสอน">
          <Field label="นักเรียน">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
              <option value="">เลือกนักเรียน</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="รูปแบบ">
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form, recurring: true })} style={form.recurring ? { background: C.pineTint, color: C.pineDark } : { color: C.inkSoft, border: `1px solid ${C.line}` }} className="flex-1 text-sm py-2 rounded-lg font-medium">ประจำทุกสัปดาห์</button>
              <button onClick={() => setForm({ ...form, recurring: false })} style={!form.recurring ? { background: C.pineTint, color: C.pineDark } : { color: C.inkSoft, border: `1px solid ${C.line}` }} className="flex-1 text-sm py-2 rounded-lg font-medium">ครั้งเดียว</button>
            </div>
          </Field>
          {form.recurring ? (
            <Field label="วัน">
              <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="วันที่">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
            </Field>
          )}
          <div className="flex gap-3">
            <Field label="เวลาเริ่ม">
              <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
            </Field>
            <Field label="เวลาจบ">
              <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
            </Field>
          </div>
          <ModalActions onCancel={() => setShowForm(false)} onSave={addSlot} />
        </Modal>
      )}

      {confirmSlot && (
        <Modal onClose={() => setConfirmSlot(null)} title="ยืนยันคาบสอน">
          <Field label="วันที่">
            <input type="date" value={confirmSlot.date} onChange={(e) => setConfirmSlot({ ...confirmSlot, date: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <Field label="จำนวนชั่วโมง">
            <input type="number" step="0.25" value={confirmSlot.hours} onChange={(e) => setConfirmSlot({ ...confirmSlot, hours: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <Field label="โน้ต (ไม่บังคับ)">
            <input value={confirmSlot.note} onChange={(e) => setConfirmSlot({ ...confirmSlot, note: e.target.value })} placeholder="สอนอะไรไปบ้าง" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <ModalActions onCancel={() => setConfirmSlot(null)} onSave={saveConfirm} saveLabel="บันทึกคาบสอน" />
        </Modal>
      )}
    </div>
  );
}

// ---------- Calendar summary (send schedule + cost to parents) ----------
const WEEKDAY_ABBR = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + rr.tl, y);
  ctx.lineTo(x + w - rr.tr, y);
  ctx.arcTo(x + w, y, x + w, y + rr.tr, rr.tr);
  ctx.lineTo(x + w, y + h - rr.br);
  ctx.arcTo(x + w, y + h, x + w - rr.br, y + h, rr.br);
  ctx.lineTo(x + rr.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr.bl, rr.bl);
  ctx.lineTo(x, y + rr.tl);
  ctx.arcTo(x, y, x + rr.tl, y, rr.tl);
  ctx.closePath();
}

function drawSummaryCard(canvas, { kicker, title, subtitle, rows, footerSmall, footerBig }) {
  const width = 720;
  const headerH = 130;
  const rowH = 46;
  const footerH = 104;
  const bottomPad = 24;
  const height = headerH + rows.length * rowH + footerH + bottomPad;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  roundRectPath(ctx, 0, 0, width, height, 20);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.line;
  ctx.stroke();

  ctx.save();
  roundRectPath(ctx, 0, 0, width, headerH, { tl: 20, tr: 20, br: 0, bl: 0 });
  ctx.clip();
  ctx.fillStyle = C.pine;
  ctx.fillRect(0, 0, width, headerH);
  ctx.restore();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 15px sans-serif';
  ctx.fillText(kicker, 32, 40);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 30px sans-serif';
  ctx.fillText(title, 32, 78);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '500 16px sans-serif';
  ctx.fillText(subtitle, 32, 106);

  let y = headerH;
  rows.forEach((row, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = C.paperDeep;
      ctx.fillRect(0, y, width, rowH);
    }
    ctx.fillStyle = C.ink;
    ctx.font = '600 17px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(row.left, 32, y + rowH / 2);

    ctx.fillStyle = C.inkSoft;
    ctx.font = '400 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(row.right, width - 32, y + rowH / 2);

    if (i < rows.length - 1) {
      ctx.strokeStyle = C.line;
      ctx.setLineDash([4, 4]);      ctx.beginPath();
      ctx.moveTo(24, y + rowH);
      ctx.lineTo(width - 24, y + rowH);      ctx.stroke();
      ctx.setLineDash([]);
    }
    y += rowH;
  });

  const footerY = y + 16;
  roundRectPath(ctx, 24, footerY, width - 48, footerH - 32, 14);
  ctx.fillStyle = C.goldTint;
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.inkSoft;
  ctx.font = '500 14px sans-serif';
  ctx.fillText(footerSmall, 44, footerY + 28);

  ctx.fillStyle = C.gold;
  ctx.font = '700 24px sans-serif';
  ctx.fillText(footerBig, 44, footerY + 56);
}

function CalendarTab({ students, schedule, showToast }) {
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const canvasRef = useRef(null);

  const student = students.find((s) => s.id === studentId);

  const entries = [];
  if (student) {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const recurring = schedule.filter((sl) => sl.recurring && sl.studentId === studentId);
    const oneOff = schedule.filter((sl) => !sl.recurring && sl.studentId === studentId && sl.date.startsWith(month));

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(y, m - 1, day);
      const wIdx = jsDayToIndex(dateObj.getDay());
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      recurring.filter((sl) => sl.day === wIdx).forEach((sl) => {
        entries.push({ date: dateStr, start: sl.start, end: sl.end, weekday: wIdx });
      });
    }
    oneOff.forEach((sl) => {
      const wIdx = jsDayToIndex(new Date(sl.date + 'T00:00:00').getDay());
      entries.push({ date: sl.date, start: sl.start, end: sl.end, weekday: wIdx });
    });
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  }

  const totalHours = entries.reduce((sum, e) => sum + hoursBetween(e.start, e.end), 0);
  const totalAmount = student ? totalHours * student.rate : 0;
  const monthLabel = () => { const [y, m] = month.split('-').map(Number); return `${MONTHS_TH[m - 1]} ${y + 543}`; };

  useEffect(() => {
    if (!student || entries.length === 0 || !canvasRef.current) return;
    drawSummaryCard(canvasRef.current, {
      kicker: '📅  ตารางเรียน',
      title: student.name,
      subtitle: `เดือน${monthLabel()}`,
      rows: entries.map((e) => ({ left: `${WEEKDAY_ABBR[e.weekday]} ${fmtDateThai(e.date)}`, right: `${e.start}–${e.end}` })),
      footerSmall: `รวม ${entries.length} ครั้ง (${fmtHours(totalHours)} ชม.)`,
      footerBig: `ค่าเรียนโดยประมาณ ${fmtMoney(totalAmount)}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, month, schedule, students]);

  const message = student && entries.length > 0
    ? `📅 ตารางเรียน ${student.name} เดือน${monthLabel()}\n` +
      entries.map((e) => `- ${WEEKDAY_ABBR[e.weekday]} ${fmtDateThai(e.date)} เวลา ${e.start}-${e.end}`).join('\n') +
      `\nรวม ${entries.length} ครั้ง (${fmtHours(totalHours)} ชม.)\nค่าเรียนโดยประมาณ: ${fmtMoney(totalAmount)}`
    : '';

  const copyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('คัดลอกรูปแล้ว ไปวางในแชท LINE ได้เลย');
      } catch (e) {
        showToast('อุปกรณ์นี้อาจไม่รองรับการคัดลอกรูป ลองดาวน์โหลดแทน');
      }
    });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !student) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ตารางเรียน-${student.name}-${month}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const copyText = async () => {
    try { await navigator.clipboard.writeText(message); showToast('คัดลอกข้อความแล้ว'); }
    catch { showToast('คัดลอกไม่สำเร็จ ลองเลือกข้อความเอง'); }
  };

  return (
    <div>
      <SectionTitle sub="สรุปวันเรียนทั้งเดือนจากตารางสอน เป็นรูปภาพพร้อมส่งให้ผู้ปกครองทราบล่วงหน้า">ปฏิทินเรียน</SectionTitle>
      {students.length === 0 ? (
        <EmptyState text="เพิ่มนักเรียนก่อนจึงจะสรุปตารางได้" />
      ) : (
        <>
          <Card className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="นักเรียน">
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="เดือน">
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
              </Field>
            </div>
          </Card>

          {entries.length === 0 ? (
            <EmptyState text="ไม่มีคาบสอนของนักเรียนคนนี้ในเดือนที่เลือก ลองไปตั้งตารางสอนก่อน" />
          ) : (
            <>
              <div className="mb-4 overflow-x-auto flex justify-center">
                <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: '20px' }} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={copyImage} style={{ background: C.pine, color: C.paper }} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg">
                  <Copy size={15} /> คัดลอกรูป
                </button>
                <button onClick={downloadImage} style={{ border: `1px solid ${C.line}`, color: C.inkSoft }} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg">
                  <Download size={15} /> ดาวน์โหลดรูป
                </button>
                <button onClick={copyText} style={{ color: C.inkSoft }} className="text-sm font-medium px-3 py-2 underline">
                  คัดลอกเป็นข้อความแทน
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Sessions log ----------
function SessionsTab({ students, sessions, updateSessions, getStudent, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', date: todayStr(), hours: '1', note: '' });

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  const addManual = () => {
    const student = getStudent(form.studentId);
    if (!student || !form.hours) return;
    updateSessions([
      ...sessions,
      { id: uid(), studentId: student.id, studentName: student.name, date: form.date, hours: Number(form.hours), rate: student.rate, note: form.note, invoiced: false, paid: false },
    ]);
    setShowForm(false);
    setForm({ studentId: '', date: todayStr(), hours: '1', note: '' });
  };

  const togglePaid = (s) => updateSessions(sessions.map((x) => (x.id === s.id ? { ...x, paid: !x.paid } : x)));
  const remove = (id) => {
    if (!confirm('ลบคาบสอนนี้?')) return;
    updateSessions(sessions.filter((s) => s.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <SectionTitle sub="ประวัติคาบสอนทั้งหมด เรียงจากล่าสุด">บันทึกคาบสอน</SectionTitle>
        <button onClick={() => setShowForm(true)} disabled={students.length === 0} style={{ background: C.pine, color: C.paper }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg h-fit disabled:opacity-40">
          <Plus size={16} /> เพิ่มคาบสอน
        </button>
      </div>

      {sorted.length === 0 && <EmptyState text="ยังไม่มีบันทึกคาบสอน" />}

      <div className="flex flex-col">
        {sorted.map((s, i) => {
          const name = getStudent(s.studentId)?.name || s.studentName || 'ไม่ทราบชื่อ';
          return (
            <div key={s.id} style={{ borderBottom: i < sorted.length - 1 ? `1px dashed ${C.line}` : 'none' }} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{name}</div>
                <div style={{ color: C.inkSoft }} className="text-xs">{fmtDateThai(s.date)} · {fmtHours(s.hours)} ชม. {s.note && `· ${s.note}`}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span style={{ color: C.gold }} className="text-sm font-medium">{fmtMoney(s.hours * s.rate)}</span>
                {s.invoiced && <span style={{ color: C.inkSoft }} className="text-xs">แจ้งแล้ว</span>}
                <button onClick={() => togglePaid(s)} style={s.paid ? { color: C.pine } : { color: C.brick }} className="text-xs font-medium flex items-center gap-1">
                  {s.paid ? <><CheckCircle2 size={14} /> จ่ายแล้ว</> : <><Circle size={14} /> ยังไม่จ่าย</>}
                </button>
                <button onClick={() => remove(s.id)} style={{ color: C.inkSoft }} className="p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="เพิ่มคาบสอน">
          <Field label="นักเรียน">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
              <option value="">เลือกนักเรียน</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="วันที่">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <Field label="จำนวนชั่วโมง">
            <input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <Field label="โน้ต (ไม่บังคับ)">
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="สอนอะไรไปบ้าง" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <ModalActions onCancel={() => setShowForm(false)} onSave={addManual} />
        </Modal>
      )}
    </div>
  );
}

// ---------- Invoice / message generator ----------
function InvoiceTab({ students, sessions, updateSessions, showToast }) {
  const firstOfMonth = todayStr().slice(0, 8) + '01';
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(todayStr());
  const [selected, setSelected] = useState(new Set());
  const canvasRef = useRef(null);

  const candidates = sessions
    .filter((s) => s.studentId === studentId && s.date >= dateFrom && s.date <= dateTo && !s.invoiced)
    .sort((a, b) => a.date.localeCompare(b.date));
  useEffect(() => {
    setSelected(new Set(candidates.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, dateFrom, dateTo, sessions.length]);
  const student = students.find((s) => s.id === studentId);
  const chosen = candidates.filter((c) => selected.has(c.id));
  const totalHours = chosen.reduce((sum, c) => sum + c.hours, 0);
  const totalAmount = chosen.reduce((sum, c) => sum + c.hours * c.rate, 0);

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  useEffect(() => {
    if (!student || chosen.length === 0 || !canvasRef.current) return;
    drawSummaryCard(canvasRef.current, {
      kicker: '📚  แจ้งค่าสอน',
      title: student.name,
      subtitle: `${fmtDateThai(dateFrom)} – ${fmtDateThai(dateTo)}`,
      rows: chosen.map((c) => ({ left: fmtDateThai(c.date), right: `${fmtHours(c.hours)} ชม. · ${fmtMoney(c.hours * c.rate)}` })),
      footerSmall: `รวม ${chosen.length} ครั้ง (${fmtHours(totalHours)} ชม.)`,
      footerBig: `ยอดที่ต้องชำระ ${fmtMoney(totalAmount)}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, dateFrom, dateTo, selected, sessions]);

  const message = student && chosen.length > 0
    ? `📚 แจ้งค่าสอน ${student.name}\n` +
      chosen.map((c) => `- ${fmtDateThai(c.date)} ${fmtHours(c.hours)} ชม. (${fmtMoney(c.hours * c.rate)})`).join('\n') +
      `\nรวม ${fmtHours(totalHours)} ชม. = ${fmtMoney(totalAmount)}`
    : '';

  const copyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('คัดลอกรูปแล้ว ไปวางในแชท LINE ได้เลย');
      } catch (e) {
        showToast('อุปกรณ์นี้อาจไม่รองรับการคัดลอกรูป ลองดาวน์โหลดแทน');
      }
    });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !student) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `แจ้งค่าสอน-${student.name}-${dateFrom}-ถึง-${dateTo}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message);
      showToast('คัดลอกข้อความแล้ว');
    } catch {
      showToast('คัดลอกไม่สำเร็จ ลองเลือกข้อความเอง');
    }
  };

  const markInvoiced = () => {
    updateSessions(sessions.map((s) => (selected.has(s.id) ? { ...s, invoiced: true } : s)));
    showToast('ทำเครื่องหมายว่าแจ้งแล้ว');
  };

  return (
    <div>
      <SectionTitle sub="เลือกนักเรียนและช่วงเวลา เพื่อสร้างเป็นรูปภาพแจ้งค่าสอนไว้ส่งเอง">แจ้งค่าสอน</SectionTitle>

      {students.length === 0 ? (
        <EmptyState text="เพิ่มนักเรียนก่อนจึงจะแจ้งค่าสอนได้" />
      ) : (
        <>
          <Card className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="นักเรียน">
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg">
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

          {candidates.length === 0 ? (
            <EmptyState text="ไม่มีคาบสอนที่ยังไม่ได้แจ้งในช่วงเวลานี้" />
          ) : (
            <>
              <Card className="mb-4">
                <div className="text-sm font-medium mb-2">เลือกคาบที่จะแจ้ง</div>
                <div className="flex flex-col gap-1">
                  {candidates.map((c) => (
                    <label key={c.id} className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                        {fmtDateThai(c.date)} · {fmtHours(c.hours)} ชม.
                      </span>
                      <span style={{ color: C.gold }}>{fmtMoney(c.hours * c.rate)}</span>
                    </label>
                  ))}
                </div>
              </Card>

              {chosen.length > 0 && (
                <div className="mb-4 overflow-x-auto flex justify-center">
                  <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: '20px' }} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={copyImage} disabled={chosen.length === 0} style={{ background: C.pine, color: C.paper }} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
                  <Copy size={15} /> คัดลอกรูป
                </button>
                <button onClick={downloadImage} disabled={chosen.length === 0} style={{ border: `1px solid ${C.line}`, color: C.inkSoft }} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
                  <Download size={15} /> ดาวน์โหลดรูป
                </button>
                <button onClick={copyText} disabled={!message} style={{ color: C.inkSoft }} className="text-sm font-medium px-3 py-2 underline disabled:opacity-40">
                  คัดลอกเป็นข้อความแทน
                </button>
                <button onClick={markInvoiced} disabled={chosen.length === 0} style={{ border: `1px solid ${C.line}`, color: C.inkSoft }} className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
                  ทำเครื่องหมายว่าแจ้งแล้ว
                </button>
              </div>
            </>
          )}
        </>
      )}
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
    const lines = [header.join(',')];
    rows.forEach((s) => {
      const name = students.find((st) => st.id === s.studentId)?.name || s.studentName || '';
      const amount = s.hours * s.rate;
      const cells = [s.date, name, s.hours, s.rate, amount, (s.note || '').replace(/,/g, ' '), s.invoiced ? 'ใช่' : 'ไม่', s.paid ? 'ใช่' : 'ไม่'];
      lines.push(cells.join(','));
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
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(35,40,43,0.4)' }} onClick={onClose}>
      <div
        style={{ background: C.surface, maxHeight: '90vh' }}
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto"
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