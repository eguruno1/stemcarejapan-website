import { PrismaClient } from '@prisma/client';
import { config } from './config';

/**
 * PrismaClient 는 앱 전체에서 하나만 만들어 쓴다.
 * 개발 중 파일이 저장될 때마다 새로 만들면 DB 커넥션이 계속 쌓여 한도를 넘긴다.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error']
  });

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}
