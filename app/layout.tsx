import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ISMS Application",
  description: "Student Information Management System",
};

/**
 * Root layout that applies global fonts, base styles, and includes Vercel Analytics.
 *
 * @param children - The page content to render inside the layout's <body>.
 * @returns The root HTML structure containing the configured font classes, styled <body> wrapping `children`, and the Analytics component.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased w-screen bg-gray-50 overflow-x-hidden`}
      >
        {children}
      </body>
      <Analytics/> 
    </html>
  );
}
