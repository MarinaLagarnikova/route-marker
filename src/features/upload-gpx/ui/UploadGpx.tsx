import { useRef, useState } from 'react'
import type { GpxData } from '@/shared/lib/gpx'
import { parseTrackFile } from '@/shared/lib/track-file'

interface Props {
  onParsed: (data: GpxData, xml: string) => void
}

export function UploadGpx({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      const { data, xml } = await parseTrackFile(file)
      setError(null)
      onParsed(data, xml)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка разбора файла')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 text-sm font-medium hover:border-gray-400 active:bg-gray-50 transition-colors"
      >
        {fileName ? `Файл: ${fileName}` : 'Выбрать файл трека'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,.kmz,.kml"
        className="hidden"
        onChange={handleFile}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
