import * as esbuild from 'esbuild'
import { rimraf } from 'rimraf'
import stylePlugin from 'esbuild-style-plugin'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import { copyFileSync, mkdirSync, readdirSync, existsSync, writeFileSync, readFileSync } from 'fs'
import path from 'path'
import https from 'https'
import dotenv from 'dotenv'

const args = process.argv.slice(2)
const isProd = args[0] === '--production'

// Load environment variables from .env.production in production mode
if (isProd) {
  const result = dotenv.config({ path: '.env.production' })
  if (result.error) {
    console.warn('⚠️  Warning: Could not load .env.production file')
  } else {
    console.log('✓ Loaded environment variables from .env.production')
  }
}

const pkgJson = JSON.parse(readFileSync('package.json', 'utf-8'))
const appVersion = process.env.VITE_APP_VERSION || pkgJson.version || '1.0.0'

const envDefines = {
  DEV: !isProd,
  PROD: isProd,
  MODE: isProd ? 'production' : 'development',
  VITE_API_URL:
    process.env.VITE_API_URL || 'https://productlabelerpro-worker.sherhan1988hp.workers.dev',
  VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN || '',
  // Абсолютный URL туннеля для Sentry (если задали только путь, нормализуем позже в фронтенде)
  VITE_SENTRY_TUNNEL: process.env.VITE_SENTRY_TUNNEL || 'https://labelcraft.sherhan1988hp.workers.dev/monitor',
  VITE_APP_VERSION: appVersion,
}

await rimraf('dist')
mkdirSync('dist', { recursive: true })

// Copy all public assets (fonts, favicon, etc.) into dist root so they are served at '/<asset>'
const copyRecursiveSync = (src, dest) => {
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyRecursiveSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
};

try {
  copyRecursiveSync('public', 'dist');
  console.log('✓ Copied public assets to dist/');
} catch (e) {
  console.warn('⚠ No public directory found, skipping asset copy');
}

// Skip DejaVu download - using webfonts + canvas raster for reliable rendering

/**
 * @type {esbuild.BuildOptions}
 */
const esbuildOpts = {
  color: true,
  entryPoints: ['src/main.tsx', 'index.html'],
  outdir: 'dist',
  entryNames: '[name]',
  write: true,
  bundle: true,
  format: 'iife',
  sourcemap: isProd ? false : 'linked',
  minify: isProd,
  treeShaking: true,
  jsx: 'automatic',
  loader: {
    '.html': 'copy',
    '.png': 'file',
    '.svg': 'file',
  },
  define: Object.fromEntries(
    Object.entries(envDefines).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
  ),
  plugins: [
    stylePlugin({
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
    }),
  ],
}

if (isProd) {
  await esbuild.build(esbuildOpts)
  console.log('✓ Production build complete');
} else {
  const ctx = await esbuild.context(esbuildOpts)
  await ctx.watch()
  const { hosts, port } = await ctx.serve()
  console.log(`Running on:`)
  hosts.forEach((host) => {
    console.log(`http://${host}:${port}`)
  })
}
