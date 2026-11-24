import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function dueJobs(now, emailEnabled) {
  const jobs = [];
  if (now.getUTCMinutes() === 0) jobs.push({ path: '/api/internal/monthly-card-settlement', method: 'GET', secret: 'CRON_SECRET' });
  if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0 && now.getUTCDay() >= 1 && now.getUTCDay() <= 5) jobs.push({ path: '/api/internal/operational-alerts', method: 'GET', secret: 'CRON_SECRET' });
  if (emailEnabled && now.getUTCMinutes() % 5 === 0) jobs.push({ path: '/api/internal/email-dispatch', method: 'POST', secret: 'EMAIL_DISPATCH_SECRET' });
  return jobs;
}

async function main() {
  const base = process.env.ERP_INTERNAL_URL;
  if (!base || !process.env.CRON_SECRET || !process.env.EMAIL_DISPATCH_SECRET) throw new Error('Scheduler configuration is incomplete.');
  let lastMinute = '';
  let running = false;
  async function tick() {
    const now = new Date();
    const minute = now.toISOString().slice(0, 16);
    if (running || minute === lastMinute) return;
    lastMinute = minute;
    running = true;
    try {
      for (const job of dueJobs(now, process.env.EMAIL_PROVIDER !== 'DISABLED')) {
        try {
          const response = await fetch(base + job.path, { method: job.method, headers: { Authorization: 'Bearer ' + process.env[job.secret] }, signal: AbortSignal.timeout(30000) });
          if (!response.ok) console.error('Scheduled request failed:', job.path, response.status);
        } catch { console.error('Scheduled request unavailable:', job.path); }
      }
    } finally { running = false; }
  }
  const timer = setInterval(() => void tick(), 15000);
  process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
  process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });
  await tick();
  console.log('ERP scheduler started; operational alerts run on weekdays at 09:00 Asia/Seoul.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
