# Starlink Mini Phase 5 Wi-Fi capability diagnostic

Validation date: 2026-07-27. Target: the local Mini endpoint on the trusted LAN, using plaintext HTTP/2 gRPC and server reflection. The diagnostic output is sanitized before it is retained or reported.

## Result

Reflection succeeded and advertised `SpaceX.API.Device.Device`, `grpc.reflection.v1.ServerReflection`, and `grpc.reflection.v1alpha.ServerReflection`.

| Operation               | Reflected request field             | Reflected response field          | Classification                        | Invocation                       | Populated fields |
| ----------------------- | ----------------------------------- | --------------------------------- | ------------------------------------- | -------------------------------- | ---------------- |
| `wifi_get_clients`      | Yes; `WifiGetClientsRequest {}`     | Yes; `WifiGetClientsResponse`     | Clearly read-only                     | Attempted first; `Unimplemented` | None             |
| `wifi_get_status`       | No matching `Request` oneof field   | Yes; `WifiGetStatusResponse`      | Uncertain; no invocable request shape | Not attempted                    | None             |
| `wifi_get_history`      | No matching `Request` oneof field   | Yes; `WifiGetHistoryResponse`     | Uncertain; no invocable request shape | Not attempted                    | None             |
| `wifi_get_ping_metrics` | Yes; `WifiGetPingMetricsRequest {}` | Yes; `WifiGetPingMetricsResponse` | Clearly read-only                     | Attempted; `Unimplemented`       | None             |
| `wifi_backhaul_stats`   | Yes; `WifiBackhaulStatsRequest {}`  | Yes; `WifiBackhaulStatsResponse`  | Clearly read-only                     | Attempted; `Unimplemented`       | None             |

The required first request was exactly:

```json
{ "wifi_get_clients": {} }
```

No mutating, setup, configuration, reset, trust, calibration, test, update, sandbox, or toggle operation was invoked. The existing verified `get_status` diagnostic RPC remains read-only and succeeded, but it is not evidence that any Phase 5 Wi-Fi operation works.

## Reflected schemas

The exact top-level schemas returned by reflection were:

```protobuf
message WifiGetClientsRequest {}

message WifiGetClientsResponse {
  repeated .SpaceX.API.Device.WifiClient clients = 1;
  bool has_client_index = 2;
  int32 client_index = 3;
}
```

```protobuf
message WifiGetStatusResponse {
  bool captive_portal_enabled = 1 [deprecated = true];
  .SpaceX.API.Device.DeviceInfo device_info = 3;
  .SpaceX.API.Device.DeviceState device_state = 4;
  string ipv4_wan_address = 1003;
  float ping_drop_rate = 1004;
  float ping_latency_ms = 1005;
  .SpaceX.API.Device.WifiBandStatus rf_2ghz_status = 1008 [deprecated = true];
  .SpaceX.API.Device.WifiBandStatus rf_5ghz_status = 1009 [deprecated = true];
  .SpaceX.API.Device.WifiAlerts alerts = 1010;
  bool is_aviation = 1011;
  float dish_ping_drop_rate = 1012;
  float dish_ping_latency_ms = 1013;
  float pop_ping_drop_rate = 1014;
  float pop_ping_latency_ms = 1015;
  bool is_aviation_conformed = 1016;
  repeated string ipv6_wan_addresses = 1017;
  float dish_ping_drop_rate_5m = 1018;
  repeated .SpaceX.API.Device.DhcpServer dhcp_servers = 1019;
  float pop_ping_drop_rate_5m = 1020;
  float ping_drop_rate_5m = 1021;
  .SpaceX.API.Device.PoeStats poe_stats = 1022;
  string dish_id = 1023;
  int64 utc_ns = 1024;
  .SpaceX.API.Device.WifiSoftwareUpdateStats software_update_stats = 1025;
  .SpaceX.API.Device.WifiSetupRequirement setup_requirement = 1026;
  float pop_ipv6_ping_drop_rate = 1027;
  float pop_ipv6_ping_drop_rate_5m = 1028;
  float pop_ipv6_ping_latency_ms = 1029;
  float secs_since_last_public_ipv4_change = 1030;
  .SpaceX.API.Satellites.Network.UtDisablementCode dish_disablement_code = 1031;
  bool using_individualized_calibration = 1032;
  .SpaceX.API.Device.CalibrationPartitionsState calibration_partitions_state = 1033;
  uint32 hops_from_controller = 1034;
  bool no_wan_link = 1035;
  .SpaceX.API.Device.WifiConfig config = 2000;
  repeated .SpaceX.API.Device.WifiClient clients = 3000;
  bool has_client_index = 3001;
  int32 client_index = 3002;
  .SpaceX.API.Device.RadiusStatsMap radius_stats = 3003;
  reserved 2, 5, 6, 7, 1001, 1002, 1006, 1007;
}
```

```protobuf
message WifiGetHistoryResponse {
  uint64 current = 1;
  uint64 current_index_15s = 2;
  repeated float ping_drop_rate = 1001;
  repeated float ping_latency_ms = 1002;
  repeated float pop_ipv4_ping_drop_rate_last_15s = 1003;
  repeated float pop_ipv6_ping_drop_rate_last_15s = 1004;
  repeated float google_ipv4_ping_drop_rate_last_15s = 1005;
  repeated float google_ipv6_ping_drop_rate_last_15s = 1006;
  repeated float cloudflare_ipv4_ping_drop_rate_last_15s = 1007;
  repeated float cloudflare_ipv6_ping_drop_rate_last_15s = 1008;
  map<string, .SpaceX.API.Device.WifiGetHistoryResponse.DnsResolverHistory> dns_resolver_drop_rate = 1009;
  .SpaceX.API.Device.EventLog event_log = 1010;
  message DnsResolverHistory {
    repeated float drop_rate_last_15s = 2;
  }
}

message WifiGetPingMetricsRequest {}

message WifiGetPingMetricsResponse {
  .SpaceX.API.Device.PingMetrics internet = 1;
}

message WifiBackhaulStatsRequest {}

message WifiBackhaulStatsResponse {
  bool success = 1;
  string bssid = 2;
  .SpaceX.API.Device.IfaceType iface = 3;
  uint32 preference = 4;
  repeated .SpaceX.API.Device.WifiSiteSurveyResult siteSurveyScan = 5;
}
```

The reflected parent `Request` schema contains `wifi_get_clients`, `wifi_get_ping_metrics`, and `wifi_backhaul_stats`, but not `wifi_get_status` or `wifi_get_history`. The response oneof contains all five response fields. This mismatch is why the latter two remain uncertain and were not guessed or invoked.

## Sanitization and fixture policy

The diagnostic redacts IP addresses, MAC/BSSID values, SSIDs, names, device/account/Starlink identifiers, and location-like fields. No Wi-Fi response fixture was added: every requested read-only invocation returned `Unimplemented`, so there was no successful response payload to fixture. The checked-in production protobuf subset was not expanded and no production integration was changed.

Run the evidence-gathering tool with:

```bash
pnpm --filter @abd-mission-control/starlink-diagnostic build
pnpm --filter @abd-mission-control/starlink-diagnostic exec node dist/index.js --host 192.168.100.1 --ports 9200 --timeout-ms 2000 --output /tmp/starlink-mini-phase5-wifi-report.json
```
