import './globals.css';

export const metadata = {
  title: 'Tutor Desk — Teaching Studio',
  description: 'พื้นที่จัดการนักเรียน ตารางสอน บันทึกคาบเรียน และรายรับสำหรับติวเตอร์',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
