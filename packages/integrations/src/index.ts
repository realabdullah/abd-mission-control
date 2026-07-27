export type IntegrationCapability =
  | 'connectivity'
  | 'latency'
  | 'throughput'
  | 'power'
  | 'obstruction'
  | 'outage'
  | 'hardware'
  | 'firmware';
export interface IntegrationProvider {
  readonly type: string;
  readonly capabilities: readonly IntegrationCapability[];
}
export const starlinkProviderPlaceholder: IntegrationProvider = {
  type: 'starlink',
  capabilities: [],
};
export * from './starlink/client';
