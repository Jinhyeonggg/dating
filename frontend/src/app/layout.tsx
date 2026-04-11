import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { AppNav } from "@/components/nav/AppNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digital Clone Platform",
  description: "AI 페르소나 클론끼리 대화하는 호환성 탐색 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextTopLoader
          color="hsl(var(--primary))"
          height={3}
          showSpinner={false}
          shadow="0 0 8px hsl(var(--primary) / 0.4)"
        />
        <AppNav />
        {children}
      </body>
    </html>
  );
}
