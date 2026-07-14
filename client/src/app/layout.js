import "./globals.css";

export const metadata = {
  title: "TrustBite",
  description: "Nền tảng đánh giá ẩm thực đáng tin cậy",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
