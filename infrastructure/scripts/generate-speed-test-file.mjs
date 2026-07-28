import { randomFillSync } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const destination = process.argv[2];
if (!destination) {
  throw new Error('Usage: node generate-speed-test-file.mjs <destination> [bytes]');
}
const bytes = Number(process.argv[3] ?? 100000000);
if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 100000000) {
  throw new Error('bytes must be a positive integer no greater than 100000000');
}
const output = resolve(destination);
await mkdir(dirname(output), { recursive: true });
const handle = await open(output, 'w');
try {
  let remaining = bytes;
  while (remaining > 0) {
    const chunk = Buffer.allocUnsafe(Math.min(1024 * 1024, remaining));
    randomFillSync(chunk);
    await handle.write(chunk);
    remaining -= chunk.length;
  }
} finally {
  await handle.close();
}
console.log(`Generated ${bytes} byte speed-test asset at ${output}`);
