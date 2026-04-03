import { EventEmitter } from 'events'
import type { PipelineProgress } from './pipeline'

interface ProgressEvent {
  runId: string
  date: string
  progress: PipelineProgress
}

// 全局单例事件总线，pipeline 进度更新时 emit，SSE 端点监听
class PipelineEventBus extends EventEmitter {
  // 每个 runId 的最新进度快照（SSE 连接时可立即推送当前状态）
  private snapshots = new Map<string, { date: string; progress: PipelineProgress }>()

  emitProgress(data: ProgressEvent) {
    this.snapshots.set(data.runId, { date: data.date, progress: data.progress })
    this.emit('progress', data)
    // 完成或失败后延迟清理快照
    if (data.progress.phase === 'completed' || data.progress.phase === 'failed') {
      setTimeout(() => this.snapshots.delete(data.runId), 5000)
    }
  }

  onProgress(listener: (data: ProgressEvent) => void) {
    this.on('progress', listener)
    return () => { this.off('progress', listener) }
  }

  // 获取指定日期的最新快照
  getSnapshot(date: string): (ProgressEvent | null) {
    for (const [runId, snap] of this.snapshots) {
      if (snap.date === date) return { runId, ...snap }
    }
    return null
  }
}

export const pipelineEvents = new PipelineEventBus()
