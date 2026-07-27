const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const integrationId = process.env.STARLINK_INTEGRATION_ID ?? '00000000-0000-0000-0000-000000000001';
async function check(url: string, label: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  console.log(`${label}: ok`);
}
await check(`${apiBase}/health`, 'api health');
await check(`${apiBase}/api/v1/system/status`, 'system status');
await check(`${apiBase}/api/v1/integrations`, 'integrations');
await check(`${apiBase}/api/v1/integrations/${integrationId}/snapshot`, 'snapshot');
await check(
  `${apiBase}/api/v1/integrations/${integrationId}/telemetry?range=1h&limit=100`,
  'telemetry',
);
await check(webBase, 'web');
const controller = new AbortController();
const stream = await fetch(`${apiBase}/api/v1/stream`, { signal: controller.signal });
if (!stream.ok || !stream.body) throw new Error('SSE connection failed');
const reader = stream.body.getReader();
const first = await reader.read();
controller.abort();
if (!first.value || new TextDecoder().decode(first.value).length === 0)
  throw new Error('SSE returned no data');
console.log('SSE: ok');
