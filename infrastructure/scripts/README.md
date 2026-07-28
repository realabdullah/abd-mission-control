# Operational scripts

Reserved for repeatable local deployment and maintenance scripts.

## Speed-test asset

Generate (but do not commit) the 100 MB random asset used by the opt-in collector speed test:

```sh
node infrastructure/scripts/generate-speed-test-file.mjs /private/tmp/mission-control-speed-test-100mb.bin
```

The file is intentionally random so a proxy cannot trivially compress it. The generator refuses
files larger than the configured 100 MB speed-test budget.
