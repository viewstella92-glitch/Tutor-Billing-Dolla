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
  const result = { taught:'', outcome:'', strengths:'', score:'', stuck:'', homework:'', nextPlan:'', taughtEn:'', outcomeEn:'', stuckEn:'', homeworkEn:'', extra:[] };
  String(note || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('EN topic:')) result.taughtEn = line.slice('EN topic:'.length).trim();
    else if (line.startsWith('EN result:')) result.outcomeEn = line.slice('EN result:'.length).trim();
    else if (line.startsWith('EN stuck:')) result.stuckEn = line.slice('EN stuck:'.length).trim();
    else if (line.startsWith('EN homework:')) result.homeworkEn = line.slice('EN homework:'.length).trim();
    else if (line.startsWith('สอน:')) result.taught = line.slice('สอน:'.length).trim();
    else if (line.startsWith('ผลการเรียน:')) result.outcome = line.slice('ผลการเรียน:'.length).trim();
    else if (line.startsWith('จุดเด่น:')) result.strengths = line.slice('จุดเด่น:'.length).trim();
    else if (line.startsWith('คะแนน:')) result.score = line.slice('คะแนน:'.length).trim();
    else if (line.startsWith('ติดขัด:')) result.stuck = line.slice('ติดขัด:'.length).trim();
    else if (line.startsWith('การบ้าน:')) result.homework = line.slice('การบ้าน:'.length).trim();
    else if (line.startsWith('แผนคาบหน้า:')) result.nextPlan = line.slice('แผนคาบหน้า:'.length).trim();
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
  const [language, setLanguage] = useState('th');
  const [tutorMessage, setTutorMessage] = useState(initialTutorMessage || 'วันนี้น้องตั้งใจเรียนและค่อย ๆ พัฒนาขึ้นค่ะ');
  const [copyStatus, setCopyStatus] = useState('');
  const studentSessions = useMemo(() => sessions
    .filter(s => s && s.studentId === student?.id && typeof s.date === 'string')
    .sort((a,b) => a.date.localeCompare(b.date)), [sessions, student?.id]);
  const monthSessions = useMemo(() => studentSessions.filter(s => s.date.slice(0,7) === month), [studentSessions, month]);
  const recent = [...monthSessions].slice(-3).reverse();
  const recentForSkills = [...studentSessions].slice(-3).reverse();
  const parsedRecent = recent.map(s => { const parsed=parseNote(s.note); return {...s, parsed: language==='en' ? {...parsed, taught:parsed.taughtEn||parsed.taught, outcome:parsed.outcomeEn||parsed.outcome, stuck:parsed.stuckEn||parsed.stuck, homework:parsed.homeworkEn||parsed.homework} : parsed}; });
  const parsedSkills = recentForSkills.map(s => { const parsed=parseNote(s.note); return {...s, parsed: language==='en' ? {...parsed, taught:parsed.taughtEn||parsed.taught, outcome:parsed.outcomeEn||parsed.outcome, stuck:parsed.stuckEn||parsed.stuck} : parsed}; });
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
  const ui = language === 'en'
    ? {close:'Close report',title:'Learning progress report',subtitle:'Share with parents via LINE',month:'Report month',parent:'Parent report',score:'Score progress',baseline:'Baseline',latest:'Latest',target:'Target',skills:'Skills & topics learned',recent:'Latest 3 lessons this month',noLessons:'No lessons recorded this month',tutor:'Tutor message',homeworkNext:'Homework & next lesson',total:'Monthly total',hours:'hours',lessons:'lessons',messageLabel:'Tutor message',copyImage:'Copy image',downloadImage:'Download image',copyText:'Copy text',noScore:'No scores recorded yet. We will track progress over time.'}
    : {close:'ปิดรายงาน',title:'รายงานความก้าวหน้า',subtitle:'การ์ดสำหรับส่งให้ผู้ปกครองทาง LINE',month:'เดือนที่รายงาน',parent:'รายงานสำหรับผู้ปกครอง',score:'พัฒนาการคะแนน',baseline:'ตั้งต้น',latest:'ล่าสุด',target:'เป้าหมาย',skills:'ทักษะที่กำลังเรียน',recent:'คาบเรียน 3 คาบล่าสุดของเดือน',noLessons:'เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้',tutor:'ข้อความจากติวเตอร์',homeworkNext:'การบ้านและคาบหน้า',total:'ยอดของเดือนนี้',hours:'ชั่วโมง',lessons:'คาบ',messageLabel:'แก้ไขข้อความจากติวเตอร์',copyImage:'คัดลอกรูป',downloadImage:'ดาวน์โหลดรูป',copyText:'คัดลอกเป็นข้อความ',noScore:'ยังไม่มีคะแนนที่บันทึกไว้ ไม่เป็นไรค่ะ เราจะค่อย ๆ เก็บข้อมูลเพื่อดูพัฒนาการของน้องไปด้วยกัน'};
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
    ...(parsedRecent.length ? parsedRecent.map(s=>fmtDateThai(s.date) + ' · ' + (s.parsed.taught || 'ไม่ได้ระบุเรื่องที่สอน') + (s.parsed.outcome ? ' — ' + s.parsed.outcome : '') + (s.parsed.strengths ? ' · จุดเด่น: ' + s.parsed.strengths : '') + (s.parsed.nextPlan ? ' · คาบหน้า: ' + s.parsed.nextPlan : '')) : ['เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้']),
    tutorMessage ? '' : '',
    tutorMessage ? 'ข้อความจากติวเตอร์: ' + tutorMessage : '',
    homeworkItems.length ? 'การบ้าน: ' + homeworkItems.join(' / ') : '',
    'ยอดของเดือนนี้: ' + fmtMoney(monthTotal) + ' (' + fmtHours(monthHours) + ' ชั่วโมง)'
  ].filter(Boolean).join('\n');

  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas || !student) return canvas;
    const width = 720, PAD = 32, INNER = width - PAD * 2, scale = 2;
    const ctx = canvas.getContext('2d');
    const font = (value) => { ctx.font = value; };
    const text = (value, x, y, face, color) => {
      font(face); ctx.fillStyle = color; ctx.fillText(value, x, y);
    };
    const fillBox = (x, y, w, h, r, color) => {
      roundRectPath(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill();
    };
    const strokeBox = (x, y, w, h, r, color) => {
      roundRectPath(ctx, x, y, w, h, r); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    };
    const wrapLines = (context, value, maxWidth) => {
      const result = [];
      const paragraphs = String(value || '').split(/\\n/);
      paragraphs.forEach(paragraph => {
        if (!paragraph) { result.push(''); return; }
        let line = '';
        for (const char of Array.from(paragraph)) {
          const candidate = line + char;
          if (context.measureText(candidate).width > maxWidth && line) {
            result.push(line); line = char;
          } else line = candidate;
        }
        if (line) result.push(line);
      });
      return result.length ? result : [''];
    };
    const addText = (value, x, y, maxWidth, face, color, lh) => {
      font(face);
      const wrapped = wrapLines(ctx, value, maxWidth);
      wrapped.forEach((line, i) => text(line, x, y + i * lh, face, color));
      return wrapped.length * lh;
    };
    const lessons = parsedRecent;
    const headerH = 150;
    const layout = [];
    let contentHeight = 22;
    const addSectionTitle = (title) => {
      layout.push({ type:'title', title, y:contentHeight });
      contentHeight += 30;
    };
    const addParagraph = (value, options = {}) => {
      const face = options.font || '400 15px sans-serif';
      const lh = options.lh || 21;
      font(face);
      const wrapped = wrapLines(ctx, value, INNER);
      layout.push({ type:'paragraph', value, lines:wrapped, y:contentHeight, font:face, color:options.color || C.ink, lh });
      contentHeight += wrapped.length * lh + 4;
    };
    addSectionTitle('พัฒนาการคะแนน');
    addParagraph(current !== null
      ? 'คะแนนตั้งต้น ' + (baseline ?? '—') + '  ·  คะแนนล่าสุด ' + current + '  ·  เป้าหมาย ' + (target ?? '—')
      : 'ยังไม่มีคะแนนที่บันทึกไว้ เราจะค่อย ๆ เก็บข้อมูลพัฒนาการไปด้วยกัน');
    if (change !== null && change > 0) addParagraph('พัฒนาการเพิ่มขึ้น +' + change + ' คะแนนจากตอนเริ่มเรียน', {font:'600 14px sans-serif',color:C.pine});
    addSectionTitle('ทักษะที่กำลังเรียน');
    if (skills.length) skills.forEach(item => addParagraph(item.status + ' · ' + item.label, {font:'400 14px sans-serif',lh:19}));
    else addParagraph('กำลังเก็บข้อมูลหัวข้อที่เรียน เพื่อสะท้อนพัฒนาการของน้องให้ชัดเจนขึ้น');
    addSectionTitle('คาบเรียนล่าสุดในเดือนนี้');
    if (lessons.length) {
      lessons.forEach((lesson) => {
        const parsed = lesson.parsed;
        const IX = PAD + 18;
        const IW = INNER - 36;
        const subject = lesson.subject || (student?.subjects || []).join(' · ') || 'คาบเรียน';
        const items = [
          { text: fmtDateThai(lesson.date) + ' · ' + fmtHours(lesson.hours) + ' ชั่วโมง · ' + subject, font:'600 12px sans-serif', color:C.pine, lh:16 },
          { text: parsed.taught || 'ไม่ได้ระบุหัวข้อที่สอน', font:'600 14px sans-serif', color:C.ink, lh:19 },
          parsed.outcome && { text:'ผลการเรียน: ' + parsed.outcome, font:'400 13px sans-serif', color:C.ink, lh:18 },
          parsed.strengths && { text:'จุดเด่น: ' + parsed.strengths, font:'400 12px sans-serif', color:C.pine, lh:17 },
          parsed.stuck && { text:'ควรทบทวน: ' + parsed.stuck, font:'400 12px sans-serif', color:C.gold, lh:17 },
          parsed.homework && { text:'การบ้าน: ' + parsed.homework, font:'400 12px sans-serif', color:C.pine, lh:17 },
          parsed.nextPlan && { text:'คาบถัดไป: ' + parsed.nextPlan, font:'400 12px sans-serif', color:C.ink, lh:17 },
        ].filter(Boolean);
        let bodyH = 0;
        const measured = items.map(item => {
          font(item.font);
          const lines = wrapLines(ctx, item.text, IW);
          bodyH += lines.length * item.lh + 4;
          return { ...item, lines };
        });
        const cardH = bodyH + 16;
        layout.push({type:'lesson', y:contentHeight, h:cardH, measured, IX, IW, color:lesson.color || C.pine});
        contentHeight += cardH + 8;
      });
    } else addParagraph('เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้');
    addSectionTitle('ข้อความจากติวเตอร์');
    addParagraph(tutorMessage || 'วันนี้น้องทำได้ดีขึ้นค่ะ');
    if (homeworkItems.length) {
      addSectionTitle('การบ้านและคาบหน้า');
      homeworkItems.forEach((item, index) => addParagraph((index + 1) + '. ' + item));
    }
    const totalLabel = 'ยอดของเดือนนี้ · ' + fmtHours(monthHours) + ' ชั่วโมง · ' + fmtMoney(monthTotal);
    contentHeight += 20;
    const height = headerH + contentHeight + 30;
    canvas.width = width * scale; canvas.height = height * scale;
    canvas.style.width = '100%'; canvas.style.height = 'auto'; canvas.style.aspectRatio = width + '/' + height;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    fillBox(0, 0, width, height, 22, C.surface);
    strokeBox(0, 0, width, height, 22, C.line);
    ctx.save(); roundRectPath(ctx, 0, 0, width, headerH, {tl:22,tr:22,br:0,bl:0}); ctx.clip();
    ctx.fillStyle = C.pine; ctx.fillRect(0, 0, width, headerH); ctx.restore();
    text('รายงานสำหรับผู้ปกครอง', PAD, 32, '600 14px sans-serif', 'rgba(255,255,255,.85)');
    text(student.name || 'นักเรียน', PAD, 72, '700 30px sans-serif', '#FFFFFF');
    text([student.grade, ...(student.subjects || [])].filter(Boolean).join(' · ').slice(0, 58), PAD, 103, '400 16px sans-serif', '#FFFFFF');
    text(monthLabelOf(month), PAD, 130, '600 14px sans-serif', '#FFFFFF');
    layout.forEach(item => {
      const y = headerH + item.y;
      if (item.type === 'title') {
        text(item.title, PAD, y + 16, '700 17px sans-serif', C.pineDark);
      } else if (item.type === 'paragraph') {
        item.lines.forEach((line, i) => text(line, PAD, y + 15 + i * item.lh, item.font, item.color));
      } else if (item.type === 'lesson') {
        fillBox(PAD, y, INNER, item.h, 12, C.surface);
        strokeBox(PAD, y, INNER, item.h, 12, C.line);
        fillBox(PAD + 2, y + 10, 4, Math.max(8, item.h - 20), 2, item.color);
        let iy = y + 10;
        item.measured.forEach(entry => {
          entry.lines.forEach((line, i) => text(line, item.IX, iy + i * entry.lh, entry.font, entry.color));
          iy += entry.lines.length * entry.lh + 4;
        });
      }
    });
    const footerY = height - 18;
    ctx.strokeStyle = C.line; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(PAD, footerY - 22); ctx.lineTo(width - PAD, footerY - 22); ctx.stroke(); ctx.setLineDash([]);
    text(totalLabel, PAD, footerY, '700 17px sans-serif', C.pineDark);
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
    <div className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-6" style={{background:"rgba(35,40,43,.55)"}}><div className="mx-auto max-w-3xl rounded-2xl p-3 sm:p-5 shadow-xl" style={{background:C.paper}}><section className="w-full min-w-0 space-y-4 text-sm" style={{color:C.ink}}>
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:C.line,color:C.ink}}>{ui.close}</button>
        <div><h2 className="text-lg font-semibold">{ui.title} · {student.name}</h2><p style={{color:C.inkSoft}} className="text-xs mt-1">{ui.subtitle}</p></div>
        <label className="flex items-center gap-2 text-xs"><CalendarDays size={15}/><span>{ui.month}</span><input aria-label="เดือนที่รายงาน" type="month" value={month} onChange={e=>setMonth(e.target.value)} className="max-w-[150px] rounded-lg border px-2 py-2" style={{borderColor:C.line,background:C.surface}} /></label>
      </div>
      <div className="flex justify-end gap-1"><button type="button" onClick={()=>setLanguage('th')} aria-pressed={language==='th'} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:language==='th'?C.pine:C.line,background:language==='th'?C.pineTint:C.surface}}>ไทย</button><button type="button" onClick={()=>setLanguage('en')} aria-pressed={language==='en'} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:language==='en'?C.pine:C.line,background:language==='en'?C.pineTint:C.surface}}>English</button></div>
      <div className="w-full min-w-0 overflow-hidden rounded-2xl border p-3 sm:p-5" style={{background:C.paper,borderColor:C.line}}>
        <div className="rounded-2xl overflow-hidden" style={{background:C.surface,border:'1px solid '+C.line}}>
          <header className="p-5 sm:p-7 text-white" style={{background:C.pine}}>
            <div className="text-xs opacity-80">{ui.parent}</div>
            <h3 className="mt-2 break-words text-2xl sm:text-3xl font-bold">{student.name}</h3>
            <div className="mt-2 text-sm opacity-90 break-words">{[student.grade,...(student.subjects||[])].filter(Boolean).join(' · ') || 'บันทึกการเรียนรู้รายบุคคล'}</div>
            <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs" style={{background:'rgba(255,255,255,.15)'}}>{monthLabelOf(month)}</div>
          </header>
          <div className="space-y-3 p-3 sm:p-5">
            <section className="rounded-xl border p-4" style={{borderColor:C.line}}>
              <h4 className="font-semibold" style={{color:C.pine}} >{ui.score}</h4>
              {current === null ? <p className="mt-2 leading-relaxed" style={{color:C.inkSoft}}>ยังไม่มีคะแนนที่บันทึกไว้ ไม่เป็นไรค่ะ เราจะค่อย ๆ เก็บข้อมูลเพื่อดูพัฒนาการของน้องไปด้วยกัน</p> : <>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg p-2" style={{background:C.paper}}><div className="text-xs" style={{color:C.inkSoft}} >{ui.baseline}</div><strong className="text-lg">{baseline ?? '—'}</strong></div>
                  <div className="rounded-lg p-2" style={{background:C.pineTint}}><div className="text-xs" style={{color:C.inkSoft}} >{ui.latest}</div><strong className="text-lg">{current}</strong></div>
                  <div className="rounded-lg p-2" style={{background:C.goldTint}}><div className="text-xs" style={{color:C.inkSoft}} >{ui.target}</div><strong className="text-lg">{target ?? '—'}</strong></div>
                </div>
                <div className="mt-4 relative h-3 rounded-full" style={{background:C.paperDeep}}><div className="h-3 rounded-full" style={{width:Math.max(0,Math.min(100,current))+'%',background:C.pine}}/>{target!==null&&<span className="absolute -top-1.5 block h-6 w-1 rounded" style={{left:'calc('+Math.max(0,Math.min(100,target))+'% - 2px)',background:C.gold}} aria-label={'เป้าหมาย '+target}/>}</div>
                <div className="mt-2 flex justify-between text-xs" style={{color:C.inkSoft}}><span>0 คะแนน</span><span>100 คะแนน</span></div>
                {change!==null&&change>0?<p className="mt-3 font-semibold" style={{color:C.pine}}>ขึ้นมา +{change} จากตอนเริ่มเรียน</p>:change!==null?<p className="mt-3 text-sm" style={{color:C.inkSoft}}>เราจะติดตามพัฒนาการต่อเนื่องจากจุดเริ่มต้นค่ะ</p>:null}
              </>}
            </section>
            <section className="rounded-xl border p-4" style={{borderColor:C.line}}>
              <h4 className="font-semibold" style={{color:C.pine}} >{ui.skills}</h4>
              {skills.length ? <div className="mt-3 flex flex-wrap gap-2">{skills.map((s,i)=><span key={s.label+i} className="max-w-full break-words rounded-full px-3 py-1.5 text-xs" style={{background:s.status==='กำลังฝึก'?C.goldTint:s.status==='ทำได้แล้ว'?C.pineTint:C.paperDeep,color:s.status==='กำลังฝึก'?C.gold:C.pineDark}}>{s.status} · {s.label}</span>)}</div>:<p className="mt-2" style={{color:C.inkSoft}}>เมื่อมีบันทึกเรื่องที่สอนและจุดที่ติดขัด ทักษะที่กำลังฝึกจะแสดงที่นี่</p>}
            </section>
            <section className="rounded-xl border p-4" style={{borderColor:C.line}}>
              <h4 className="font-semibold" style={{color:C.pine}} >{ui.recent}</h4>
              {parsedRecent.length ? <div className="mt-3 space-y-3">{parsedRecent.map((s,i)=><article key={s.id||s.date+i} className="border-l-2 pl-3" style={{borderColor:C.pine}}><div className="text-xs font-semibold" style={{color:C.pine}}>{fmtDateThai(s.date)} · {fmtHours(s.hours)} ชั่วโมง</div><div className="mt-1 font-medium break-words">{s.parsed.taught || 'ไม่ได้ระบุเรื่องที่สอน'}</div><p className="mt-1 break-words leading-relaxed" style={{color:C.inkSoft}}>{s.parsed.outcome || 'ยังไม่มีข้อความสรุปผลการเรียนในคาบนี้'}</p></article>)}</div>:<p className="mt-2 rounded-lg p-3" style={{background:C.paper,color:C.inkSoft}}>เดือนนี้ยังไม่มีคาบสอนที่บันทึกไว้</p>}
            </section>
            <section className="rounded-xl border p-4" style={{borderColor:C.line,background:C.pineTint}}>
              <h4 className="font-semibold" style={{color:C.pineDark}} >{ui.tutor}</h4>
              <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{tutorMessage || 'วันนี้น้องทำได้ดีขึ้นค่ะ'}</p>
            </section>
            {homeworkItems.length>0&&<section className="rounded-xl border p-4" style={{borderColor:C.line}}><h4 className="font-semibold" style={{color:C.pine}} >{ui.homeworkNext}</h4><ul className="mt-2 list-disc space-y-1 pl-5">{homeworkItems.map((x,i)=><li key={i} className="break-words">{x}</li>)}</ul></section>}
            <footer className="border-t-2 border-dashed pt-4" style={{borderColor:C.line}}><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="font-semibold" style={{color:C.pine}} >{ui.total}</div><div className="mt-1 text-xs" style={{color:C.inkSoft}}>{fmtHours(monthHours)} {ui.hours} · {monthSessions.length} {ui.lessons}</div></div><div className="text-right"><div className="text-xs" style={{color:C.inkSoft}}>ยอดรวม</div><div className="text-2xl font-bold" style={{color:C.pineDark}}>{fmtMoney(monthTotal)}</div></div></div></footer>
          </div>
        </div>
      </div>
      <div className="space-y-2 rounded-xl border p-3 sm:p-4" style={{borderColor:C.line,background:C.surface}}>
        <label className="block text-xs font-medium">{ui.messageLabel}<textarea value={tutorMessage} onChange={e=>setTutorMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{borderColor:C.line,background:C.paper}} /></label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={copyImage} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-medium text-white" style={{background:C.pine}}><Clipboard size={16}/>{ui.copyImage}</button>
          <button type="button" onClick={downloadImage} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-medium" style={{borderColor:C.pine,color:C.pine}}><Download size={16}/>{ui.downloadImage}</button>
          <button type="button" onClick={copyText} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-medium" style={{borderColor:C.line,color:C.ink}}><Copy size={16}/>{ui.copyText}</button>
        </div>
        {copyStatus&&<p role="status" className="text-xs" style={{color:C.pine}}>{copyStatus}</p>}
      </div>
      <canvas ref={canvasRef} className="sr-only" aria-hidden="true" />
    </section></div></div>
  );
}
