import type { Difficulty } from '../model'

const LABELS: Record<Difficulty, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
}

const CIRCLE_COLORS: Record<Difficulty, { fill: string; stroke: string }> = {
  easy:   { fill: '#16A34A', stroke: '#16A34A' },
  medium: { fill: '#FBBF24', stroke: '#FBBF24' },
  hard:   { fill: '#F97316', stroke: '#EA580C' },
}

interface Props {
  difficulty: Difficulty
  className?: string
}

function DifficultyCircle({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path
        d="M7 12.8333C10.2217 12.8333 12.8333 10.2217 12.8333 7C12.8333 3.77834 10.2217 1.16667 7 1.16667C3.77834 1.16667 1.16667 3.77834 1.16667 7C1.16667 10.2217 3.77834 12.8333 7 12.8333Z"
        fill={fill}
        fillOpacity="0.15"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DifficultyBadge({ difficulty, className = '' }: Props) {
  const { fill, stroke } = CIRCLE_COLORS[difficulty]
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <DifficultyCircle fill={fill} stroke={stroke} />
      <span className="text-sm font-normal text-zinc-500 leading-normal">{LABELS[difficulty]}</span>
    </span>
  )
}
