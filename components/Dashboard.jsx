'use client';

import { useMemo } from 'react';
import {
  CalendarDays, CircleDollarSign, ClipboardList, Receipt, Users,
  ArrowRight, CheckCircle2, Clock3, Plus, Ban, BookOpen, TrendingUp
} from 'lucide-react';
import { buildMonthlyForecast, dateKey, monthKey } from '../lib/forecast';

const money = n => '฿' + Math.round(Number(n) || 0).toLocaleString('th-TH');
const dateLabel = d => new Date(d + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
const timeLabel = v => String(v || '').slice(0, 5);
const dayIndex = d => (d.getDay() + 6) % 7;
const todayKey = () => dateKey(new Date());

export default function Dashboard({
  students = [], schedule = [], sessions = [], exceptions = [], invoices = [],
  settings = {}, lang = 'th', setTab, showToast, updateExceptions, onOpenLessonForm
}) {
  const en = lang === 'en';
  const today = todayKey();
  const month = monthKey(new Date());
  const activeStudents = students.filter(s => (s.status || 'active') === 'active');
  const thisMonthSessions = sessions.filter(s => String(s.date || '').slice(0, 7) === month);
  const earned = thisMonthSessions.reduce((sum, s) => sum + Number(s.hours || 0) * Number(s.rate || 0), 0);
  const unpaidSessions = sessions.filter(s => !s.paid);
  const unpaid = unpaidSessions.reduce((sum, s) => sum + Number(s.hours || 0) * Number(s.rate || 0), 0);
  const forecast = useMemo(() => buildMonthlyForecast({ month, students, schedule, sessions, exceptions, today }), [month, students, schedule, sessions, exceptions, today]);
  const expected = earned + forecast.forecast.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const colors = ['#2E5E45', '#447DA5', '#A8781F', '#8D6E9D', '#B85C45', '#3B8C8C'];

  const upcoming = useMemo(() => {
    const rows = [];
    for (let offset = 0; offset < 8; offset++) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const key = dateKey(d);
      const dow = dayIndex(d);
      schedule.forEach(slot => {
        if (!(slot.recurring && Number(slot.day) === dow) && !( !slot.recurring && slot.date === key)) return;
        const student = students.find(s => s.id === slot.studentId);
        if (!student || (student.status || 'active') !== 'active') return;
        const exception = exceptions.find(e => e.slotId === slot.id && e.date === key && e.status === 'cancelled');
        const session = sessions.find(s => s.sourceSlotId === slot.id && s.date === key);
        rows.push({ key, slot, student, exception, session });
      });
    }
    return rows.filter(r => !r.exception)
      .sort((a, b) => a.key.localeCompare(b.key) || String(a.slot.start).localeCompare(String(b.slot.start)))
      .slice(0, 6);
  }, [schedule, students, sessions, exceptions]);

  const pendingRecords = upcoming.filter(r => !r.session).length;
  const cancelLesson = async row => {
    if (!updateExceptions || row.session || row.exception) return;
    if (typeof window !== 'undefined' && !window.confirm((en ? 'Cancel lesson with ' : 'ยืนยันยกเลิกคาบของ ') + row.student.name + ' ' + dateLabel(row.key) + ' ' + timeLabel(row.slot.start) + '–' + timeLabel(row.slot.end) + '?')) return;
    const next = [...exceptions, { id: crypto.randomUUID(), slotId: row.slot.id, date: row.key, status: 'cancelled' }];
    const ok = await updateExceptions(next);
    if (ok) showToast?.(en ? 'Lesson cancelled' : 'ยกเลิกคาบสอนแล้ว');
  };

  const shortcuts = [
    { label: en ? 'Add lesson record' : 'บันทึกคาบสอน', hint: en ? 'Record what was taught' : 'เก็บรายละเอียดหลังสอน', icon: ClipboardList, action: () => setTab('teaching'), primary: true },
    { label: en ? 'Manage students' : 'ข้อมูลนักเรียน', hint: en ? 'Profiles and rates' : 'ข้อมูลและอัตราค่าสอน', icon: Users, action: () => setTab('students') },
    { label: en ? 'Send tuition notice' : 'แจ้งค่าสอน', hint: en ? 'Prepare parent invoice' : 'สรุปยอดส่งผู้ปกครอง', icon: Receipt, action: () => setTab('invoice') }
  ];

  return (
    <main className="td-dashboard">
      <header className="td-hero">
        <div className="td-hero-copy">
          <div className="td-eyebrow"><span className="td-live-dot" /> TUTOR DESK <span>·</span> {en ? 'YOUR TEACHING SPACE' : 'พื้นที่จัดการงานสอน'}</div>
          <h1>{en ? 'A calmer way to manage tutoring.' : 'จัดการงานสอนให้ง่ายขึ้น'}</h1>
          <p>{en ? 'Your schedule, students and tuition at a glance.' : 'เห็นตารางสอน นักเรียน และรายรับได้ในที่เดียว ไม่ต้องไล่หาหลายหน้า'}</p>
          <div className="td-date"><CalendarDays size={15} /> {new Date().toLocaleDateString(en ? 'en-GB' : 'th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: en ? 'numeric' : 'numeric' })}</div>
        </div>
        <button type="button" className="td-primary-button" onClick={() => setTab('teaching')}><Plus size={17} /> {en ? 'Manage lessons' : 'จัดการคาบสอน'} <ArrowRight size={15} /></button>
        <div className="td-hero-decoration" aria-hidden="true"><span /><span /><span /></div>
      </header>

      <section className="td-kpis" aria-label={en ? 'Monthly overview' : 'ภาพรวมเดือนนี้'}>
        <article className="td-kpi td-kpi-green"><div className="td-kpi-label"><span>{en ? 'Earned this month' : 'รายได้ที่บันทึกแล้ว'}</span><CircleDollarSign size={18} /></div><strong>{money(earned)}</strong><small>{thisMonthSessions.length} {en ? 'lessons recorded' : 'คาบที่บันทึกแล้ว'}</small></article>
        <article className="td-kpi td-kpi-blue"><div className="td-kpi-label"><span>{en ? 'Expected this month' : 'คาดว่าจะได้รับเดือนนี้'}</span><TrendingUp size={18} /></div><strong>{money(expected)}</strong><small>{en ? 'Recorded + upcoming forecast' : 'รายได้จริงรวมกับคาบตามแผน'}</small></article>
        <article className="td-kpi td-kpi-amber"><div className="td-kpi-label"><span>{en ? 'Unpaid' : 'ยอดค้างชำระ'}</span><Receipt size={18} /></div><strong>{money(unpaid)}</strong><small>{unpaidSessions.length} {en ? 'unpaid lessons' : 'คาบที่ยังไม่ชำระ'}</small></article>
        <article className="td-kpi td-kpi-violet"><div className="td-kpi-label"><span>{en ? 'Active students' : 'นักเรียนที่กำลังสอน'}</span><Users size={18} /></div><strong>{activeStudents.length}</strong><small>{en ? 'Current student profiles' : 'คนในระบบ'}</small></article>
      </section>

      <section className="td-content-grid">
        <div className="td-panel td-upcoming-panel">
          <div className="td-panel-heading"><div><span className="td-section-kicker">{en ? 'COMING UP' : 'เตรียมตัวล่วงหน้า'}</span><h2>{en ? 'Upcoming lessons' : 'คาบสอนที่กำลังจะมาถึง'}</h2><p>{en ? 'Next 8 days · up to 6 lessons' : '8 วันข้างหน้า · แสดงไม่เกิน 6 คาบ'}</p></div><button className="td-link-button" onClick={() => setTab('teaching')}>{en ? 'Open calendar' : 'เปิดปฏิทิน'} <ArrowRight size={15} /></button></div>
          {upcoming.length === 0 ? <div className="td-empty"><div className="td-empty-icon"><BookOpen size={22} /></div><strong>{en ? 'No upcoming lessons' : 'ยังไม่มีคาบสอนที่กำลังจะมาถึง'}</strong><p>{en ? 'Add a recurring or one-time lesson to your calendar.' : 'เพิ่มคาบเรียนประจำหรือคาบเฉพาะวันไว้ในปฏิทินได้เลย'}</p><button onClick={() => setTab('teaching')}>{en ? 'Set up schedule' : 'ตั้งตารางสอน'}</button></div> : <div className="td-upcoming-list">{upcoming.map((row, i) => <article key={row.slot.id + '-' + row.key} className="td-upcoming-row"><div className="td-date-block"><strong>{new Date(row.key + 'T12:00:00').getDate()}</strong><span>{new Date(row.key + 'T12:00:00').toLocaleDateString(en ? 'en-GB' : 'th-TH', { month: 'short' })}</span></div><div className="td-upcoming-time"><Clock3 size={14} /><span>{timeLabel(row.slot.start)}–{timeLabel(row.slot.end)}</span></div><div className="td-upcoming-student"><span className="td-avatar" style={{ '--student-color': colors[i % colors.length] }}>{row.student.name.trim().slice(0, 1)}</span><div><strong>{row.student.name}</strong><small>{row.student.subjects?.join(' · ') || row.student.grade || (en ? 'Tutoring session' : 'เรียนพิเศษ')}</small></div></div><div className="td-upcoming-state">{row.session ? <span className="td-state-done"><CheckCircle2 size={14} /> {en ? 'Recorded' : 'บันทึกแล้ว'}</span> : <span className="td-state-pending">{en ? 'To record' : 'รอบันทึก'}</span>}</div><div className="td-row-actions">{!row.session && <><button title={en ? 'Record lesson' : 'บันทึกคาบสอน'} onClick={() => onOpenLessonForm?.(row.slot, row.key)}><ClipboardList size={15} /></button><button title={en ? 'Cancel lesson' : 'ยกเลิกคาบ'} onClick={() => cancelLesson(row)}><Ban size={15} /></button></>}</div></article>)}</div>}
          <div className="td-panel-footer"><span>{pendingRecords} {en ? 'upcoming lessons need a record' : 'คาบที่ยังต้องบันทึกหลังสอน'}</span><button onClick={() => setTab('teaching')}>{en ? 'View all lessons' : 'ดูคาบทั้งหมด'} <ArrowRight size={14} /></button></div>
        </div>

        <aside className="td-side-column">
          <section className="td-panel td-shortcuts-panel"><div className="td-panel-heading"><div><span className="td-section-kicker">{en ? 'QUICK ACCESS' : 'ทางลัด'}</span><h2>{en ? 'Get things done' : 'ทำงานต่อได้ทันที'}</h2></div></div><div className="td-shortcut-list">{shortcuts.map(({ label, hint, icon: Icon, action, primary }) => <button key={label} className={'td-shortcut' + (primary ? ' is-primary' : '')} onClick={action}><span className="td-shortcut-icon"><Icon size={18} /></span><span className="td-shortcut-copy"><strong>{label}</strong><small>{hint}</small></span><ArrowRight size={16} className="td-shortcut-arrow" /></button>)}</div></section>
          <section className="td-panel td-focus-panel"><div className="td-panel-heading"><div><span className="td-section-kicker">{en ? 'THIS MONTH' : 'โฟกัสเดือนนี้'}</span><h2>{en ? 'A quick check-in' : 'เช็กงานที่ค้างอยู่'}</h2></div></div><div className="td-focus-row"><span className="td-focus-icon"><ClipboardList size={17} /></span><div><strong>{forecast.pending.length} {en ? 'lessons to review' : 'คาบรอบันทึกรายละเอียด'}</strong><small>{en ? 'Review recent teaching notes' : 'กลับไปบันทึกหัวข้อที่สอนและผลการเรียน'}</small></div><button onClick={() => setTab('teaching')} aria-label={en ? 'Open lessons' : 'เปิดคาบสอน'}><ArrowRight size={15} /></button></div><div className="td-focus-row"><span className="td-focus-icon td-focus-icon-amber"><Receipt size={17} /></span><div><strong>{unpaidSessions.length} {en ? 'unpaid lessons' : 'คาบที่ยังไม่ชำระ'}</strong><small>{en ? 'Follow up on tuition payments' : 'ตรวจยอดและเตรียมแจ้งค่าสอน'}</small></div><button onClick={() => setTab('invoice')} aria-label={en ? 'Open invoices' : 'เปิดใบแจ้งค่าสอน'}><ArrowRight size={15} /></button></div></section>
        </aside>
      </section>
    </main>
  );
}
