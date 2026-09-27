import { useNavigate, useParams } from 'react-router-dom'
import { useCollection } from '@/entities/library-route'
import { CollectionMap } from '@/widgets/collection-map'

export function CollectionMapPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { collection, loading, error } = useCollection(id)

  // Карту можно открыть прямой ссылкой, поэтому возврат не всегда есть в истории.
  const goBack = () => navigate(`/collection/${id}`)

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center max-w-[560px] mx-auto">
        <p className="text-sm text-zinc-400">Загрузка…</p>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="h-dvh flex items-center justify-center max-w-[560px] mx-auto">
        <p className="text-sm text-zinc-500">{error ?? 'Подборка не найдена'}</p>
      </div>
    )
  }

  return <CollectionMap routes={collection.routes} onBack={goBack} />
}
