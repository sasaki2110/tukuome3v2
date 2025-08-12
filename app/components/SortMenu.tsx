'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'

export default function SortMenu() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const currentSort = searchParams.get('sort') || 'desc' // デフォルトは多い順 (降順)

  const sortOptions = [
    { sort: 'desc', label: '多い順' },
    { sort: 'asc', label: '少ない順' },
  ];

  const createPageURL = (sort: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('sort', sort)
    // 他のフィルタリングパラメータを保持しつつ、sortパラメータを更新する
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-around">
        <span className="mr-2">つくれぽ数の</span>
        {sortOptions.map(({ sort, label }) => (
          <button
            key={sort}
            onClick={() => router.push(createPageURL(sort))}
            className={`inline-flex items-center px-2 py-2 whitespace-nowrap ${
              currentSort === sort ? 'text-blue-500' : ''
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}