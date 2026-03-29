import { NextRequest } from 'next/server';
import { fetchMinuteData } from '../../../../src/providers/v1/adapter';
import { buildDayDetail } from '../../../../src/live/normalizer';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayInDublin(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dateParam = searchParams.get('date');

  const date = dateParam ?? todayInDublin();

  if (!DATE_PATTERN.test(date)) {
    return Response.json({ error: 'Invalid date format. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  const fetchedAt = new Date().toISOString();
  const minutes = await fetchMinuteData(date);
  const result = buildDayDetail(date, minutes, fetchedAt);

  return Response.json(result);
}
