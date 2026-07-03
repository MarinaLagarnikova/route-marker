import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RouteHeader } from '@/widgets/route-header'
import { ProgressPanel } from '@/widgets/progress-panel'
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
    <div className="h-screen flex flex-col max-w-[560px] mx-auto bg-white">
      <RouteHeader />
      <ProgressPanel />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="h-[45vh] min-h-[200px] flex-shrink-0">
          <RouteMap />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CheckpointList />
        </div>
      </div>
    </div>
  )
}
