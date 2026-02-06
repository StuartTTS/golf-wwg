import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@golf/core', '@golf/ui'],
};

export default nextConfig;
