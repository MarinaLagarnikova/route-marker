import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, SportShoe } from 'lucide-react'
import { useRouteStore } from '@/entities/route'
import { storageGet } from '@/shared/lib/storage'
import type { RouteState } from '@/entities/route'
import type { StageMeta } from '@/entities/route'

function calcStageCoveredKm(stageMeta: StageMeta): number {
  const stageState = storageGet<RouteState>(stageMeta.stageKey)
  if (!stageState) return 0
  const checked = stageState.checkpoints.filter((cp) => cp.checkedAt !== undefined)
  return checked.length > 0 ? (checked[checked.length - 1].distanceKm ?? 0) : 0
}

export function StagesPage() {
  const navigate = useNavigate()
  const multiStage = useRouteStore((s) => s.multiStage)
  const selectStage = useRouteStore((s) => s.selectStage)

  useEffect(() => {
    if (!multiStage) {
      navigate('/')
    }
  }, [multiStage, navigate])

  if (!multiStage) return null

  function handleStageClick(index: number) {
    selectStage(index)
    navigate('/route')
  }

  return (
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto bg-white">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors shrink-0"
            aria-label="На главную"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-900" />
          </button>
          <h1 className="text-xl font-semibold text-zinc-900 truncate">{multiStage.name}</h1>
        </div>

        {/* Stage cards */}
        <div className="flex flex-col gap-3">
          {multiStage.stages.map((stageMeta, i) => {
            const coveredKm = calcStageCoveredKm(stageMeta)
            return (
              <button
                key={stageMeta.stageKey}
                onClick={() => handleStageClick(i)}
                className="w-full text-left bg-white border border-zinc-200 rounded-2xl p-6 flex items-start gap-4"
              >
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{stageMeta.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <SportShoe className="w-4 h-4 text-zinc-900" />
                      <span className="text-sm font-normal text-zinc-900">{stageMeta.totalKm.toFixed(0)} км</span>
                    </div>
                  </div>
                  <p className="text-sm font-normal text-zinc-500">{coveredKm.toFixed(1)} км пройдено</p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-900 shrink-0 mt-0.5" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
