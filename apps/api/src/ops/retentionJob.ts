import cron from 'node-cron';
import { logger } from '../common/logger';
import { runRetention } from './retention';

/**
 * 매일 새벽 4시(서버 시각)에 보관 기간 정리를 실행한다.
 *
 * 왜 새벽인가: 상담이 거의 없는 시간대여야 DB 부하가 서비스에 영향을 주지 않는다.
 */
export function startRetentionJob(): void {
  cron.schedule('0 4 * * *', () => {
    void runRetention()
      .then((result) => logger.info(result, 'retention_job_completed'))
      .catch((err) => logger.error({ err: String(err) }, 'retention_job_failed'));
  });

  logger.info({ schedule: '0 4 * * *' }, 'retention_job_scheduled');
}
