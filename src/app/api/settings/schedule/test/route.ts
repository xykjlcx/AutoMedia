import { NextResponse } from 'next/server'
import { sendDigestNotification } from '@/lib/notify'

export async function POST() {
  try {
    await sendDigestNotification(new Date().toISOString().slice(0, 10), 0)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
