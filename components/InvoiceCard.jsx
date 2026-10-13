'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Check, BookOpen, CalendarDays, Clock3, BookMarked, MessageCircle, Target } from 'lucide-react';

const PALETTE = {
  paper: '#FFFBF2', ink: '#23282B', soft: '#6B7270', line: '#E8DFC9',
  pine: '#2E5E45', pineDark: '#20402F', teal: '#2E8B8B',
  resultBg: '#E5F2E7', resultInk: '#2E6845', stuckBg: '#FFF0C2', stuckInk: '#795719',
  homeworkBg: '#E0F0FF', homeworkInk: '#245C85', white: '#FFFFFF',
  math: '#4F5BD5', physics: '#0F8A8A', english: '#D9485F',
  chinese: '#C0392B', science: '#2E8B57', other: '#2E5E45'
};
const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function localToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtDateThai(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'ไม่ระบุวันที่';
  const [y,m,d] = dateStr.split('-').map(Number);
  return d + ' ' + (TH_MONTHS[m-1] || '') + ' ' + (y+543);
}
function fmtMoney(n) { return '฿' + Math.round(Number(n)||0).toLocaleString('th-TH'); }
function fmtHours(n) {
  return (Math.round((Number(n)||0)*100)/100).toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
function monthLabel(dateStr) {
  const key = (dateStr || localToday()).slice(0,7);
  const [y,m] = key.split('-').map(Number);
  return (TH_MONTHS[m-1] || '') + ' ' + (y+543);
}
function parseLessonNote(note) {
  const out = { taught:'', outcome:'', score:'', stuck:'', homework:'', hasKnown:false };
  String(note || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('สอน:')) { out.taught = line.slice(5).trim(); out.hasKnown = true; }
    else if (line.startsWith('ผลการเรียน:')) { out.outcome = line.slice('ผลการเรียน:'.length).trim(); out.hasKnown = true; }
    else if (line.startsWith('คะแนน:')) { out.score = line.slice('คะแนน:'.length).trim(); out.hasKnown = true; }
    else if (line.startsWith('ติดขัด:')) { out.stuck = line.slice('ติดขัด:'.length).trim(); out.hasKnown = true; }
    else if (line.startsWith('การบ้าน:')) { out.homework = line.slice('การบ้าน:'.length).trim(); out.hasKnown = true; }
  });
  return out;
}
function subjectFromSession(session, student) {
  const parsed = parseLessonNote(session?.note);
  const raw = parsed.taught || (Array.isArray(student?.subjects) ? student.subjects[0] : '') || '';
  const first = raw.split(/[·•—-]/)[0].trim();
  if (/คณิต/.test(first)) return { name:'คณิตศาสตร์', color:PALETTE.math };
  if (/ฟิสิกส์/.test(first)) return { name:'ฟิสิกส์', color:PALETTE.physics };
  if (/อังกฤษ|ภาษาอังกฤษ/.test(first)) return { name:'ภาษาอังกฤษ', color:PALETTE.english };
  if (/จีน|ภาษาจีน/.test(first)) return { name:'ภาษาจีน', color:PALETTE.chinese };
  if (/วิทยาศาสตร์|วิทย์/.test(first)) return { name:'วิทยาศาสตร์', color:PALETTE.science };
  return { name:first || 'บันทึกการสอน', color:PALETTE.other };
}
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = typeof r === 'number' ? { tl:r, tr:r, br:r, bl:r } : r;
  ctx.beginPath(); ctx.moveTo(x+rr.tl,y); ctx.lineTo(x+w-rr.tr,y);
  ctx.arcTo(x+w,y,x+w,y+rr.tr,rr.tr); ctx.lineTo(x+w,y+h-rr.br);
  ctx.arcTo(x+w,y+h,x+w-rr.br,y+h,rr.br); ctx.lineTo(x+rr.bl,y+h);
  ctx.arcTo(x,y+h,x,y+h-rr.bl,rr.bl); ctx.lineTo(x,y+rr.tl);
  ctx.arcTo(x,y,x+rr.tl,y,rr.tl); ctx.closePath();
}
function wrapThai(ctx, text, maxWidth) {
  const result = []; let line = '';
  for (const ch of String(text || '')) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) { result.push(line); line = ch; }
    else line = next;
  }
  if (line) result.push(line);
  return result;
}
function rounded(ctx,x,y,w,h,r,fill,stroke) {
  roundRectPath(ctx,x,y,w,h,r);
  if (fill) { ctx.fillStyle=fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke(); }
}

export default function InvoiceCard({ student, sessions = [], invoiceDates, tutorMessage: initialTutorMessage, onMarkInvoiced }) {
  const canvasRef = useRef(null);
  const [tutorMessage, setTutorMessage] = useState(initialTutorMessage || 'ขอบคุณผู้ปกครองที่สนับสนุนการเรียนของน้องนะคะ หากมีข้อสงสัยเกี่ยวกับการเรียนสามารถสอบถามได้เสมอค่ะ');
  const [status, setStatus] = useState('');
  const safeSessions = useMemo(() => (sessions || [])
    .filter(s => s && s.studentId === student?.id && typeof s.date === 'string')
    .filter(s => !invoiceDates?.from || s.date >= invoiceDates.from)
    .filter(s => !invoiceDates?.to || s.date <= invoiceDates.to)
    .sort((a,b) => a.date.localeCompare(b.date)), [sessions, student?.id, invoiceDates?.from, invoiceDates?.to]);
  const totalHours = safeSessions.reduce((sum,s)=>sum+(Number(s.hours)||0),0);
  const totalAmount = safeSessions.reduce((sum,s)=>sum+(Number(s.hours)||0)*(Number(s.rate)||0),0);
  const lessonRows = safeSessions.map(s => ({...s, parsed:parseLessonNote(s.note), subject:subjectFromSession(s,student)}));
  const shownRows = lessonRows.slice(-6);
  const topicCount = new Set(lessonRows.map(r=>r.parsed.taught.trim()).filter(Boolean)).size;
  const rangeLabel = invoiceDates?.from && invoiceDates?.to
    ? (invoiceDates.from.slice(0,7) === invoiceDates.to.slice(0,7) ? monthLabel(invoiceDates.from) : fmtDateThai(invoiceDates.from)+' – '+fmtDateThai(invoiceDates.to))
    : monthLabel(safeSessions[0]?.date || localToday());
  const textMessage = [
    'บันทึกการสอน · ' + (student?.name || 'นักเรียน'),
    rangeLabel,
    student?.grade ? 'ระดับชั้น ' + student.grade : '',
    '',
    ...shownRows.map(row => {
      const p = row.parsed;
      const parts = [fmtDateThai(row.date) + ' · ' + (p.taught || 'บันทึกการสอน') + ' · ' + fmtHours(row.hours) + ' ชั่วโมง'];
      if (p.outcome) parts.push('ผลการเรียน: ' + p.outcome);
      if (p.stuck) parts.push('ยังติด: ' + p.stuck);
      if (p.homework) parts.push('การบ้าน: ' + p.homework);
      return parts.join('\n');
    }),
    lessonRows.length > 6 ? 'และอีก ' + (lessonRows.length-6) + ' คาบ' : '',
    '',
    tutorMessage.trim() ? 'ข้อความจากติวเตอร์: ' + tutorMessage.trim() : '',
    '',
    'ค่าเรียนเดือนนี้: ' + fmtMoney(totalAmount) + ' · ' + fmtHours(totalHours) + ' ชั่วโมง'
  ].filter(Boolean).join('\n');

  const drawCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !student) return null;
    try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
    const width = 720, scale = 2, pad = 30, contentW = width-pad*2;
    const ctx = canvas.getContext('2d');
    const measureLines = [];
    const pushWrap = (text, max=contentW, font='400 15px sans-serif') => {
      ctx.font=font; wrapThai(ctx,text,max).forEach(line=>measureLines.push({text:line,font}));
    };
    // Measure dynamic height first, so Thai text never spills into following sections.
    ctx.font='400 15px sans-serif';
    const headerH=168;
    measureLines.push({type:'stats'});
    if (!shownRows.length) measureLines.push({type:'empty'});
    shownRows.forEach(row=>{
      measureLines.push({type:'lessonTop',row});
      pushWrap(row.parsed.taught || 'บันทึกการสอน', contentW-30, '700 18px sans-serif');
      if (row.parsed.outcome) pushWrap('ผลการเรียน: '+row.parsed.outcome,contentW-30);
      if (row.parsed.stuck) pushWrap('ยังติด: '+row.parsed.stuck,contentW-30);
      if (row.parsed.homework) pushWrap('การบ้าน: '+row.parsed.homework,contentW-30);
      measureLines.push({type:'gap'});
    });
    if (lessonRows.length>6) measureLines.push({type:'more',text:'และอีก '+(lessonRows.length-6)+' คาบ'});
    measureLines.push({type:'messageTitle'}); pushWrap(tutorMessage || 'วันนี้น้องตั้งใจเรียนและค่อย ๆ พัฒนาขึ้นค่ะ',contentW-42);
    const nextLesson = student?.nextLesson || student?.nextSession || null;
    if (nextLesson && (nextLesson.topic || nextLesson.date || nextLesson.time)) {
      measureLines.push({type:'nextTitle'});
      pushWrap([nextLesson.topic,nextLesson.date?fmtDateThai(nextLesson.date):'',nextLesson.time].filter(Boolean).join(' · '),contentW-42);
    }
    measureLines.push({type:'footer'});
    const bodyH = measureLines.reduce((sum,item)=>sum+(item.type==='lessonTop'?28:item.type==='gap'?10:item.type==='stats'?100:item.type==='empty'?76:item.type==='messageTitle'?36:item.type==='nextTitle'?34:item.type==='footer'?82:item.type==='more'?30:25),0);
    const height=headerH+bodyH+24;
    canvas.width=width*scale; canvas.height=height*scale; canvas.style.width='100%'; canvas.style.height='auto';
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.fillStyle=PALETTE.paper; ctx.fillRect(0,0,width,height);
    rounded(ctx,0,0,width,height,22,PALETTE.paper,PALETTE.line);
    ctx.save(); roundRectPath(ctx,0,0,width,headerH,{tl:22,tr:22,br:0,bl:0}); ctx.clip();
    const grad=ctx.createLinearGradient(0,0,width,headerH); grad.addColorStop(0,PALETTE.pineDark); grad.addColorStop(1,PALETTE.teal);
    ctx.fillStyle=grad; ctx.fillRect(0,0,width,headerH);
    ctx.fillStyle='rgba(255,255,255,.08)';
    for(let n=0;n<8;n++){ctx.beginPath();ctx.arc(width-35-(n%4)*42,25+Math.floor(n/4)*52,34,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='600 14px sans-serif';ctx.fillText('บันทึกการสอน',pad,31);
    ctx.fillStyle='#FFFFFF';ctx.font='700 32px sans-serif';
    const nameLines=wrapThai(ctx,student.name||'นักเรียน',contentW);
    ctx.fillText(nameLines[0]||'นักเรียน',pad,73);
    ctx.font='400 15px sans-serif';ctx.fillStyle='rgba(255,255,255,.92)';
    ctx.fillText([student.grade,...(student.subjects||[])].filter(Boolean).join(' · ').slice(0,70),pad,104);
    rounded(ctx,pad,120,Math.min(220,ctx.measureText(rangeLabel).width+26),28,14,'rgba(255,255,255,.16)');
    ctx.fillStyle='#FFFFFF';ctx.font='600 13px sans-serif';ctx.fillText(rangeLabel,pad+13,139);
    let y=headerH+18;
    const statGap=10, statW=(contentW-statGap*2)/3;
    const stats=[{label:'ชั่วโมงสอน',value:fmtHours(totalHours)+' ชม.',bg:'#E7EFE7',color:PALETTE.pineDark},{label:'จำนวนคาบ',value:String(safeSessions.length)+' คาบ',bg:'#E0F0FF',color:'#245C85'},{label:'หัวข้อที่เรียน',value:String(topicCount)+' หัวข้อ',bg:'#FFF0C2',color:'#795719'}];
    stats.forEach((st,i)=>{const x=pad+i*(statW+statGap);rounded(ctx,x,y,statW,74,12,st.bg);ctx.fillStyle=PALETTE.soft;ctx.font='400 13px sans-serif';ctx.fillText(st.label,x+13,y+25);ctx.fillStyle=st.color;ctx.font='700 21px sans-serif';ctx.fillText(st.value,x+13,y+54);});
    y+=92;
    if(!shownRows.length){rounded(ctx,pad,y,contentW,68,12,PALETTE.white,PALETTE.line);ctx.fillStyle=PALETTE.soft;ctx.font='400 15px sans-serif';ctx.fillText('เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้',pad+16,y+39);y+=84;}
    shownRows.forEach(row=>{
      const subject=row.subject;
      const parsed=row.parsed;
      const noteLines=[];
      if(parsed.outcome) noteLines.push({label:'ผลการเรียน: ',text:parsed.outcome,bg:PALETTE.resultBg,color:PALETTE.resultInk});
      if(parsed.stuck) noteLines.push({label:'ยังติด: ',text:parsed.stuck,bg:PALETTE.stuckBg,color:PALETTE.stuckInk});
      if(parsed.homework) noteLines.push({label:'การบ้าน: ',text:parsed.homework,bg:PALETTE.homeworkBg,color:PALETTE.homeworkInk});
      ctx.font='400 14px sans-serif';
      const innerW=contentW-50;
      const chips=noteLines.map(n=>({...n,lines:wrapThai(ctx,n.label+n.text,innerW-22)}));
      const title=parsed.taught||'บันทึกการสอน';
      ctx.font='700 18px sans-serif';const titleLines=wrapThai(ctx,title,innerW);
      const cardH=44+titleLines.length*24+chips.reduce((sum,c)=>sum+12+c.lines.length*21,0)+12;
      rounded(ctx,pad,y,contentW,cardH,13,PALETTE.white,PALETTE.line);
      ctx.fillStyle=subject.color;roundRectPath(ctx,pad,y,7,cardH,{tl:13,tr:0,br:0,bl:13});ctx.fill();
      rounded(ctx,pad+17,y+12,110,24,12,subject.color+'18');
      ctx.fillStyle=subject.color;ctx.font='600 12px sans-serif';ctx.fillText(subject.name.slice(0,17),pad+25,y+28);
      ctx.fillStyle=PALETTE.soft;ctx.font='400 12px sans-serif';ctx.fillText(fmtDateThai(row.date)+' · '+fmtHours(row.hours)+' ชม.',pad+138,y+28);
      let ty=y+58;ctx.fillStyle=PALETTE.ink;ctx.font='700 18px sans-serif';titleLines.forEach(line=>{ctx.fillText(line,pad+18,ty);ty+=24;});
      chips.forEach(chip=>{
        const chipH=chip.lines.length*21+10;rounded(ctx,pad+17,ty-4,contentW-34,chipH,8,chip.bg);
        ctx.fillStyle=chip.color;ctx.font='400 14px sans-serif';chip.lines.forEach(line=>{ctx.fillText(line,pad+27,ty+13);ty+=21;});ty+=7;
      });
      y+=cardH+11;
    });
    if(lessonRows.length>6){ctx.fillStyle=PALETTE.soft;ctx.font='400 13px sans-serif';ctx.fillText('และอีก '+(lessonRows.length-6)+' คาบ',pad,y+7);y+=28;}
    rounded(ctx,pad,y,contentW,Math.max(76,wrapThai(ctx,tutorMessage||'วันนี้น้องตั้งใจเรียนและค่อย ๆ พัฒนาขึ้นค่ะ',contentW-48).length*22+48),14,'#F7EEDB');
    ctx.fillStyle=PALETTE.pineDark;ctx.font='600 15px sans-serif';ctx.fillText('ข้อความจากติวเตอร์',pad+18,y+25);
    ctx.fillStyle=PALETTE.ink;ctx.font='400 14px sans-serif';let my=y+48;
    wrapThai(ctx,tutorMessage||'วันนี้น้องตั้งใจเรียนและค่อย ๆ พัฒนาขึ้นค่ะ',contentW-48).forEach(line=>{ctx.fillText(line,pad+18,my);my+=21;});
    y+=Math.max(76,my-y+14);
    const nextLesson = student?.nextLesson || student?.nextSession || null;
    if(nextLesson && (nextLesson.topic || nextLesson.date || nextLesson.time)){
      rounded(ctx,pad,y,contentW,65,12,'#EAF3EF');
      ctx.fillStyle=PALETTE.pineDark;ctx.font='600 15px sans-serif';ctx.fillText('คาบหน้า',pad+16,y+24);
      ctx.fillStyle=PALETTE.ink;ctx.font='400 14px sans-serif';
      wrapThai(ctx,[nextLesson.topic,nextLesson.date?fmtDateThai(nextLesson.date):'',nextLesson.time].filter(Boolean).join(' · '),contentW-42).slice(0,2).forEach((line,i)=>ctx.fillText(line,pad+16,y+46+i*19));
      y+=78;
    }
    ctx.strokeStyle=PALETTE.line;ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(pad,y+4);ctx.lineTo(width-pad,y+4);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=PALETTE.soft;ctx.font='400 13px sans-serif';ctx.fillText('ค่าเรียนเดือนนี้ · '+fmtHours(totalHours)+' ชั่วโมง',pad,y+30);
    ctx.fillStyle=PALETTE.pineDark;ctx.font='600 18px sans-serif';ctx.fillText(fmtMoney(totalAmount),width-pad-ctx.measureText(fmtMoney(totalAmount)).width,y+31);
    return canvas;
  };

  useEffect(() => { drawCard(); }, [student, safeSessions, tutorMessage, rangeLabel]);

  const blobForCard = async () => {
    const canvas = await drawCard();
    if (!canvas) throw new Error('ไม่มีการ์ดให้ส่งออก');
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างรูปไม่สำเร็จ')),'image/png'));
  };
  const copyImage = async () => {
    try {
      const blob=await blobForCard();
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
      setStatus('คัดลอกรูปแล้ว');
    } catch { setStatus('คัดลอกรูปไม่ได้ในเบราว์เซอร์นี้ ลองดาวน์โหลดรูปแทน'); }
  };
  const downloadImage = async () => {
    try {
      const blob=await blobForCard(), url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download='แจ้งค่าสอน-'+String(student?.name||'นักเรียน').replace(/[\\/:*?"<>|]/g,'_')+'-'+(invoiceDates?.from || localToday()).slice(0,7)+'.png';
      a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch { setStatus('สร้างรูปไม่สำเร็จ กรุณาลองอีกครั้ง'); }
  };
  const copyText = async () => {
    try { await navigator.clipboard.writeText(textMessage); setStatus('คัดลอกข้อความแล้ว'); }
    catch { setStatus('คัดลอกข้อความไม่ได้ กรุณาอนุญาตคลิปบอร์ด'); }
  };

  if (!student) return <div className="rounded-xl border p-4 text-sm" style={{borderColor:PALETTE.line,color:PALETTE.soft}}>เลือกนักเรียนเพื่อสร้างการ์ดแจ้งค่าสอน</div>;
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border shadow-sm" style={{borderColor:PALETTE.line,background:PALETTE.paper}}>
        <div className="overflow-hidden rounded-t-2xl text-white px-5 py-6 sm:px-7" style={{background:'linear-gradient(115deg, '+PALETTE.pineDark+', '+PALETTE.teal+')'}}>
          <div className="text-xs font-medium opacity-85">บันทึกการสอน · {rangeLabel}</div>
          <h3 className="mt-2 break-words text-2xl sm:text-3xl font-bold">{student.name || 'นักเรียน'}</h3>
          <p className="mt-2 break-words text-sm opacity-90">{[student.grade,...(student.subjects||[])].filter(Boolean).join(' · ') || 'บันทึกการเรียนรู้รายบุคคล'}</p>
          <div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs">{rangeLabel}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-5">
          {[{label:'ชั่วโมงสอน',value:fmtHours(totalHours)+' ชม.',bg:'#E7EFE7',color:PALETTE.pineDark,Icon:Clock3},{label:'จำนวนคาบ',value:safeSessions.length+' คาบ',bg:'#E0F0FF',color:'#245C85',Icon:CalendarDays},{label:'หัวข้อที่เรียน',value:topicCount+' หัวข้อ',bg:'#FFF0C2',color:'#795719',Icon:BookMarked}].map(item=><div key={item.label} className="min-w-0 rounded-xl p-2.5 sm:p-3" style={{background:item.bg,color:item.color}}><item.Icon size={16}/><div className="mt-2 text-[11px] sm:text-xs">{item.label}</div><div className="mt-1 break-words text-base sm:text-xl font-bold">{item.value}</div></div>)}
        </div>
        <div className="space-y-3 px-3 pb-4 sm:px-5">
          {!shownRows.length ? <div className="rounded-xl border p-4 text-sm" style={{borderColor:PALETTE.line,background:PALETTE.white,color:PALETTE.soft}}>เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้</div> : shownRows.map(row=>{
            const p=row.parsed;
            return <article key={row.id||row.date} className="overflow-hidden rounded-xl border" style={{borderColor:PALETTE.line,background:PALETTE.white}}>
              <div className="flex min-w-0 gap-3">
                <div className="w-1.5 shrink-0" style={{background:row.subject.color}}/>
                <div className="min-w-0 flex-1 py-3 pr-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{background:row.subject.color+'18',color:row.subject.color}}>{row.subject.name}</span><span className="text-xs" style={{color:PALETTE.soft}}>{fmtDateThai(row.date)} · {fmtHours(row.hours)} ชม.</span></div>
                  <h4 className="mt-2 break-words text-base sm:text-lg font-bold">{p.taught || 'บันทึกการสอน'}</h4>
                  {p.outcome&&<p className="mt-2 break-words rounded-lg px-3 py-2 text-sm leading-relaxed" style={{background:PALETTE.resultBg,color:PALETTE.resultInk}}>ผลการเรียน: {p.outcome}</p>}
                  {p.stuck&&<p className="mt-2 break-words rounded-lg px-3 py-2 text-sm leading-relaxed" style={{background:PALETTE.stuckBg,color:PALETTE.stuckInk}}>ยังติด: {p.stuck}</p>}
                  {p.homework&&<p className="mt-2 break-words rounded-lg px-3 py-2 text-sm leading-relaxed" style={{background:PALETTE.homeworkBg,color:PALETTE.homeworkInk}}>การบ้าน: {p.homework}</p>}
                </div>
              </div>
            </article>;
          })}
          {lessonRows.length>6&&<p className="px-1 text-xs" style={{color:PALETTE.soft}}>และอีก {lessonRows.length-6} คาบ</p>}
          <section className="rounded-2xl p-4 sm:p-5" style={{background:'#F7EEDB'}}>
            <div className="flex items-center gap-2 font-semibold" style={{color:PALETTE.pineDark}}><MessageCircle size={17}/>ข้อความจากติวเตอร์</div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed" style={{color:PALETTE.ink}}>{tutorMessage || 'วันนี้น้องตั้งใจเรียนและค่อย ๆ พัฒนาขึ้นค่ะ'}</p>
          </section>
          {(student.nextLesson || student.nextSession) && <section className="rounded-xl p-4" style={{background:'#EAF3EF',color:PALETTE.pineDark}}><div className="flex items-center gap-2 font-semibold"><Target size={17}/>คาบหน้า</div><p className="mt-2 break-words text-sm">{[(student.nextLesson||student.nextSession).topic,(student.nextLesson||student.nextSession).date?fmtDateThai((student.nextLesson||student.nextSession).date):'',(student.nextLesson||student.nextSession).time].filter(Boolean).join(' · ')}</p></section>}
          <footer className="border-t-2 border-dashed pt-3" style={{borderColor:PALETTE.line}}><div className="flex flex-wrap items-end justify-between gap-3"><div className="text-xs" style={{color:PALETTE.soft}}>ค่าเรียนเดือนนี้ · {fmtHours(totalHours)} ชั่วโมง</div><div className="text-right text-lg font-semibold" style={{color:PALETTE.pineDark}}>{fmtMoney(totalAmount)}</div></div></footer>
        </div>
      </div>
      <label className="block rounded-xl border p-3 text-xs font-medium" style={{borderColor:PALETTE.line,background:PALETTE.white}}>แก้ไขข้อความจากติวเตอร์<textarea rows={3} value={tutorMessage} onChange={e=>setTutorMessage(e.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm font-normal" style={{borderColor:PALETTE.line,background:PALETTE.paper}}/></label>
      <canvas ref={canvasRef} className="sr-only" aria-hidden="true"/>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={copyImage} disabled={!safeSessions.length} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{background:PALETTE.pine}}><Copy size={16}/>คัดลอกรูป</button>
        <button type="button" onClick={downloadImage} disabled={!safeSessions.length} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium disabled:opacity-40" style={{borderColor:PALETTE.line,color:PALETTE.pineDark}}><Download size={16}/>ดาวน์โหลดรูป</button>
        <button type="button" onClick={copyText} disabled={!safeSessions.length} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium disabled:opacity-40" style={{borderColor:PALETTE.line,color:PALETTE.ink}}><Copy size={16}/>คัดลอกเป็นข้อความ</button>
        <button type="button" onClick={onMarkInvoiced} disabled={!safeSessions.length || !onMarkInvoiced} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium disabled:opacity-40" style={{borderColor:PALETTE.pine,color:PALETTE.pineDark}}><Check size={16}/>ทำเครื่องหมายว่าแจ้งแล้ว</button>
      </div>
      {status&&<p role="status" className="text-xs" style={{color:PALETTE.pine}}>{status}</p>}
    </div>
  );
}
