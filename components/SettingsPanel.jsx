'use client';

import { useEffect, useState } from 'react';
import { X, Upload, Trash2, Save, Image as ImageIcon } from 'lucide-react';

const C={paper:'#FAF6EC',ink:'#23282B',soft:'#6B7270',line:'#DED4B8',surface:'#fff',pine:'#2E5E45',dark:'#20402F',tint:'#E7EFE7',brick:'#A0392A'};
const TEXT={
 th:{title:'ตั้งค่าการชำระเงิน',subtitle:'ตั้งค่าชื่อที่แสดงและ QR สำหรับใบแจ้งค่าสอน',display:'ชื่อที่แสดงในใบ',displayHint:'เช่น ชื่อติวเตอร์หรือชื่อบัญชี',payment:'ข้อความช่องทางชำระ (ไม่บังคับ)',paymentHint:'เช่น โอนผ่านแอปธนาคาร หรือรายละเอียดสั้น ๆ',qr:'รูป QR สำหรับชำระเงิน',upload:'เลือกรูป QR',remove:'ลบรูป',save:'บันทึกการตั้งค่า',cancel:'ปิด',only:'รองรับไฟล์ PNG และ JPG เท่านั้น',large:'รูปหลังย่อยังมีขนาดเกิน 300 KB กรุณาใช้รูปที่เล็กลง',saved:'บันทึกแล้ว',loadError:'อ่านรูปไม่สำเร็จ',noQr:'ยังไม่ได้อัปโหลด QR',tip:'ระบบจะย่อรูปด้านยาวไม่เกิน 600px ก่อนบันทึก ไม่มีช่องกรอกเลขบัญชีหรือ PromptPay ID'},
 en:{title:'Payment settings',subtitle:'Set the display name and payment QR for invoices',display:'Display name on invoice',displayHint:'Tutor or account display name',payment:'Payment note (optional)',paymentHint:'Short payment instructions, if needed',qr:'Payment QR image',upload:'Choose QR image',remove:'Remove image',save:'Save settings',cancel:'Close',only:'Only PNG and JPG files are supported',large:'The resized image is still larger than 300 KB. Please choose a smaller image.',saved:'Settings saved',loadError:'Could not read image',noQr:'No QR uploaded yet',tip:'Images are resized to a maximum 600px on the longest side. No account number or PromptPay ID field is used.'}
};
export default function SettingsPanel({settings={},onSave,onClose,lang='th',showToast}){
 const t=TEXT[lang]||TEXT.th;
 const [displayName,setDisplayName]=useState(settings.display_name||'');
 const [paymentNote,setPaymentNote]=useState(settings.payment_note||'');
 const [qr,setQr]=useState(settings.qr_data_url||null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{setDisplayName(settings.display_name||'');setPaymentNote(settings.payment_note||'');setQr(settings.qr_data_url||null);},[settings]);
 const chooseImage=e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  if(!['image/png','image/jpeg'].includes(file.type)){showToast?.(t.only);return;}
  const reader=new FileReader();
  reader.onerror=()=>showToast?.(t.loadError);
  reader.onload=()=>{
   const img=new Image();
   img.onerror=()=>showToast?.(t.loadError);
   img.onload=()=>{
    const factor=Math.min(1,600/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*factor));canvas.height=Math.max(1,Math.round(img.height*factor));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL('image/jpeg',0.85);
    if(result.length>300*1024){showToast?.(t.large);return;}
    setQr(result);
   };
   img.src=String(reader.result);
  };
  reader.readAsDataURL(file);
 };
 const save=async()=>{
  setBusy(true);
  try{await onSave?.({display_name:displayName.trim(),payment_note:paymentNote.trim(),qr_data_url:qr});showToast?.(t.saved);}
  catch(e){console.error(e);showToast?.(lang==='en'?'Could not save settings':'บันทึกการตั้งค่าไม่สำเร็จ');}
  finally{setBusy(false);}
 };
 return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{background:'rgba(35,40,43,.48)'}} onClick={onClose}>
  <section className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 overflow-y-auto" style={{background:C.surface,borderColor:C.line,maxHeight:'92dvh'}} onClick={e=>e.stopPropagation()}>
   <header className="flex items-start justify-between gap-3 mb-5"><div><h2 className="text-xl font-semibold">{t.title}</h2><p className="mt-1 text-sm" style={{color:C.soft}}>{t.subtitle}</p></div><button type="button" onClick={onClose} aria-label={t.cancel} className="rounded-lg border p-2" style={{borderColor:C.line}}><X size={18}/></button></header>
   <div className="space-y-4">
    <label className="block"><span className="mb-1 block text-sm font-medium">{t.display}</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder={t.displayHint} className="w-full rounded-lg border px-3 py-2.5 text-base" style={{borderColor:C.line,background:C.paper}}/></label>
    <label className="block"><span className="mb-1 block text-sm font-medium">{t.payment}</span><textarea value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} rows={3} placeholder={t.paymentHint} className="w-full rounded-lg border px-3 py-2.5 text-base" style={{borderColor:C.line,background:C.paper,resize:'vertical'}}/></label>
    <div><div className="mb-2 text-sm font-medium">{t.qr}</div><div className="flex flex-col sm:flex-row gap-4 rounded-xl border p-4" style={{borderColor:C.line,background:C.paper}}>
      <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border bg-white" style={{borderColor:C.line}}>{qr?<img src={qr} alt="QR payment preview" className="h-full w-full rounded-lg object-contain p-1"/>:<div className="text-center text-xs" style={{color:C.soft}}><ImageIcon size={24} className="mx-auto mb-2"/>{t.noQr}</div>}</div>
      <div className="flex flex-col items-start gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white" style={{background:C.pine}}><Upload size={16}/>{t.upload}<input type="file" accept="image/png,image/jpeg" onChange={chooseImage} className="sr-only"/></label>{qr&&<button type="button" onClick={()=>setQr(null)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{borderColor:C.line,color:C.brick}}><Trash2 size={15}/>{t.remove}</button>}<p className="max-w-sm text-xs leading-5" style={{color:C.soft}}>{t.tip}</p></div>
    </div></div>
   </div>
   <footer className="mt-6 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold" style={{borderColor:C.line,color:C.soft}}>{t.cancel}</button><button type="button" disabled={busy} onClick={save} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:C.pine}}><Save size={16}/>{t.save}</button></footer>
  </section>
 </div>;
}
