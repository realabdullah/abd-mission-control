import type { DailySummary } from '@abd-mission-control/contracts';
import type { TelemetryRepository } from '@abd-mission-control/database';

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function generateDailySummary(
  repository: Pick<
    TelemetryRepository,
    'getIncidentStats' | 'getTelemetry' | 'getEvents' | 'saveDailySummary'
  >,
  integrationId: string,
  now = new Date(),
): Promise<DailySummary> {
  const date = utcDay(now);
  const from = new Date(`${date}T00:00:00.000Z`);
  const stats = await repository.getIncidentStats(integrationId, from, now);
  const downlinkRows = await repository.getTelemetry(
    integrationId,
    'downlink_throughput_bps',
    from,
    now,
    5000,
  );
  const events = await repository.getEvents(integrationId, 5000);
  const peakDownlinkBps = downlinkRows.reduce<number | null>((peak, row) => {
    if (typeof row !== 'object' || row === null || !('value' in row)) return peak;
    const value = row.value;
    return typeof value === 'number' && (peak === null || value > peak) ? value : peak;
  }, null);
  const summary: DailySummary = {
    id: '00000000-0000-0000-0000-000000000000',
    integrationId,
    date,
    availabilityPercent: Number(stats.uptimePercent ?? 0),
    incidentCount: Number(stats.outageCount ?? 0),
    totalOutageSeconds: Number(stats.totalOutageSeconds ?? 0),
    longestOutageSeconds: Number(stats.longestOutageSeconds ?? 0),
    averageLatencyMs: typeof stats.latencyAverageMs === 'number' ? stats.latencyAverageMs : null,
    p95LatencyMs: typeof stats.latencyP95Ms === 'number' ? stats.latencyP95Ms : null,
    peakDownlinkBps,
    averagePacketLossPercent:
      typeof stats.packetLossAveragePercent === 'number' ? stats.packetLossAveragePercent : null,
    telemetryCompletenessPercent: Number(stats.telemetryCompletenessPercent ?? 0),
    firmwareChanged: events.some(
      (row) =>
        typeof row === 'object' && row !== null && 'category' in row && row.category === 'firmware',
    ),
    notableIssues: events
      .flatMap((row) =>
        typeof row === 'object' &&
        row !== null &&
        'description' in row &&
        typeof row.description === 'string'
          ? [row.description]
          : [],
      )
      .slice(0, 5),
    generatedAt: now.toISOString(),
  };
  const saved = await repository.saveDailySummary(integrationId, date, {
    ...summary,
    id: undefined,
  });
  if (typeof saved === 'object' && saved !== null && 'id' in saved && typeof saved.id === 'string')
    return { ...summary, id: saved.id };
  return summary;
}
