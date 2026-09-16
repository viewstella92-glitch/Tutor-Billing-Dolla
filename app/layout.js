import './globals.css';

export const metadata = {
  title: 'สมุดสอนพิเศษ',
  description: 'จัดตาราง คิดค่าสอน แจ้งผู้ปกครอง',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
