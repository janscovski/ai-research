import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // fixtures/ is read at runtime in DECK_SOURCE=fixture mode
  outputFileTracingIncludes: { "/*": ["./fixtures/**/*"] },
};

export default nextConfig;
