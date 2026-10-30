import { appConfig } from '../../config/app.config';
import { logger } from '../lib/logger';
import { reclaimExpiredLeases, claimNextJobs } from '../queue/job-queue';
import { processJob } from './processor';

const workerId = `worker_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
let isRunning = true;

logger.info('Starting receipt processing worker', {
  workerId,
  concurrency: appConfig.queue.concurrency,
  pollIntervalMs: appConfig.queue.pollIntervalMs,
});

export async function runWorkerLoop(): Promise<void> {
  while (isRunning) {
    try {
      // 1. Reclaim any expired leases (TR-8)
      await reclaimExpiredLeases();

      // 2. Claim available jobs within concurrency limits (FOR UPDATE SKIP LOCKED)
      const jobs = await claimNextJobs(workerId);

      if (jobs.length > 0) {
        // Run jobs concurrently up to concurrency cap
        await Promise.allSettled(jobs.map((job) => processJob(job)));
      }
    } catch (err: unknown) {
      logger.error('Worker loop encountered an error', {
        workerId,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // Wait before next tick
    await new Promise((resolve) => setTimeout(resolve, appConfig.queue.pollIntervalMs));
  }
}

function handleShutdown(): void {
  logger.info('Shutting down worker gracefully...', { workerId });
  isRunning = false;
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

if (process.env.NODE_ENV !== 'test') {
  runWorkerLoop().catch((err: unknown) => {
    logger.error('Fatal worker crash', {
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}
