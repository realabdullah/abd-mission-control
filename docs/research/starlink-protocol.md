# Starlink local protocol research

Research performed 2026-07-27. This is a starting point for validation, not a protocol guarantee.

- [starlink-grpc-tools](https://github.com/sparky8512/starlink-grpc-tools) documents `192.168.100.1:9200`, reflection commands, and a `Device/Handle` service used by community tooling.
- [TCP Ports Used by the gRPC Service](https://github-wiki-see.page/m/sparky8512/starlink-grpc-tools/wiki/TCP-Ports-Used-by-the-gRPC-Service) distinguishes dish port `9200`, gRPC-Web port `9201`, and router ports `9000`/`9001`.
- [Starlink official Telemetry API help](https://starlink.com/mv/support/article/90109cc2-c7ec-31ff-d160-0a87f16ef759) describes a separate low-latency API and states availability is limited to Premium Business and Enterprise customers.
- [starlink-rs](https://git.hubp.de/ewilken/starlink-rs) independently describes an unauthenticated local gRPC server with reflection, but this remains community evidence and must be checked against the actual Mini.

The project therefore probes transport and reflection only. It does not treat community method names or fields as stable contracts until observed on the target device.
