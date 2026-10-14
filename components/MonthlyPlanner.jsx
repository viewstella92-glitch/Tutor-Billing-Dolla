'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock3, Ban, RotateCcw, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { buildMonthlyForecast, buildNineMonthChart, monthDateRange } from '../lib/forecast';

const C = { paper:'#FAF6EC', ink:'#23282B', inkSoft:'#6B7270', line:'#DED4B8', surface:'#FFFFFF', pine:'#2E5E45', pineDark:'#20402F', pineTint:'#E7EFE7', blue:'#B8D9EA', blueText:'#365F79', gold:'#A8781F', goldTint:'#F5EBD4', brick:'#A0392A', brickTint:'#F5E4DF' };
const PALETTE = ['#2E5E45','#447DA5','#A8781F','#8D6E9D','#B85C45','#3B8C8C','#6C7C45','#B36A8B'];
const T = {
  th: { title:'แพลนรายเดือน', subtitle:'วางแผนค่าสอนจากตารางประจำและคาบที่บันทึกจริง', thisMonth:'เดือนนี้', confirmed:'ยืนยันแล้ว', forecast:'คาดการณ์', pending:'รอบันทึก', cancelled:'ยกเลิก', all:'ทั้งหมด', student:'นักเรียน', week:'สัปดาห์ที่', noLessons:'ไม่มีคาบในสัปดาห์นี้', saveTaught:'บันทึกว่าสอนแล้ว', cancel:'ยกเลิกคาบนี้', undo:'ยกเลิกการยกเลิก', today:'วันนี้', actual:'ยืนยันแล้ว', chartTitle:'รายได้จริงและคาดการณ์ 9 เดือน', chartActual:'ยืนยันแล้ว', chartForecast:'คาดการณ์', hours:'ชม.', lessons:'คาบ', amount:'ยอดคาบ', noStudents:'ยังไม่มีนักเรียนที่ Active', cancelHint:'คาบนี้ถูกยกเลิกแล้ว', waiting:'คาบที่ผ่านมาแล้ว รอให้บันทึกผลการสอน', future:'คาบตามแผน' },
  en: { title:'Monthly planner', subtitle:'Forecast lesson income from recurring schedules and recorded lessons', thisMonth:'This month', confirmed:'Confirmed', forecast:'Forecast', pending:'Needs logging', cancelled:'Cancelled', all:'All students', student:'Student', week:'Week', noLessons:'No lessons scheduled this week', saveTaught:'Record lesson', cancel:'Cancel lesson', undo:'Undo cancellation', today:'Today', actual:'Confirmed', chartTitle:'Actual and forecast income · 9 months', chartActual:'Confirmed', chartForecast:'Forecast', hours:'hrs', lessons:'lessons', amount:'Lesson amount', noStudents:'No active students yet', cancelHint:'This lesson is cancelled', waiting:'Past lesson waiting to be recorded', future:'Scheduled lesson' }
};
const money = (n, lang) => lang === 'en' ? 'THB ' + Math.round(Number(n)||0).toLocaleString('en-US') : '฿' + Math.round(Number(n)||0).toLocaleString('th-TH');
const todayKey = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const keyFor = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const monthFor = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const shiftMonth = (key, offset) => { const [y,m]=key.split('-').map(Number); const d=new Date(y,m-1+offset,1); return monthFor(d); };
const formatDate = (key, lang) => { const d=new Date(key+'T12:00:00'); return lang==='en' ? d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); };
const formatTime = value => String(value||'').slice(0,5) || '--:--';

export default function MonthlyPlanner({ students=[], schedule=[], sessions=[], exceptions=[], updateExceptions, showToast, onOpenLessonForm, lang='th', setTab }) {
  const [month,setMonth] = useState(()=>monthFor(new Date()));
  const [studentFilter,setStudentFilter] = useState('all');
  const labels = T[lang] || T.th;
  const today = todayKey();
  const model = useMemo(()=>buildMonthlyForecast({month,students,schedule,sessions,exceptions,today}),[month,students,schedule,sessions,exceptions,today]);
  const chart = useMemo(()=>buildNineMonthChart({month,students,schedule,sessions,exceptions,today,lang}),[month,students,schedule,sessions,exceptions,today]);
  const activeStudents = students.filter(s=>(s.status||'active')==='active');
  const visibleRows = model.rows.filter(row=>studentFilter==='all'||row.studentId===studentFilter);
  const [year,monthNum] = month.split('-').map(Number);
  const monthTitle = new Date(year,monthNum-1,1).toLocaleDateString(lang==='en'?'en-US':'th-TH',{month:'long',year:lang==='en'?'numeric':'numeric'});
  const grouped = Array.from({length:5},(_,i)=>({week:i+1,rows:visibleRows.filter(row=>Math.ceil(Number(row.date.slice(-2))/7)===i+1)}));
  const actualSessions = sessions.filter(s=>s.date?.slice(0,7)===month);
  const actualAmount = actualSessions.reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
  const forecastAmount = model.forecast.filter(r=>studentFilter==='all'||r.studentId===studentFilter).reduce((sum,r)=>sum+r.amount,0);
  const confirmedAmount = studentFilter==='all'?actualAmount:actualSessions.filter(s=>s.studentId===studentFilter).reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
  const pendingCount = model.pending.filter(r=>studentFilter==='all'||r.studentId===studentFilter).length;
  const cancelledCount = model.cancelled.filter(r=>studentFilter==='all'||r.studentId===studentFilter).length;
  const exceptionFor = row => exceptions.find(e=>e.slotId===row.slotId&&e.date===row.date&&e.status==='cancelled');
  const cancelSlot = async row => {
    if (!updateExceptions) return;
    const entry={id:crypto.randomUUID(),slotId:row.slotId,date:row.date,status:'cancelled'};
    const saved = await updateExceptions([...exceptions,entry]);
    if(saved) showToast?.(lang==='en'?'Lesson cancelled':'ยกเลิกคาบแล้ว');
  };
  const undoCancel = async row => {
    if (!updateExceptions) return;
    const existing=exceptionFor(row);
    const saved = await updateExceptions(exceptions.filter(e=>e.id!==existing?.id),existing?.id?[existing.id]:[]);
    if(saved) showToast?.(lang==='en'?'Cancellation removed':'ยกเลิกสถานะยกเลิกแล้ว');
  };
  const colors = new Map(activeStudents.map((s,i)=>[s.id,PALETTE[i%PALETTE.length]]));

  return <div className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold">{labels.title}</h1><p className="mt-1 text-sm" style={{color:C.inkSoft}}>{labels.subtitle}</p></div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={()=>setMonth(shiftMonth(month,-1))} aria-label="Previous month" className="rounded-lg border p-2" style={{borderColor:C.line}}><ChevronLeft size={18}/></button>
        <div className="min-w-32 text-center font-semibold">{monthTitle}</div>
        <button type="button" onClick={()=>setMonth(shiftMonth(month,1))} aria-label="Next month" className="rounded-lg border p-2" style={{borderColor:C.line}}><ChevronRight size={18}/></button>
        <button type="button" onClick={()=>setMonth(monthFor(new Date()))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:C.line}}>{labels.thisMonth}</button>
      </div>
    </header>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
      <div className="rounded-xl border p-3" style={{background:C.pineTint,borderColor:C.pineTint}}><div className="text-xs" style={{color:C.pineDark}}>{labels.confirmed}</div><div className="mt-1 text-xl font-semibold" style={{color:C.pineDark}}>{money(confirmedAmount,lang)}</div></div>
      <div className="rounded-xl border p-3" style={{background:'#EEF7FC',borderColor:'#D8EAF5'}}><div className="text-xs" style={{color:C.blueText}}>{labels.forecast}</div><div className="mt-1 text-xl font-semibold" style={{color:C.blueText}}>{money(forecastAmount,lang)}</div></div>
      <div className="rounded-xl border p-3" style={{background:C.goldTint,borderColor:C.goldTint}}><div className="text-xs" style={{color:C.gold}}>{labels.pending}</div><div className="mt-1 text-xl font-semibold" style={{color:C.gold}}>{pendingCount} {labels.lessons}</div></div>
      <div className="rounded-xl border p-3" style={{background:C.brickTint,borderColor:C.brickTint}}><div className="text-xs" style={{color:C.brick}}>{labels.cancelled}</div><div className="mt-1 text-xl font-semibold" style={{color:C.brick}}>{cancelledCount} {labels.lessons}</div></div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm" style={{color:C.inkSoft}}>{labels.student}:</span>
      <select value={studentFilter} onChange={e=>setStudentFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:C.line,background:C.surface}}>
        <option value="all">{labels.all}</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
    {!activeStudents.length ? <div className="rounded-xl border p-8 text-center text-sm" style={{borderColor:C.line,color:C.inkSoft}}>{labels.noStudents}</div> : grouped.map(group=><section key={group.week} className="rounded-xl border overflow-hidden" style={{borderColor:C.line,background:C.surface}}>
      <div className="px-4 py-3 font-semibold text-sm" style={{background:C.paper}}>{labels.week} {group.week}</div>
      {group.rows.length===0 ? <div className="px-4 py-5 text-sm" style={{color:C.inkSoft}}>{labels.noLessons}</div> : <div className="divide-y" style={{borderColor:C.line}}>
        {group.rows.map(row=>{
          const color=colors.get(row.studentId)||C.pine;
          const isCancelled=row.status==='cancelled';
          const isPending=row.status==='pending';
          const isConfirmed=row.status==='confirmed';
          const statusLabel=isCancelled?labels.cancelled:isPending?labels.pending:isConfirmed?labels.confirmed:labels.forecast;
          return <article key={row.id} className="flex gap-3 p-3 sm:p-4" style={{borderColor:C.line,background:isPending?C.goldTint:isCancelled?'#F8F4F1':'transparent',opacity:isCancelled?0.75:1}}>
            <div className="w-1.5 shrink-0 rounded-full" style={{background:isCancelled?C.brick:color}}/>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-sm" style={{textDecoration:isCancelled?'line-through':'none'}}>{formatDate(row.date,lang)}</span><span className="text-xs" style={{color:C.inkSoft}}>{formatTime(row.start)}–{formatTime(row.end)}</span><span className="rounded-full px-2 py-0.5 text-xs" style={{background:isConfirmed?C.pineTint:isPending?C.goldTint:isCancelled?C.brickTint:'#EEF7FC',color:isConfirmed?C.pineDark:isPending?C.gold:isCancelled?C.brick:C.blueText}}>{statusLabel}</span></div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2"><span className="font-medium text-sm">{row.studentName}</span><span className="text-xs" style={{color:C.inkSoft}}>{row.hours} {labels.hours} · {labels.amount}: {money(row.amount,lang)}</span></div>
              {isPending&&<p className="mt-1 text-xs" style={{color:C.gold}}>{labels.waiting}</p>}
              {isCancelled&&<p className="mt-1 text-xs" style={{color:C.brick}}>{labels.cancelHint}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              {isPending&&<button type="button" onClick={()=>onOpenLessonForm?.(schedule.find(s=>s.id===row.slotId),row.date)} className="rounded-md px-2 py-1.5 text-xs font-semibold" style={{background:C.pine,color:'#fff'}}>{labels.saveTaught}</button>}
              {!isCancelled&&<button type="button" onClick={()=>cancelSlot(row)} className="rounded-md border px-2 py-1.5 text-xs" style={{borderColor:C.line,color:C.inkSoft}}><Ban size={12} className="inline mr-1"/>{labels.cancel}</button>}
              {isCancelled&&<button type="button" onClick={()=>undoCancel(row)} className="rounded-md border px-2 py-1.5 text-xs" style={{borderColor:C.line,color:C.pine}}><RotateCcw size={12} className="inline mr-1"/>{labels.undo}</button>}
            </div>
          </article>;
        })}
      </div>}
    </section>)}
    <section className="rounded-xl border p-4" style={{borderColor:C.line,background:C.surface}}>
      <div className="mb-3 font-semibold text-sm">{labels.chartTitle}</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{top:12,right:4,left:4,bottom:4}}>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke={C.line}/>
            <XAxis dataKey="label" tick={{fontSize:11}}/>
            <YAxis tick={{fontSize:10}} width={48} tickFormatter={v=>lang==='en'?Math.round(v/1000)+'k':Math.round(v/1000)+'k'}/>
            <Tooltip formatter={(value,name)=>[money(value,lang),name==='confirmed'?labels.chartActual:labels.chartForecast]}/>
            <Bar dataKey="confirmed" stackId="income" fill={C.pine} isAnimationActive={false}/>
            <Bar dataKey="forecast" stackId="income" fill={C.blue} isAnimationActive={false}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  </div>;
}
