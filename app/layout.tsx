import type { Metadata, Viewport } from "next"
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AnalyticsProvider } from "@/components/analytics-provider"
import { NextAuthProvider } from "@/components/providers/session-provider"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import "./globals.css"


/* Google fonts */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

/* Metadata */
export const metadata: Metadata = {
  title: "BØDEN Online",
  description: "Live online radio with curated DJ sets and electronic music",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BØDEN",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/apple-touch-icon-120.png", sizes: "120x120", type: "image/png" },
      { url: "/icons/apple-touch-icon-76.png", sizes: "76x76", type: "image/png" },
    ],
  },
}

/* Viewport */
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tektur:wght@500&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`
          ${spaceGrotesk.variable}
          ${jetbrainsMono.variable}
          font-sans
          antialiased
        `}
      >
        <NextAuthProvider>
          {children}
          <PwaInstallPrompt />
          <Analytics />
          <AnalyticsProvider />
        </NextAuthProvider>

        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('[SW] registered:', reg.scope); })
                    .catch(function(err) { console.warn('[SW] registration failed:', err); });
                });
              }
            `,
          }}
        />
      </body>

    </html>
  )
}