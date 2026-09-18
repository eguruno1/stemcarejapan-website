import cron from 'node-cron';
import { trackBackground } from '../common/background';
import { logger, logError } from '../common/logger';
import { runRetention } from './retention';

/**
 * 매일 한국 시각 새벽 4시에 보관 기간 정리를 실행한다.
 *
 * 왜 새벽인가: 상담이 거의 없는 시간대여야 DB 부하가 서비스에 영향을 주지 않는다.
 */
export function startRetentionJob() {
  const task = cron.schedule('0 4 * * *', () => {
    const work = runRetention()
      .then((result) => logger.info(result, 'retention_job_completed'))
      .catch((err) => logError(err, 'retention_job_failed'));
    trackBackground(work);
    return work;
  }, { timezone: 'Asia/Seoul', noOverlap: true });

  logger.info({ schedule: '0 4 * * *' }, 'retention_job_scheduled');
  return task;
}
