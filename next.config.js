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

module.exports = nextConfig;
