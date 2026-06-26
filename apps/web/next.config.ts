import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // @yield2pay/shared is a source-only workspace package (TS in src/); Next must
  // transpile it so the build resolves it on Vercel without relying solely on
  // the tsconfig path alias.
  transpilePackages: ["@yield2pay/shared"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
