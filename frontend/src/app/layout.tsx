import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { AppNav } from "@/components/nav/AppNav";
import { MemoryPromptBanner } from "@/components/memory/MemoryPromptBanner";
import { TipBanner } from "@/components/nav/TipBanner";

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
          color="#3b82f6"
          height={3}
          showSpinner={false}
          shadow="0 0 10px rgba(59, 130, 246, 0.5), 0 0 5px rgba(59, 130, 246, 0.5)"
          speed={200}
          crawlSpeed={150}
        />
        <AppNav />
        <TipBanner />
        <MemoryPromptBanner />
        {children}
      </body>
    </html>
  );
}
