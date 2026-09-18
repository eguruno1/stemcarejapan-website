import { createServer } from 'node:http';
import { createApp } from './app';
import { logger } from './common/logger';
import { assertProductionConfig, config } from './config';
import { drainBackground } from './common/background';
import { prisma } from './db';
import { startRetentionJob } from './ops/retentionJob';
import { createSocketServer } from './realtime/socketServer';

assertProductionConfig();

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

const retentionJob = startRetentionJob();

httpServer.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'api_started');
});

/**
 * 컨테이너가 종료 신호를 받으면 진행 중인 요청을 끝내고 정리한다.
 * 이게 없으면 재배포할 때마다 상담 중이던 연결이 갑자기 끊긴다.
 */
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutdown_started');
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  await retentionJob.stop();
  await retentionJob.destroy();
  await new Promise<void>(resolve => io.close(() => resolve()));
  await drainBackground();
  await prisma.$disconnect();
  clearTimeout(deadline);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
