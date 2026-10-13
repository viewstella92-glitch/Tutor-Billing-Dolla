'use client';

import { useMemo, useRef, useState } from 'react';
import { Clipboard, Download, Copy, CalendarDays, BookOpen, Star, X } from 'lucide-react';

const C = { paper:'#FAF6EC', paperDeep:'#F1EAD8', ink:'#23282B', inkSoft:'#6B7270', line:'#DED4B8', surface:'#FFFFFF', pine:'#2E5E45', pineDark:'#20402F', pineTint:'#E7EFE7', gold:'#A8781F', goldTint:'#F5EBD4', brick:'#A0392A' };
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtMoney(n) { return '฿' + Math.round(Number(n)||0).toLocaleString('th-TH'); }
function fmtHours(n) { return (Math.round((Number(n)||0)*100)/100).toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); }
function fmtDateThai(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'ไม่ระบุวันที่';
  const [y,m,d] = dateStr.split('-').map(Number);
  return d + ' ' + MONTHS_TH[m-1] + ' ' + (y+543);
}
function monthLabelOf(key) {
  const [y,m] = (key || todayStr().slice(0,7)).split('-').map(Number);
  return (MONTHS_TH[m-1] || '') + ' ' + (y+543);
}
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = typeof r === 'number' ? {tl:r,tr:r,br:r,bl:r} : r;
  ctx.beginPath(); ctx.moveTo(x+rr.tl,y); ctx.lineTo(x+w-rr.tr,y);
  ctx.arcTo(x+w,y,x+w,y+rr.tr,rr.tr); ctx.lineTo(x+w,y+h-rr.br);
  ctx.arcTo(x+w,y+h,x+w-rr.br,y+h,rr.br); ctx.lineTo(x+rr.bl,y+h);
  ctx.arcTo(x,y+h,x,y+h-rr.bl,rr.bl); ctx.lineTo(x,y+rr.tl);
  ctx.arcTo(x,y,x+rr.tl,y,rr.tl); ctx.closePath();
}
function parseNote(note = '') {
  const result = { taught:'', outcome:'', score:'', stuck:'', homework:'', extra:[] };
  String(note || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('สอน:')) result.taught = line.slice('สอน:'.length).trim();
    else if (line.startsWith('ผลการเรียน:')) result.outcome = line.slice('ผลการเรียน:'.length).trim();
    else if (line.startsWith('คะแนน:')) result.score = line.slice('คะแนน:'.length).trim();
    else if (line.startsWith('ติดขัด:')) result.stuck = line.slice('ติดขัด:'.length).trim();
    else if (line.startsWith('การบ้าน:')) result.homework = line.slice('การบ้าน:'.length).trim();
    else result.extra.push(line);
  });
  return result;
}
function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = []; let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export default function ParentReportCard({ student, sessions = [], month: initialMonth, tutorMessage: initialTutorMessage, onClose }) {
  const canvasRef = useRef(null);
  const [month, setMonth] = useState(initialMonth || todayStr().slice(0,7));
  const [tutorMessage, setTutorMessage] = useState(initialTutorMessage || 'วันนี้น้องตั้งใจเรียนและค่อย ๆ พัฒนาขึ้นค่ะ');
  const [copyStatus, setCopyStatus] = useState('');
  const studentSessions = useMemo(() => sessions
    .filter(s => s && s.studentId === student?.id && typeof s.date === 'string')
    .sort((a,b) => a.date.localeCompare(b.date)), [sessions, student?.id]);
  const monthSessions = useMemo(() => studentSessions.filter(s => s.date.slice(0,7) === month), [studentSessions, month]);
  const recent = [...monthSessions].slice(-3).reverse();
  const recentForSkills = [...studentSessions].slice(-3).reverse();
  const parsedRecent = recent.map(s => ({...s, parsed:parseNote(s.note)}));
  const parsedSkills = recentForSkills.map(s => ({...s, parsed:parseNote(s.note)}));
  const scoreHistory = studentSessions.map(s => {
    const p = parseNote(s.note);
    return p.score !== '' && p.score != null && Number.isFinite(Number(p.score)) ? Number(p.score) : null;
  }).filter(n => n !== null);
  const current = student?.latestScore !== '' && student?.latestScore != null && Number.isFinite(Number(student.latestScore)) ? Number(student.latestScore) : (scoreHistory.length ? scoreHistory[scoreHistory.length-1] : null);
  const baseline = student?.baselineScore !== '' && student?.baselineScore != null && Number.isFinite(Number(student.baselineScore)) ? Number(student.baselineScore) : (scoreHistory.length ? scoreHistory[0] : null);
  const target = student?.targetScore !== '' && student?.targetScore != null && Number.isFinite(Number(student.targetScore)) ? Number(student.targetScore) : null;
  const change = current !== null && baseline !== null ? current-baseline : null;
  const monthHours = monthSessions.reduce((sum,s)=>sum+(Number(s.hours)||0),0);
  const monthTotal = monthSessions.reduce((sum,s)=>sum+(Number(s.hours)||0)*(Number(s.rate)||0),0);
  const latestParsed = parsedRecent[0]?.parsed;
  const homeworkItems = (latestParsed?.homework || '').split(/[•,;；\n]/).map(s=>s.trim()).filter(Boolean);
  const skills = [];
  const skillMap = new Map();
  parsedSkills.forEach(({parsed}) => {
    const noteText = [parsed.taught, parsed.stuck, parsed.outcome, ...parsed.extra].filter(Boolean).join(' ');
    const taught = parsed.taught.replace(/^([^·]+)·\s*/, '').trim();
    if (parsed.stuck) parsed.stuck.split(/[、,;；]/).map(x=>x.trim()).filter(Boolean).forEach(label=>skillMap.set(label,{label,status:'กำลังฝึก'}));
    if (taught) skillMap.set(taught,{label:taught,status:/ทำได้|ดีขึ้น/.test(noteText)?'ทำได้แล้ว':'เริ่มเรียนแล้ว'});
    if (/ทำได้|ดีขึ้น/.test(noteText) && taught) skillMap.set(taught,{label:taught,status:'ทำได้แล้ว'});
  });
  skills.push(...Array.from(skillMap.values()).slice(0,8));
  const textReport = [
    'รายงานความก้าวหน้าการเรียนของ ' + (student?.name || 'นักเรียน'),
    'ช่วงรายงาน: ' + monthLabelOf(month),
    student?.grade ? 'ระดับชั้น: ' + student.grade : '',
    student?.subjects?.length ? 'วิชา: ' + student.subjects.join(' · ') : '',
    '',
    'พัฒนาการคะแนน',
    current !== null ? 'คะแนนล่าสุด: ' + current + (baseline !== null ? ' · คะแนนตั้งต้น ' + baseline : '') + (target !== null ? ' · เป้าหมาย ' + target : '') : 'ยังไม่มีคะแนนที่บันทึกไว้ เราจะค่อย ๆ เก็บข้อมูลพัฒนาการไปด้วยกัน',
    change !== null && change > 0 ? 'ขึ้นมา +' + change + ' จากตอนเริ่มเรียน' : '',
    '',
    'คาบเรียนในเดือนนี้',
    ...(parsedRecent.length ? parsedRecent.map(s=>fmtDateThai(s.date) + ' · ' + (s.parsed.taught || 'ไม่ได้ระบุเรื่องที่สอน') + (s.parsed.outcome ? ' — ' + s.parsed.outcome : '')) : ['เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้']),
    tutorMessage ? '' : '',
    tutorMessage ? 'ข้อความจากติวเตอร์: ' + tutorMessage : '',
    homeworkItems.length ? 'การบ้าน: ' + homeworkItems.join(' / ') : '',
    'ยอดของเดือนนี้: ' + fmtMoney(monthTotal) + ' (' + fmtHours(monthHours) + ' ชั่วโมง)'
  ].filter(Boolean).join('\n');

  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas || !student) return canvas;
    const width = 720, pad = 32, contentW = width-pad*2;
    const lines = [];
    const ctx = canvas.getContext('2d');
    const scale = 2;
    ctx.font = '400 16px sans-serif';
    const addWrapped = (text, max=contentW) => wrapText(ctx, text, max).forEach(line=>lines.push(line));
    addWrapped('รายงานความก้าวหน้าการเรียน · ' + monthLabelOf(month));
    addWrapped(student.name || 'นักเรียน');
    addWrapped([student.grade, ...(student.subjects||[])].filter(Boolean).join(' · ') || 'บันทึกการเรียนรู้รายบุคคล');
    lines.push(''); lines.push('พัฒนาการคะแนน');
    addWrapped(current !== null ? 'คะแนนตั้งต้น ' + (baseline ?? '—') + '  ·  คะแนนล่าสุด ' + current + '  ·  เป้าหมาย ' + (target ?? '—') : 'ยังไม่มีคะแนนที่บันทึกไว้ เราจะค่อย ๆ เก็บข้อมูลพัฒนาการไปด้วยกัน');
    if (change !== null && change > 0) addWrapped('ขึ้นมา +' + change + ' จากตอนเริ่มเรียน');
    lines.push(''); lines.push('ทักษะที่กำลังเรียน');
    skills.forEach(x=>addWrapped(x.status + ' · ' + x.label));
    if (!skills.length) addWrapped('กำลังเก็บข้อมูลหัวข้อที่เรียน เพื่อสะท้อนพัฒนาการของน้องให้ชัดเจนขึ้น');
    lines.push(''); lines.push('คาบเรียนล่าสุดในเดือนนี้');
    parsedRecent.forEach(s=>{ addWrapped(fmtDateThai(s.date) + ' · ' + (s.parsed.taught || 'ไม่ได้ระบุเรื่องที่สอน')); if(s.parsed.outcome) addWrapped('ผลการเรียน: ' + s.parsed.outcome); });
    if (!parsedRecent.length) addWrapped('เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้');
    lines.push(''); lines.push('ข้อความจากติวเตอร์'); addWrapped(tutorMessage || 'วันนี้น้องทำได้ดีขึ้นค่ะ');
    if (homeworkItems.length) { lines.push(''); lines.push('การบ้านและคาบหน้า'); homeworkItems.forEach((x,i)=>addWrapped((i+1)+'. '+x)); }
    lines.push(''); lines.push('ยอดของเดือนนี้ · ' + fmtHours(monthHours) + ' ชั่วโมง · ' + fmtMoney(monthTotal));
    const lineH = 25, headerH = 150, height = headerH + lines.length*lineH + 45;
    canvas.width=width*scale; canvas.height=height*scale; canvas.style.width='100%'; canvas.style.height='auto'; canvas.style.aspectRatio=width+'/'+height;
    ctx.setTransform(scale,0,0,scale,0,0);
    roundRectPath(ctx,0,0,width,height,22); ctx.fillStyle=C.surface; ctx.fill(); ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.stroke();
    ctx.save(); roundRectPath(ctx,0,0,width,headerH,{tl:22,tr:22,br:0,bl:0}); ctx.clip(); ctx.fillStyle=C.pine; ctx.fillRect(0,0,width,headerH); ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.8)'; ctx.font='600 14px sans-serif'; ctx.fillText('รายงานสำหรับผู้ปกครอง',pad,32);
    ctx.fillStyle='#FFFFFF'; ctx.font='700 30px sans-serif'; ctx.fillText(student.name || 'นักเรียน',pad,72);
    ctx.font='400 16px sans-serif'; ctx.fillText([student.grade,...(student.subjects||[])].filter(Boolean).join(' · ').slice(0,58),pad,103);
    ctx.fillStyle='#FFFFFF'; ctx.font='600 14px sans-serif'; ctx.fillText(monthLabelOf(month),pad,130);
    let y=headerH+28;
    lines.forEach(line=>{
      if(!line) { y+=8; return; }
      const isHeading = ['พัฒนาการคะแนน','ทักษะที่กำลังเรียน','คาบเรียนล่าสุดในเดือนนี้','ข้อความจากติวเตอร์','การบ้านและคาบหน้า'].includes(line) || line.startsWith('ยอดของเดือนนี้');
      ctx.font=isHeading?'700 17px sans-serif':'400 15px sans-serif'; ctx.fillStyle=isHeading?C.pineDark:C.ink;
      ctx.fillText(line.slice(0,90),pad,y); y+=lineH;
    });
    ctx.strokeStyle=C.line; ctx.setLineDash([5,4]); ctx.beginPath(); ctx.moveTo(pad,y+4); ctx.lineTo(width-pad,y+4); ctx.stroke(); ctx.setLineDash([]);
    return canvas;
  };
  const getPngBlob = async () => {
    const canvas = drawCard();
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างรูปไม่สำเร็จ')),'image/png'));
  };
  const copyImage = async () => {
    try {
      const blob = await getPngBlob();
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('ไม่รองรับการคัดลอกรูป');
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
      setCopyStatus('คัดลอกรูปแล้ว');
    } catch { setCopyStatus('คัดลอกรูปไม่ได้ในเบราว์เซอร์นี้ ลองดาวน์โหลดรูปแทน'); }
  };
  const downloadImage = async () => {
    try {
      const blob = await getPngBlob();
      const url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download='รายงาน-' + String(student?.name||'นักเรียน').replace(/[\\/:*?"<>|]/g,'_') + '-' + month + '.png'; a.click(); URL.revokeObjectURL(url);
    } catch { setCopyStatus('สร้างรูปไม่สำเร็จ กรุณาลองอีกครั้ง'); }
  };
  const copyText = async () => {
    try { await navigator.clipboard.writeText(textReport); setCopyStatus('คัดลอกข้อความแล้ว'); }
    catch { setCopyStatus('คัดลอกข้อความไม่ได้ กรุณาอนุญาตการเข้าถึงคลิปบอร์ด'); }
  };

  if (!student) return null;
  return (
    <section className="w-full min-w-0 space-y-4 text-sm" style={{color:C.ink}}>
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:C.line,color:C.ink}}>ปิดรายงาน</button>
        <div><h2 className="text-lg font-semibold">รายงานความก้าวหน้า · {student.name}</h2><p style={{color:C.inkSoft}} className="text-xs mt-1">การ์ดสำหรับส่งให้ผู้ปกครองทาง LINE</p></div>
        <label className="flex items-center gap-2 text-xs"><CalendarDays size={15}/><span>เดือนที่รายงาน</span><input aria-label="เดือนที่รายงาน" type="month" value={month} onChange={e=>setMonth(e.target.value)} className="max-w-[150px] rounded-lg border px-2 py-2" style={{borderColor:C.line,background:C.surface}} /></label>
      </div>
      <div className="w-full min-w-0 overflow-hidden rounded-2xl border p-3 sm:p-5" style={{background:C.paper,borderColor:C.line}}>
        <div className="rounded-2xl overflow-hidden" style={{background:C.surface,border:'1px solid '+C.line}}>
          <header className="p-5 sm:p-7 text-white" style={{background:C.pine}}>
            <div className="text-xs opacity-80">รายงานสำหรับผู้ปกครอง</div>
            <h3 className="mt-2 break-words text-2xl sm:text-3xl font-bold">{student.name}</h3>
            <div className="mt-2 text-sm opacity-90 break-words">{[student.grade,...(student.subjects||[])].filter(Boolean).join(' · ') || 'บันทึกการเรียนรู้รายบุคคล'}</div>
            <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs" style={{background:'rgba(255,255,255,.15) }}>{monthLabelOf(month)}</div>
          </header>
          <div className="space-y-3 p-3 sm:p-5">
            <section className="rounded-xl border p-4" style={{borderColor:C.line}}>
              <h4 className="font-semibold" style={{color:C.pine}}>พัฒนาการคะแนน</h4>
              {current === null ? <p className="mt-2 leading-relaxed" style={{color:C.inkSoft}}>ยังไม่มีคะแนนที่บันทึกไว้ ไม่เป็นไรค่ะ เราจะค่อย ๆ เก็บข้อมูลเพื่อดูพัฒนาการของน้องไปด้วยกัน</p> : <>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg p-2" style={{background:C.paper}}><div className="text-xs" style={{color:C.inkSoft}}>ตั้งต้น</div><strong className="text-lg">{baseline ?? '—'}</strong></div>
                  <div className="rounded-lg p-2" style={{background:C.pineTint}}><div className="text-xs" style={{color:C.inkSoft}}>ล่าสุด</div><strong className="text-lg">{current}</strong></div>
                  <div className="rounded-lg p-2" style={{background:C.goldTint}}><div className="text-xs" style={{color:C.inkSoft}}>เป้าหมาย</div><strong className="text-lg">{target ?? '—'}</strong></div>
                </div>
                <div className="mt-4 relative h-3 rounded-full" style={{background:C.paperDeep}}><div className="h-3 rounded-full" style={{width:Math.max(0,Math.min(100,current))+'%',background:C.pine}}/>{target!==null&&<span className="absolute -top-1.5 block h-6 w-1 rounded" style={{left:'calc('+Math.max(0,Math.min(100,target))+'% - 2px)',background:C.gold}} aria-label={'เป้าหมาย '+target}/>}</div>
                <div className="mt-2 flex justify-between text-xs" style={{color:C.inkSoft}}><span>0 คะแนน</span><span>100 คะแนน</span></div>
                {change!==null&&change>0?<p className="mt-3 font-semibold" style={{color:C.pine}}>ขึ้นมา +{change} จากตอนเริ่มเรียน</p>:change!==null?<p className="mt-3 text-sm" style={{color:C.inkSoft}}>เราจะติดตามพัฒนาการต่อเนื่องจากจุดเริ่มต้นค่ะ</p>:null}
              </>}
            </section>
            <section className="rounded-xl border p-4" style={{borderColor:C.line}}>
              <h4 className="font-semibold" style={{color:C.pine}}>ทักษะที่กำลังเรียน</h4>
              {skills.length ? <div className="mt-3 flex flex-wrap gap-2">{skills.map((s,i)=><span key={s.label+i} className="max-w-full break-words rounded-full px-3 py-1.5 text-xs" style={{background:s.status==='กำลังฝึก'?C.goldTint:s.status==='ทำได้แล้ว'?C.pineTint:C.paperDeep,color:s.status==='กำลังฝึก'?C.gold:C.pineDark}}>{s.status} · {s.label}</span>)}</div>:<p className="mt-2" style={{color:C.inkSoft}}>เมื่อมีบันทึกเรื่องที่สอนและจุดที่ติดขัด ทักษะที่กำลังฝึกจะแสดงที่นี่</p>}
            </section>
            <section className="rounded-xl border p-4" style={{borderColor:C.line}}>
              <h4 className="font-semibold" style={{color:C.pine}}>คาบเรียน 3 คาบล่าสุดของเดือน</h4>
              {parsedRecent.length ? <div className="mt-3 space-y-3">{parsedRecent.map((s,i)=><article key={s.id||s.date+i} className="border-l-2 pl-3" style={{borderColor:C.pine}}><div className="text-xs font-semibold" style={{color:C.pine}}>{fmtDateThai(s.date)} · {fmtHours(s.hours)} ชั่วโมง</div><div className="mt-1 font-medium break-words">{s.parsed.taught || 'ไม่ได้ระบุเรื่องที่สอน'}</div><p className="mt-1 break-words leading-relaxed" style={{color:C.inkSoft}}>{s.parsed.outcome || 'ยังไม่มีข้อความสรุปผลการเรียนในคาบนี้'}</p></article>)}</div>:<p className="mt-2 rounded-lg p-3" style={{background:C.paper,color:C.inkSoft}}>เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้</p>}
            </section>
            <section className="rounded-xl border p-4" style={{borderColor:C.line,background:C.pineTint}}>
              <h4 className="font-semibold" style={{color:C.pineDark}}>ข้อความจากติวเตอร์</h4>
              <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{tutorMessage || 'วันนี้น้องทำได้ดีขึ้นค่ะ'}</p>
            </section>
            {homeworkItems.length>0&&<section className="rounded-xl border p-4" style={{borderColor:C.line}}><h4 className="font-semibold" style={{color:C.pine}}>การบ้านและคาบหน้า</h4><ul className="mt-2 list-disc space-y-1 pl-5">{homeworkItems.map((x,i)=><li key={i} className="break-words">{x}</li>)}</ul></section>}
            <footer className="border-t-2 border-dashed pt-4" style={{borderColor:C.line}}><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="font-semibold" style={{color:C.pine}}>ยอดของเดือนนี้</div><div className="mt-1 text-xs" style={{color:C.inkSoft}}>{fmtHours(monthHours)} ชั่วโมง · {monthSessions.length} คาบ</div></div><div className="text-right"><div className="text-xs" style={{color:C.inkSoft}}>ยอดรวม</div><div className="text-2xl font-bold" style={{color:C.pineDark}}>{fmtMoney(monthTotal)}</div></div></div></footer>
          </div>
        </div>
      </div>
      <div className="space-y-2 rounded-xl border p-3 sm:p-4" style={{borderColor:C.line,background:C.surface}}>
        <label className="block text-xs font-medium">แก้ไขข้อความจากติวเตอร์<textarea value={tutorMessage} onChange={e=>setTutorMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:C.line,background:C.paper}} /></label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={copyImage} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-medium text-white" style={{background:C.pine}}><Clipboard size={16}/>คัดลอกรูป</button>
          <button type="button" onClick={downloadImage} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-medium" style={{borderColor:C.pine,color:C.pine}}><Download size={16}/>ดาวน์โหลดรูป</button>
          <button type="button" onClick={copyText} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-medium" style={{borderColor:C.line,color:C.ink}}><Copy size={16}/>คัดลอกเป็นข้อความ</button>
        </div>
        {copyStatus&&<p role="status" className="text-xs" style={{color:C.pine}}>{copyStatus}</p>}
      </div>
      <canvas ref={canvasRef} className="sr-only" aria-hidden="true" />
    </section>
  );
}
