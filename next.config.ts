import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['canvas', '@napi-rs/canvas', 'gifenc', 'discord.js', '@discordjs/ws', '@discordjs/rest', 'zlib-sync'],
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {},
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
      {
        protocol: 'https',
        hostname: 'ella.janitorai.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, {dev, isServer}) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        canvas: false,
        '@napi-rs/canvas': false,
        gifenc: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
