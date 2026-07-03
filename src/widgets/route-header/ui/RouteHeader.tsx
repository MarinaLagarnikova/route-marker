import { useNavigate } from 'react-router-dom'
import { APP_NAME } from '@/shared/config'
import { useRouteStore } from '@/entities/route'

export function RouteHeader() {
  const navigate = useNavigate()
  const name = useRouteStore((s) => s.route?.name ?? '')

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
      <button
        onClick={() => navigate('/')}
        aria-label="На главную"
        className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{APP_NAME}</p>
        <h1 className="text-base font-semibold text-gray-900 truncate">{name}</h1>
      </div>
    </header>
  )
}
