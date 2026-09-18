import { createServer } from 'node:http';
import { createApp } from './app';
import { logger } from './common/logger';
import { assertProductionConfig, config } from './config';
import { prisma } from './db';
import { startRetentionJob } from './ops/retentionJob';
import { createSocketServer } from './realtime/socketServer';

assertProductionConfig();

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

startRetentionJob();

httpServer.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'api_started');
});

/**
 * 컨테이너가 종료 신호를 받으면 진행 중인 요청을 끝내고 정리한다.
 * 이게 없으면 재배포할 때마다 상담 중이던 연결이 갑자기 끊긴다.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutdown_started');

  io.close();
  httpServer.close(() => logger.info('http_closed'));

  await prisma.$disconnect();

  // 10초 안에 안 끝나면 강제 종료한다.
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
