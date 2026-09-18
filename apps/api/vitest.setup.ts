import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// config.ts 가 읽기 전에 덮어쓴다. 순서가 중요하다.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://stemcare:stemcare@localhost:5434/stemcare_chat_test';
