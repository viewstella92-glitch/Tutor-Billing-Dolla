import './globals.css';

export const metadata = {
  title: 'Dolla Tutor — Teaching Studio',
  description: 'จัดการนักเรียน ตารางสอน บันทึกคาบเรียน ค่าสอน และรายงานสำหรับผู้ปกครอง',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
