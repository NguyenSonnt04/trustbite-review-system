import "./globals.css";

export const metadata = {
  title: "TrustBite Admin",
  description: "TrustBite operations and administration console",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
