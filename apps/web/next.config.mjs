import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pins the monorepo root explicitly. Without this, Next.js's lockfile
  // auto-detection can pick up an unrelated lockfile elsewhere on the
  // machine (e.g. in the user's home directory) and misidentify the
  // workspace root, which breaks output file tracing.
  outputFileTracingRoot: join(__dirname, "..", ".."),
  // @swms/shared-types ships raw TypeScript (no build step) since it's
  // only ever consumed by other packages in this workspace — Next needs
  // to be told to transpile it rather than treating it as pre-built JS.
  transpilePackages: ["@swms/shared-types"],
  webpack(config) {
    // @swms/shared-types is authored for Node's NodeNext resolution, so
    // its relative imports use explicit ".js" extensions even though the
    // source files are ".ts" — webpack needs to be told to resolve those
    // the same way tsc does.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
