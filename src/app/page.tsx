import { Suspense } from "react"
import { DigestPage } from "@/components/digest/digest-page"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 pb-16">
          <div className="space-y-4 mt-12">
            <Skeleton className="h-10 w-48 mx-auto" />
            <Skeleton className="h-6 w-32 mx-auto" />
            <div className="flex gap-6 mt-8">
              <div className="w-44 shrink-0 hidden lg:block space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      }
    >
      <DigestPage />
    </Suspense>
  )
}
