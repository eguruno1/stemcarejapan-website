import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // E2E 개발 서버가 일반 빌드 산출물을 덮어쓰지 않도록 분리한다.
  distDir: process.env.SCJ_E2E === '1' ? '.next-e2e' : '.next',
  // 모노레포에서 @stemcare/shared 소스를 그대로 쓰기 위해 트랜스파일 대상에 넣는다.
  transpilePackages: ['@stemcare/shared'],
  // 운영 배포(Phase 6)에서 nginx 가 이 앱을 /admin 경로로 서비스한다.
  // 빌드 시점에 고정되므로 런타임 환경변수로는 바꿀 수 없다.
  basePath: process.env.NEXT_BASE_PATH || undefined
};

export default nextConfig;
