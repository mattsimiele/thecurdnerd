import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Curd Nerd | Operations Intelligence",
  description: "A clear daily view of sales, hospitality, labor, and financial performance.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
