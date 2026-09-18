import * as path from 'node:path';
import * as dotenv from 'dotenv';

// 루트의 .env 파일 하나만 읽는다. (apps/api 기준으로 두 단계 위)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env 파일을 확인하세요.`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://stemcare:stemcare@localhost:5434/stemcare_chat'),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret'),
  adminCookieName: process.env.ADMIN_COOKIE_NAME ?? 'scj_admin_token',
  corsOrigins: [
    process.env.WEBSITE_ORIGIN ?? 'http://localhost:8080',
    process.env.ADMIN_ORIGIN ?? 'http://localhost:3100'
  ],
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  aiModel: process.env.AI_MODEL ?? 'gpt-5-mini',
  translationModel: process.env.TRANSLATION_MODEL ?? 'gpt-5-mini'
};

export const isTest = config.nodeEnv === 'test';
