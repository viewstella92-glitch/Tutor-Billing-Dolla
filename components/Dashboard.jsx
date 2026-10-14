'use client';

import { useMemo } from 'react';
import { CalendarDays, CircleDollarSign, ClipboardList, Receipt, Users, ArrowRight, CheckCircle2, Circle, Ban, BookOpen, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { buildMonthlyForecast, buildNineMonthChart, dateKey, monthKey } from '../lib/forecast';

const C={paper:'#FAF6EC',ink:'#23282B',soft:'#6B7270',line:'#DED4B8',surface:'#fff',pine:'#2E5E45',dark:'#20402F',tint:'#E7EFE7',blue:'#B8D9EA',blueText:'#365F79',gold:'#A8781F',goldTint:'#F5EBD4',brick:'#A0392A',brickTint:'#F5E4DF'};
const COLORS=['#2E5E45','#447DA5','#A8781F','#8D6E9D','#B85C45','#3B8C8C','#6C7C45','#B36A8B'];
const WORDS={
 th:{title:'ภาพรวม',subtitle:'รายได้จริง คาดการณ์ และรายการที่ต้องจัดการ',earned:'ได้แล้วเดือนนี้',expected:'คาดว่าจะได้เดือนนี้ทั้งหมด',unpaid:'ค้างชำระ',pending:'รอบันทึก',today:'วันนี้',noToday:'วันนี้ไม่มีคาบสอน',next:'คาบถัดไป',record:'สอนแล้ว',fullForm:'บันทึกรายละเอียด',cancel:'ยกเลิก',cancelled:'ยกเลิกแล้ว',noStudents:'ยังไม่มีนักเรียน',chart:'รายได้จริงและคาดการณ์ 9 เดือน',actual:'ยืนยันแล้ว',forecast:'คาดการณ์',todo:'รายการที่ต้องทำ',todoInvoice:'ใบแจ้งค่าสอนค้างชำระ',todoLessons:'คาบที่รอบันทึก',todoStudents:'นักเรียนที่ยังไม่มีตารางสอน',allDone:'ทุกอย่างเรียบร้อย',incomeByStudent:'รายได้แยกตามนักเรียนเดือนนี้',shortcuts:'ทางลัด',goPlan:'จัดการการสอน',goInvoice:'แจ้งค่าสอน',goReports:'ข้อมูลนักเรียน',hours:'ชม.',lessons:'คาบ',noSchedule:'ยังไม่มีตารางสอน',noIncome:'เดือนนี้ยังไม่มีรายได้ที่บันทึกไว้',paid:'ชำระแล้ว',unpaidLabel:'ค้างชำระ',from:'ตั้งแต่',nextLabel:'คาบถัดไป'},
 en:{title:'Dashboard',subtitle:'Actual income, forecast and actions to take',earned:'Earned this month',expected:'Expected total this month',unpaid:'Unpaid',pending:'Needs logging',today:'Today',noToday:'No lessons today',next:'Next lesson',record:'Taught',fullForm:'Full lesson details',cancel:'Cancel',cancelled:'Cancelled',noStudents:'No students yet',chart:'Actual and forecast income · 9 months',actual:'Confirmed',forecast:'Forecast',todo:'To do',todoInvoice:'Unpaid invoices',todoLessons:'Lessons needing a record',todoStudents:'Students without a schedule',allDone:'Everything is up to date',incomeByStudent:'Income by student this month',shortcuts:'Shortcuts',goPlan:'Teaching workspace',goInvoice:'Invoices',goReports:'Students',hours:'hrs',lessons:'lessons',noSchedule:'No lessons scheduled',noIncome:'No recorded income this month',paid:'Paid',unpaidLabel:'Unpaid',from:'Since',nextLabel:'Next lesson'}
};
const money=(n,lang)=>lang==='en'?'THB '+Math.round(Number(n)||0).toLocaleString('en-US'):'฿'+Math.round(Number(n)||0).toLocaleString('th-TH');
const fmtDate=(d,lang)=>new Date(d+'T12:00:00').toLocaleDateString(lang==='en'?'en-GB':'th-TH',{day:'numeric',month:'short',year:'numeric'});
const fmtTime=v=>String(v||'').slice(0,5)||'--:--';

export default function Dashboard({students=[],schedule=[],sessions=[],exceptions=[],invoices=[],settings={},lang='th',setTab,showToast,updateExceptions,onOpenLessonForm}){
 const t=WORDS[lang]||WORDS.th;
 const today=dateKey(new Date()),month=monthKey(new Date());
 const model=useMemo(()=>buildMonthlyForecast({month,students,schedule,sessions,exceptions,today}),[month,students,schedule,sessions,exceptions,today]);
 const chart=useMemo(()=>buildNineMonthChart({month,students,schedule,sessions,exceptions,today,lang}),[month,students,schedule,sessions,exceptions,today]);
 const thisMonthSessions=sessions.filter(s=>s.date?.slice(0,7)===month);
 const earned=thisMonthSessions.reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
 const expected=earned+model.forecast.reduce((sum,r)=>sum+r.amount,0);
 const unpaidSessions=sessions.filter(s=>!s.paid);
 const unpaidTotal=unpaidSessions.reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
 const todayIdx=(new Date().getDay()+6)%7;
 const todaySlots=schedule.filter(s=>(s.recurring&&Number(s.day)===todayIdx)||(!s.recurring&&s.date===today)).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
 const todayRows=todaySlots.map(slot=>{
   const student=students.find(s=>s.id===slot.studentId);
   const session=sessions.find(s=>s.sourceSlotId===slot.id&&s.date===today);
   const exception=exceptions.find(e=>e.slotId===slot.id&&e.date===today&&e.status==='cancelled');
   return {slot,student,session,exception};
 });
 const nextLesson=(()=>{
  const options=[];
  for(let offset=1;offset<=45;offset++){
   const d=new Date();d.setDate(d.getDate()+offset);const key=dateKey(d);const day=(d.getDay()+6)%7;
   for(const slot of schedule){
    if(!slot.recurring||Number(slot.day)!==day)continue;
    const student=students.find(s=>s.id===slot.studentId);if(!student||(student.status||'active')!=='active')continue;
    if(exceptions.some(e=>e.slotId===slot.id&&e.date===key&&e.status==='cancelled'))continue;
    options.push({slot,student,date:key});}
   const once=schedule.filter(s=>!s.recurring&&s.date===key).map(slot=>({slot,student:students.find(s=>s.id===slot.studentId),date:key})).filter(x=>x.student&&(x.student.status||'active')==='active'&&!exceptions.some(e=>e.slotId===x.slot.id&&e.date===key&&e.status==='cancelled'));
   options.push(...once);if(options.length)break;
  }
  return options.sort((a,b)=>a.date.localeCompare(b.date)||String(a.slot.start).localeCompare(String(b.slot.start)))[0]||null;
 })();
 const unpaidInvoices=invoices.map(inv=>{const rows=(inv.session_ids||[]).map(id=>sessions.find(s=>s.id===id)).filter(Boolean);return {...inv,rows,paid:rows.length>0&&rows.every(s=>s.paid)};}).filter(i=>!i.paid).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const pending=model.pending;
 const noSchedule=students.filter(s=>(s.status||'active')==='active'&&!schedule.some(sl=>sl.studentId===s.id));
 const colors=new Map(students.map((s,i)=>[s.id,COLORS[i%COLORS.length]]));
 const studentIncome=students.map(s=>({student:s,amount:thisMonthSessions.filter(x=>x.studentId===s.id).reduce((sum,x)=>sum+Number(x.hours||0)*Number(x.rate||0),0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
 const cancelToday=async(slot)=>{
  if(!updateExceptions)return;
  const existing=exceptions.find(e=>e.slotId===slot.id&&e.date===today);
  if(existing)return;
  const saved = await updateExceptions([...exceptions,{id:crypto.randomUUID(),slotId:slot.id,date:today,status:'cancelled'}]);
  if(saved) showToast?.(lang==='en'?'Lesson cancelled':'ยกเลิกคาบแล้ว');
 };
 const shortcuts=[{label:t.goPlan,icon:CalendarDays,tab:'teaching'},{label:t.goInvoice,icon:Receipt,tab:'invoice'},{label:t.goReports,icon:Users,tab:'students'}];
 return <div className="dashboard-page">
  <header className="dashboard-welcome">
   <div className="dashboard-welcome-copy">
    <div className="dashboard-kicker">DOLLA TUTOR · TEACHING STUDIO</div>
    <h1>{lang==='en'?'Your teaching, at a glance':'จัดการงานสอน ให้ทุกอย่างเป็นระบบ'}</h1>
    <p>{lang==='en'?'A clear picture of lessons, income and what needs your attention.':'ดูคาบสอน รายรับ และสิ่งที่ต้องจัดการได้จากหน้าจอเดียว'}</p>
    <div className="dashboard-welcome-meta"><span className="dashboard-live-dot"/>{lang==='en'?'Your tutoring workspace':'พื้นที่จัดการงานติวเตอร์'} <span className="dashboard-meta-divider">/</span> {fmtDate(today,lang)}</div>
   </div>
   <div className="dashboard-welcome-actions">
    <button type="button" onClick={()=>setTab('teaching')} className="dashboard-action-secondary">{lang==='en'?'Lesson history':'ประวัติคาบสอน'} <ArrowRight size={15}/></button>
    <button type="button" onClick={()=>setTab('invoice')} className="dashboard-action-primary"><Receipt size={16}/>{lang==='en'?'Create invoice':'แจ้งค่าสอน'}</button>
   </div>
   <div className="dashboard-orbit dashboard-orbit-one"/><div className="dashboard-orbit dashboard-orbit-two"/>
  </header>

  <div className="dashboard-section-label"><span>{lang==='en'?'MONTHLY SNAPSHOT':'ภาพรวมเดือนนี้'}</span><span className="dashboard-section-line"/><span className="dashboard-section-date">{new Date().toLocaleDateString(lang==='en'?'en-GB':'th-TH',{month:'long',year:'numeric'})}</span></div>
  <div className="dashboard-kpis">
   <article className="dashboard-kpi dashboard-kpi-earned"><div className="dashboard-kpi-top"><span>{t.earned}</span><span className="dashboard-kpi-icon"><CircleDollarSign size={18}/></span></div><div className="dashboard-kpi-value">{money(earned,lang)}</div><div className="dashboard-kpi-foot"><span className="dashboard-kpi-indicator"/> {lang==='en'?'Recorded lessons':'จากคาบที่บันทึกแล้ว'}</div></article>
   <article className="dashboard-kpi dashboard-kpi-expected"><div className="dashboard-kpi-top"><span>{t.expected}</span><span className="dashboard-kpi-icon"><TrendingUpIcon/></span></div><div className="dashboard-kpi-value">{money(expected,lang)}</div><div className="dashboard-kpi-foot">{lang==='en'?'Including forecast':'รวมยอดคาดการณ์'}</div></article>
   <article className="dashboard-kpi dashboard-kpi-unpaid"><div className="dashboard-kpi-top"><span>{t.unpaid}</span><span className="dashboard-kpi-icon"><Receipt size={18}/></span></div><div className="dashboard-kpi-value">{money(unpaidTotal,lang)}</div><div className="dashboard-kpi-foot">{unpaidSessions.length} {lang==='en'?'unpaid lessons':'คาบที่ยังไม่ชำระ'}</div></article>
   <article className="dashboard-kpi dashboard-kpi-pending"><div className="dashboard-kpi-top"><span>{t.pending}</span><span className="dashboard-kpi-icon"><ClipboardList size={18}/></span></div><div className="dashboard-kpi-value">{pending.length}<small> {t.lessons}</small></div><div className="dashboard-kpi-foot">{lang==='en'?'Need a lesson record':'รอบันทึกรายละเอียดการสอน'}</div></article>
  </div>

  <div className="dashboard-main-grid">
   <section className="dashboard-panel dashboard-today-panel">
    <div className="dashboard-panel-heading"><div><div className="dashboard-panel-eyebrow">{lang==='en'?'DAILY PLAN':'ตารางประจำวัน'}</div><h2>{t.today}</h2><p>{lang==='en'?'Keep today’s lessons and follow-ups in one place.':'ติดตามคาบสอนวันนี้และจัดการได้ทันที'}</p></div><span className="dashboard-date-pill"><CalendarDays size={14}/>{fmtDate(today,lang)}</span></div>
    {todayRows.length===0?<div className="dashboard-empty-day"><div className="dashboard-empty-illustration"><BookOpen size={25}/></div><div><strong>{t.noToday}</strong><p>{lang==='en'?'A little breathing room in your schedule.':'วันนี้ไม่มีคาบในตารางที่ต้องจัดการ'}</p>{nextLesson&&<div className="dashboard-next-lesson"><span>{t.next}</span><strong>{nextLesson.student?.name}</strong><small>{fmtDate(nextLesson.date,lang)} · {fmtTime(nextLesson.slot.start)}–{fmtTime(nextLesson.slot.end)}</small></div>}</div>{nextLesson&&<button type="button" onClick={()=>setTab('teaching')} className="dashboard-text-action">{t.goPlan}<ArrowRight size={15}/></button>}</div>:<div className="dashboard-today-list">{todayRows.map(({slot,student,session,exception})=><article key={slot.id} className={`dashboard-today-row ${exception?'is-cancelled':session?'is-recorded':'is-pending'}`}><div className="dashboard-time-block"><strong>{fmtTime(slot.start)}</strong><span>{fmtTime(slot.end)}</span></div><div className="dashboard-today-student"><span className="dashboard-student-avatar" style={{'--student-color':colors.get(student?.id)||C.pine}}>{(student?.name||'?').trim().slice(0,1)}</span><div><strong>{student?.name||'—'}</strong><span>{student?.subjects?.join(' · ')||student?.grade|| (lang==='en'?'Private lesson':'เรียนพิเศษ')}</span></div></div><div className="dashboard-today-status"><span className="dashboard-status-dot"/>{exception?t.cancelled:session?t.record:t.pending}</div><div className="dashboard-today-actions">{!exception&&!session&&<><button type="button" onClick={()=>onOpenLessonForm?.(slot,today)} className="dashboard-record-button"><ClipboardList size={14}/>{t.fullForm}</button><button type="button" onClick={()=>cancelToday(slot)} className="dashboard-cancel-button" aria-label={t.cancel}><X size={15}/></button></>}{session&&<span className="dashboard-done-label"><CheckCircle2 size={15}/>{t.record}</span>}</div></article>)}</div>}
   </section>

   <section className="dashboard-panel dashboard-todo-panel">
    <div className="dashboard-panel-heading"><div><div className="dashboard-panel-eyebrow">{lang==='en'?'KEEP THINGS MOVING':'จัดการต่อจากนี้'}</div><h2>{t.todo}</h2><p>{lang==='en'?'A short list of things to take care of.':'รายการที่ควรจัดการต่อ เรียงไว้ในที่เดียว'}</p></div><span className="dashboard-task-count">{unpaidInvoices.length+pending.length+noSchedule.length}</span></div>
    {!unpaidInvoices.length&&!pending.length&&!noSchedule.length?<div className="dashboard-all-done"><CheckCircle2 size={21}/><div><strong>{t.allDone}</strong><p>{lang==='en'?'Nothing is waiting for your attention.':'ไม่มีรายการค้าง ทุกอย่างเรียบร้อยดี'}</p></div></div>:<div className="dashboard-todo-list">
     {unpaidInvoices.map(inv=><button key={inv.id} type="button" onClick={()=>setTab('invoice')} className="dashboard-todo-item"><span className="dashboard-todo-icon is-red"><Receipt size={17}/></span><span className="dashboard-todo-copy"><strong>{t.todoInvoice} · {inv.number}</strong><small>{t.from} {fmtDate(String(inv.created_at).slice(0,10),lang)}</small></span><span className="dashboard-todo-amount">{money(inv.total,lang)}</span><ArrowRight size={15}/></button>)}
     {pending.map(row=><button key={row.id} type="button" onClick={()=>setTab('plan')} className="dashboard-todo-item"><span className="dashboard-todo-icon is-amber"><ClipboardList size={17}/></span><span className="dashboard-todo-copy"><strong>{t.todoLessons} · {row.studentName}</strong><small>{fmtDate(row.date,lang)} · {fmtTime(row.start)}</small></span><span className="dashboard-todo-amount">{money(row.amount,lang)}</span><ArrowRight size={15}/></button>)}
     {noSchedule.map(s=><button key={s.id} type="button" onClick={()=>setTab('students')} className="dashboard-todo-item"><span className="dashboard-todo-icon is-green"><Users size={17}/></span><span className="dashboard-todo-copy"><strong>{t.todoStudents}</strong><small>{s.name}</small></span><ArrowRight size={15}/></button>)}
    </div>}
    <div className="dashboard-todo-footer"><span>{lang==='en'?'Keep your records up to date for accurate billing.':'บันทึกคาบเรียนให้ครบ เพื่อสรุปยอดได้ถูกต้อง'}</span><button type="button" onClick={()=>setTab('sessions')}>{lang==='en'?'Open lesson records':'ไปหน้าบันทึกคาบ'}<ArrowRight size={14}/></button></div>
   </section>
  </div>

  <div className="dashboard-lower-grid">
   <section className="dashboard-panel dashboard-chart-panel"><div className="dashboard-panel-heading"><div><div className="dashboard-panel-eyebrow">{lang==='en'?'CASH FLOW':'กระแสรายรับ'}</div><h2>{t.chart}</h2><p>{lang==='en'?'Confirmed income and estimated future income.':'เปรียบเทียบรายได้จริงกับรายได้ที่คาดการณ์'}</p></div><span className="dashboard-chart-badge">{lang==='en'?'9 MONTHS':'9 เดือน'}</span></div><div className="dashboard-chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:12,right:4,left:0,bottom:2}}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e8e9e1"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#7b857c'}}/><YAxis width={42} axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#7b857c'}} tickFormatter={v=>Math.round(v/1000)+'k'}/><Tooltip formatter={(v,n)=>[money(v,lang),n==='confirmed'?t.actual:t.forecast]} contentStyle={{borderRadius:12,border:'1px solid #e1e5dc',fontSize:12}}/><Bar dataKey="confirmed" stackId="income" fill="#315d45" radius={[4,4,0,0]} isAnimationActive={false}/><Bar dataKey="forecast" stackId="income" fill="#e4b46b" radius={[4,4,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div><div className="dashboard-chart-legend"><span><i className="legend-confirmed"/>{t.actual}</span><span><i className="legend-forecast"/>{t.forecast}</span></div></section>
   <section className="dashboard-panel dashboard-income-panel"><div className="dashboard-panel-heading"><div><div className="dashboard-panel-eyebrow">{lang==='en'?'STUDENT BREAKDOWN':'แยกตามนักเรียน'}</div><h2>{t.incomeByStudent}</h2><p>{lang==='en'?'Contribution to this month’s income.':'สัดส่วนรายรับของนักเรียนแต่ละคน'}</p></div><Users size={19} className="dashboard-muted-icon"/></div>{studentIncome.length===0?<div className="dashboard-income-empty"><BookOpen size={22}/><p>{t.noIncome}</p></div>:<div className="dashboard-income-list">{studentIncome.slice(0,6).map(({student,amount},i)=><div key={student.id} className="dashboard-income-row"><span className="dashboard-student-avatar" style={{'--student-color':colors.get(student.id)||C.pine}}>{(student.name||'?').trim().slice(0,1)}</span><div className="dashboard-income-copy"><div><strong>{student.name}</strong><span>{money(amount,lang)}</span></div><div className="dashboard-income-track"><i style={{width:(amount/Math.max(...studentIncome.map(x=>x.amount),1)*100)+'%','--student-color':colors.get(student.id)||C.pine}}/></div></div></div>)}</div>}<button type="button" onClick={()=>setTab('business')} className="dashboard-panel-link">{lang==='en'?'View income details':'ดูรายรับทั้งหมด'}<ArrowRight size={15}/></button></section>
  </div>

  <section className="dashboard-quick-actions"><div><div className="dashboard-panel-eyebrow">{lang==='en'?'QUICK ACCESS':'ทางลัด'}</div><h2>{t.shortcuts}</h2></div><div className="dashboard-quick-grid">{shortcuts.map(({label,icon:Icon,tab})=><button key={tab} type="button" onClick={()=>setTab(tab)}><span className="dashboard-quick-icon"><Icon size={19}/></span><span>{label}</span><ArrowRight size={16}/></button>)}</div></section>
 </div>;
}
function TrendingUpIcon(){return <TrendingUp size={18}/>;}
function Kpi({label,value,tone,icon:Icon}){const styles={pine:{bg:C.tint,fg:C.dark},blue:{bg:'#EEF7FC',fg:C.blueText},brick:{bg:C.brickTint,fg:C.brick},gold:{bg:C.goldTint,fg:C.gold}}[tone];return <div className="rounded-xl border p-3 sm:p-4" style={{background:styles.bg,borderColor:styles.bg,color:styles.fg}}><div className="flex items-start justify-between gap-2"><div className="text-xs font-medium leading-5">{label}</div><Icon size={18}/></div><div className="mt-2 break-words text-lg sm:text-2xl font-semibold">{value}</div></div>}
