/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { parse } from 'dotenv'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = process.cwd()

  // Use .env.local for local development, and .env for build/deploy
  const envFile = mode === 'development' ? '.env.local' : '.env'
  const envPath = path.resolve(root, envFile)

  if (fs.existsSync(envPath)) {
    try {
      const parsed = parse(fs.readFileSync(envPath))
      // Merge parsed values into process.env (override to ensure correct token used)
      Object.keys(parsed).forEach((k) => {
        process.env[k] = parsed[k]
      })
    } catch (err) {
      // if parsing fails, stop
      throw new Error(`Failed to parse env file ${envPath}: ${err}`)
    }
  } else {
    // if the env file does not exist, stop
    throw new Error(`Env file ${envPath} does not exist`)
  }

  // Ensure the Mapbox token is injected at build/dev time. Prefer VITE_ prefixed
  // value but fall back to MAPBOX_TOKEN if present.
  const token = process.env.VITE_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || ''
  if (!token) {
    throw new Error('Mapbox token is not defined in environment variables')
  }

  return {
    plugins: [react(), tailwindcss()],
    base: process.env.VITE_BASE_PATH || '/',
    define: {
      'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(token),
      'process.env.MAPBOX_TOKEN': JSON.stringify(process.env.MAPBOX_TOKEN || token),
    },
  }
})
