import { createRoot } from 'react-dom/client'
import './shadcn.css'
import './i18n/config'
import App from './App'
import { Toaster } from './components/ui/sonner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import { ThemeProvider } from './context/ThemeContext'

// Initialize Sentry before rendering
initSentry()

const root = createRoot(document.getElementById('app')!)
root.render(
  <ErrorBoundary>
    <ThemeProvider>
      <App />
      <Toaster />
    </ThemeProvider>
  </ErrorBoundary>
)
