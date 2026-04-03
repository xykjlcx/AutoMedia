import type { Metadata } from "next"
import { Source_Serif_4, DM_Sans, Geist_Mono } from "next/font/google"
import { Navbar } from "@/components/layout/navbar"
import { Providers } from "@/components/layout/providers"
import "./globals.css"

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  display: "swap",
})

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "AutoMedia — 你的每日资讯日报",
  description: "AI 驱动的个人每日资讯聚合，涵盖 GitHub、掘金、知乎、Product Hunt、Hacker News 等优质信息源",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${sourceSerif.variable} ${dmSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1 pt-14">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
