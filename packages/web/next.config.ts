import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@como-voto-uy/shared'],
}

export default nextConfig
