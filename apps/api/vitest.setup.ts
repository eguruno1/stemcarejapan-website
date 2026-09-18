import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { testDatabaseUrl } = require('./scripts/test-db-url.cjs');
const testUrl = testDatabaseUrl(process.env);
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl;
