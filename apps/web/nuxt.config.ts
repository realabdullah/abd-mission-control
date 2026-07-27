import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  typescript: { strict: true, typeCheck: true },
  runtimeConfig: {
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001' },
  },
  compatibilityDate: '2025-01-01',
})
