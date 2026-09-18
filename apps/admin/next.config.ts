import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 모노레포에서 @stemcare/shared 소스를 그대로 쓰기 위해 트랜스파일 대상에 넣는다.
  transpilePackages: ['@stemcare/shared']
};

export default nextConfig;
