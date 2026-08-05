/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
