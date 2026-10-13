import './globals.css';

export const metadata = {
  title: 'Tutor Desk | สมุดบริหารงานติวเตอร์',
  description: 'จัดการนักเรียน ตารางสอน ค่าสอน และติดตามการชำระเงิน',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
