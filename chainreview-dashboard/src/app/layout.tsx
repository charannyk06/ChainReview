import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChainReview Dashboard",
  description: "Usage stats, review history, and account management for ChainReview",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 antialiased">
        {children}
      </body>
    </html>
  );
}
