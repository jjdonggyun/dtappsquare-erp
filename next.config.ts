import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  ...(process.env.ERP_RUNTIME === "ubuntu" ? { output: "standalone" as const } : {}),

  experimental: {
    authInterrupts: true,
    ...(process.env.ERP_RUNTIME === "ubuntu" ? { cpus: 2 } : {}),
  },

  outputFileTracingIncludes: {
    "/api/project-finance/tax-invoice-pdf": [
      "./node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf",
      "./node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf",
    ],
    "/api/quotation/pdf": [
      "./node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf",
      "./node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf",
    ],
  },

  allowedDevOrigins: [
    "172.25.128.1",
    "192.168.1.141",
    "192.168.219.105",
  ],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default config;
