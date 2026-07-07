import '@maptiler/sdk/dist/maptiler-sdk.css'
import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StartPage } from '@/pages/start'
import { RoutePage } from '@/pages/route'

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
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
