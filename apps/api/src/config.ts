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
  jwtSecret: required('JWT_SECRET', process.env.NODE_ENV === 'production' ? undefined : 'dev-only-secret'),
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

/**
 * 로그인/상담시작 rate limit 은 프로덕션 기준(10/60초)으로 고정하면 테스트가
 * 깨진다 - 여러 테스트 파일이 검증용으로 로그인을 수십 번씩 반복 호출하기
 * 때문이다. 테스트 환경에서는 넉넉하게 두고, 제한 동작 자체를 검증하는
 * security.test.ts 만 환경변수로 프로덕션과 같은 값을 명시적으로 지정한다.
 *
 * 함수로 두는 이유: express-rate-limit 은 `limit` 을 요청마다 평가할 수 있다.
 * 이 값을 고정된 숫자로 한 번만 계산해 두면, 이 모듈이 (테스트 헬퍼를 통해)
 * security.test.ts 가 환경변수를 지정하기 *전에* 먼저 로드됐을 때 그 값을
 * 영영 반영하지 못한다 - 매 요청마다 process.env 를 다시 읽어야 안전하다.
 */
export function rateLimitFor(envVar: string, prodDefault: number, testDefault = 1000): () => number {
  return () => Number(process.env[envVar] ?? (isTest ? testDefault : prodDefault));
}

const INSECURE_DEFAULTS = ['change-this-in-production', 'dev-only-secret', 'change-this-too'];

/**
 * 운영 환경에서 위험한 기본값이 남아 있으면 서버를 띄우지 않는다.
 * "설정을 깜빡했다"가 보안 사고로 이어지는 것을 막는 가장 확실한 방법이다.
 */
export function assertProductionConfig(): void {
  if ((process.env.NODE_ENV ?? 'development') !== 'production') return;

  const problems: string[] = [];

  const secret = process.env.JWT_SECRET ?? '';
  if (INSECURE_DEFAULTS.includes(secret) || secret.length < 32) {
    problems.push('JWT_SECRET 이 기본값이거나 32자 미만입니다.');
  }

  if (!process.env.DATABASE_URL) {
    problems.push('DATABASE_URL 이 없습니다.');
  }

  if (!process.env.WEBSITE_ORIGIN || !process.env.ADMIN_ORIGIN) {
    problems.push('WEBSITE_ORIGIN / ADMIN_ORIGIN 이 설정되지 않았습니다.');
  }

  if ((process.env.WEBSITE_ORIGIN ?? '').startsWith('http://')) {
    problems.push('운영 환경에서는 HTTPS 주소를 사용해야 합니다.');
  }

  if (problems.length > 0) {
    throw new Error(`운영 환경 설정 오류:\n- ${problems.join('\n- ')}`);
  }
}
