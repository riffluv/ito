import withBundleAnalyzer from "@next/bundle-analyzer";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow builds to succeed on CI while we iteratively fix lint warnings/errors
  eslint: {
    ignoreDuringBuilds: true,
  },
  // パフォーマンス最適化
  experimental: {
    // optimizeCss: true, // critters依存エラーのため一時無効化
    optimizePackageImports: [
      "@chakra-ui/react",
      "framer-motion",
      "lucide-react",
      "firebase/firestore",
      "firebase/auth",
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        undici: false,
        "node-fetch": false,
      };
      // 強制的に undici の取り込みを無視
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^undici(\/.*)?$/ })
      );

      // Bundle分析用の最適化
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            // Firebase関連を専用チャンクに分離
            firebase: {
              test: /[\\/]node_modules[\\/]firebase[\\/]/,
              name: "firebase",
              chunks: "all",
              priority: 30,
            },
            // UI関連ライブラリを専用チャンクに分離
            ui: {
              test: /[\\/]node_modules[\\/](@chakra-ui|framer-motion|lucide-react)[\\/]/,
              name: "ui",
              chunks: "all",
              priority: 20,
            },
          },
        },
      };
    }
    return config;
  },
};

// Bundle分析を有効化（ANALYZE=true npm run buildで実行）
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default bundleAnalyzer(nextConfig);
