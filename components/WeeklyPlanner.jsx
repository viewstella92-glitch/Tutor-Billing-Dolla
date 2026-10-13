'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, CheckCircle2, Circle, Wallet, BookOpen } from 'lucide-react';

const C = { paper:'#FAF6EC', paperDeep:'#F1EAD8', ink:'#23282B', inkSoft:'#6B7270', line:'#DED4B8', surface:'#FFFFFF', pine:'#2E5E45', pineDark:'#20402F', pineTint:'#E7EFE7', gold:'#A8781F', goldTint:'#F5EBD4' };
const DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
const SHORT = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
const money = n => '฿' + Math.round(Number(n)||0).toLocaleString('th-TH');
const dateKey = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const mondayOf = d => { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x; };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtDay = d => d.toLocaleDateString('th-TH',{day:'numeric',month:'short'});
const fmtMonth = d => d.toLocaleDateString('th-TH',{month:'long',year:'numeric'});

export default function WeeklyPlanner({ students=[], schedule=[], sessions=[], showToast, onOpenLessonForm }) {
  const [weekStart,setWeekStart] = useState(()=>mondayOf(new Date()));
  const days = useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const today = dateKey(new Date());
  const activeStudents = students.filter(s=>s.status!=='inactive');
  const weekSlots = days.flatMap((date,idx)=>{
    const key=dateKey(date);
    return schedule.filter(sl => (sl.recurring && Number(sl.day)===idx) || (!sl.recurring && sl.date===key))
      .map(sl=>({...sl, date:key, dayIndex:idx, student:students.find(s=>s.id===sl.studentId)}))
      .sort((a,b)=>(a.start||'').localeCompare(b.start||''));
  });
  const weekSessions = sessions.filter(s=>s.date>=dateKey(weekStart)&&s.date<=dateKey(addDays(weekStart,6)));
  const hours = weekSessions.reduce((n,s)=>n+(Number(s.hours)||0),0);
  const income = weekSessions.reduce((n,s)=>n+(Number(s.hours)||0)*(Number(s.rate)||0),0);
  const isLogged = slot => sessions.some(s=>s.sourceSlotId===slot.id&&s.date===slot.date);
  const onRecord = slot => {
    if (!slot.student) { showToast?.('ไม่พบนักเรียนของตารางนี้'); return; }
    if (isLogged(slot)) { showToast?.('บันทึกคาบนี้แล้ว'); return; }
    if (slot.date>today) { showToast?.('ยังบันทึกคาบอนาคตไม่ได้'); return; }
    onOpenLessonForm?.(slot,slot.date);
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold">แพลนสัปดาห์</h1><p className="mt-1 text-sm" style={{color:C.inkSoft}}>ดูตารางสอนและบันทึกคาบเรียนจากแผนรายสัปดาห์</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={()=>setWeekStart(mondayOf(new Date()))} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:C.line}}>สัปดาห์นี้</button>
        <button type="button" aria-label="สัปดาห์ก่อน" onClick={()=>setWeekStart(d=>addDays(d,-7))} className="rounded-lg border p-2" style={{borderColor:C.line}}><ChevronLeft size={18}/></button>
        <button type="button" aria-label="สัปดาห์ถัดไป" onClick={()=>setWeekStart(d=>addDays(d,7))} className="rounded-lg border p-2" style={{borderColor:C.line}}><ChevronRight size={18}/></button>
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div className="rounded-xl border p-3" style={{background:C.surface,borderColor:C.line}}><div className="text-xs" style={{color:C.inkSoft}}>คาบที่บันทึกแล้ว</div><div className="mt-1 text-xl font-semibold">{weekSessions.length}</div></div>
      <div className="rounded-xl border p-3" style={{background:C.surface,borderColor:C.line}}><div className="text-xs" style={{color:C.inkSoft}}>ชั่วโมงสอนจริง</div><div className="mt-1 text-xl font-semibold">{Math.round(hours*100)/100} ชม.</div></div>
      <div className="rounded-xl border p-3" style={{background:C.surface,borderColor:C.line}}><div className="text-xs" style={{color:C.inkSoft}}>รายได้ที่บันทึก</div><div className="mt-1 text-xl font-semibold">{money(income)}</div></div>
      <div className="rounded-xl border p-3" style={{background:C.surface,borderColor:C.line}}><div className="text-xs" style={{color:C.inkSoft}}>คาบตามแผน</div><div className="mt-1 text-xl font-semibold">{weekSlots.length}</div></div>
    </div>
    <div className="rounded-xl border px-4 py-3" style={{background:C.pineDark,color:'#fff',borderColor:C.pineDark}}>
      <div className="flex items-center gap-2 text-sm"><CalendarDays size={17}/><span className="font-semibold">{fmtMonth(weekStart)}</span></div>
      <div className="mt-1 text-xs opacity-80">{fmtDay(weekStart)} – {fmtDay(addDays(weekStart,6))} · เลือก “บันทึกคาบสอน” เพื่อกรอกรายละเอียดบทเรียน คะแนน และการบ้าน</div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {days.map((date,idx)=>{
        const key=dateKey(date), daySlots=weekSlots.filter(s=>s.date===key), isToday=key===today;
        return <section key={key} className="min-w-0 rounded-xl border overflow-hidden" style={{background:C.surface,borderColor:isToday?C.pine:C.line,boxShadow:isToday?'0 0 0 1px '+C.pine:'none'}}>
          <div className="flex items-center justify-between px-3 py-3" style={{background:isToday?C.pineTint:C.paper}}>
            <div><div className="text-sm font-semibold">{DAYS[idx]}</div><div className="text-xs mt-0.5" style={{color:C.inkSoft}}>{fmtDay(date)}{isToday?' · วันนี้':''}</div></div>
            <span className="rounded-full px-2 py-1 text-xs" style={{background:'#fff',color:C.inkSoft}}>{daySlots.length} คาบ</span>
          </div>
          <div className="p-2 space-y-2 min-h-28">
            {!daySlots.length&&<div className="py-5 text-center text-xs" style={{color:C.inkSoft}}>ไม่มีตารางสอน</div>}
            {daySlots.map(slot=>{
              const student=slot.student, logged=isLogged(slot), future=slot.date>today;
              return <article key={slot.id+'-'+slot.date} className="rounded-lg border p-3" style={{borderColor:logged?'#B8CCB8':C.line,background:logged?C.pineTint:'#fff'}}>
                <div className="flex items-start gap-2"><div className="mt-0.5" style={{color:logged?C.pine:C.gold}}>{logged?<CheckCircle2 size={17}/>:<Circle size={17}/>}</div><div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm break-words">{student?.name||'ไม่พบนักเรียน'}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs" style={{color:C.inkSoft}}><Clock3 size={13}/>{slot.start||'--:--'} – {slot.end||'--:--'}</div>
                  <div className="mt-1 text-xs" style={{color:C.inkSoft}}><BookOpen size={12} className="inline mr-1"/>{student?.subjects?.join(' · ')||student?.grade||'ยังไม่ได้ระบุวิชา'}</div>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs font-medium" style={{color:C.pine}}>{logged?'บันทึกแล้ว':future?'ตามแผน': 'รอบันทึกผล'}</span>{!logged&&<button type="button" disabled={future||!student} onClick={()=>onRecord(slot)} className="rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40" style={{background:C.pine,color:'#fff'}}>บันทึกคาบสอน</button>}</div>
                  <div className="mt-2 text-xs" style={{color:C.inkSoft}}>ประมาณ {money((Math.max(0,((Number((slot.end||'0:0').split(':')[0])*60+Number((slot.end||'0:0').split(':')[1]))-(Number((slot.start||'0:0').split(':')[0])*60+Number((slot.start||'0:0').split(':')[1])))/60))*Number(student?.rate||0))}</div>
                </div></div>
              </article>
            })}
          </div>
        </section>;
      })}
    </div>
    {!activeStudents.length&&<p className="text-sm" style={{color:C.inkSoft}}>เพิ่มนักเรียนก่อน จึงจะเริ่มจัดแพลนสัปดาห์ได้</p>}
  </div>;
}
