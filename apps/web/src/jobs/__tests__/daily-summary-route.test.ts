import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const runDailySummaryJob = vi.fn();
vi.mock('../daily-summary', () => ({ runDailySummaryJob }));

const { GET, POST } = await import('../../../app/api/internal/jobs/daily-summary/route');

const URL = 'http://localhost/api/internal/jobs/daily-summary';

function request(method: 'GET' | 'POST', authorization?: string) {
  return new NextRequest(URL, {
    method,
    headers: authorization ? { authorization } : {},
  });
}

describe('daily-summary job route', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';
    runDailySummaryJob.mockReset();
    runDailySummaryJob.mockResolvedValue({ successCount: 1, skippedCount: 0, failedCount: 0 });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('runs the job for a Vercel Cron GET with the bearer secret', async () => {
    const res = await GET(request('GET', 'Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    expect(runDailySummaryJob).toHaveBeenCalledOnce();
  });

  it('still accepts POST for manual runs', async () => {
    const res = await POST(request('POST', 'Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    expect(runDailySummaryJob).toHaveBeenCalledOnce();
  });

  it('rejects a GET without the secret', async () => {
    const res = await GET(request('GET'));
    expect(res.status).toBe(401);
    expect(runDailySummaryJob).not.toHaveBeenCalled();
  });

  it('rejects a GET with the wrong secret', async () => {
    const res = await GET(request('GET', 'Bearer nope'));
    expect(res.status).toBe(401);
    expect(runDailySummaryJob).not.toHaveBeenCalled();
  });

  it('fails closed when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request('GET', 'Bearer undefined'));
    expect(res.status).toBe(500);
    expect(runDailySummaryJob).not.toHaveBeenCalled();
  });
});
