import fs from "node:fs";
import path from "node:path";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { build as esbuildBuild } from "esbuild";

const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.GIT_COMMIT ||
  process.env.GIT_COMMIT_SHA ||
  "";

const shortCommit = commitSha ? commitSha.slice(0, 7) : "local";
const timestamp = new Date().toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
const fallbackVersion = `${timestamp}-${shortCommit}`;

if (
  !process.env.NEXT_PUBLIC_APP_VERSION ||
  !process.env.NEXT_PUBLIC_APP_VERSION.trim()
) {
  process.env.NEXT_PUBLIC_APP_VERSION = fallbackVersion;
}

// Expose a per-build SW version to the client (App Routerでは __NEXT_DATA__ が無いので env 経由で渡す)
process.env.NEXT_PUBLIC_SW_VERSION =
  process.env.NEXT_PUBLIC_SW_VERSION ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_BUILD_ID ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  fallbackVersion;

/** @type {import('next').NextConfig} */
const SECURITY_HEADERS = [
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Embedder-Policy",
    value: "credentialless",
  },
];

const pixiWorkerEntry = path.join(process.cwd(), "lib/pixi/background.worker.ts");
const pixiWorkerOutput = path.join(process.cwd(), "public/workers/pixi-background-worker.js");
let pixiWorkerBuildPromise = null;
let pixiWorkerBuildMode = null;

const ensurePixiWorkerBundle = (dev) => {
  if (pixiWorkerBuildPromise && pixiWorkerBuildMode === dev) {
    return pixiWorkerBuildPromise;
  }
  pixiWorkerBuildMode = dev;
  fs.mkdirSync(path.dirname(pixiWorkerOutput), { recursive: true });
  pixiWorkerBuildPromise = esbuildBuild({
    entryPoints: [pixiWorkerEntry],
    outfile: pixiWorkerOutput,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: dev ? "es2022" : "es2019",
    sourcemap: dev ? "inline" : false,
    minify: !dev,
    loader: { ".ts": "ts" },
    banner: { js: "/* pixi background worker bundle */" },
  }).finally(() => {
    pixiWorkerBuildPromise = null;
  });
  return pixiWorkerBuildPromise;
};

class PixiWorkerBuildPlugin {
  constructor(dev) {
    this.dev = dev;
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tapPromise("PixiWorkerBuildPlugin", () => ensurePixiWorkerBundle(this.dev));
    compiler.hooks.afterCompile.tap("PixiWorkerBuildPlugin", (compilation) => {
      if (compilation?.fileDependencies?.add) {
        compilation.fileDependencies.add(pixiWorkerEntry);
      }
    });
  }
}

const nextConfig = {
  // 開発環境でのカード描画・アニメーション問題を回避するため無効化
  // Strict Modeの2重レンダリングがPixi.js/GSAPアニメーションと競合
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/sfx/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/_next/static/media/:path*.worker.ts",
        headers: [
          {
            key: "Content-Type",
            value: "text/javascript",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/_next/static/:path*.ts",
        headers: [
          {
            key: "Content-Type",
            value: "text/javascript",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
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
      config.plugins.push(new PixiWorkerBuildPlugin(dev));
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

    if (isServer) {
      config.plugins = config.plugins || [];
      config.plugins.push(new PixiWorkerBuildPlugin(dev));
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
