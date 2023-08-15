/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects: async () => {
    return [
      {
        source: "/",
        destination: "/coffee",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
