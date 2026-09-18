import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { testDatabaseUrl } = require('./scripts/test-db-url.cjs');
const testUrl = testDatabaseUrl(process.env);
process.env.NODE_ENV = 'test';
// 개발용 키가 있더라도 자동 테스트에서 외부 모델을 호출하지 않는다.
process.env.OPENAI_API_KEY = '';
process.env.DATABASE_URL = testUrl;
