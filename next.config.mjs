import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

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
  webpack: (config, { isServer, webpack, dev }) => {
    if (dev) {
      const ignoredPatterns = [
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "**/public/images/**",
        "**/public/sfx/**",
        "**/public/design/**",
        "**/test-results/**",
        "**/coverage/**",
      ];
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: ignoredPatterns,
      };
    }

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
    } else {
      // サーバー側ビルドで chunk が .next/server/chunks 配下に出力されると
      // webpack-runtime が `require("./859.js")` で読み込みに失敗するため、
      // chunkFilename から `chunks/` プレフィックスを取り除き、
      // ルート直下 (.next/server) に配置する。
      if (
        isServer &&
        config.output?.chunkFilename &&
        config.output.chunkFilename.includes("chunks/")
      ) {
        config.output.chunkFilename = config.output.chunkFilename.replace(
          "chunks/",
          ""
        );
      }
    }
    return config;
  },
};

if (!process.env.STRIPE_SECRET_KEY?.trim()) {
  console.warn("[stripe] STRIPE_SECRET_KEY is not set. Stripe checkout API routes will respond with 503 until configured.");
}

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
  console.warn("[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Client-side Stripe UI will remain disabled.");
}

if (process.env.NEXT_PUBLIC_STRIPE_UI_ENABLED !== "1") {
  console.warn("[stripe] NEXT_PUBLIC_STRIPE_UI_ENABLED is not '1'. Supporter UI will stay hidden.");
}


// Bundle分析を有効化（ANALYZE=true npm run buildで実行）
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const configWithAnalyzer = bundleAnalyzer(nextConfig);

const sentryWebpackPluginOptions = {
  silent: true,
  dryRun: !process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN,
};

export default withSentryConfig(configWithAnalyzer, sentryWebpackPluginOptions);
