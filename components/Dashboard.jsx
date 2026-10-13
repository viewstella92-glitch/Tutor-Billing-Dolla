'use client';

import { useMemo } from 'react';
import { CalendarDays, CircleDollarSign, ClipboardList, Receipt, Users, ArrowRight, CheckCircle2, Circle, Ban, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { buildMonthlyForecast, buildNineMonthChart, dateKey, monthKey } from '../lib/forecast';

const C={paper:'#FAF6EC',ink:'#23282B',soft:'#6B7270',line:'#DED4B8',surface:'#fff',pine:'#2E5E45',dark:'#20402F',tint:'#E7EFE7',blue:'#B8D9EA',blueText:'#365F79',gold:'#A8781F',goldTint:'#F5EBD4',brick:'#A0392A',brickTint:'#F5E4DF'};
const COLORS=['#2E5E45','#447DA5','#A8781F','#8D6E9D','#B85C45','#3B8C8C','#6C7C45','#B36A8B'];
const WORDS={
 th:{title:'ภาพรวม',subtitle:'รายได้จริง คาดการณ์ และรายการที่ต้องจัดการ',earned:'ได้แล้วเดือนนี้',expected:'คาดว่าจะได้เดือนนี้ทั้งหมด',unpaid:'ค้างชำระ',pending:'รอบันทึก',today:'วันนี้',noToday:'วันนี้ไม่มีคาบสอน',next:'คาบถัดไป',record:'สอนแล้ว',fullForm:'บันทึกรายละเอียด',cancel:'ยกเลิก',cancelled:'ยกเลิกแล้ว',noStudents:'ยังไม่มีนักเรียน',chart:'รายได้จริงและคาดการณ์ 9 เดือน',actual:'ยืนยันแล้ว',forecast:'คาดการณ์',todo:'รายการที่ต้องทำ',todoInvoice:'ใบแจ้งค่าสอนค้างชำระ',todoLessons:'คาบที่รอบันทึก',todoStudents:'นักเรียนที่ยังไม่มีตารางสอน',allDone:'ทุกอย่างเรียบร้อย',incomeByStudent:'รายได้แยกตามนักเรียนเดือนนี้',shortcuts:'ทางลัด',goPlan:'แพลนรายเดือน',goInvoice:'แจ้งค่าสอน',goReports:'รายงานการสอน',hours:'ชม.',lessons:'คาบ',noSchedule:'ยังไม่มีตารางสอน',noIncome:'เดือนนี้ยังไม่มีรายได้ที่บันทึกไว้',paid:'ชำระแล้ว',unpaidLabel:'ค้างชำระ',from:'ตั้งแต่',nextLabel:'คาบถัดไป'}
 en:{title:'Dashboard',subtitle:'Actual income, forecast and actions to take',earned:'Earned this month',expected:'Expected total this month',unpaid:'Unpaid',pending:'Needs logging',today:'Today',noToday:'No lessons today',next:'Next lesson',record:'Taught',fullForm:'Full lesson details',cancel:'Cancel',cancelled:'Cancelled',noStudents:'No students yet',chart:'Actual and forecast income · 9 months',actual:'Confirmed',forecast:'Forecast',todo:'To do',todoInvoice:'Unpaid invoices',todoLessons:'Lessons needing a record',todoStudents:'Students without a schedule',allDone:'Everything is up to date',incomeByStudent:'Income by student this month',shortcuts:'Shortcuts',goPlan:'Monthly planner',goInvoice:'Invoices',goReports:'Lesson reports',hours:'hrs',lessons:'lessons',noSchedule:'No lessons scheduled',noIncome:'No recorded income this month',paid:'Paid',unpaidLabel:'Unpaid',from:'Since',nextLabel:'Next lesson'}
};
const money=(n,lang)=>lang==='en'?'THB '+Math.round(Number(n)||0).toLocaleString('en-US'):'฿'+Math.round(Number(n)||0).toLocaleString('th-TH');
const fmtDate=(d,lang)=>new Date(d+'T12:00:00').toLocaleDateString(lang==='en'?'en-GB':'th-TH',{day:'numeric',month:'short',year:'numeric'});
const fmtTime=v=>String(v||'').slice(0,5)||'--:--';

export default function Dashboard({students=[],schedule=[],sessions=[],exceptions=[],invoices=[],settings={},lang='th',setTab,showToast,updateExceptions,onOpenLessonForm}){
 const t=WORDS[lang]||WORDS.th;
 const today=dateKey(new Date()),month=monthKey(new Date());
 const model=useMemo(()=>buildMonthlyForecast({month,students,schedule,sessions,exceptions,today}),[month,students,schedule,sessions,exceptions,today]);
 const chart=useMemo(()=>buildNineMonthChart({month,students,schedule,sessions,exceptions,today}),[month,students,schedule,sessions,exceptions,today]);
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
  await updateExceptions([...exceptions,{id:crypto.randomUUID(),slotId:slot.id,date:today,status:'cancelled'}]);
  showToast?.(lang==='en'?'Lesson cancelled':'ยกเลิกคาบแล้ว');
 };
 const shortcuts=[{label:t.goPlan,icon:CalendarDays,tab:'plan'},{label:t.goInvoice,icon:Receipt,tab:'invoice'},{label:t.goReports,icon:ClipboardList,tab:'progress'}];
 return <div className="space-y-5">
  <div><h1 className="text-2xl font-semibold">{t.title}</h1><p className="mt-1 text-sm" style={{color:C.soft}}>{t.subtitle}</p></div>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
   <Kpi label={t.earned} value={money(earned,lang)} tone="pine" icon={CircleDollarSign}/>
   <Kpi label={t.expected} value={money(expected,lang)} tone="blue" icon={CalendarDays}/>
   <Kpi label={t.unpaid} value={money(unpaidTotal,lang)} tone="brick" icon={Receipt}/>
   <Kpi label={t.pending} value={String(pending.length)+' '+t.lessons} tone="gold" icon={ClipboardList}/>
  </div>
  <section className="rounded-2xl border p-4 sm:p-5" style={{background:C.surface,borderColor:C.line}}>
   <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">{t.today}</h2><span className="text-xs" style={{color:C.soft}}>{fmtDate(today,lang)}</span></div>
   {todayRows.length===0?<div className="rounded-xl p-4" style={{background:C.paper}}><p className="text-sm font-medium">{t.noToday}</p>{nextLesson&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs" style={{color:C.soft}}>{t.next}</div><div className="mt-1 font-semibold">{nextLesson.student?.name} · {fmtDate(nextLesson.date,lang)}</div><div className="text-sm" style={{color:C.soft}}>{fmtTime(nextLesson.slot.start)}–{fmtTime(nextLesson.slot.end)}</div></div><button onClick={()=>setTab('plan')} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:C.line}}>{t.goPlan} <ArrowRight size={14} className="inline"/></button></div>}</div>:<div className="space-y-2">{todayRows.map(({slot,student,session,exception})=><div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{borderColor:C.line,background:exception?C.brickTint:session?C.tint:'#fff'}}><div className="flex min-w-0 items-start gap-3"><div className="mt-1 h-9 w-1.5 rounded-full" style={{background:colors.get(student?.id)||C.pine}}/><div className="min-w-0"><div className="font-semibold text-sm">{student?.name||'—'}</div><div className="mt-1 text-xs" style={{color:C.soft}}>{fmtTime(slot.start)}–{fmtTime(slot.end)} · {student?.subjects?.join(' · ')||student?.grade||''}</div><div className="mt-1 text-xs" style={{color:exception?C.brick:session?C.pine:C.gold}}>{exception?t.cancelled:session?t.record:t.pending}</div></div></div><div className="flex flex-wrap gap-2">{!exception&&!session&&<><button onClick={()=>onOpenLessonForm?.(slot,today)} className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:C.pine}}>{t.fullForm}</button><button onClick={()=>cancelToday(slot)} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:C.line}}>{t.cancel}</button></>}{session&&<span className="rounded-lg px-3 py-2 text-xs font-semibold" style={{background:C.tint,color:C.dark}}><CheckCircle2 size={14} className="inline mr-1"/>{t.record}</span>}</div></div>)}</div>}
  </section>
  <section className="rounded-2xl border p-4 sm:p-5" style={{background:C.surface,borderColor:C.line}}><h2 className="mb-3 font-semibold">{t.chart}</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:10,right:4,left:2,bottom:4}}><CartesianGrid strokeDasharray="0" vertical={false} stroke={C.line}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis width={45} tick={{fontSize:10}} tickFormatter={v=>Math.round(v/1000)+'k'}/><Tooltip formatter={(v,n)=>[money(v,lang),n==='confirmed'?t.actual:t.forecast]}/><Bar dataKey="confirmed" stackId="income" fill={C.pine} isAnimationActive={false}/><Bar dataKey="forecast" stackId="income" fill={C.blue} isAnimationActive={false}/></BarChart></ResponsiveContainer></div><div className="mt-2 flex gap-4 text-xs" style={{color:C.soft}}><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{background:C.pine}}/>{t.actual}</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{background:C.blue}}/>{t.forecast}</span></div></section>
  <section className="rounded-2xl border p-4 sm:p-5" style={{background:C.surface,borderColor:C.line}}><h2 className="mb-3 font-semibold">{t.todo}</h2>{!unpaidInvoices.length&&!pending.length&&!noSchedule.length?<div className="rounded-xl p-4 text-sm" style={{background:C.tint,color:C.dark}}><CheckCircle2 size={16} className="inline mr-2"/>{t.allDone}</div>:<div className="space-y-2">
   {unpaidInvoices.map(inv=><button key={inv.id} onClick={()=>setTab('invoice')} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left" style={{borderColor:C.line}}><span><span className="block text-sm font-semibold">{t.todoInvoice} · {inv.number}</span><span className="block mt-1 text-xs" style={{color:C.soft}}>{t.from} {fmtDate(String(inv.created_at).slice(0,10),lang)}</span></span><span className="font-semibold" style={{color:C.brick}}>{money(inv.total,lang)}</span></button>)}
   {pending.map(row=><button key={row.id} onClick={()=>setTab('plan')} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left" style={{borderColor:C.line}}><span><span className="block text-sm font-semibold">{t.todoLessons} · {row.studentName}</span><span className="block mt-1 text-xs" style={{color:C.soft}}>{fmtDate(row.date,lang)} · {fmtTime(row.start)}</span></span><span className="font-semibold" style={{color:C.gold}}>{money(row.amount,lang)}</span></button>)}
   {noSchedule.map(s=><button key={s.id} onClick={()=>setTab('students')} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left" style={{borderColor:C.line}}><span className="text-sm font-semibold">{t.todoStudents} · {s.name}</span><ArrowRight size={16}/></button>)}
  </div>}</section>
  <section className="rounded-2xl border p-4 sm:p-5" style={{background:C.surface,borderColor:C.line}}><h2 className="mb-4 font-semibold">{t.incomeByStudent}</h2>{studentIncome.length===0?<p className="text-sm" style={{color:C.soft}}>{t.noIncome}</p>:<div className="space-y-3">{studentIncome.map(({student,amount})=><div key={student.id}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium">{student.name}</span><span>{money(amount,lang)}</span></div><div className="h-2 overflow-hidden rounded-full" style={{background:C.paperDeep}}><div className="h-full rounded-full" style={{width:(amount/Math.max(...studentIncome.map(x=>x.amount),1)*100)+'%',background:colors.get(student.id)||C.pine}}/></div></div>)}</div>}</section>
  <section><h2 className="mb-3 font-semibold">{t.shortcuts}</h2><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{shortcuts.map(({label,icon:Icon,tab})=><button key={tab} onClick={()=>setTab(tab)} className="flex items-center justify-between rounded-xl border p-4 text-left font-medium" style={{background:C.surface,borderColor:C.line}}><span className="flex items-center gap-3"><Icon size={18} style={{color:C.pine}}/>{label}</span><ArrowRight size={16} style={{color:C.soft}}/></button>)}</div></section>
 </div>;
}
function Kpi({label,value,tone,icon:Icon}){const styles={pine:{bg:C.tint,fg:C.dark},blue:{bg:'#EEF7FC',fg:C.blueText},brick:{bg:C.brickTint,fg:C.brick},gold:{bg:C.goldTint,fg:C.gold}}[tone];return <div className="rounded-xl border p-3 sm:p-4" style={{background:styles.bg,borderColor:styles.bg,color:styles.fg}}><div className="flex items-start justify-between gap-2"><div className="text-xs font-medium leading-5">{label}</div><Icon size={18}/></div><div className="mt-2 break-words text-lg sm:text-2xl font-semibold">{value}</div></div>}
