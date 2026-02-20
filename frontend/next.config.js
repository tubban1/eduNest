const { config } = require('dotenv');
const path = require('path');

// 加载正确的 .env 文件
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // 环境变量会自动从 .env.local 和 ../.env 文件加载
  async redirects() {
    return [
      { source: '/collections/lists', destination: '/collections/manage', permanent: true },
    ];
  },
};

module.exports = nextConfig;
