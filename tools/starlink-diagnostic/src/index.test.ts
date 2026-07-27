import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverAndInvoke,
  parseArgs,
  resolveGrpcurl,
  runCommand,
  sanitizeJson,
  type CommandObservation,
  type CommandRunner,
  type GrpcurlDependency,
} from './index.js';

const emptyCommand: CommandObservation = {
  command: [],
  endpoint: null,
  transport: 'none',
  elapsedMs: 0,
  exitCode: 0,
  stdout: '',
  stderr: '',
  outcome: 'success',
  error: null,
};
const dependency: GrpcurlDependency = {
  requested: 'grpcurl',
  resolvedPath: '/usr/local/bin/grpcurl',
  version: 'grpcurl 1.9.3',
  available: true,
  error: null,
  lookup: emptyCommand,
  versionCheck: null,
};

test('CLI intentionally strips pnpm forwarded argument separator', () => {
  assert.equal(parseArgs(['--', '--host', '192.168.100.1']).host, '192.168.100.1');
});

function thrown(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function reflectionRunner(overrides: Record<string, string | Error> = {}): CommandRunner {
  return async (_executable, args) => {
    const key = args.join(' ');
    const override = Object.entries(overrides).find(([needle]) => key.includes(needle))?.[1];
    if (override instanceof Error) throw override;
    if (typeof override === 'string') return { stdout: override, stderr: '', exitCode: 0 };
    if (key.endsWith('list'))
      return {
        stdout: 'SpaceX.API.Device.Device\ngrpc.reflection.v1.ServerReflection\n',
        stderr: '',
        exitCode: 0,
      };
    if (key.includes('list SpaceX.API.Device.Device'))
      return {
        stdout: 'SpaceX.API.Device.Device.Handle\nSpaceX.API.Device.Device.Stream\n',
        stderr: '',
        exitCode: 0,
      };
    if (key.includes('describe SpaceX.API.Device.Request'))
      return {
        stdout: 'oneof request { .SpaceX.API.Device.GetStatusRequest get_status = 1004; }',
        stderr: '',
        exitCode: 0,
      };
    if (key.includes('describe SpaceX.API.Device.Response'))
      return {
        stdout:
          'oneof response { .SpaceX.API.Device.DishGetStatusResponse dish_get_status = 2004; }',
        stderr: '',
        exitCode: 0,
      };
    if (key.includes('describe SpaceX.API.Device.GetStatusRequest'))
      return { stdout: 'message GetStatusRequest {}', stderr: '', exitCode: 0 };
    if (key.includes('describe SpaceX.API.Device.DishGetStatusResponse'))
      return { stdout: 'message DishGetStatusResponse {}', stderr: '', exitCode: 0 };
    if (key.includes('describe SpaceX.API.Device.Device'))
      return {
        stdout:
          'rpc Handle ( .SpaceX.API.Device.Request ) returns ( .SpaceX.API.Device.Response );',
        stderr: '',
        exitCode: 0,
      };
    if (key.includes('Device/Handle'))
      return {
        stdout:
          '{"dishGetStatus":{"deviceInfo":{"id":"secret","countryCode":"NG"},"popPingLatencyMs":12.5}}',
        stderr: '',
        exitCode: 0,
      };
    return { stdout: '', stderr: '', exitCode: 0 };
  };
}

test('grpcurl missing is distinct from endpoint failure', async () => {
  const runner: CommandRunner = async () => {
    throw thrown('ENOENT', 'spawn grpcurl ENOENT');
  };
  const result = await resolveGrpcurl('grpcurl', 100, runner);
  assert.equal(result.available, false);
  assert.match(result.error ?? '', /Install grpcurl/);
  assert.equal(result.lookup.outcome, 'missing');
});

test('grpcurl spawn failure is recorded after PATH resolution', async () => {
  const runner: CommandRunner = async (executable) => {
    if (executable === 'which')
      return { stdout: '/usr/local/bin/grpcurl\n', stderr: '', exitCode: 0 };
    throw thrown('EACCES', 'permission denied');
  };
  const result = await resolveGrpcurl('grpcurl', 100, runner);
  assert.equal(result.available, false);
  assert.equal(result.resolvedPath, '/usr/local/bin/grpcurl');
  assert.equal(result.versionCheck?.outcome, 'spawn_failure');
});

test('command timeout is distinguished from nonzero command exit', async () => {
  const runner: CommandRunner = async () => {
    throw thrown('ETIMEDOUT', 'timed out');
  };
  const result = await runCommand(
    'grpcurl',
    ['-plaintext', '192.168.100.1:9200', 'list'],
    100,
    runner,
    '192.168.100.1:9200',
    'plaintext-http2',
  );
  assert.equal(result.outcome, 'timeout');
  assert.equal(result.exitCode, null);
});

test('reflection supported discovers services and invokes verified read-only RPC', async () => {
  const result = await discoverAndInvoke('192.168.100.1:9200', dependency, 100, reflectionRunner());
  assert.equal(result.supported, true);
  assert.deepEqual(result.discoveredServices, [
    'SpaceX.API.Device.Device',
    'grpc.reflection.v1.ServerReflection',
  ]);
  assert.deepEqual(result.verifiedReadOnlyRpcs, [
    'SpaceX.API.Device.Device/Handle { get_status: {} }',
  ]);
  assert.match(result.sanitizedResponse ?? '', /<redacted>/);
  assert.doesNotMatch(result.sanitizedResponse ?? '', /secret/);
  assert.match(result.sanitizedResponse ?? '', /"countryCode": "<redacted>"/);
});

test('reflection unsupported does not invoke an RPC', async () => {
  const calls: string[] = [];
  const runner: CommandRunner = async (_executable, args) => {
    calls.push(args.join(' '));
    return { stdout: 'SpaceX.API.Device.Device\n', stderr: '', exitCode: 0 };
  };
  const result = await discoverAndInvoke('192.168.100.1:9200', dependency, 100, runner);
  assert.equal(result.supported, false);
  assert.equal(result.verifiedReadOnlyRpcs.length, 0);
  assert.equal(calls.length, 1);
});

test('malformed output is retained as sanitized text rather than parsed', () => {
  assert.equal(sanitizeJson('{"location":"1.2.3.4"'), '{"<redacted-field>":"<redacted-ip>"');
});

test('sanitizes Wi-Fi client identity values', () => {
  const sanitized = sanitizeJson(
    JSON.stringify({
      clients: [
        {
          mac: 'aa:bb:cc:dd:ee:ff',
          ipv4: '192.168.1.42',
          ssid: 'private-network',
          name: 'living-room-device',
        },
      ],
    }),
  );
  assert.doesNotMatch(sanitized, /aa:bb|192\.168|private-network|living-room-device/);
  assert.match(sanitized, /<redacted-mac>|<redacted-ip>|<redacted>/);
});

test('successful read-only invocation is not reported when grpcurl cannot spawn', async () => {
  const unavailable = {
    ...dependency,
    available: false,
    resolvedPath: null,
    error: 'grpcurl is missing',
  };
  const result = await discoverAndInvoke(
    '192.168.100.1:9200',
    unavailable,
    100,
    reflectionRunner(),
  );
  assert.equal(result.requested, true);
  assert.equal(result.spawned, false);
  assert.equal(result.supported, false);
  assert.equal(result.verifiedReadOnlyRpcs.length, 0);
});
