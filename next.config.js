/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa');
const isProduction = process.env.NODE_ENV === 'production';
const runtimeCaching = require('next-pwa/cache.js');
const disablePWA = process.env.DISABLE_PWA === '1';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.SKIP_NEXT_TYPECHECK === '1',
  },

  turbopack: {},

  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.(mp4)$/i,
      use: [
        options.defaultLoaders.babel,
        {
          loader: 'file-loader',
        },
      ],
    });

    return config;
  },

  // redirects: async () => {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/coffee',
  //       permanent: true,
  //     },
  //   ];
  // },
};

module.exports = withPWA({
  dest: 'public',
  disable: disablePWA || !isProduction,
  runtimeCaching: runtimeCaching,
})(nextConfig);
