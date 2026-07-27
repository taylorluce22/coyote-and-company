/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // /api/assemble shells out to the ffmpeg-static binary. Two pieces make
  // that survive deployment:
  // - serverExternalPackages stops webpack from BUNDLING ffmpeg-static —
  //   bundling rewrote its internal __dirname so the exported path pointed
  //   into .next/server/app/api/assemble/ (spawn ENOENT in production);
  //   external = resolved from real node_modules at runtime
  // - outputFileTracingIncludes ships the package (binary included, ~80MB,
  //   inside the 250MB unzipped limit) with the function, since tracing
  //   can't see through child_process.spawn
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/assemble": ["./node_modules/ffmpeg-static/**"],
  },
  env: {
    // Vercel injects these at build time — surfaced in the UI as a build
    // stamp so "is the fix actually deployed AND running in this tab?" is
    // answerable at a glance instead of by vibes.
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  },
};

export default nextConfig;
