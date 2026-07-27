# ADR 0009: Docker and host-run collector modes

Docker Compose includes PostgreSQL, API, collector, and web services. On macOS Docker Desktop, the Starlink Mini’s private route may not be reachable from a container. The supported fallback is to run PostgreSQL/API/web in Compose and run the collector on the host with `DATABASE_URL` pointing at the published PostgreSQL port and `API_URL` pointing at the published API port.
