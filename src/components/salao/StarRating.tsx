'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRating({
  value,
  onChange,
  size = 32,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className="p-0.5 -m-0.5 active:scale-90 transition-transform"
        >
          <Star
            size={size}
            className={cn(
              'transition-colors',
              n <= value ? 'fill-brand-400 text-brand-400' : 'fill-transparent text-neutral-700'
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function CategoryRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-neutral-300">{label}</span>
      <StarRating value={value} onChange={onChange} size={22} />
    </div>
  )
}
