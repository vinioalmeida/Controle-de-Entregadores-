/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["10.10.0.104", "127.0.0.1", "localhost"],
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'http://127.0.0.1:5000/:path*',
      },
    ];
  },
};

export default nextConfig;