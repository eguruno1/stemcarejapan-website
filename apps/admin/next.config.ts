import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 모노레포에서 @stemcare/shared 소스를 그대로 쓰기 위해 트랜스파일 대상에 넣는다.
  transpilePackages: ['@stemcare/shared']
};

export default nextConfig;
