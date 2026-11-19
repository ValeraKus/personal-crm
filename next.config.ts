import type { NextConfig } from "next";

// `next dev` needs eval for its debugging tools; the production build never uses it
const isDev = process.env.NODE_ENV === "development";

// Everything loads from our own domain only. Inline scripts and styles are allowed: Next.js puts
// the page data in inline scripts, and pop-ups and menus set styles right on the elements.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // The same value nginx sets: one year, without subdomains
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Older browsers do not know frame-ancestors
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites see only our domain, never the address of a page with a contact id
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone: the Docker image runs it without node_modules
  output: "standalone",
  // The app does not name its software: no "X-Powered-By: Next.js"
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
