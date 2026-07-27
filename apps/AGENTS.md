# Applications

`web` is the presentation layer, `api` is the public application boundary, and `collector` is a long-running device-facing process. Do not put collection logic in Nuxt or make the collector depend on frontend code.
