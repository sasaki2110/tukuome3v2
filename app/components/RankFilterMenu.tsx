'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Heart } from 'lucide-react';

interface RankFilterMenuProps {
  currentRank: string;
}

export default function RankFilterMenu({ currentRank }: RankFilterMenuProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const rankOptions = [
    { rank: 'all', label: '全部' },
    { rank: '1', label: <><Heart fill="red" stroke="red" size={16} /> めっちゃ好き</> },
    { rank: '2', label: <><Heart fill="orange" stroke="orange" size={16} /> まあまあ</> },
  ];

  const createPageURL = (rank: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('rank', rank)
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-around">
        {rankOptions.map(({ rank, label }) => (
          <button
            key={rank}
            onClick={() => router.push(createPageURL(rank))}
            className={`inline-flex items-center px-2 py-2 whitespace-nowrap ${
              currentRank === rank ? 'text-blue-500' : ''
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
