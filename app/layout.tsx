import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { PostHogProvider } from "@/components/posthog-provider"
import "./globals.css"
import Script from "next/script";

export const metadata: Metadata = {
  title: "리뷰플로우 | 블로거 체험단 관리 앱",
  description: "일정 체크부터 수익 정산까지. 리뷰 관리, 이제 스트레스 받지 마세요. 체험단 관리의 새로운 기준, ReviewFlow",
  generator: "v0.app",
  metadataBase: new URL('https://reviewflow.tech'),
  keywords: ['리뷰플로우', '체험단', '블로거', '리뷰 관리', '일정 관리', '수익 관리', 'ReviewFlow'],
  authors: [{ name: 'ReviewFlow' }],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://reviewflow.tech',
    siteName: '리뷰플로우',
    title: '리뷰플로우 | 블로거 체험단 관리 앱',
    description: '일정 체크부터 수익 정산까지. 리뷰 관리, 이제 스트레스 받지 마세요. 체험단 관리의 새로운 기준, ReviewFlow',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '리뷰플로우 - 체험단 관리 앱',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '리뷰플로우 | 블로거 체험단 관리 앱',
    description: '일정 체크부터 수익 정산까지. 리뷰 관리, 이제 스트레스 받지 마세요.',
    images: ['/og-image.png'],
  },
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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, viewport-fit=cover"
        />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className={`font-sans antialiased`}>
        <Script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY}&libraries=services&autoload=false`}
          strategy="beforeInteractive"
        />
        <PostHogProvider>
          {children}
          <Toaster />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}
