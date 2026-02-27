// ============================================================
// This Mind Does Not Exist — Web App (Next.js 15)
// ============================================================
// Entry point: apps/web/
// Framework: Next.js 15 with App Router
// Styling: Tailwind CSS + shadcn/ui
// 
// Pages:
//   /              → Main reasoning interface
//   /traces        → Browse past debates
//   /traces/[id]   → View specific debate transcript
//   /settings      → Configure models, rounds, etc.
//   /finetune      → Fine-tuning dashboard
//
// API Integration:
//   Connects to the Fastify backend at NEXT_PUBLIC_API_URL
//   Uses Server-Sent Events (SSE) for real-time debate streaming
// ============================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React 19 features
  reactStrictMode: true,
  
  // API proxy to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
