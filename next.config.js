const nextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.SKIP_NEXT_TYPECHECK === '1',
  },

  turbopack: {},

  // 실시간 2창 검증용: localhost와 127.0.0.1은 쿠키가 분리돼 서로 다른 참가자로 접속된다
  allowedDevOrigins: ['127.0.0.1'],

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
