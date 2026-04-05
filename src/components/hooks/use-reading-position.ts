"use client"

import { useEffect, useRef, useCallback } from "react"

const LS_PREFIX = "reading-pos:"

/**
 * 阅读位置记忆 hook
 * - 页面加载时恢复上次滚动位置
 * - 滚动时 debounce 500ms 保存到 localStorage + API
 */
export function useReadingPosition(path: string, key: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredRef = useRef(false)

  const storageKey = `${LS_PREFIX}${path}:${key}`

  // 保存位置到 localStorage 和 API
  const save = useCallback(
    (scrollY: number) => {
      // localStorage（快速）
      try {
        localStorage.setItem(storageKey, String(scrollY))
      } catch {
        // localStorage 不可用时静默失败
      }
      // API（持久化，不阻塞）
      fetch("/api/reading-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, key, scrollY }),
      }).catch(() => {})
    },
    [path, key, storageKey]
  )

  // 恢复位置
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    // 优先从 localStorage 恢复（快）
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const y = parseInt(cached, 10)
        if (y > 0) {
          // 延迟一帧等 DOM 渲染完成
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: "instant" })
          })
          return
        }
      }
    } catch {}

    // 回退到 API
    fetch(`/api/reading-position?path=${encodeURIComponent(path)}&key=${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.scrollY > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: data.scrollY, behavior: "instant" })
          })
        }
      })
      .catch(() => {})
  }, [path, key, storageKey])

  // 监听滚动，debounce 500ms 保存
  useEffect(() => {
    const handleScroll = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        save(window.scrollY)
      }, 500)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [save])
}
