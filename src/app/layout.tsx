import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AisleOps — Warehouse Control",
  description: "Scan-first warehouse inventory management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
