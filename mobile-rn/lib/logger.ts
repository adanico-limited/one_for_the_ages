/**
 * Application logger - silent in production, verbose in development.
 */

const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  info: (...args: unknown[]) => { if (isDev) console.log('[OFTA]', ...args) },
  warn: (...args: unknown[]) => { if (isDev) console.warn('[OFTA]', ...args) },
  error: (...args: unknown[]) => { console.error('[OFTA]', ...args) },
  debug: (...args: unknown[]) => { if (isDev) console.debug('[OFTA]', ...args) },
}
