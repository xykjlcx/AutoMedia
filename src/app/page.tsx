import { Suspense } from "react"
import { DigestPage } from "@/components/digest/digest-page"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[720px] px-4 pb-16">
          <div className="space-y-4 mt-12">
            <Skeleton className="h-10 w-48 mx-auto" />
            <Skeleton className="h-6 w-32 mx-auto" />
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3 mt-6">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-28 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <DigestPage />
    </Suspense>
  )
}
