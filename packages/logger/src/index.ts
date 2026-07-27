export function log(event: string, context: Record<string, string> = {}): void {
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...context })}\n`,
  );
}
