'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, BookOpen, Wallet, CheckCircle2, Circle, Search, X, Trash2, PencilLine, CalendarPlus, NotebookPen } from 'lucide-react';

const DAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const FULL_DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const money = n => '฿' + Math.round(Number(n)||0).toLocaleString('th-TH');
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = s => new Date(`${s}T12:00:00`);
const dayIndex = d => (d.getDay()+6)%7;
const id = () => crypto.randomUUID();

export default function TeachingHub({students=[],schedule=[],sessions=[],exceptions=[],updateSchedule,updateSessions,updateExceptions,showToast,recordRequest,clearRecordRequest}) {
  const [view,setView] = useState('calendar');
  const [month,setMonth] = useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
  const [selectedDate,setSelectedDate] = useState(keyOf(new Date()));
  const [showScheduleForm,setShowScheduleForm] = useState(false);
  const [showLessonForm,setShowLessonForm] = useState(false);
  const [query,setQuery] = useState('');
  const [scheduleForm,setScheduleForm] = useState({studentId:'',recurring:true,day:dayIndex(new Date()),date:keyOf(new Date()),start:'10:00',end:'11:00'});
  const [lessonForm,setLessonForm] = useState({studentId:'',date:keyOf(new Date()),hours:'1',note:'',sourceSlotId:''});
  const [busy,setBusy] = useState(false);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}`;
  const activeStudents = students.filter(s=>(s.status||'active')==='active');
  const monthSessions = sessions.filter(s=>String(s.date||'').startsWith(monthKey));
  const monthIncome = monthSessions.reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
  const unpaid = sessions.filter(s=>!s.paid).reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0);
  const calendarDays = useMemo(()=>{
    const first=new Date(month.getFullYear(),month.getMonth(),1);
    const start=new Date(first); start.setDate(first.getDate()-dayIndex(first));
    return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
  },[month]);
  const entriesFor = date => {
    const d=parseDate(date), dow=dayIndex(d);
    const slots=schedule.filter(s=>(s.recurring&&Number(s.day)===dow)||(!s.recurring&&s.date===date))
      .filter(s=>!exceptions.some(e=>e.slotId===s.id&&e.date===date&&e.status==='cancelled'))
      .map(slot=>({slot,student:students.find(s=>s.id===slot.studentId),session:sessions.find(x=>x.sourceSlotId===slot.id&&x.date===date)}))
      .sort((a,b)=>String(a.slot.start).localeCompare(String(b.slot.start)));
    const standalone=sessions.filter(s=>s.date===date&&!s.sourceSlotId).map(session=>({session,student:students.find(x=>x.id===session.studentId)}));
    return {slots,standalone};
  };
  const selectedEntries=entriesFor(selectedDate);
  const monthSlots=calendarDays.filter(d=>d.getMonth()===month.getMonth()).reduce((sum,d)=>sum+entriesFor(keyOf(d)).slots.length,0);
  const openLesson = (studentId='',date=selectedDate,slot=null) => {
    setLessonForm({studentId:studentId||slot?.studentId||'',date,hours:slot?String(Math.max(.5,(Number(slot.end?.slice(0,2))*60+Number(slot.end?.slice(3,5))-Number(slot.start?.slice(0,2))*60-Number(slot.start?.slice(3,5)))/60)):'1',note:'',sourceSlotId:slot?.id||''});
    setShowLessonForm(true);
  };
  useEffect(()=>{if(recordRequest){openLesson(recordRequest.slot?.studentId||'',recordRequest.date||selectedDate,recordRequest.slot||null);setView('calendar');clearRecordRequest?.();}},[recordRequest]);
  const saveSchedule = async e => {
    e.preventDefault(); if(!scheduleForm.studentId)return showToast?.('กรุณาเลือกนักเรียน');
    setBusy(true);
    const row={id:id(),studentId:scheduleForm.studentId,recurring:scheduleForm.recurring,day:scheduleForm.recurring?Number(scheduleForm.day):undefined,date:scheduleForm.recurring?undefined:scheduleForm.date,start:scheduleForm.start,end:scheduleForm.end};
    const ok=await updateSchedule([...schedule,row]);
    setBusy(false);
    if(ok){setShowScheduleForm(false);showToast?.('เพิ่มตารางสอนแล้ว');setView('calendar');setSelectedDate(row.recurring?selectedDate:row.date);}
  };
  const saveLesson = async e => {
    e.preventDefault(); const student=students.find(s=>s.id===lessonForm.studentId);
    if(!student)return showToast?.('กรุณาเลือกนักเรียน');
    const duration=Number(lessonForm.hours); if(!(duration>0))return showToast?.('กรอกจำนวนชั่วโมงให้ถูกต้อง');
    setBusy(true);
    const row={id:id(),studentId:student.id,studentName:student.name,date:lessonForm.date,hours:duration,rate:Number(student.rate)||0,note:lessonForm.note.trim(),invoiced:false,paid:false,sourceSlotId:lessonForm.sourceSlotId||undefined};
    const ok=await updateSessions([...sessions,row]);
    setBusy(false);
    if(ok){setShowLessonForm(false);setSelectedDate(row.date);setMonth(new Date(parseDate(row.date).getFullYear(),parseDate(row.date).getMonth(),1));setView('calendar');showToast?.('บันทึกคาบสอนแล้ว');}
  };
  const filtered=[...sessions].sort((a,b)=>String(b.date).localeCompare(String(a.date))).filter(s=>`${s.studentName} ${s.note} ${s.date}`.toLowerCase().includes(query.toLowerCase()));
  const togglePaid=async s=>{await updateSessions(sessions.map(x=>x.id===s.id?{...x,paid:!x.paid}:x));};
  const removeSchedule=async slot=>{if(!window.confirm('ลบตารางสอนรายการนี้?'))return;await updateSchedule(schedule.filter(x=>x.id!==slot.id),[slot.id]);};
  const tabs=[['calendar','ปฏิทินสอน',CalendarDays],['schedule','ตารางประจำ',CalendarPlus],['history','ประวัติคาบ',NotebookPen]];
  return <main className="thub">
    <header className="thub-hero"><div className="thub-hero-orb"/><div className="thub-eyebrow">DOLLA TUTOR · TEACHING SPACE</div><div className="thub-hero-row"><div><h1>จัดการการสอน</h1><p>ตารางเรียน บันทึกหลังสอน และยอดค่าสอน — รวมไว้ในพื้นที่เดียว</p></div><button className="thub-main-action" onClick={()=>openLesson('',selectedDate)}><Plus size={17}/> บันทึกคาบสอน</button></div>
      <div className="thub-stats"><div><span>คาบที่บันทึกเดือนนี้</span><strong>{monthSessions.length}</strong></div><div><span>รายได้ที่บันทึกแล้ว</span><strong>{money(monthIncome)}</strong></div><div><span>ยอดค้างชำระทั้งหมด</span><strong>{money(unpaid)}</strong></div></div>
    </header>
    <nav className="thub-tabs">{tabs.map(([key,label,Icon])=><button key={key} className={view===key?'is-active':''} onClick={()=>setView(key)}><Icon size={17}/>{label}</button>)}</nav>
    {view==='calendar'&&<section className="thub-layout"><div className="thub-panel thub-calendar-panel"><div className="thub-panel-head"><div><span className="thub-kicker">MONTH VIEW</span><h2>ปฏิทินสอน</h2></div><div className="thub-month-nav"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} aria-label="เดือนก่อน"><ChevronLeft size={18}/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()+543}</strong><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} aria-label="เดือนถัดไป"><ChevronRight size={18}/></button></div></div>
      <div className="thub-calendar-grid">{DAYS.map(d=><div key={d} className="thub-weekday">{d}</div>)}{calendarDays.map(d=>{const key=keyOf(d),{slots}=entriesFor(key),outside=d.getMonth()!==month.getMonth();return <button key={key} className={`thub-day ${outside?'is-outside':''} ${selectedDate===key?'is-selected':''} ${key===keyOf(new Date())?'is-today':''}`} onClick={()=>setSelectedDate(key)}><span className="thub-day-number">{d.getDate()}</span>{slots.slice(0,2).map(({slot,student,session})=><span key={slot.id} className={`thub-day-event ${session?'is-done':''}`}><i/>{student?.name||'ไม่ระบุ'}</span>)}{slots.length>2&&<small>+{slots.length-2} คาบ</small>}</button>})}</div>
      <div className="thub-calendar-foot"><span><i className="thub-dot-scheduled"/> มีคาบตามตาราง</span><span><i className="thub-dot-done"/> บันทึกแล้ว</span><span className="thub-foot-total">{monthSlots} คาบตามตารางเดือนนี้</span></div></div>
      <aside className="thub-panel thub-day-panel"><div className="thub-panel-head"><div><span className="thub-kicker">SELECTED DAY</span><h2>{parseDate(selectedDate).getDate()} {MONTHS[parseDate(selectedDate).getMonth()]}</h2><p>{FULL_DAYS[dayIndex(parseDate(selectedDate))]} · {parseDate(selectedDate).getFullYear()+543}</p></div><button className="thub-icon-button" onClick={()=>openLesson('',selectedDate)} title="เพิ่มบันทึกคาบ"><Plus size={18}/></button></div>
      {selectedEntries.slots.length===0&&selectedEntries.standalone.length===0?<div className="thub-empty"><div><CalendarDays size={23}/></div><strong>วันนี้ยังไม่มีคาบสอน</strong><p>เลือกวันอื่น หรือเพิ่มคาบสอนใหม่ได้เลย</p><button onClick={()=>{setScheduleForm(f=>({...f,recurring:false,date:selectedDate}));setShowScheduleForm(true);setView('schedule')}}>เพิ่มลงตาราง</button></div>:<div className="thub-day-list">{selectedEntries.slots.map(({slot,student,session})=><article key={slot.id} className="thub-lesson-card"><div className="thub-time"><strong>{slot.start}</strong><span>{slot.end}</span></div><div className="thub-lesson-copy"><strong>{student?.name||'ไม่ระบุนักเรียน'}</strong><span>{student?.subjects?.join(' · ')||student?.grade||'เรียนพิเศษ'}</span><small>{session?'บันทึกการสอนแล้ว':'รอบันทึกหลังสอน'} · {money((student?.rate||0)*Math.max(0,(Number(slot.end?.slice(0,2))*60+Number(slot.end?.slice(3,5))-Number(slot.start?.slice(0,2))*60-Number(slot.start?.slice(3,5)))/60))}</small></div>{session?<CheckCircle2 className="thub-complete" size={19}/>:<button className="thub-record-link" onClick={()=>openLesson(student?.id,selectedDate,slot)}>บันทึก</button>}</article>)}{selectedEntries.standalone.map(({session,student})=><article key={session.id} className="thub-lesson-card"><div className="thub-time"><strong>{session.hours} ชม.</strong><span>{session.date.slice(5)}</span></div><div className="thub-lesson-copy"><strong>{student?.name||session.studentName}</strong><span>{session.note||'บันทึกคาบสอน'}</span><small>{money(session.hours*session.rate)}</small></div><CheckCircle2 className="thub-complete" size={19}/></article>)}</div>}
      <button className="thub-bottom-action" onClick={()=>{setScheduleForm(f=>({...f,recurring:false,date:selectedDate}));setShowScheduleForm(true);setView('schedule')}}><CalendarPlus size={16}/> เพิ่มคาบลงตาราง</button>
    </aside></section>}
    {view==='schedule'&&<section className="thub-panel thub-manage-panel"><div className="thub-panel-head"><div><span className="thub-kicker">YOUR ROUTINE</span><h2>ตารางเรียนประจำ</h2><p>ตั้งคาบที่เรียนซ้ำทุกสัปดาห์ หรือกำหนดเป็นวันเฉพาะ</p></div><button className="thub-main-action" onClick={()=>{setScheduleForm({studentId:activeStudents[0]?.id||'',recurring:true,day:dayIndex(new Date()),date:selectedDate,start:'10:00',end:'11:00'});setShowScheduleForm(true)}}><Plus size={17}/> เพิ่มตาราง</button></div>
      {schedule.length===0?<div className="thub-empty"><div><CalendarPlus size={24}/></div><strong>ยังไม่มีตารางสอน</strong><p>เพิ่มคาบประจำเพื่อให้เห็นภาพรวมในปฏิทิน</p></div>:<div className="thub-schedule-list">{schedule.slice().sort((a,b)=>(Number(a.day??8)-Number(b.day??8))||String(a.start).localeCompare(String(b.start))).map(slot=>{const student=students.find(s=>s.id===slot.studentId);return <article key={slot.id} className="thub-schedule-row"><div className="thub-schedule-day"><CalendarDays size={17}/><span>{slot.recurring?FULL_DAYS[Number(slot.day)]||'ไม่ระบุวัน':parseDate(slot.date).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</span></div><div className="thub-schedule-student"><strong>{student?.name||'นักเรียนที่ถูกลบ'}</strong><small>{student?.subjects?.join(' · ')||student?.grade||'เรียนพิเศษ'}</small></div><div className="thub-schedule-time"><Clock3 size={15}/>{slot.start}–{slot.end}</div><div className="thub-schedule-rate">{money((student?.rate||0)*Math.max(0,(Number(slot.end?.slice(0,2))*60+Number(slot.end?.slice(3,5))-Number(slot.start?.slice(0,2))*60-Number(slot.start?.slice(3,5)))/60))}<small>/คาบ</small></div><button className="thub-delete-button" onClick={()=>removeSchedule(slot)} aria-label="ลบตาราง"><Trash2 size={16}/></button></article>})}</div>}
    </section>}
    {view==='history'&&<section className="thub-panel thub-history-panel"><div className="thub-panel-head"><div><span className="thub-kicker">LESSON JOURNAL</span><h2>ประวัติคาบสอน</h2><p>รายละเอียดหลังสอน ยอดค่าเรียน และสถานะการชำระ</p></div><label className="thub-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อนักเรียนหรือหัวข้อ"/></label></div>
      {!filtered.length?<div className="thub-empty"><div><BookOpen size={24}/></div><strong>{sessions.length?'ไม่พบรายการที่ค้นหา':'ยังไม่มีประวัติคาบสอน'}</strong><p>บันทึกคาบสอนหลังเรียนเสร็จ แล้วประวัติจะปรากฏที่นี่</p><button onClick={()=>openLesson('',selectedDate)}>บันทึกคาบแรก</button></div>:<div className="thub-history-list">{filtered.map(s=><article key={s.id} className="thub-history-row"><div className="thub-history-date"><strong>{parseDate(s.date).getDate()}</strong><span>{MONTHS[parseDate(s.date).getMonth()].slice(0,3)} {parseDate(s.date).getFullYear()+543}</span></div><div className="thub-history-copy"><strong>{s.studentName||students.find(x=>x.id===s.studentId)?.name||'ไม่ระบุชื่อนักเรียน'}</strong><p>{s.note||'ยังไม่ได้เพิ่มรายละเอียดการสอน'}</p><div className="thub-tags"><span>{s.hours} ชั่วโมง</span><span className={s.paid?'is-paid':'is-unpaid'}>{s.paid?'ชำระแล้ว':'รอชำระ'}</span><span>{s.invoiced?'แจ้งค่าสอนแล้ว':'ยังไม่แจ้งค่าสอน'}</span></div></div><div className="thub-history-total"><strong>{money(s.hours*s.rate)}</strong><button onClick={()=>togglePaid(s)} className={s.paid?'is-paid':''}>{s.paid?'ยกเลิกสถานะชำระ':'ทำเครื่องหมายว่าชำระแล้ว'}</button></div></article>)}</div>}
    </section>}
    {showScheduleForm&&<div className="thub-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowScheduleForm(false)}}><form className="thub-modal" onSubmit={saveSchedule}><button type="button" className="thub-modal-close" onClick={()=>setShowScheduleForm(false)}><X size={18}/></button><span className="thub-kicker">ADD TO SCHEDULE</span><h2>เพิ่มคาบลงตาราง</h2><p>กำหนดเวลาให้ชัดเจน แล้วระบบจะช่วยคำนวณยอดคาดการณ์</p><label>นักเรียน<select required value={scheduleForm.studentId} onChange={e=>setScheduleForm(f=>({...f,studentId:e.target.value}))}><option value="">เลือกนักเรียน</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="thub-choice-row"><button type="button" className={scheduleForm.recurring?'is-selected':''} onClick={()=>setScheduleForm(f=>({...f,recurring:true}))}>เรียนทุกสัปดาห์</button><button type="button" className={!scheduleForm.recurring?'is-selected':''} onClick={()=>setScheduleForm(f=>({...f,recurring:false,date:selectedDate}))}>วันเฉพาะ</button></div>{scheduleForm.recurring?<label>วันเรียน<select value={scheduleForm.day} onChange={e=>setScheduleForm(f=>({...f,day:Number(e.target.value)}))}>{FULL_DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>:<label>วันที่เรียน<input type="date" required value={scheduleForm.date} onChange={e=>setScheduleForm(f=>({...f,date:e.target.value}))}/></label>}<div className="thub-form-grid"><label>เวลาเริ่ม<input type="time" required value={scheduleForm.start} onChange={e=>setScheduleForm(f=>({...f,start:e.target.value}))}/></label><label>เวลาสิ้นสุด<input type="time" required value={scheduleForm.end} onChange={e=>setScheduleForm(f=>({...f,end:e.target.value}))}/></label></div><div className="thub-form-hint">ค่าเรียนโดยประมาณ: <strong>{money((activeStudents.find(s=>s.id===scheduleForm.studentId)?.rate||0)*Math.max(0,(Number(scheduleForm.end.slice(0,2))*60+Number(scheduleForm.end.slice(3,5))-Number(scheduleForm.start.slice(0,2))*60-Number(scheduleForm.start.slice(3,5)))/60))}</strong> / คาบ</div><button className="thub-submit" disabled={busy||!activeStudents.length}>{busy?'กำลังบันทึก…':'บันทึกตารางสอน'}</button></form></div>}
    {showLessonForm&&<div className="thub-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowLessonForm(false)}}><form className="thub-modal" onSubmit={saveLesson}><button type="button" className="thub-modal-close" onClick={()=>setShowLessonForm(false)}><X size={18}/></button><span className="thub-kicker">AFTER-LESSON NOTE</span><h2>บันทึกคาบสอน</h2><p>เก็บหัวข้อที่เรียนและยอดค่าเรียน เพื่อใช้ติดตามกับผู้ปกครอง</p><label>นักเรียน<select required value={lessonForm.studentId} onChange={e=>setLessonForm(f=>({...f,studentId:e.target.value}))}><option value="">เลือกนักเรียน</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>วันที่สอน<input type="date" required value={lessonForm.date} onChange={e=>setLessonForm(f=>({...f,date:e.target.value}))}/></label><div className="thub-form-grid"><label>จำนวนชั่วโมง<input type="number" min="0.25" step="0.25" required value={lessonForm.hours} onChange={e=>setLessonForm(f=>({...f,hours:e.target.value}))}/></label><div className="thub-fee-preview"><span>ยอดค่าสอน</span><strong>{money((Number(lessonForm.hours)||0)*(activeStudents.find(s=>s.id===lessonForm.studentId)?.rate||0))}</strong></div></div><label>รายละเอียดที่สอน<textarea rows="4" value={lessonForm.note} onChange={e=>setLessonForm(f=>({...f,note:e.target.value}))} placeholder="เช่น คณิตศาสตร์: สมการเชิงเส้น ทำแบบฝึกหัดหน้า 12–15"/></label><button className="thub-submit" disabled={busy||!activeStudents.length}>{busy?'กำลังบันทึก…':'บันทึกคาบสอน'}</button></form></div>}
  </main>;
}
