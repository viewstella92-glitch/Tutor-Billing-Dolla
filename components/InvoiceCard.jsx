'use client';

import { useMemo, useState } from 'react';
import { Clipboard, Copy, Download, CheckCircle2, Circle } from 'lucide-react';

const C={paper:'#FAF6EC',deep:'#F1EAD8',ink:'#23282B',soft:'#6B7270',line:'#DED4B8',pine:'#2E5E45',dark:'#20402F',tint:'#E7EFE7',brick:'#A0392A',brickTint:'#F5E4DF'};
export const T={
 th:{invoice:'ใบแจ้งค่าสอน',invoiceNo:'เลขที่ใบ',issued:'วันที่ออกใบ',recipient:'ผู้รับ',parent:'ผู้ปกครอง',period:'ช่วงวันที่',lessons:'รายการคาบ',date:'วันที่',hours:'ชั่วโมง',rate:'อัตรา',amount:'ยอดคาบ',totalDue:'ยอดที่ต้องชำระ',scanToPay:'สแกนเพื่อชำระ',paid:'ชำระแล้ว',unpaid:'ค้างชำระ',payment:'ช่องทางชำระเงิน',qrMissing:'ยังไม่ได้ตั้งค่า QR',copyImage:'คัดลอกรูป',downloadImage:'ดาวน์โหลดรูป',copyText:'คัดลอกข้อความ',copied:'คัดลอกแล้ว',error:'ส่งออกรูปไม่สำเร็จ',account:'ชื่อบัญชี',noLessons:'ไม่มีรายการคาบ'},
 en:{invoice:'Invoice',invoiceNo:'Invoice No.',issued:'Issued',recipient:'Bill to',parent:'Parent',period:'Period',lessons:'Lessons',date:'Date',hours:'Hours',rate:'Rate',amount:'Amount',totalDue:'Total due',scanToPay:'Scan to pay',paid:'Paid',unpaid:'Unpaid',payment:'Payment details',qrMissing:'QR not configured',copyImage:'Copy image',downloadImage:'Download image',copyText:'Copy text',copied:'Copied',error:'Image export failed',account:'Account name',noLessons:'No lessons listed'}
};
const dateFmt=(v,l)=>{if(!v)return'—';const d=new Date(v+'T12:00:00');return l==='en'?d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});};
const money=(v,l)=>l==='en'?'THB '+Math.round(Number(v)||0).toLocaleString('en-US'):'฿'+Math.round(Number(v)||0).toLocaleString('th-TH');
const hours=v=>String(Math.round((Number(v)||0)*100)/100).replace(/\.0+$/,'');
const noteDetails=(note,lang)=>{let subject='',th='',en='';String(note||'').split('\n').forEach(line=>{const s=line.trim();if(s.startsWith('EN topic:'))en=s.slice(9).trim();else if(s.startsWith('สอน:'))th=s.slice(4).trim();else if(s.startsWith('วิชา:'))subject=s.slice(4).trim();else if(s.startsWith('Subject:'))subject=s.slice(8).trim();});return [subject,lang==='en'?(en||th):(th||en)].filter(Boolean).join(' · ')||(lang==='en'?'Lesson':'คาบเรียน');};
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
const wrap=(ctx,text,max)=>{const words=String(text||'').split(/\s+/);const out=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>max&&line){out.push(line);line=word;}else line=test;}if(line)out.push(line);return out;};

export default function InvoiceCard({invoice,student,sessions=[],settings={},lang='th',showToast}){
 const [busy,setBusy]=useState(false);const words=T[lang]||T.th;
 const sorted=useMemo(()=>[...sessions].sort((a,b)=>a.date.localeCompare(b.date)),[sessions]);
 const total=Number(invoice?.total??sorted.reduce((sum,s)=>sum+Number(s.hours||0)*Number(s.rate||0),0));
 const isPaid=sorted.length>0&&sorted.every(s=>Boolean(s.paid));
 const issuedValue=(()=>{const d=invoice?.created_at?new Date(invoice.created_at):new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
 const issued=dateFmt(issuedValue,lang);
 const details=s=>noteDetails(s.note,lang);
 const textVersion=()=>[
  words.invoice+' · '+(invoice?.number||'—'),words.invoiceNo+': '+(invoice?.number||'—'),words.issued+': '+issued,
  words.recipient+': '+(student?.name||invoice?.student_name||'—'),
  ...(invoice?.parent_name?[words.parent+': '+invoice.parent_name]:[]),
  words.period+': '+dateFmt(invoice?.period_from,lang)+' – '+dateFmt(invoice?.period_to,lang),'',words.lessons+':',
  ...sorted.map((s,i)=>(i+1)+'. '+dateFmt(s.date,lang)+' · '+details(s)+' · '+hours(s.hours)+' '+words.hours+' × '+money(s.rate,lang)+' = '+money(Number(s.hours)*Number(s.rate),lang)),
  '',words.totalDue+': '+money(total,lang),isPaid?words.paid:words.unpaid,
  ...(settings?.payment_note?[words.payment+': '+settings.payment_note]:[]),
  ...(settings?.display_name?[words.account+': '+settings.display_name]:[])
 ].join('\n');
 const makeCanvas=async()=>{
  const canvas=document.createElement('canvas'),scale=2,w=720,p=32,inner=w-p*2;
  const rowH=sorted.map(s=>Math.max(72,42+Math.min(2,details(s).length>42?2:1)*18));
  const qr=Boolean(settings?.qr_data_url),payH=qr?208:72,h=540+rowH.reduce((a,b)=>a+b,0)+payH;
  canvas.width=w*scale;canvas.height=h*scale;
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle=C.paper;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=C.dark;ctx.fillRect(0,0,w,142);ctx.fillStyle='#fff';ctx.font='bold 28px sans-serif';ctx.fillText(words.invoice,p,45);
  ctx.font='13px sans-serif';ctx.fillStyle='#DDE9DF';ctx.fillText(words.invoiceNo+': '+(invoice?.number||'—'),p,74);ctx.fillText(words.issued+': '+issued,p,99);
  ctx.textAlign='right';ctx.font='bold 16px sans-serif';ctx.fillStyle='#fff';ctx.fillText(settings?.display_name||'Tutor',w-p,48);ctx.textAlign='left';
  let y=172;ctx.fillStyle=C.soft;ctx.font='12px sans-serif';ctx.fillText(words.recipient.toUpperCase(),p,y);
  ctx.fillStyle=C.ink;ctx.font='bold 20px sans-serif';ctx.fillText(student?.name||invoice?.student_name||'—',p,y+26);
  if(invoice?.parent_name){ctx.font='13px sans-serif';ctx.fillStyle=C.soft;ctx.fillText(words.parent+': '+invoice.parent_name,p,y+48);}
  ctx.textAlign='right';ctx.font='12px sans-serif';ctx.fillStyle=C.soft;ctx.fillText(words.period,w-p,y);ctx.font='bold 13px sans-serif';ctx.fillStyle=C.ink;ctx.fillText(dateFmt(invoice?.period_from,lang)+' – '+dateFmt(invoice?.period_to,lang),w-p,y+23);ctx.textAlign='left';
  y+=74;ctx.fillStyle=C.pine;ctx.fillRect(p,y,inner,34);ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';
  ctx.fillText(words.date,p+9,y+21);ctx.fillText(words.lessons,p+110,y+21);ctx.fillText(words.hours,p+405,y+21);ctx.textAlign='right';ctx.fillText(words.rate,p+550,y+21);ctx.fillText(words.amount,w-p-8,y+21);ctx.textAlign='left';y+=34;
  for(let i=0;i<sorted.length;i++){const s=sorted[i],rh=rowH[i];ctx.fillStyle=i%2?'#FFFFFF':C.deep;ctx.fillRect(p,y,inner,rh);ctx.fillStyle=C.ink;ctx.font='11px sans-serif';ctx.fillText(dateFmt(s.date,lang),p+9,y+22);
   ctx.font='bold 11px sans-serif';ctx.fillText(hours(s.hours),p+405,y+22);ctx.textAlign='right';ctx.font='11px sans-serif';ctx.fillText(money(s.rate,lang),p+550,y+22);ctx.font='bold 11px sans-serif';ctx.fillText(money(Number(s.hours)*Number(s.rate),lang),w-p-8,y+22);ctx.textAlign='left';
   ctx.fillStyle=C.soft;ctx.font='11px sans-serif';wrap(ctx,details(s),270).slice(0,2).forEach((line,j)=>ctx.fillText(line,p+110,y+22+j*16));y+=rh;}
  y+=16;ctx.fillStyle=C.tint;ctx.fillRect(p,y,inner,76);ctx.fillStyle=C.dark;ctx.font='bold 14px sans-serif';ctx.fillText(words.totalDue,p+16,y+28);ctx.textAlign='right';ctx.font='bold 27px sans-serif';ctx.fillText(money(total,lang),w-p-16,y+54);ctx.textAlign='left';y+=96;
  ctx.fillStyle=C.soft;ctx.font='bold 11px sans-serif';ctx.fillText(words.payment.toUpperCase(),p,y);ctx.fillStyle=C.ink;ctx.font='12px sans-serif';
  if(settings?.payment_note)wrap(ctx,settings.payment_note,inner-8).slice(0,2).forEach((line,j)=>ctx.fillText(line,p,y+21+j*17));
  if(settings?.display_name){ctx.fillStyle=C.soft;ctx.fillText(words.account+': '+settings.display_name,p,y+(settings?.payment_note?57:23));}
  if(qr){try{const img=await loadImage(settings.qr_data_url);const qx=w-p-172,qy=y+8;ctx.fillStyle='#fff';ctx.fillRect(qx-5,qy-5,170,170);ctx.drawImage(img,qx,qy,160,160);ctx.fillStyle=C.dark;ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(words.scanToPay,qx+80,qy+174);ctx.textAlign='left';}catch(e){}}
  y+=payH;ctx.fillStyle=isPaid?C.pine:C.brick;ctx.beginPath();ctx.roundRect(p,y,140,28,14);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 12px sans-serif';ctx.fillText(isPaid?words.paid:words.unpaid,p+14,y+18);
  return canvas;
 };
 const saveBlob=async copy=>{
  setBusy(true);try{const canvas=await makeCanvas();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');
   if(copy&&navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);showToast?.(words.copied);}
   else{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='invoice-'+(invoice?.number||'invoice')+'-'+lang+'.png';a.click();URL.revokeObjectURL(url);if(copy)showToast?.(lang==='en'?'Clipboard unavailable; downloaded instead':'เบราว์เซอร์ไม่รองรับคัดลอกรูป จึงดาวน์โหลดแทน');}
  }catch(e){console.error(e);showToast?.(words.error);}finally{setBusy(false);}
 };
 const copyText=async()=>{try{await navigator.clipboard.writeText(textVersion());showToast?.(words.copied);}catch(e){showToast?.(lang==='en'?'Copy failed':'คัดลอกไม่สำเร็จ');}};
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-sm">{words.invoice} · {invoice?.number}</div><span className="rounded-full px-3 py-1 text-xs font-semibold" style={{background:isPaid?C.tint:C.brickTint,color:isPaid?C.dark:C.brick}}>{isPaid?<CheckCircle2 size={13} className="inline mr-1"/>:<Circle size={13} className="inline mr-1"/>}{isPaid?words.paid:words.unpaid}</span></div>
  <div className="overflow-hidden rounded-2xl border" style={{borderColor:C.line,background:C.paper}}>
   <div className="p-5 sm:p-6 text-white" style={{background:C.dark}}><div className="flex items-start justify-between gap-3"><div><div className="text-2xl font-semibold">{words.invoice}</div><div className="mt-2 text-xs">{words.invoiceNo}: {invoice?.number}</div><div className="mt-1 text-xs">{words.issued}: {issued}</div></div><div className="text-right text-sm font-semibold">{settings?.display_name||'Tutor'}</div></div></div>
   <div className="p-4 sm:p-6 space-y-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="text-xs" style={{color:C.soft}}>{words.recipient}</div><div className="mt-1 text-lg font-semibold">{student?.name||invoice?.student_name||'—'}</div>{invoice?.parent_name&&<div className="mt-1 text-sm" style={{color:C.soft}}>{words.parent}: {invoice.parent_name}</div>}</div><div className="text-sm sm:text-right"><div className="text-xs" style={{color:C.soft}}>{words.period}</div><div className="mt-1 font-medium">{dateFmt(invoice?.period_from,lang)} – {dateFmt(invoice?.period_to,lang)}</div></div></div>
    <div className="overflow-x-auto rounded-lg border" style={{borderColor:C.line}}><table className="w-full min-w-[560px] text-sm"><thead style={{background:C.pine,color:'#fff'}}><tr>{[words.date,words.lessons,words.hours,words.rate,words.amount].map((t,i)=><th key={t} className={'px-3 py-2 font-medium '+(i===0||i===1?'text-left':'text-right')}>{t}</th>)}</tr></thead><tbody>{sorted.map((s,i)=><tr key={s.id} style={{background:i%2===0?'#fff':C.deep,borderTop:'1px solid '+C.line}}><td className="px-3 py-3 align-top whitespace-nowrap">{dateFmt(s.date,lang)}</td><td className="px-3 py-3 min-w-40"><div className="font-medium break-words">{details(s)}</div></td><td className="px-3 py-3 text-right align-top">{hours(s.hours)}</td><td className="px-3 py-3 text-right align-top whitespace-nowrap">{money(s.rate,lang)}</td><td className="px-3 py-3 text-right align-top whitespace-nowrap font-medium">{money(Number(s.hours)*Number(s.rate),lang)}</td></tr>)}{!sorted.length&&<tr><td colSpan="5" className="p-5 text-center" style={{color:C.soft}}>{words.noLessons}</td></tr>}</tbody></table></div>
    <div className="flex items-end justify-between gap-3 rounded-xl p-4" style={{background:C.tint,color:C.dark}}><div className="font-semibold">{words.totalDue}</div><div className="text-2xl sm:text-3xl font-bold">{money(total,lang)}</div></div>
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t pt-4" style={{borderColor:C.line}}><div className="flex-1 min-w-0"><div className="text-xs font-semibold uppercase" style={{color:C.soft}}>{words.payment}</div>{settings?.payment_note&&<p className="mt-2 text-sm break-words">{settings.payment_note}</p>}{settings?.display_name&&<p className="mt-1 text-xs" style={{color:C.soft}}>{words.account}: {settings.display_name}</p>}<p className="mt-3 text-xs font-medium" style={{color:C.dark}}>{words.scanToPay}</p></div>{settings?.qr_data_url?<img src={settings.qr_data_url} alt="Payment QR" className="h-40 w-40 shrink-0 rounded-lg border bg-white object-contain p-1"/>:<div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-dashed text-center text-xs" style={{borderColor:C.line,color:C.soft,background:'#fff'}}>{words.qrMissing}<br/>{lang==='th'?'แสดงเฉพาะตัวอย่าง':''}</div>}</div>
    <div className="flex justify-end"><span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{background:isPaid?C.tint:C.brickTint,color:isPaid?C.dark:C.brick}}>{isPaid?words.paid:words.unpaid}</span></div>
   </div>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><button type="button" disabled={busy} onClick={()=>saveBlob(true)} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:C.pine}}><Clipboard size={16}/>{words.copyImage}</button><button type="button" disabled={busy} onClick={()=>saveBlob(false)} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold disabled:opacity-50" style={{borderColor:C.pine,color:C.pine}}><Download size={16}/>{words.downloadImage}</button><button type="button" onClick={copyText} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold" style={{borderColor:C.line,color:C.ink}}><Copy size={16}/>{words.copyText}</button></div>
 </div>;
}
