import { runRetentionJob } from '../src/services/retention.service';
import { logger } from '../src/lib/logger';

async function main() {
  logger.info('Starting retention cleanup script');
  const result = await runRetentionJob();
  logger.info('Retention cleanup script finished', { ...result });
}

main().catch((err) => {
  logger.error('Retention script failed', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
