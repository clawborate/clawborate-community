import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: false,
  async rewrites() {
    // In Docker, BACKEND_URL points to the backend service; falls back to localhost for local dev.
    // Nginx fronts everything on port 3000, but Next.js still needs rewrites for local dev
    // and for the /api/* routes that nginx forwards to it.
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8001'
    return [
      { source: '/api/open-webui/proxy', destination: `${backendUrl}/api/open-webui/proxy` },
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
    ]
  },
}

export default nextConfig
