import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { useRouteStore } from '@/entities/route'

export function ResetButton() {
  const resetProgress = useRouteStore((s) => s.resetProgress)

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="text-xs text-gray-400 underline underline-offset-2 py-1 px-2 min-h-[44px] flex items-center">
          Сбросить прогресс
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Сбросить все отметки?</AlertDialogTitle>
          <AlertDialogDescription>
            Все пройденные точки будут сброшены. Маршрут останется загруженным.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={resetProgress}>Сбросить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
