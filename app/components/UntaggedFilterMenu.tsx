'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'

export default function UntaggedFilterMenu() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const isUntaggedMode = searchParams.get('tagmode') === 'untaged'

  const handleCheckboxChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams)
    if (checked) {
      params.set('tagmode', 'untaged')
    } else {
      params.delete('tagmode')
    }
    // ページネーションをリセットするためにpageパラメータを削除
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-center w-full py-2">
        <Checkbox
          id="untagged-mode"
          checked={isUntaggedMode}
          onCheckedChange={handleCheckboxChange}
        />
        <label htmlFor="untagged-mode">タグ未設定のみ</label>
      </div>
    </div>
  )
}
