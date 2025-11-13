import * as Sentry from '@sentry/react'

export function initSentry() {
  // Only initialize Sentry in production
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    // Нормализуем tunnel: если передали относительный путь, подставим текущий origin
    const tunnelFromEnv = import.meta.env.VITE_SENTRY_TUNNEL as string | undefined
    let tunnel: string | undefined = tunnelFromEnv
    try {
      if (tunnelFromEnv && !/^https?:\/\//i.test(tunnelFromEnv)) {
        tunnel = new URL(tunnelFromEnv, window.location.origin).toString()
      }
    } catch {}

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      // Tunnel для обхода блокировок адблокерами
      tunnel,
      // Не отправлять client reports (outcomes) отдельно
      sendClientReports: false,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      // Environment
      environment: import.meta.env.MODE,
      // Release tracking
      release: `productlabelerpro@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      // Before send hook for filtering
      beforeSend(event, hint) {
        // Don't send events in development
        if (import.meta.env.DEV) {
          console.error('Sentry event (not sent in dev):', event, hint)
          return null
        }
        return event
      },
    })

    console.log('✅ Sentry initialized for production monitoring')
  } else if (import.meta.env.DEV) {
    console.debug('Sentry not initialized: running in development mode')
  } else if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn('Sentry DSN is not configured; error monitoring is disabled')
  }
}
