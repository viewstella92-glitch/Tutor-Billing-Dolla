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
  const [selectedDate,setSelectedDate] = useState(()=>todayKey());
  const [showTrend,setShowTrend] = useState(false);
  const labels = T[lang] || T.th;
  const today = todayKey();
  const model = useMemo(()=>buildMonthlyForecast({month,students,schedule,sessions,exceptions,today}),[month,students,schedule,sessions,exceptions,today]);
  const chart = useMemo(()=>buildNineMonthChart({month,students,schedule,sessions,exceptions,today,lang}),[month,students,schedule,sessions,exceptions,today]);
  const activeStudents = students.filter(s=>(s.status||'active')==='active');
  const visibleRows = model.rows.filter(row=>studentFilter==='all'||row.studentId===studentFilter);
  const [year,monthNum] = month.split('-').map(Number);
  const monthTitle = new Date(year,monthNum-1,1).toLocaleDateString(lang==='en'?'en-US':'th-TH',{month:'long',year:lang==='en'?'numeric':'numeric'});
  const actualSessions = sessions.filter(s=>s.date?.slice(0,7)===month&&(studentFilter==='all'||s.studentId===studentFilter));
  const actualAmount = actualSessions.reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
  const forecastRows = model.forecast.filter(r=>studentFilter==='all'||r.studentId===studentFilter);
  const pendingRows = model.pending.filter(r=>studentFilter==='all'||r.studentId===studentFilter);
  const cancelledRows = model.cancelled.filter(r=>studentFilter==='all'||r.studentId===studentFilter);
  const forecastAmount = forecastRows.reduce((sum,r)=>sum+r.amount,0);
  const pendingAmount = pendingRows.reduce((sum,r)=>sum+r.amount,0);
  const expectedAmount = actualAmount+forecastAmount+pendingAmount;
  const visibleRows = model.rows.filter(row=>studentFilter==='all'||row.studentId===studentFilter);
  const {days} = monthDateRange(month);
  const firstWeekday=(new Date(year,monthNum-1,1).getDay()+6)%7;
  const calendarCells=[...Array(firstWeekday).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  while(calendarCells.length%7) calendarCells.push(null);
  const rowsByDate=new Map();
  visibleRows.forEach(row=>rowsByDate.set(row.date,[...(rowsByDate.get(row.date)||[]),row]));
  const chosenDate=selectedDate.slice(0,7)===month?selectedDate:month+'-01';
  const selectedRows=rowsByDate.get(chosenDate)||[];
  const dayNames=lang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
  const colors = new Map(activeStudents.map((s,i)=>[s.id,PALETTE[i%PALETTE.length]]));
  const moveMonth=offset=>{const next=shiftMonth(month,offset);setMonth(next);setSelectedDate(next+'-01');};
  const selectToday=()=>{const t=todayKey();setMonth(monthFor(new Date()));setSelectedDate(t);};
  const selectedLabel=formatDate(chosenDate,lang);
  const selectedAmount=selectedRows.filter(r=>r.status!=='cancelled').reduce((sum,r)=>sum+r.amount,0);
  const selectedHours=selectedRows.filter(r=>r.status!=='cancelled').reduce((sum,r)=>sum+Number(r.hours||0),0);
  const totalLessons=visibleRows.filter(r=>r.status!=='cancelled').length;
  const remainingRows=[...pendingRows,...forecastRows].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  const actionLabels=lang==='en'?{empty:'No lessons on this date',add:'Add a lesson',actual:'Recorded',pending:'Needs recording',cancelled:'Cancelled',forecast:'Planned',income:'Estimated lesson income',hours:'hours',lesson:'lessons',day:'Selected day',actualShort:'Recorded income',remaining:'Expected / not yet recorded',expected:'Estimated total this month',select:'Select a date to see lesson details'}:{empty:'วันนี้ไม่มีคาบสอน',add:'เพิ่มคาบสอน',actual:'บันทึกแล้ว',pending:'รอบันทึก',cancelled:'ยกเลิก',forecast:'ตามแผน',income:'รายได้ประมาณการของวัน',hours:'ชั่วโมง',lesson:'คาบ',day:'คาบของวันที่เลือก',actualShort:'รายได้ที่บันทึกแล้ว',remaining:'รายได้คาดการณ์ / รอบันทึก',expected:'รายได้รวมประมาณการเดือนนี้',select:'เลือกวันที่ในปฏิทินเพื่อดูรายละเอียดคาบ'};
  const statusText=row=>row.status==='confirmed'?actionLabels.actual:row.status==='pending'?actionLabels.pending:row.status==='cancelled'?actionLabels.cancelled:actionLabels.forecast;

  return <div className="monthly-planner calendar-monitor">
    <header className="calendar-toolbar">
      <div><div className="calendar-eyebrow">{lang==='en'?'TEACHING OVERVIEW':'TEACHING OVERVIEW'}</div><h1>{labels.title}</h1><p>{lang==='en'?'See every lesson, its status, and expected income in one monthly view.':'เห็นคาบสอนทั้งเดือน สถานะงาน และรายได้ที่คาดว่าจะได้รับในหน้าเดียว'}</p></div>
      <div className="calendar-month-nav">
        <button type="button" onClick={()=>moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={18}/></button>
        <div className="calendar-month-title">{monthTitle}</div>
        <button type="button" onClick={()=>moveMonth(1)} aria-label="Next month"><ChevronRight size={18}/></button>
        <button type="button" className="calendar-today-btn" onClick={selectToday}>{labels.today}</button>
      </div>
    </header>

    <section className="calendar-income-overview">
      <div className="calendar-income-main"><span>{actionLabels.expected}</span><strong>{money(expectedAmount,lang)}</strong><small>{totalLessons} {actionLabels.lesson} · {visibleRows.filter(r=>r.status!=='cancelled').reduce((n,r)=>n+Number(r.hours||0),0)} {actionLabels.hours}</small></div>
      <div className="calendar-income-stat"><span>{actionLabels.actualShort}</span><strong>{money(actualAmount,lang)}</strong><small>{model.confirmed.filter(r=>studentFilter==='all'||r.studentId===studentFilter).length} {actionLabels.lesson}</small></div>
      <div className="calendar-income-stat"><span>{actionLabels.remaining}</span><strong>{money(forecastAmount+pendingAmount,lang)}</strong><small>{forecastRows.length+pendingRows.length} {actionLabels.lesson}</small></div>
    </section>

    <div className="calendar-filter-row">
      <label>{labels.student}<select value={studentFilter} onChange={e=>setStudentFilter(e.target.value)}><option value="all">{labels.all}</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="calendar-legend"><span><i className="legend-dot legend-confirmed"/> {actionLabels.actual}</span><span><i className="legend-dot legend-forecast"/> {actionLabels.forecast}</span><span><i className="legend-dot legend-pending"/> {actionLabels.pending}</span><span><i className="legend-dot legend-cancelled"/> {actionLabels.cancelled}</span></div>
    </div>

    {!activeStudents.length ? <div className="calendar-empty">{labels.noStudents}</div> : <div className="calendar-workspace">
      <section className="calendar-grid-panel">
        <div className="calendar-weekdays">{dayNames.map((d,i)=><div key={d} className={i>4?'weekend':''}>{d}</div>)}</div>
        <div className="calendar-month-grid">{calendarCells.map((day,index)=>{
          if(!day)return <div key={'blank-'+index} className="calendar-day calendar-day-blank"/>;
          const date=month+'-'+String(day).padStart(2,'0');
          const dayRows=rowsByDate.get(date)||[];
          const liveRows=dayRows.filter(r=>r.status!=='cancelled');
          const amount=liveRows.reduce((sum,r)=>sum+r.amount,0);
          const isToday=date===today;
          const isSelected=date===chosenDate;
          return <button type="button" key={date} onClick={()=>setSelectedDate(date)} className={'calendar-day'+(isSelected?' is-selected':'')+(isToday?' is-today':'')}>
            <span className="calendar-day-number">{day}{isToday&&<i/>}</span>
            {dayRows.slice(0,3).map(row=><span key={row.id} className={'calendar-event event-'+row.status} style={{'--event-color':colors.get(row.studentId)||C.pine}}><i/>{row.start?.slice(0,5)} {row.studentName}</span>)}
            {dayRows.length>3&&<span className="calendar-more">+{dayRows.length-3} {lang==='en'?'more':'คาบ'}</span>}
            {liveRows.length>0&&<span className="calendar-day-income">{money(amount,lang)}</span>}
          </button>;
        })}</div>
        <div className="calendar-grid-footer"><CalendarDays size={15}/>{lang==='en'?'Select any date to inspect lessons and income':'แตะวันที่เพื่อดูคาบสอนและรายได้ของวันนั้น'}</div>
      </section>

      <aside className="calendar-agenda">
        <div className="calendar-agenda-header"><div><span>{actionLabels.day}</span><h2>{selectedLabel}</h2></div><div className="calendar-agenda-total">{money(selectedAmount,lang)}<small>{selectedHours} {actionLabels.hours}</small></div></div>
        {selectedRows.length===0?<div className="calendar-agenda-empty"><CalendarDays size={25}/><p>{actionLabels.empty}</p><button type="button" onClick={()=>setTab?.('schedule')}>{actionLabels.add}</button></div>:<div className="calendar-agenda-list">{selectedRows.map(row=>{
          const isCancelled=row.status==='cancelled';
          return <article key={row.id} className={'calendar-agenda-item'+(isCancelled?' is-cancelled':'')}>
            <div className="agenda-time">{formatTime(row.start)}<span>{formatTime(row.end)}</span></div>
            <div className="agenda-detail"><strong>{row.studentName}</strong><span>{row.hours} {actionLabels.hours} · {money(row.amount,lang)}</span><em className={'agenda-status status-'+row.status}>{statusText(row)}</em></div>
            <div className="agenda-actions">{row.status==='pending'&&<button type="button" className="agenda-record-btn" onClick={()=>onOpenLessonForm?.(schedule.find(s=>s.id===row.slotId),row.date)}>{labels.saveTaught}</button>}{!isCancelled&&<button type="button" className="agenda-cancel-btn" onClick={()=>cancelSlot(row)}>{labels.cancel}</button>}{isCancelled&&<button type="button" className="agenda-undo-btn" onClick={()=>undoCancel(row)}>{labels.undo}</button>}</div>
          </article>;
        })}</div>}
        <div className="calendar-agenda-footer"><span>{actionLabels.income}</span><strong>{money(selectedAmount,lang)}</strong><small>{selectedRows.filter(r=>r.status==='pending').length} {actionLabels.pending} · {selectedRows.filter(r=>r.status==='forecast').length} {actionLabels.forecast}</small></div>
      </aside>
    </div>}

    <button type="button" className="calendar-trend-toggle" onClick={()=>setShowTrend(v=>!v)}><span>{labels.chartTitle}</span><span>{showTrend?'−':'+'}</span></button>
    {showTrend&&<section className="calendar-trend-panel"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:12,right:4,left:4,bottom:4}}><CartesianGrid strokeDasharray="0" vertical={false} stroke={C.line}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}} width={48} tickFormatter={v=>Math.round(v/1000)+'k'}/><Tooltip formatter={(value,name)=>[money(value,lang),name==='confirmed'?labels.chartActual:labels.chartForecast]}/><Bar dataKey="confirmed" stackId="income" fill={C.pine} isAnimationActive={false}/><Bar dataKey="forecast" stackId="income" fill={C.blue} isAnimationActive={false}/></BarChart></ResponsiveContainer></div></section>}
  </div>;
}
