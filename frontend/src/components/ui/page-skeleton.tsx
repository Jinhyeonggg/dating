import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export function ListPageSkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </Card>
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex items-center justify-between p-4">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-5 w-12" />
          </Card>
        ))}
      </div>
    </main>
  )
}

export function DetailPageSkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-24" />
      <Card className="mb-6 p-6">
        <Skeleton className="mb-3 h-6 w-40" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
      <Card className="p-6">
        <Skeleton className="mb-3 h-5 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
    </main>
  )
}

export function ViewerPageSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-32" />
      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="mb-3 h-4 w-64" />
        <Skeleton className="h-2 w-full rounded-full" />
      </Card>
      <div className="min-h-[360px] space-y-3">
        <Skeleton className="h-16 w-3/5" />
        <Skeleton className="ml-auto h-16 w-3/5" />
        <Skeleton className="h-16 w-1/2" />
      </div>
    </main>
  )
}
