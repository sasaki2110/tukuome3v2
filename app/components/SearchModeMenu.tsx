'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { searchModes } from '@/lib/constants'

interface SearchModeMenuProps {
  currentMode: string;
}

export default function SearchModeMenu({ currentMode }: SearchModeMenuProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const createPageURL = (mode: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('mode', mode)
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-around">
        {searchModes.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => router.push(createPageURL(mode))}
            className={`block px-2 py-2 text-center whitespace-nowrap ${
              currentMode === mode ? 'text-blue-500' : ''
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
