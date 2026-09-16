# สมุดสอนพิเศษ — Tutor Billing App

เว็บแอปส่วนตัวสำหรับติวเตอร์ ใช้จัดตารางสอน บันทึกชั่วโมงสอน คิดค่าสอนรายชั่วโมง และสร้างข้อความแจ้งค่าสอนไว้คัดลอกส่งทาง LINE เอง

## รันบนเครื่องตัวเอง

```bash
npm install
npm run dev
```

เปิด http://localhost:3000

## Deploy ขึ้น GitHub + Vercel

1. สร้าง repo ใหม่บน GitHub แล้ว push โค้ดนี้ขึ้นไป:
   ```bash
   git init
   git add .
   git commit -m "init tutor billing app"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
2. เข้า https://vercel.com → New Project → เลือก repo ที่เพิ่ง push
3. Framework Preset จะตรวจเจอ **Next.js** อัตโนมัติ ไม่ต้องตั้งค่าอะไรเพิ่ม
4. กด Deploy รอสักครู่ก็จะได้ลิงก์ใช้งานจริง (เช่น `your-app.vercel.app`)

## เรื่องสำคัญเกี่ยวกับข้อมูล

แอปนี้เก็บข้อมูล (นักเรียน ตารางสอน ประวัติคาบสอน) ไว้ใน **localStorage ของเบราว์เซอร์** บนเครื่อง/เบราว์เซอร์ที่ใช้งานเท่านั้น ซึ่งหมายความว่า:

- ข้อมูล **ไม่ sync ข้ามอุปกรณ์** — ถ้าเปิดจากมือถือกับคอมพิวเตอร์ ข้อมูลจะคนละชุดกัน
- ถ้าล้างข้อมูลเบราว์เซอร์ (clear browsing data) หรือเปลี่ยนเครื่อง **ข้อมูลจะหาย**
- แนะนำให้เข้าใช้จากอุปกรณ์/เบราว์เซอร์เดียวเป็นหลัก และกด **"ส่งออกข้อมูล" (CSV)** เก็บสำรองไว้เป็นระยะ

ถ้าในอนาคตอยากให้ข้อมูล sync ข้ามอุปกรณ์ได้ (เช่น เปิดจากมือถือและคอมพิวเตอร์แล้วเห็นข้อมูลชุดเดียวกัน) จะต้องเพิ่มฐานข้อมูลจริง เช่น Supabase หรือ Vercel Postgres แทน localStorage — บอกได้เลยถ้าอยากต่อยอดตรงนี้

## โครงสร้างโปรเจกต์

```
app/
  layout.js       # root layout
  page.js         # หน้าแรก โหลด TutorApp
  globals.css     # tailwind
components/
  TutorApp.jsx    # ตัวแอปทั้งหมด (ทุกแท็บ/ทุกฟีเจอร์)
```
