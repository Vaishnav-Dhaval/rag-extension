import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // swcMinify was removed in Next 15; SWC minification is always on.
  httpAgentOptions: {
    keepAlive: false,
  },
};

export default config;
