import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CloudUpload, Flag, FolderOpen, SportShoe, X } from 'lucide-react'
import { parseGpx } from '@/shared/lib/gpx'
import { useRouteStore, hashString } from '@/entities/route'
import { storageGet, storageSet, storageKeys } from '@/shared/lib/storage'
import { APP_NAME } from '@/shared/config'
import { COLLECTION_CARD_LIST, useLibraryStore } from '@/entities/library-route'
import type { LibraryRoute } from '@/entities/library-route'
import { fetchRouteGpxXml } from '@/shared/lib/library-api'
import type { GpxData } from '@/shared/lib/gpx'
import type { RouteState } from '@/entities/route'

// ────────────────────────────────────────────
// Exact Figma path from Star 2.svg, viewBox 0 0 88 93
// ────────────────────────────────────────────
const BLOB_PATH =
  'M27.8695 6.77043C36.6591 -2.25681 51.3409 -2.25681 60.1305 6.77043C63.0724 9.79182 66.8326 11.924 70.9677 12.9155C83.3226 15.8778 90.6636 28.3654 87.0983 40.355C85.905 44.3678 85.905 48.6322 87.0983 52.645C90.6636 64.6346 83.3226 77.1222 70.9677 80.0845C66.8326 81.076 63.0724 83.2082 60.1305 86.2296C51.3409 95.2568 36.6591 95.2568 27.8695 86.2296C24.9276 83.2082 21.1674 81.076 17.0323 80.0845C4.67736 77.1222 -2.66356 64.6346 0.901738 52.645C2.09503 48.6322 2.09503 44.3678 0.901738 40.355C-2.66356 28.3654 4.67736 15.8778 17.0323 12.9155C21.1674 11.924 24.9276 9.79182 27.8695 6.77043Z'

// Figma canvas size — exact from Figma export
const BLOB_VB_W = 88
const BLOB_VB_H = 93
const BLOB_W = 88
const BLOB_H = 93

function BlobCard({
  id,
  name,
  count,
  imageUrl,
  onClick,
}: {
  id: string
  name: string
  count: number
  imageUrl?: string
  onClick: () => void
}) {
  const clipId = `blob-clip-${id}`
  const gradId = `blob-grad-${id}`

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 shrink-0 active:opacity-75 transition-opacity"
      style={{ width: 128 }}
    >
      {/* Blob */}
      <div className="relative" style={{ width: BLOB_W, height: BLOB_H }}>
        <svg
          width={BLOB_W}
          height={BLOB_H}
          viewBox={`0 0 ${BLOB_VB_W} ${BLOB_VB_H}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={BLOB_PATH} />
            </clipPath>
            {!imageUrl && (
              <radialGradient id={gradId} cx="38%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FFAA5A" />
                <stop offset="100%" stopColor="#FF7A29" />
              </radialGradient>
            )}
          </defs>

          {imageUrl ? (
            <image
              href={imageUrl}
              x="0"
              y="0"
              width={BLOB_VB_W}
              height={BLOB_VB_H}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
            />
          ) : (
            <path d={BLOB_PATH} fill={`url(#${gradId})`} />
          )}
        </svg>

        {/* Count badge */}
        <div
          className="absolute flex items-center justify-center bg-white rounded-full"
          style={{ width: 24, height: 24, bottom: 2, right: 5, boxShadow: '0 1px 4px rgba(0,0,0,0.20)' }}
        >
          <span className="text-[11px] font-semibold text-zinc-900 leading-none">{count}</span>
        </div>
      </div>

      {/* Name */}
      <p
        className="text-[12px] font-medium text-zinc-800 text-center leading-[1.3]"
        style={{ width: 128 }}
      >
        {name}
      </p>
    </button>
  )
}


function RouteCard({
  route,
  onClick,
  isActive,
}: {
  route: RouteState
  onClick: () => void
  isActive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-zinc-200 rounded-2xl p-6 flex items-start gap-4"
    >
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {isActive && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" style={{ overflow: 'visible' }}>
                <circle className="dot-pulse-ring" cx="8" cy="8" r="8" fill="#FF7A29" />
                <circle cx="8" cy="8" r="3" fill="#FF7A29" />
              </svg>
            )}
            <p className="text-sm font-semibold text-zinc-900 truncate">{route.name}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <SportShoe className="w-4 h-4 text-zinc-900" />
            <span className="text-sm font-normal text-zinc-900">{(route.totalKm ?? 0).toFixed(0)} км</span>
          </div>
        </div>
        <p className="text-sm font-normal text-zinc-500">{fmtRouteSubtitle(route)}</p>
      </div>
    </button>
  )
}


function fmtCompletedSubtitle(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  if (checked.length === 0) return ''
  const firstTs = checked[0].checkedAt!
  const lastTs = checked[checked.length - 1].checkedAt!
  const date = new Date(lastTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const durationMs = lastTs - firstTs
  const hours = Math.floor(durationMs / 3600000)
  const minutes = Math.floor((durationMs % 3600000) / 60000)
  const dur = hours === 0 ? `${minutes} мин` : minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`
  return `${date} · ${dur}`
}

function fmtRouteSubtitle(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  const coveredKm = checked.length ? (checked[checked.length - 1].distanceKm ?? 0) : 0
  const isCompleted = checked.length === r.checkpoints.length && r.checkpoints.length > 0

  if (isCompleted && checked.length > 0) {
    const firstTs = checked[0].checkedAt!
    const lastTs = checked[checked.length - 1].checkedAt!
    const firstDay = new Date(firstTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const lastDay = new Date(lastTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const dateStr = firstDay === lastDay ? firstDay : `${firstDay} — ${lastDay}`
    return `${coveredKm.toFixed(1)} км пройдено · ${dateStr}`
  }

  return `${coveredKm.toFixed(1)} км пройдено`
}

interface AddTrackDrawerProps {
  routeName: string
  onNameChange: (name: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function AddTrackDrawer({ routeName, onNameChange, onConfirm, onCancel }: AddTrackDrawerProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onCancel, 300)
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-[560px] mx-auto flex flex-col transition-transform duration-300 ease-out pointer-events-none ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex justify-end px-4 pb-1.5 pointer-events-none">
          <button
            onClick={handleClose}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full bg-black/40 active:bg-black/60 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="bg-white border border-zinc-200 rounded-t-2xl pointer-events-auto">
          {/* Handle */}
          <div className="flex items-center justify-center pt-4">
            <div className="w-[100px] h-2 bg-zinc-100 rounded-full" />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-4 p-4">
            {/* Name input */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-zinc-900">Название</p>
              <input
                type="text"
                value={routeName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Введите название"
                autoFocus
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              />
            </div>

            {/* Confirm button */}
            <button
              onClick={onConfirm}
              disabled={!routeName.trim()}
              className="w-full h-11 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:bg-zinc-800 transition-colors"
            >
              Добавить трек
            </button>

            {/* Cancel button */}
            <button
              onClick={handleClose}
              className="w-full h-9 bg-white border border-zinc-200 text-sm font-medium text-zinc-900 rounded-xl active:bg-zinc-50 transition-colors"
            >
              Отменить
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ────────────────────────────────────────────
// CompletedSection — always visible; empty state or collapsible list
// ────────────────────────────────────────────
function CompletedRouteCard({ route, onClick }: { route: RouteState; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-zinc-200 rounded-2xl p-6 flex items-start gap-4"
    >
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">{route.name}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <SportShoe className="w-4 h-4 text-zinc-900" />
            <span className="text-sm font-normal text-zinc-900">{(route.totalKm ?? 0).toFixed(0)} км</span>
          </div>
        </div>
        <p className="text-sm font-normal text-zinc-500">{fmtCompletedSubtitle(route)}</p>
      </div>
    </button>
  )
}

function CompletedSection({
  routes,
  onOpen,
  onNavigateAll,
}: {
  routes: RouteState[]
  onOpen: (r: RouteState) => void
  onNavigateAll: () => void
}) {
  if (routes.length === 0) return null

  const hasMany = routes.length > 1

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <button
        onClick={hasMany ? onNavigateAll : undefined}
        className={`flex items-center gap-1.5 ${hasMany ? 'active:opacity-70' : ''}`}
        disabled={!hasMany}
      >
        <Flag className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-500">Завершённые</span>
        <span className="text-sm font-medium text-zinc-500">{routes.length}</span>
        {hasMany && <ChevronRight className="w-4 h-4 text-zinc-400 ml-auto" />}
      </button>

      {/* Single route — just the card */}
      {!hasMany && (
        <CompletedRouteCard route={routes[0]} onClick={() => onOpen(routes[0])} />
      )}

      {/* Multiple routes — first card with stack effect */}
      {hasMany && (
        <div className="relative pb-8">
          {/* Ghost 2 — narrowest, furthest back, peeks below ghost 1 */}
          <div className="absolute inset-x-6 top-4 bottom-0 rounded-2xl border border-zinc-200 bg-white" />
          {/* Ghost 1 — stops earlier so ghost 2 can peek out */}
          <div className="absolute inset-x-3 top-2 bottom-4 rounded-2xl border border-zinc-200 bg-white" />
          <div className="relative">
            <CompletedRouteCard route={routes[0]} onClick={onNavigateAll} />
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────
// PinnedRoutesSection — routes added from library
// ────────────────────────────────────────────
type PinnedRoute = Omit<LibraryRoute, 'track'>

function PinnedRoutesSection({ onOpen, savedRoutes }: { onOpen: (route: PinnedRoute) => Promise<void>; savedRoutes: RouteState[] }) {
  const pinnedRoutes = useLibraryStore((s) => s.pinnedRoutes)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (pinnedRoutes.length === 0) return null

  return (
    <>
      {pinnedRoutes.map((route) => {
        const saved = savedRoutes.find((r) => r.libraryRouteId === route.id)
        // Skip completed routes — they go to the completed section
        const isCompleted = saved && saved.checkpoints.length > 0 && saved.checkpoints.every((cp) => cp.checkedAt !== undefined)
        if (isCompleted) return null
        const isActive = saved ? saved.checkpoints.some((cp) => cp.checkedAt !== undefined) : false

        const handleClick = async () => {
          setLoadingId(route.id)
          try {
            await onOpen(route)
          } finally {
            setLoadingId(null)
          }
        }

        if (saved) {
          return (
            <RouteCard
              key={route.id}
              route={saved}
              onClick={handleClick}
              isActive={isActive}
            />
          )
        }

        // Not yet opened — show basic card from library data
        return (
          <button
            key={route.id}
            disabled={loadingId !== null}
            onClick={handleClick}
            className={`w-full text-left bg-white border border-zinc-200 rounded-2xl p-6 flex items-start gap-4 transition-colors ${loadingId === route.id ? 'opacity-60' : 'active:bg-zinc-50'}`}
          >
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{route.name}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <SportShoe className="w-4 h-4 text-zinc-900" />
                  <span className="text-sm font-normal text-zinc-900">{Math.round(route.distanceKm)} км</span>
                </div>
              </div>
              <p className="text-sm font-normal text-zinc-500">0.0 км пройдено</p>
            </div>
          </button>
        )
      })}
    </>
  )
}

// ────────────────────────────────────────────
// LibraryCollectionsSection — horizontal scroll of blob region cards
// ────────────────────────────────────────────
function LibraryCollectionsSection() {
  const navigate = useNavigate()
  const favorites = useLibraryStore((s) => s.favorites)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-medium text-zinc-500">Маршруты</span>
      </div>

      {/* Horizontal scroll — no gap at left/right edges */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {COLLECTION_CARD_LIST.map((col) => (
          <BlobCard
            key={col.id}
            id={col.id}
            name={col.name}
            count={col.id === 'favorites' ? favorites.length : col.count}
            imageUrl={col.imageUrl}
            onClick={() => navigate(`/collection/${col.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

export function StartPage() {
  const navigate = useNavigate()
  const loadRoute = useRouteStore((s) => s.loadRoute)
  const loadSaved = useRouteStore((s) => s.loadSaved)
  const pinnedRoutes = useLibraryStore((s) => s.pinnedRoutes)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsedGpx, setParsedGpx] = useState<{ data: GpxData; xml: string } | null>(null)
  const [routeName, setRouteName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [savedRoutes, setSavedRoutes] = useState<RouteState[]>([])

  useEffect(() => {
    const allKeys = storageKeys()
    // Regular routes: skip multi-stage keys (multi_ prefix or _sN suffix)
    const routeKeys = allKeys.filter(
      (k) => !k.startsWith('multi_') && !/^.+_s\d+$/.test(k)
    )
    const routes = routeKeys
      .map((k) => storageGet<RouteState>(k))
      .filter((r): r is RouteState => r !== null && typeof r.gpxHash === 'string')
    setSavedRoutes(routes)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const xml = ev.target?.result as string
      try {
        const data = parseGpx(xml)
        setParseError(null)
        handleParsed(data, xml)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Ошибка разбора файла')
      }
    }
    reader.readAsText(file)
  }

  function handleParsed(data: GpxData, xml: string) {
    const hash = hashString(xml)
    const existing = storageGet<RouteState>(hash)
    if (existing) {
      loadSaved(existing)
      navigate('/route')
      return
    }
    setParsedGpx({ data, xml })
    setRouteName(data.name)
  }

  function handleConfirm() {
    if (!parsedGpx || !routeName.trim()) return
    loadRoute(routeName.trim(), parsedGpx.data.trackPoints, parsedGpx.data.waypoints, parsedGpx.xml, parsedGpx.data.trackSegments)
    navigate('/route')
  }

  function handleCancel() {
    setParsedGpx(null)
    setRouteName('')
  }

  async function handleOpenPinnedRoute(route: PinnedRoute) {
    if (!route.gpx) return
    const xml = await fetchRouteGpxXml(route.region.id, route.gpx)
    const hash = hashString(xml)
    const existing = storageGet<RouteState>(hash)
    if (existing) {
      // Patch libraryRouteId if missing (e.g. loaded before this feature was added)
      if (!existing.libraryRouteId) {
        existing.libraryRouteId = route.id
        storageSet(hash, existing)
      }
      loadSaved(existing)
    } else {
      const data = parseGpx(xml)
      loadRoute(route.name, data.trackPoints, data.waypoints, xml, data.trackSegments, route.id)
    }
    navigate('/route')
  }

  function handleContinue(route: RouteState) {
    loadSaved(route)
    navigate('/route')
  }

  const completedRoutes = savedRoutes.filter(
    (r) => r.checkpoints.length > 0 && r.checkpoints.every((cp) => cp.checkedAt !== undefined)
  )
  const activeRoutes = savedRoutes.filter(
    (r) => !r.checkpoints.every((cp) => cp.checkedAt !== undefined) && !r.libraryRouteId
  )


  return (
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto bg-white">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 shrink-0" viewBox="0 0 36.9498 36.9498" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
            <rect x="18.4749" width="26.1275" height="26.1275" rx="7.11111" transform="rotate(45 18.4749 0)" fill="#FF7A29"/>
            <path d="M14.2223 10.6667H22.6434H23.1112V17.7778H14.2223L16.889 14.2222L14.2223 10.6667Z" fill="white"/>
            <path d="M23.1112 18.6667V4.66667L26.6667 8.16667V18.6667C26.6667 23.5759 22.6871 27.5556 17.7779 27.5556H9.08341L5.55564 24H17.7779C20.7234 24 23.1112 21.6122 23.1112 18.6667Z" fill="white"/>
          </svg>
          <h1 className="text-[30px] font-semibold leading-[36px] text-zinc-900">{APP_NAME}</h1>
        </div>

        {/* Pinned + active routes — always visible */}
        <div className="flex flex-col gap-3">
          {pinnedRoutes.length === 0 && activeRoutes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 bg-zinc-50 rounded-2xl px-6">
              <div className="w-12 h-12 flex items-center justify-center bg-zinc-100 rounded-2xl">
                <FolderOpen className="w-6 h-6 text-zinc-500" />
              </div>
              <p className="text-base font-semibold text-zinc-900">Нет активных маршрутов</p>
              <p className="text-sm text-zinc-500 text-center leading-[1.4]">
                Выберите маршрут из подборки или добавьте его вручную, чтобы начать
              </p>
            </div>
          ) : (
            <>
              <PinnedRoutesSection onOpen={handleOpenPinnedRoute} savedRoutes={savedRoutes} />
              {activeRoutes.map((r) => (
                <RouteCard
                  key={r.gpxHash}
                  route={r}
                  onClick={() => handleContinue(r)}
                  isActive={r.checkpoints.some((cp) => cp.checkedAt !== undefined)}
                />
              ))}
            </>
          )}
        </div>

        {/* Library collections — always */}
        <LibraryCollectionsSection />

        {/* Completed routes — always */}
        <CompletedSection
          routes={completedRoutes}
          onOpen={handleContinue}
          onNavigateAll={() => navigate('/completed')}
        />

        {parseError && (
          <p className="text-sm text-red-600">{parseError}</p>
        )}
      </div>

      {/* Footer with upload button — always */}
      <div className="px-4 py-6 bg-white shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-11 bg-zinc-900 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2.5 active:bg-zinc-800 transition-colors"
        >
          <CloudUpload className="w-4 h-4" />
          Загрузить GPX трек
        </button>
      </div>

      {/* Add track drawer */}
      {parsedGpx && (
        <AddTrackDrawer
          routeName={routeName}
          onNameChange={setRouteName}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
