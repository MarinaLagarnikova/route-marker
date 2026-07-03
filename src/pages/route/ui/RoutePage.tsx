import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RouteHeader } from '@/widgets/route-header'
import { RouteMap } from '@/widgets/route-map'
import { CheckpointList } from '@/widgets/checkpoint-list'
import { useRouteStore } from '@/entities/route'

export function RoutePage() {
  const navigate = useNavigate()
  const route = useRouteStore((s) => s.route)

  useEffect(() => {
    if (!route) navigate('/', { replace: true })
  }, [route, navigate])

  if (!route) return null

  return (
    <div className="min-h-screen flex flex-col max-w-[560px] mx-auto bg-white">
      {/* Header: back button + name + subtitle + progress bar */}
      <RouteHeader />

      {/* Map card */}
      <div className="mx-4 mb-4 border border-[#e5e5e5] rounded-[14px] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1)] overflow-hidden h-[45vh] min-h-[200px] flex-shrink-0">
        <RouteMap />
      </div>

      {/* Checkpoint list — scrollable */}
      <div className="flex-1">
        <CheckpointList />
      </div>
    </div>
  )
}
