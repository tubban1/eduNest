const { config } = require('dotenv');
const path = require('path');

// 加载根目录的 .env 文件
config({ path: path.resolve(process.cwd(), '../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // 环境变量会自动从根目录的 .env 文件加载
};

module.exports = nextConfig;
