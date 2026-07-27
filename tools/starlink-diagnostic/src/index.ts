import { createWriteStream } from 'node:fs';
import { execFile as execFileCallback } from 'node:child_process';
import { createConnection } from 'node:net';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
export const DEFAULT_HOST = '192.168.100.1';
export const DEFAULT_PORTS = [9200, 9201, 9000, 9001];
export const DEFAULT_TIMEOUT_MS = 1500;
const DEVICE_SERVICE = 'SpaceX.API.Device.Device';
const READ_ONLY_REQUEST = 'get_status';
const READ_ONLY_RESPONSE = 'dish_get_status';
const WIFI_REQUEST_TYPE = 'SpaceX.API.Device.Request';
const WIFI_RESPONSE_TYPE = 'SpaceX.API.Device.Response';

const WIFI_OPERATIONS = [
  {
    operation: 'wifi_get_clients',
    requestType: 'SpaceX.API.Device.WifiGetClientsRequest',
    responseType: 'SpaceX.API.Device.WifiGetClientsResponse',
    responseField: 'wifi_get_clients',
    classification: 'clearly read-only',
  },
  {
    operation: 'wifi_get_status',
    requestType: null,
    responseType: 'SpaceX.API.Device.WifiGetStatusResponse',
    responseField: 'wifi_get_status',
    classification: 'uncertain',
  },
  {
    operation: 'wifi_get_history',
    requestType: null,
    responseType: 'SpaceX.API.Device.WifiGetHistoryResponse',
    responseField: 'wifi_get_history',
    classification: 'uncertain',
  },
  {
    operation: 'wifi_get_ping_metrics',
    requestType: 'SpaceX.API.Device.WifiGetPingMetricsRequest',
    responseType: 'SpaceX.API.Device.WifiGetPingMetricsResponse',
    responseField: 'wifi_get_ping_metrics',
    classification: 'clearly read-only',
  },
  {
    operation: 'wifi_backhaul_stats',
    requestType: 'SpaceX.API.Device.WifiBackhaulStatsRequest',
    responseType: 'SpaceX.API.Device.WifiBackhaulStatsResponse',
    responseField: 'wifi_backhaul_stats',
    classification: 'clearly read-only',
  },
] as const;

export type CliOptions = {
  host: string;
  ports: number[];
  timeoutMs: number;
  outputPath: string | undefined;
  grpcurlPath: string;
};
export type TcpObservation = {
  host: string;
  port: number;
  address: string;
  reachable: boolean;
  elapsedMs: number;
  error: string | null;
};
export type CommandOutcome = 'success' | 'missing' | 'spawn_failure' | 'timeout' | 'nonzero';
export type CommandObservation = {
  command: string[];
  endpoint: string | null;
  transport: 'plaintext-http2' | 'none';
  elapsedMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outcome: CommandOutcome;
  error: string | null;
};
export type GrpcurlDependency = {
  requested: string;
  resolvedPath: string | null;
  version: string | null;
  available: boolean;
  error: string | null;
  lookup: CommandObservation;
  versionCheck: CommandObservation | null;
};
export type ReflectionReport = {
  requested: boolean;
  spawned: boolean;
  supported: boolean;
  error: string | null;
  discoveredServices: string[];
  relevantService: string | null;
  verifiedReadOnlyRpcs: string[];
  commands: CommandObservation[];
  sanitizedResponse: string | null;
  wifiCapabilities: WifiCapabilityReport[];
};
export type WifiCapabilityReport = {
  operation: string;
  classification: 'clearly read-only' | 'uncertain' | 'mutating';
  requestFieldReflected: boolean;
  requestType: string | null;
  requestSchema: string | null;
  responseFieldReflected: boolean;
  responseType: string;
  responseSchema: string | null;
  invocation: 'not attempted' | 'success' | 'unimplemented' | 'failed';
  sanitizedResponse: string | null;
  returnedFields: string[];
};
export type DiagnosticReport = {
  tool: {
    name: string;
    version: string;
    startedAt: string;
    finishedAt: string;
    receivedArgs: string[];
    normalizedArgs: string[];
  };
  target: { host: string; ports: number[]; timeoutMs: number; endpoint: string };
  dependency: GrpcurlDependency;
  tcp: TcpObservation[];
  grpc: {
    transport: 'plaintext-http2';
    endpoint: string;
    reflection: ReflectionReport;
    telemetryAvailable: boolean;
    telemetryEvidence: string[];
  };
  limitations: string[];
};

type RawCommandResult = { stdout: string; stderr: string; exitCode: number };
export type CommandRunner = (
  executable: string,
  args: string[],
  timeoutMs: number,
) => Promise<RawCommandResult>;

const defaultCommandRunner: CommandRunner = async (executable, args, timeoutMs) => {
  const result = await execFile(executable, args, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
};

export function parseArgs(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
): CliOptions {
  const options: CliOptions = {
    host: environment.STARLINK_HOST ?? DEFAULT_HOST,
    ports: DEFAULT_PORTS,
    timeoutMs: Number(environment.STARLINK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    outputPath: undefined,
    grpcurlPath: environment.GRPCURL_PATH ?? 'grpcurl',
  };
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const argument = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
    if (argument === '--host' && value) options.host = value;
    if (argument === '--ports' && value) options.ports = value.split(',').map(Number);
    if (argument === '--timeout-ms' && value) options.timeoutMs = Number(value);
    if (argument === '--output' && value) options.outputPath = value;
    if (argument === '--grpcurl' && value) options.grpcurlPath = value;
    if (argument === '--help') printHelpAndExit();
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100)
    throw new Error('--timeout-ms must be an integer >= 100');
  if (options.ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535))
    throw new Error('--ports must contain valid TCP ports');
  return options;
}

function printHelpAndExit(): never {
  process.stdout.write(
    'ABD Mission Control Starlink diagnostic\n\nUsage: pnpm --filter @abd-mission-control/starlink-diagnostic exec node dist/index.js [options]\n\nOptions:\n  --host <address>       Target host (default: 192.168.100.1)\n  --ports <p1,p2>        TCP ports to probe (default: 9200,9201,9000,9001)\n  --timeout-ms <ms>      Per-probe timeout (default: 1500)\n  --grpcurl <path>       grpcurl executable or path\n  --output <path>        Also write the sanitized JSON report to a file\n',
  );
  process.exit(0);
}

function errorDetails(error: unknown): { outcome: CommandOutcome; message: string } {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      code?: unknown;
      killed?: unknown;
      signal?: unknown;
      message?: unknown;
    };
    if (candidate.code === 'ENOENT')
      return { outcome: 'missing', message: 'grpcurl was not found on PATH' };
    if (
      candidate.code === 'ETIMEDOUT' ||
      candidate.killed === true ||
      candidate.signal === 'SIGTERM'
    )
      return { outcome: 'timeout', message: 'command timed out' };
    if (typeof candidate.message === 'string')
      return { outcome: 'spawn_failure', message: candidate.message };
  }
  return { outcome: 'spawn_failure', message: 'command could not be spawned' };
}

export async function runCommand(
  executable: string,
  args: string[],
  timeoutMs: number,
  runner: CommandRunner = defaultCommandRunner,
  endpoint: string | null = null,
  transport: 'plaintext-http2' | 'none' = 'none',
): Promise<CommandObservation> {
  const startedAt = Date.now();
  try {
    const result = await runner(executable, args, timeoutMs);
    const outcome: CommandOutcome = result.exitCode === 0 ? 'success' : 'nonzero';
    return {
      command: [executable, ...args].map(sanitizeText),
      endpoint: endpoint ? sanitizeText(endpoint) : null,
      transport,
      elapsedMs: Date.now() - startedAt,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: sanitizeText(result.stderr),
      outcome,
      error: result.exitCode === 0 ? null : `grpcurl exited with code ${result.exitCode}`,
    };
  } catch (error: unknown) {
    const details = errorDetails(error);
    return {
      command: [executable, ...args].map(sanitizeText),
      endpoint: endpoint ? sanitizeText(endpoint) : null,
      transport,
      elapsedMs: Date.now() - startedAt,
      exitCode: null,
      stdout: '',
      stderr: sanitizeText(error instanceof Error ? error.message : ''),
      outcome: details.outcome,
      error: details.message,
    };
  }
}

export async function resolveGrpcurl(
  requestedPath: string,
  timeoutMs: number,
  runner: CommandRunner = defaultCommandRunner,
): Promise<GrpcurlDependency> {
  const lookup = await runCommand('which', [requestedPath], timeoutMs, runner);
  if (lookup.outcome !== 'success')
    return {
      requested: requestedPath,
      resolvedPath: null,
      version: null,
      available: false,
      error:
        'grpcurl is missing. Install grpcurl and ensure it is available on PATH (for example: brew install grpcurl).',
      lookup,
      versionCheck: null,
    };
  const resolvedPath = lookup.stdout.split(/\r?\n/)[0]?.trim() || requestedPath;
  const versionCheck = await runCommand(resolvedPath, ['-version'], timeoutMs, runner);
  if (versionCheck.outcome !== 'success')
    return {
      requested: requestedPath,
      resolvedPath,
      version: null,
      available: false,
      error: `grpcurl was resolved at ${resolvedPath} but could not be executed: ${versionCheck.error}`,
      lookup,
      versionCheck,
    };
  return {
    requested: requestedPath,
    resolvedPath,
    version: (versionCheck.stdout || versionCheck.stderr).trim(),
    available: true,
    error: null,
    lookup,
    versionCheck,
  };
}

export function probeTcp(host: string, port: number, timeoutMs: number): Promise<TcpObservation> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (reachable: boolean, error: string | null): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        host: '<redacted-ip>',
        port,
        address: '<redacted-starlink-endpoint>',
        reachable,
        elapsedMs: Date.now() - startedAt,
        error,
      });
    };
    socket.setTimeout(timeoutMs, () => finish(false, 'timeout'));
    socket.once('connect', () => finish(true, null));
    socket.once('error', (error: Error) => finish(false, error.message));
  });
}

function sanitizeText(value: string): string {
  return value
    .replace(/\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi, '<redacted-mac>')
    .replace(/\b[0-9a-f]{4}(?::[0-9a-f]{4}){3}\b/gi, '<redacted-mac>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<redacted-ip>')
    .replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi, '<redacted-ip>')
    .replace(
      /(serial|account|location|latitude|longitude|public.?ip|target.?id|device.?id|dish.?id|country.?code|connected.?routers|downstream.?routers|ssid|bssid|hostname|device.?name|client.?name|given.?name|display.?name)/gi,
      '<redacted-field>',
    );
}

export function sanitizeJson(value: string): string {
  try {
    return JSON.stringify(sanitizeObject(JSON.parse(value)), null, 2);
  } catch {
    return sanitizeText(value);
  }
}

function sanitizeObject(value: unknown, key = ''): unknown {
  const lowerKey = key.toLowerCase();
  const isSensitive =
    lowerKey === 'id' ||
    key.endsWith('Id') ||
    key.endsWith('ID') ||
    /^(serial|account|location|latitude|longitude|public.?ip|ipv[46].*address|country.?code|connected.?routers|downstream.?routers|generation|build|ssid|bssid|hostname|name|device.?name|client.?name|given.?name|display.?name)/i.test(
      key,
    );
  if (isSensitive) return '<redacted>';
  if (Array.isArray(value)) return value.map((item) => sanitizeObject(item, key));
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeObject(entryValue, entryKey),
      ]),
    );
  if (typeof value === 'string') return sanitizeText(value);
  return value;
}

async function writeReport(path: string, report: DiagnosticReport): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(path, { encoding: 'utf8' });
    stream.once('error', reject);
    stream.once('finish', resolve);
    stream.end(`${JSON.stringify(report, null, 2)}\n`);
  });
}

async function inspectWifiCapabilities(
  endpoint: string,
  dependency: GrpcurlDependency,
  timeoutMs: number,
  runner: CommandRunner,
  commands: CommandObservation[],
): Promise<WifiCapabilityReport[]> {
  const describe = async (typeName: string): Promise<string | null> => {
    const command = await runCommand(
      dependency.resolvedPath ?? 'grpcurl',
      ['-plaintext', endpoint, 'describe', typeName],
      timeoutMs,
      runner,
      endpoint,
      'plaintext-http2',
    );
    commands.push(command);
    return command.outcome === 'success' ? command.stdout : null;
  };
  const requestSchema = await describe(WIFI_REQUEST_TYPE);
  const responseSchema = await describe(WIFI_RESPONSE_TYPE);
  const reports: WifiCapabilityReport[] = [];
  for (const candidate of WIFI_OPERATIONS) {
    const requestFieldReflected = requestSchema?.includes(` ${candidate.operation} =`) ?? false;
    const responseFieldReflected =
      responseSchema?.includes(` ${candidate.responseField} =`) ?? false;
    const requestTypeSchema = candidate.requestType ? await describe(candidate.requestType) : null;
    const responseTypeSchema = await describe(candidate.responseType);
    const report: WifiCapabilityReport = {
      operation: candidate.operation,
      classification: candidate.classification,
      requestFieldReflected,
      requestType: candidate.requestType,
      requestSchema: requestTypeSchema,
      responseFieldReflected,
      responseType: candidate.responseType,
      responseSchema: responseTypeSchema,
      invocation: 'not attempted',
      sanitizedResponse: null,
      returnedFields: [],
    };
    if (candidate.classification !== 'clearly read-only' || !requestFieldReflected) {
      reports.push(report);
      continue;
    }
    const invocation = await runCommand(
      dependency.resolvedPath ?? 'grpcurl',
      [
        '-plaintext',
        '-d',
        JSON.stringify({ [candidate.operation]: {} }),
        endpoint,
        `${DEVICE_SERVICE}/Handle`,
      ],
      timeoutMs,
      runner,
      endpoint,
      'plaintext-http2',
    );
    commands.push(invocation);
    if (invocation.outcome !== 'success') {
      reports.push({
        ...report,
        invocation: invocation.stderr.includes('Unimplemented') ? 'unimplemented' : 'failed',
      });
      continue;
    }
    const sanitizedResponse = sanitizeJson(invocation.stdout);
    let returnedFields: string[] = [];
    try {
      const parsed = JSON.parse(sanitizedResponse) as Record<string, unknown>;
      const payload = parsed[candidate.responseField];
      if (payload && typeof payload === 'object' && !Array.isArray(payload))
        returnedFields = Object.keys(payload);
    } catch {
      returnedFields = [];
    }
    reports.push({ ...report, invocation: 'success', sanitizedResponse, returnedFields });
  }
  return reports;
}

export async function discoverAndInvoke(
  endpoint: string,
  dependency: GrpcurlDependency,
  timeoutMs: number,
  runner: CommandRunner,
): Promise<ReflectionReport> {
  const empty: ReflectionReport = {
    requested: true,
    spawned: false,
    supported: false,
    error: dependency.error,
    discoveredServices: [],
    relevantService: null,
    verifiedReadOnlyRpcs: [],
    commands: [],
    sanitizedResponse: null,
    wifiCapabilities: [],
  };
  if (!dependency.available || !dependency.resolvedPath) return empty;
  const commands: CommandObservation[] = [];
  const list = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', endpoint, 'list'],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  commands.push(list);
  if (list.outcome !== 'success')
    return { ...empty, spawned: list.outcome !== 'missing', error: list.error, commands };
  const discoveredServices = list.stdout
    .split(/\r?\n/)
    .map((service) => service.trim())
    .filter(Boolean);
  const supported =
    discoveredServices.includes('grpc.reflection.v1.ServerReflection') ||
    discoveredServices.includes('grpc.reflection.v1alpha.ServerReflection');
  if (!supported)
    return {
      ...empty,
      spawned: true,
      supported: false,
      error: 'endpoint responded but did not advertise a reflection service',
      discoveredServices,
      commands,
    };
  if (!discoveredServices.includes(DEVICE_SERVICE))
    return {
      requested: true,
      spawned: true,
      supported: true,
      error: null,
      discoveredServices,
      relevantService: null,
      verifiedReadOnlyRpcs: [],
      commands,
      sanitizedResponse: null,
      wifiCapabilities: [],
    };
  const methodList = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', endpoint, 'list', DEVICE_SERVICE],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  commands.push(methodList);
  const deviceDescription = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', endpoint, 'describe', DEVICE_SERVICE],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  commands.push(deviceDescription);
  const requestDescription = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', endpoint, 'describe', 'SpaceX.API.Device.Request'],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  commands.push(requestDescription);
  const responseDescription = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', endpoint, 'describe', 'SpaceX.API.Device.Response'],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  commands.push(responseDescription);
  const requestType = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', endpoint, 'describe', 'SpaceX.API.Device.GetStatusRequest'],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  commands.push(requestType);
  const responseType = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', endpoint, 'describe', 'SpaceX.API.Device.DishGetStatusResponse'],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  commands.push(responseType);
  const wifiCapabilities = await inspectWifiCapabilities(
    endpoint,
    dependency,
    timeoutMs,
    runner,
    commands,
  );
  const descriptorText = `${methodList.stdout}\n${deviceDescription.stdout}\n${requestDescription.stdout}\n${responseDescription.stdout}\n${requestType.stdout}\n${responseType.stdout}`;
  const verified =
    descriptorText.includes('Device.Handle') &&
    descriptorText.includes(` ${READ_ONLY_REQUEST} `) &&
    descriptorText.includes(` ${READ_ONLY_RESPONSE} `);
  if (!verified)
    return {
      requested: true,
      spawned: true,
      supported: true,
      error:
        'reflection was available but the expected read-only status request/response shape was not verified',
      discoveredServices,
      relevantService: DEVICE_SERVICE,
      verifiedReadOnlyRpcs: [],
      commands,
      sanitizedResponse: null,
      wifiCapabilities,
    };
  const invocation = await runCommand(
    dependency.resolvedPath,
    ['-plaintext', '-d', '{"get_status":{}}', endpoint, `${DEVICE_SERVICE}/Handle`],
    timeoutMs,
    runner,
    endpoint,
    'plaintext-http2',
  );
  invocation.stdout = sanitizeJson(invocation.stdout);
  commands.push(invocation);
  const successful =
    invocation.outcome === 'success' && invocation.stdout.includes('dishGetStatus');
  return {
    requested: true,
    spawned: true,
    supported: true,
    error: successful
      ? null
      : (invocation.error ?? 'read-only invocation did not return the verified response shape'),
    discoveredServices,
    relevantService: DEVICE_SERVICE,
    verifiedReadOnlyRpcs: successful ? [`${DEVICE_SERVICE}/Handle { get_status: {} }`] : [],
    commands,
    sanitizedResponse: successful ? invocation.stdout : null,
    wifiCapabilities,
  };
}

export async function collectReport(
  options: CliOptions,
  receivedArgs: string[],
  runner: CommandRunner = defaultCommandRunner,
): Promise<DiagnosticReport> {
  const startedAt = new Date().toISOString();
  const dependency = await resolveGrpcurl(options.grpcurlPath, options.timeoutMs, runner);
  const tcp = await Promise.all(
    options.ports.map((port) => probeTcp(options.host, port, options.timeoutMs)),
  );
  const endpoint = `${options.host}:9200`;
  const reflection = await discoverAndInvoke(endpoint, dependency, options.timeoutMs, runner);
  return {
    tool: {
      name: 'abd-mission-control-starlink-diagnostic',
      version: '0.1.0',
      startedAt,
      finishedAt: new Date().toISOString(),
      receivedArgs: receivedArgs.map(sanitizeText),
      normalizedArgs: (receivedArgs[0] === '--' ? receivedArgs.slice(1) : receivedArgs).map(
        sanitizeText,
      ),
    },
    target: {
      host: '<redacted-ip>',
      ports: options.ports,
      timeoutMs: options.timeoutMs,
      endpoint: '<redacted-starlink-endpoint>',
    },
    dependency,
    tcp,
    grpc: {
      transport: 'plaintext-http2',
      endpoint: '<redacted-starlink-endpoint>',
      reflection,
      telemetryAvailable: reflection.verifiedReadOnlyRpcs.length > 0,
      telemetryEvidence:
        reflection.verifiedReadOnlyRpcs.length > 0
          ? ['reflected Device.Handle accepted get_status and returned dishGetStatus']
          : [],
    },
    limitations: [
      'TCP reachability does not prove gRPC compatibility.',
      'Reflection availability does not prove every RPC is compatible.',
      'The captured response is sanitized before report output.',
      'No mutating or control RPCs are executed.',
    ],
  };
}

async function main(): Promise<void> {
  const receivedArgs = process.argv.slice(2);
  const options = parseArgs(receivedArgs);
  const report = await collectReport(options, receivedArgs);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (options.outputPath) await writeReport(options.outputPath, report);
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'diagnostic failed'}\n`);
    process.exitCode = 1;
  });
