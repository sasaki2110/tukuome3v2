'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { searchModes } from '@/lib/myUtilities'

interface SearchModeMenuProps {
  onLinkClick?: () => void;
}

export default function SearchModeMenu({ onLinkClick }: SearchModeMenuProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const {  } = useRouter()
  const currentMode = searchParams.get('mode') || 'all'

  const createPageURL = (mode: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('mode', mode)
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="relative">
      <div className="flex items-center">
        {searchModes.map(({ mode, label }) => (
          <Link
            key={mode}
            href={createPageURL(mode)}
            onClick={onLinkClick}
            className={`block px-2 py-2 text-center ${
              currentMode === mode ? 'text-blue-500' : ''
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
