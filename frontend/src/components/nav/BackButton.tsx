'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

// 최상위 페이지에서는 뒤로 갈 곳이 없으므로 숨김
const ROOT_PATHS = new Set<string>(['/clones', '/interactions', '/login', '/'])

export function BackButton() {
  const pathname = usePathname()
  const router = useRouter()

  if (ROOT_PATHS.has(pathname)) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="gap-1 px-2"
      aria-label="뒤로"
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="text-sm">뒤로</span>
    </Button>
  )
}
