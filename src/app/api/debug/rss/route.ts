import { NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { getPublicSources } from '@/lib/sources'

const RSSHUB_BASE = process.env.RSSHUB_BASE_URL || 'https://rsshub.rssforever.com'

export async function GET() {
  const sources = getPublicSources()
  const source = sources[0]
  if (!source) return NextResponse.json({ error: 'no sources' })

  const feedUrl = `${RSSHUB_BASE}${source.rssPath}`
  const results: Record<string, unknown> = { feedUrl }

  // Test 1: raw fetch
  try {
    const r = await fetch(feedUrl)
    const xml = await r.text()
    results.fetchOk = true
    results.xmlLength = xml.length

    // Test 2: parse the XML
    try {
      const parser = new Parser()
      const feed = await parser.parseString(xml)
      results.parseOk = true
      results.itemCount = feed.items?.length || 0
      results.firstTitle = feed.items?.[0]?.title || '(none)'
    } catch (e: unknown) {
      results.parseError = (e as Error).message
    }
  } catch (e: unknown) {
    const err = e as Error & { cause?: Error }
    results.fetchError = `${err.message} | cause: ${err.cause?.message || 'none'}`
  }

  return NextResponse.json(results)
}
