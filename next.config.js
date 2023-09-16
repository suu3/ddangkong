/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa');
const isProduction = process.env.NODE_ENV === 'production';
const runtimeCaching = require('next-pwa/cache.js');

const nextConfig = {
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/coffee',
        permanent: true,
      },
    ];
  },
};

module.exports = withPWA({
  dest: 'public',
  disable: !isProduction,
  runtimeCaching: runtimeCaching,
})(nextConfig);
