import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Citebeam — know what AI is saying about your brand",
  description:
    "Citebeam monitors your brand across 8 Chinese AI assistants (豆包 / Kimi / 通义 / 文心 / DeepSeek / 智谱 / 元宝 / 百度) plus ChatGPT and Claude. Chat-first, never burying you in dashboards. A bbd.sh studio service.",
  metadataBase: new URL("https://citebeam.bbd.sh"),
  openGraph: {
    title: "Citebeam — know what AI is saying about your brand",
    description: "AI brand visibility, by bbd.sh studio",
    url: "https://citebeam.bbd.sh",
    siteName: "Citebeam",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Citebeam — know what AI is saying about your brand",
    description: "AI brand visibility, by bbd.sh studio",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
