import { NextResponse } from 'next/server'
import { getDigestDates } from '@/lib/db/queries'

export async function GET() {
  const dates = await getDigestDates()
  return NextResponse.json({ dates })
}
