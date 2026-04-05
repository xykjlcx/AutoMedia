import { NextResponse } from 'next/server'
import { generateCompareView } from '@/lib/digest/compare-views'

// 获取指定 cluster 的多视角对比分析
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  const { clusterId } = await params

  if (!clusterId) {
    return NextResponse.json({ error: '缺少 clusterId 参数' }, { status: 400 })
  }

  const result = await generateCompareView(clusterId)

  if (!result) {
    return NextResponse.json({ error: '未找到该聚类或无法生成对比分析' }, { status: 404 })
  }

  return NextResponse.json(result)
}
