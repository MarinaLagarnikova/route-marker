import '@maptiler/sdk/dist/maptiler-sdk.css'
import { Component, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SplashScreen, SPLASH_SEEN_KEY } from '@/widgets/splash-screen'
import { storageGet, storageSet } from '@/shared/lib/storage'
import { useBootstrap } from './useBootstrap'
import { StartPage } from '@/pages/start'
import { RoutePage } from '@/pages/route'
import { StagesPage } from '@/pages/stages'
import { CollectionPage } from '@/pages/collection'
import { CompletedPage } from '@/pages/completed'

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13 }}>
          <b>Runtime error:</b>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
            {(this.state.error as Error).message}
            {'\n'}
            {(this.state.error as Error).stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  // Прогрев идёт всегда — он ускоряет переход в подборку и на повторных запусках.
  const ready = useBootstrap()
  // Читаем один раз при инициализации: иначе экран мигнёт на повторных запусках.
  const [showSplash, setShowSplash] = useState(() => !storageGet<boolean>(SPLASH_SEEN_KEY))

  function dismissSplash() {
    storageSet(SPLASH_SEEN_KEY, true)
    setShowSplash(false)
  }

  return (
    <ErrorBoundary>
      {showSplash && <SplashScreen ready={ready} onDone={dismissSplash} />}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/stages" element={<StagesPage />} />
          <Route path="/collection/:id" element={<CollectionPage />} />
          <Route path="/completed" element={<CompletedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
