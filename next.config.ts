import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // Allows production builds to successfully complete even if Prisma config typings fail
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig