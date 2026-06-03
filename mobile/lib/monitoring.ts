/**
 * Error monitoring and performance tracking via Sentry.
 * Configure NEXT_PUBLIC_SENTRY_DSN to enable reporting.
 * Falls back to console logging when DSN is absent.
 */

import * as Sentry from '@sentry/nextjs'

interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  extra?: Record<string, unknown>
}

class Monitoring {
  private initialized = false

  init() {
    if (this.initialized) return
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0.1,
      })
    }
    this.initialized = true
  }

  captureError(error: Error, context?: ErrorContext) {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, { extra: context as Record<string, unknown> })
    } else {
      console.error('[OFTA Error]', error.message, context)
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureMessage(message, level)
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`[OFTA ${level}]`, message)
    }
  }

  setUser(userId: string, email?: string) {
    Sentry.setUser({ id: userId, email })
  }
}

export const monitoring = new Monitoring()
