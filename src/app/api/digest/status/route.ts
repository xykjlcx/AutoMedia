import { NextResponse } from 'next/server'
import { getDigestRunStatus } from '@/lib/db/queries'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const runs = await getDigestRunStatus(date)
  if (runs.length === 0) {
    return NextResponse.json({ status: 'none', date })
  }

  const run = runs[0]
  return NextResponse.json({
    status: run.status,
    date: run.digestDate,
    progress: run.progress,
    rawCount: run.rawCount,
    filteredCount: run.filteredCount,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errors: run.errors,
  })
}
