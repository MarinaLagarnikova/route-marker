import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StartPage } from '@/pages/start'
import { RoutePage } from '@/pages/route'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/route" element={<RoutePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
