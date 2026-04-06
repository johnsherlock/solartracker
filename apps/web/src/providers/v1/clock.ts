import type { V1MinuteRecord } from './types';
import type { MinuteReading } from '../../live/types';

export function toInstallationClock(
  record: V1MinuteRecord,
  timezone: string,
): Pick<MinuteReading, 'hour' | 'minute'> {
  const utcDate = new Date(
    Date.UTC(
      record.yr,
      (record.mon ?? 1) - 1,
      record.dom ?? 1,
      record.hr ?? 0,
      record.min ?? 0,
    ),
  );

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);

  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find((part) => part.type === 'minute')?.value ?? '0'),
  };
}
