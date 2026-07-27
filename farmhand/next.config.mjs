/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // /api/assemble shells out to the ffmpeg-static binary — file tracing
  // can't see through child_process.spawn, so include it explicitly
  // (~80MB, inside the 250MB unzipped function limit).
  outputFileTracingIncludes: {
    "/api/assemble": ["./node_modules/ffmpeg-static/ffmpeg"],
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
