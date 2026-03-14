import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── Search engines ──────────────────────────────────────────────
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Yandexbot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "DuckDuckBot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Applebot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },

      // ── AI crawlers ─────────────────────────────────────────────────
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "ByteSpider",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "CCBot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "FacebookBot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },

      // ── Block known bad bots / scrapers ─────────────────────────────
      { userAgent: "AhrefsBot",    disallow: "/" },
      { userAgent: "MJ12bot",      disallow: "/" },
      { userAgent: "DotBot",       disallow: "/" },
      { userAgent: "SemrushBot",   disallow: "/" },
      { userAgent: "MajesticSEO",  disallow: "/" },
      { userAgent: "BLEXBot",      disallow: "/" },

      // ── Default: allow all public pages ─────────────────────────────
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: "https://bodenradio.online/sitemap.xml",
  }
}
