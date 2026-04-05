import { Suspense } from 'react'
import { StudioPage } from '@/components/studio/studio-page'
import { Skeleton } from '@/components/ui/skeleton'

export default function Studio() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[60vh] w-full mt-4 rounded-lg" />
      </div>
    }>
      <StudioPage />
    </Suspense>
  )
}
