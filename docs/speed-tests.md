# Manual speed tests

Speed tests are opt-in, browser-owned active checks. They are deliberately separate from passive
throughput telemetry: passive throughput reports current device traffic, while a speed test
generates traffic on the browser's current network to estimate download capacity.

Set `SPEED_TEST_URL` on the API to an organisation-approved download endpoint before enabling the
feature. The browser stops reading after `SPEED_TEST_MAX_BYTES`; its default and maximum value is
100,000,000 bytes (100 MB). Do not configure an endpoint that redirects to an untrusted host.

The speed-test endpoint and runner remain disabled until the endpoint is explicitly configured.
This protects metered connections from an accidental active transfer.

## Cloudflare R2 deployment

Use a custom domain for production. Cloudflare states that the managed `r2.dev` URL is for
development and may throttle throughput; a custom domain is the durable option.

1. Create an R2 bucket named `mission-control-speed-tests` in the Cloudflare dashboard.
2. Generate the asset:

   ```sh
   node infrastructure/scripts/generate-speed-test-file.mjs /private/tmp/mission-control-speed-test-100mb.bin
   ```

3. Authenticate Wrangler, then upload the object:

   ```sh
   npx wrangler login
   npx wrangler r2 object put mission-control-speed-tests/mission-control-speed-test-100mb.bin \
     --file /private/tmp/mission-control-speed-test-100mb.bin \
     --content-type application/octet-stream \
     --cache-control 'no-store'
   ```

4. In R2 bucket **Settings**, add a custom domain such as `speed-test.example.com`. The domain
   must be in the same Cloudflare account.
5. Configure the API (and rebuild/redeploy it):

   ```env
   SPEED_TEST_URL=https://speed-test.example.com/mission-control-speed-test-100mb.bin
   SPEED_TEST_MAX_BYTES=100000000
   SPEED_TEST_TIMEOUT_MS=180000
   ```

6. Verify the URL returns HTTPS, status 200, and `Content-Length: 100000000` before enabling
   active tests.

7. Add a CORS rule to the R2 bucket that allows the deployed web origin to `GET` the object.
   The download is fetched directly by the browser, so without this rule the test will only work
   from same-origin development setups.
