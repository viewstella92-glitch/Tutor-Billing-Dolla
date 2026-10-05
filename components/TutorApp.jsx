'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, Receipt, Download,
  Plus, Trash2, Check, Copy, X, Pencil, Circle, CheckCircle2, Send
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
function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function daysBetween(dateStr, todayIso) {
  return Math.floor((new Date(todayIso) - new Date(dateStr)) / 86400000);
}

function mapStudentRow(row) {
  return { id: row.id, name: row.name, rate: Number(row.rate) };
}

function mapScheduleRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    recurring: row.recurring,
    day: row.day ?? undefined,
    date: row.date ?? undefined,
    start: String(row.start_time).slice(0, 5),
    end: String(row.end_time).slice(0, 5),
  };
}

function mapSessionRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name || '',
    date: row.session_date,
    hours: Number(row.hours),
    rate: Number(row.rate),
    note: row.note || '',
    invoiced: Boolean(row.invoiced),
    paid: Boolean(row.paid),
    sourceSlotId: row.source_slot_id || undefined,
  };
}

function localData() {
  try {
    return {
      students: JSON.parse(window.localStorage.getItem('tutor-app:students') || '[]'),
      schedule: JSON.parse(window.localStorage.getItem('tutor-app:schedule') || '[]'),
      sessions: JSON.parse(window.localStorage.getItem('tutor-app:sessions') || '[]'),
    };
  } catch {
    return { students: [], schedule: [], sessions: [] };
  }
}

function normalizeLegacyData(data) {
  const studentMap = new Map();
  const slotMap = new Map();

  const students = data.students.map((s) => {
    const id = uid();
    studentMap.set(s.id, id);
    return { id, name: s.name, rate: Number(s.rate) };
  });

  const schedule = data.schedule.map((s) => {
    const id = uid();
    slotMap.set(s.id, id);
    return {
      id,
      studentId: studentMap.get(s.studentId) || s.studentId,
      recurring: Boolean(s.recurring),
      day: s.recurring ? Number(s.day) : undefined,
      date: s.recurring ? undefined : s.date,
      start: s.start,
      end: s.end,
    };
  });

  const sessions = data.sessions.map((s) => ({
    id: uid(),
    studentId: studentMap.get(s.studentId) || null,
    studentName: s.studentName || '',
    date: s.date,
    hours: Number(s.hours),
    rate: Number(s.rate),
    note: s.note || '',
    invoiced: Boolean(s.invoiced),
    paid: Boolean(s.paid),
    sourceSlotId: s.sourceSlotId ? (slotMap.get(s.sourceSlotId) || null) : null,
  }));

  return { students, schedule, sessions };
}

async function loadTutorData(userId) {
  const [studentsRes, scheduleRes, sessionsRes] = await Promise.all([
    supabase.from('tutor_students').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('tutor_schedule').select('*').eq('user_id', userId),
    supabase.from('tutor_sessions').select('*').eq('user_id', userId).order('session_date', { ascending: false }),
  ]);

  if (studentsRes.error) throw studentsRes.error;
  if (scheduleRes.error) throw scheduleRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  const dbEmpty = studentsRes.data.length === 0 && scheduleRes.data.length === 0 && sessionsRes.data.length === 0;
  const legacy = localData();

  if (dbEmpty && (legacy.students.length || legacy.schedule.length || legacy.sessions.length)) {
    const imported = normalizeLegacyData(legacy);
    await replaceTutorData(userId, imported);
    try {
      window.localStorage.removeItem('tutor-app:students');
      window.localStorage.removeItem('tutor-app:schedule');
      window.localStorage.removeItem('tutor-app:sessions');
    } catch {}
    return imported;
  }

  return {
    students: studentsRes.data.map(mapStudentRow),
    schedule: scheduleRes.data.map(mapScheduleRow),
    sessions: sessionsRes.data.map(mapSessionRow),
  };
}

async function replaceTutorData(userId, data) {
  const studentRows = data.students.map((s) => ({
    id: s.id, user_id: userId, name: s.name, rate: Number(s.rate),
  }));
  const scheduleRows = data.schedule.map((s) => ({
    id: s.id,
    user_id: userId,
    student_id: s.studentId,
    recurring: Boolean(s.recurring),
    day: s.recurring ? Number(s.day) : null,
    date: s.recurring ? null : s.date,
    start_time: s.start,
    end_time: s.end,
  }));
  const sessionRows = data.sessions.map((s) => ({
    id: s.id,
    user_id: userId,
    student_id: s.studentId || null,
    student_name: s.studentName || '',
    session_date: s.date,
    hours: Number(s.hours),
    rate: Number(s.rate),
    note: s.note || '',
    invoiced: Boolean(s.invoiced),
    paid: Boolean(s.paid),
    source_slot_id: s.sourceSlotId || null,
  }));

  const { data: existingStudents, error: esErr } = await supabase.from('tutor_students').select('id').eq('user_id', userId);
  if (esErr) throw esErr;
  const keepStudentIds = new Set(studentRows.map((r) => r.id));
  for (const row of existingStudents || []) {
    if (!keepStudentIds.has(row.id)) {
      const { error } = await supabase.from('tutor_students').delete().eq('user_id', userId).eq('id', row.id);
      if (error) throw error;
    }
  }
  if (studentRows.length) {
    const { error } = await supabase.from('tutor_students').upsert(studentRows);
    if (error) throw error;
  }

  const { data: existingSchedule, error: egErr } = await supabase.from('tutor_schedule').select('id').eq('user_id', userId);
  if (egErr) throw egErr;
  const keepScheduleIds = new Set(scheduleRows.map((r) => r.id));
  for (const row of existingSchedule || []) {
    if (!keepScheduleIds.has(row.id)) {
      const { error } = await supabase.from('tutor_schedule').delete().eq('user_id', userId).eq('id', row.id);
      if (error) throw error;
    }
  }
  if (scheduleRows.length) {
    const { error } = await supabase.from('tutor_schedule').upsert(scheduleRows);
    if (error) throw error;
  }

  const { data: existingSessions, error: exErr } = await supabase.from('tutor_sessions').select('id').eq('user_id', userId);
  if (exErr) throw exErr;
  const keepSessionIds = new Set(sessionRows.map((r) => r.id));
  for (const row of existingSessions || []) {
    if (!keepSessionIds.has(row.id)) {
      const { error } = await supabase.from('tutor_sessions').delete().eq('user_id', userId).eq('id', row.id);
      if (error) throw error;
    }
  }
  if (sessionRows.length) {
    const { error } = await supabase.from('tutor_sessions').upsert(sessionRows);
    if (error) throw error;
  }
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setMessage('สมัครสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ');
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setError(e.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: C.paper, color: C.ink }} className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <div style={{ color: C.pine }} className="text-xl font-semibold">สมุดสอนพิเศษ</div>
        <div style={{ color: C.inkSoft }} className="text-sm mt-1 mb-5">เข้าสู่ระบบเพื่อเก็บข้อมูลบนฐานข้อมูลกลาง</div>
        <Field label="อีเมล">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
        </Field>
        <Field label="รหัสผ่าน">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
        </Field>
        {error && <div style={{ color: C.brick }} className="text-sm mb-3">{error}</div>}
        {message && <div style={{ color: C.pine }} className="text-sm mb-3">{message}</div>}
        <button onClick={submit} disabled={busy || !email || password.length < 6} style={{ background: C.pine, color: C.paper }} className="w-full text-sm font-medium py-2.5 rounded-lg disabled:opacity-40">
          {busy ? 'กำลังดำเนินการ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
        </button>
        <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }} style={{ color: C.pineDark }} className="w-full text-xs font-medium mt-3 underline">
          {mode === 'login' ? 'ยังไม่มีบัญชี? สร้างบัญชี' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
      </Card>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        setUser(data.session.user);
        try {
          const loadedData = await loadTutorData(data.session.user.id);
          if (!mounted) return;
          setStudents(loadedData.students);
          setSchedule(loadedData.schedule);
          setSessions(loadedData.sessions);
        } catch (e) {
          console.error(e);
        }
      }
      setAuthChecked(true);
      setLoaded(true);
    };

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        setStudents([]);
        setSchedule([]);
        setSessions([]);
        setLoaded(true);
        return;
      }
      setUser(session.user);
      try {
        const loadedData = await loadTutorData(session.user.id);
        if (!mounted) return;
        setStudents(loadedData.students);
        setSchedule(loadedData.schedule);
        setSessions(loadedData.sessions);
      } catch (e) {
        console.error(e);
      }
      setLoaded(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const updateStudents = async (next) => {
    setStudents(next);
    if (!user) return;
    try {
      const currentIds = new Set(next.map((s) => s.id));
      const { data: existing, error: readError } = await supabase.from('tutor_students').select('id').eq('user_id', user.id);
      if (readError) throw readError;
      for (const row of existing || []) {
        if (!currentIds.has(row.id)) {
          const { error } = await supabase.from('tutor_students').delete().eq('user_id', user.id).eq('id', row.id);
          if (error) throw error;
        }
      }
      const rows = next.map((s) => ({ id: s.id, user_id: user.id, name: s.name, rate: Number(s.rate) }));
      if (rows.length) {
        const { error } = await supabase.from('tutor_students').upsert(rows);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      showToast('บันทึกข้อมูลไม่สำเร็จ');
    }
  };

  const updateSchedule = async (next) => {
    setSchedule(next);
    if (!user) return;
    try {
      const currentIds = new Set(next.map((s) => s.id));
      const { data: existing, error: readError } = await supabase.from('tutor_schedule').select('id').eq('user_id', user.id);
      if (readError) throw readError;
      for (const row of existing || []) {
        if (!currentIds.has(row.id)) {
          const { error } = await supabase.from('tutor_schedule').delete().eq('user_id', user.id).eq('id', row.id);
          if (error) throw error;
        }
      }
      const rows = next.map((s) => ({
        id: s.id, user_id: user.id, student_id: s.studentId, recurring: Boolean(s.recurring),
        day: s.recurring ? Number(s.day) : null, date: s.recurring ? null : s.date,
        start_time: s.start, end_time: s.end,
      }));
      if (rows.length) {
        const { error } = await supabase.from('tutor_schedule').upsert(rows);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      showToast('บันทึกตารางสอนไม่สำเร็จ');
    }
  };

  const updateSessions = async (next) => {
    setSessions(next);
    if (!user) return;
    try {
      const currentIds = new Set(next.map((s) => s.id));
      const { data: existing, error: readError } = await supabase.from('tutor_sessions').select('id').eq('user_id', user.id);
      if (readError) throw readError;
      for (const row of existing || []) {
        if (!currentIds.has(row.id)) {
          const { error } = await supabase.from('tutor_sessions').delete().eq('user_id', user.id).eq('id', row.id);
          if (error) throw error;
        }
      }
      const rows = next.map((s) => ({
        id: s.id, user_id: user.id, student_id: s.studentId || null, student_name: s.studentName || '',
        session_date: s.date, hours: Number(s.hours), rate: Number(s.rate), note: s.note || '',
        invoiced: Boolean(s.invoiced), paid: Boolean(s.paid), source_slot_id: s.sourceSlotId || null,
      }));
      if (rows.length) {
        const { error } = await supabase.from('tutor_sessions').upsert(rows);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      showToast('บันทึกคาบสอนไม่สำเร็จ');
    }
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

  if (!authChecked || !loaded) {
    return (
      <div style={{ background: C.paper, color: C.inkSoft }} className="w-full min-h-screen flex items-center justify-center text-sm">
        กำลังเชื่อมต่อฐานข้อมูล...
      </div>
    );
  }

  if (!user) return <AuthScreen />;

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
              <button key={n.id} onClick={() => setTab(n.id)} style={active ? { background: C.pineTint, color: C.pineDark } : { color: C.inkSoft }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left">
                <Icon size={17} />{n.label}
              </button>
            );
          })}
        </nav>
        <button onClick={() => supabase.auth.signOut()} style={{ color: C.inkSoft }} className="mt-auto mx-2 text-xs text-left py-2">
          ออกจากระบบ
        </button>
      </div>

      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.paper }} className="md:hidden sticky top-0 z-20 overflow-x-auto">
        <div className="flex gap-1 px-3 py-3 min-w-max">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={active ? { background: C.pineTint, color: C.pineDark } : { color: C.inkSoft }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                <Icon size={16} />{n.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-10 md:py-10 max-w-4xl mx-auto w-full">
        {tab === 'dashboard' && <Dashboard students={students} sessions={sessions} schedule={schedule} updateSessions={updateSessions} getStudent={getStudent} showToast={showToast} setTab={setTab} />}
        {tab === 'students' && <StudentsTab students={students} updateStudents={updateStudents} sessions={sessions} />}
        {tab === 'schedule' && <ScheduleTab students={students} schedule={schedule} updateSchedule={updateSchedule} sessions={sessions} updateSessions={updateSessions} getStudent={getStudent} showToast={showToast} />}
        {tab === 'calendar' && <CalendarTab students={students} schedule={schedule} showToast={showToast} />}
        {tab === 'sessions' && <SessionsTab students={students} sessions={sessions} updateSessions={updateSessions} getStudent={getStudent} showToast={showToast} />}
        {tab === 'invoice' && <InvoiceTab students={students} sessions={sessions} updateSessions={updateSessions} showToast={showToast} />}
        {tab === 'export' && <ExportTab students={students} sessions={sessions} />}
      </div>

      {toast && <div style={{ background: C.ink, color: C.paper }} className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm shadow-lg z-50">{toast}</div>}
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
    ];
    updateSessions(next);
    showToast(`บันทึกคาบสอนของ ${student.name} แล้ว`);
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
  const [editing, setEditing] = useState(null); // {id?, name, rate}
  const [form, setForm] = useState({ name: '', rate: '' });
  const [historyStudent, setHistoryStudent] = useState(null);

  const openNew = () => { setForm({ name: '', rate: '' }); setEditing('new'); };
  const openEdit = (s) => { setForm({ name: s.name, rate: String(s.rate) }); setEditing(s.id); };

  const save = () => {
    const name = form.name.trim();
    const rate = parseFloat(form.rate);
    if (!name || !rate || rate <= 0) return;
    if (editing === 'new') {
      updateStudents([...students, { id: uid(), name, rate }]);
    } else {
      updateStudents(students.map((s) => (s.id === editing ? { ...s, name, rate } : s)));
    }
    setEditing(null);
  };

  const remove = (id) => {
    if (!confirm('ลบนักเรียนคนนี้? ประวัติการสอนเดิมจะยังอยู่')) return;
    updateStudents(students.filter((s) => s.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <SectionTitle sub="อัตราค่าสอนต่อชั่วโมง ตั้งได้เฉพาะรายคน">นักเรียน</SectionTitle>
        <button onClick={openNew} style={{ background: C.pine, color: C.paper }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg h-fit">
          <Plus size={16} /> เพิ่มนักเรียน
        </button>
      </div>

      {students.length === 0 && <EmptyState text="ยังไม่มีนักเรียน กดปุ่ม 'เพิ่มนักเรียน' เพื่อเริ่มต้น" />}

      <div className="flex flex-col gap-2">
        {students.map((s) => (
          <Card key={s.id} className="flex items-center justify-between">
            <div>
              <div className="font-medium">{s.name}</div>
              <div style={{ color: C.gold }} className="text-sm">{fmtMoney(s.rate)} / ชม.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setHistoryStudent(s.id)} style={{ color: C.inkSoft }} className="p-2 rounded-lg"><ClipboardList size={16} /></button>
              <button onClick={() => openEdit(s)} style={{ color: C.inkSoft }} className="p-2 rounded-lg"><Pencil size={16} /></button>
              <button onClick={() => remove(s.id)} style={{ color: C.brick }} className="p-2 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่มนักเรียน' : 'แก้ไขนักเรียน'}>
          <Field label="ชื่อนักเรียน">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น น้องมิว" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <Field label="อัตราค่าสอน (บาท/ชม.)">
            <input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="400" style={inputStyle} className="w-full text-sm px-3 py-2 rounded-lg" />
          </Field>
          <ModalActions onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}

      {historyStudent && (() => {
        const student = students.find((s) => s.id === historyStudent);
        const history = sessions
          .filter((s) => s.studentId === historyStudent)
          .sort((a, b) => b.date.localeCompare(a.date));
        const totalAll = history.reduce((sum, s) => sum + s.hours * s.rate, 0);
        return (
          <Modal onClose={() => setHistoryStudent(null)} title={`ประวัติการสอน · ${student?.name || ''}`}>
            {history.length === 0 ? (
              <div style={{ color: C.inkSoft }} className="text-sm">ยังไม่มีประวัติการสอน</div>
            ) : (
              <>
                <div style={{ color: C.inkSoft }} className="text-xs mb-3">
                  รวม {history.length} คาบ ตั้งแต่เริ่มเรียน · {fmtMoney(totalAll)}
                </div>
                <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                  {history.map((s, i) => (
                    <div key={s.id} style={{ borderBottom: i < history.length - 1 ? `1px dashed ${C.line}` : 'none' }} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{fmtDateThai(s.date)} · {fmtHours(s.hours)} ชม.</span>
                        <span style={{ color: C.gold }}>{fmtMoney(s.hours * s.rate)}</span>
                      </div>
                      {s.note && <div style={{ color: C.inkSoft }} className="text-xs mt-0.5">{s.note}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex mt-4">
              <button onClick={() => setHistoryStudent(null)} style={{ border: `1px solid ${C.line}`, color: C.inkSoft }} className="flex-1 text-sm font-medium py-2 rounded-lg">ปิด</button>
            </div>
          </Modal>
        );
      })()}
    </div>
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
    };
    updateSchedule([...schedule, slot]);
    setShowForm(false);
  };

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
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(24, y + rowH);
      ctx.lineTo(width - 24, y + rowH);
      ctx.stroke();
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
