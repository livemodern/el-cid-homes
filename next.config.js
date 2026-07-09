/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.mlrecloud.com' }] },
};
module.exports = nextConfig;
