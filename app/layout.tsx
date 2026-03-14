import type { Metadata, Viewport } from "next"
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AnalyticsProvider } from "@/components/analytics-provider"
import { NextAuthProvider } from "@/components/providers/session-provider"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import { FloatingReactions } from "@/components/floating-reactions"
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
  title: {
    default: "Boden Radio — Live Deep House, Dub Techno & Electronic Music Radio Online",
    template: "%s | Boden Radio",
  },
  description: "Boden Radio is a 24/7 live online radio station streaming deep house radio, dub techno radio, hypnotic techno radio, ambient radio, and electronic music. Listen free — no ads, curated DJ sets.",
  keywords: [
    "boden radio", "online radio", "live radio",
    "deep house radio", "dub techno radio", "hypnotic techno radio",
    "ambient radio", "electronic music radio", "techno radio",
    "deep house music online", "dub techno online", "free radio stream",
    "DJ sets online", "electronic music live stream",
  ],
  authors: [{ name: "Boden Radio" }],
  creator: "Boden Radio",
  publisher: "Boden Radio",
  manifest: "/manifest.json",
  metadataBase: new URL("https://bodenradio.online"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://bodenradio.online",
    siteName: "Boden Radio",
    title: "Boden Radio — Live Deep House, Dub Techno & Electronic Music Online",
    description: "24/7 live online radio: deep house, dub techno, hypnotic techno, ambient. Free stream, no ads.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Boden Radio — Live Electronic Music Radio",
    description: "24/7 live online radio: deep house, dub techno, hypnotic techno, ambient.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Boden Radio",
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tektur:wght@500&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "RadioStation",
              "name": "Boden Radio",
              "alternateName": "BØDEN Radio",
              "url": "https://bodenradio.online",
              "logo": "https://bodenradio.online/icons/icon-512.png",
              "description": "24/7 live online radio station streaming deep house, dub techno, hypnotic techno, ambient and electronic music. Free stream with curated DJ sets.",
              "genre": [
                "Deep House", "Dub Techno", "Hypnotic Techno",
                "Ambient", "Electronic Music", "Techno"
              ],
              "broadcastFrequency": "Online",
              "broadcastTimezone": "UTC",
              "sameAs": [
                "https://bodenradio.online"
              ],
            }),
          }}
        />
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
          <FloatingReactions />
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