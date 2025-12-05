import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { PostHogProvider } from "@/components/posthog-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "리뷰플로우 | 블로거 체험단 관리 앱",
  description: "블로거 체험단 관리 앱",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/logo-white-2.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo-white-2.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/logo-white-2.png",
        type: "image/svg+xml",
      },
    ],
    apple: "/logo-white-2.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className={`font-sans antialiased`}>
        <PostHogProvider>
          {children}
          <Toaster />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}
