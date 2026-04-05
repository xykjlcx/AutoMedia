#!/usr/bin/env node
// 确保分享卡片需要的中文字体存在，缺失时自动从 jsDelivr CDN 下载
// 失败不阻塞安装 — 分享卡片是可选功能

import { existsSync, mkdirSync, statSync, createWriteStream } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const fontsDir = join(projectRoot, 'public', 'fonts')

// 字体候选列表 — 优先级从高到低
const FONT_CANDIDATES = [
  {
    name: 'SourceHanSansSC-Regular.otf',
    url: 'https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@release/SubsetOTF/CN/SourceHanSansCN-Regular.otf',
    minSize: 1_000_000, // 1MB 作为完整性下限
  },
]

function log(msg) {
  console.log(`[fonts] ${msg}`)
}

function warn(msg) {
  console.warn(`[fonts] ⚠ ${msg}`)
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const request = (currentUrl, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error('重定向次数过多'))
        return
      }
      https.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
      }).on('error', reject)
    }
    request(url)
  })
}

async function ensureFont(candidate) {
  const filepath = join(fontsDir, candidate.name)

  // 已存在且大小合理 → 跳过
  if (existsSync(filepath)) {
    const size = statSync(filepath).size
    if (size >= candidate.minSize) {
      log(`${candidate.name} 已存在 (${(size / 1024 / 1024).toFixed(1)} MB)，跳过`)
      return true
    }
    warn(`${candidate.name} 大小异常 (${size} bytes)，重新下载`)
  }

  log(`下载 ${candidate.name} ...`)
  try {
    await download(candidate.url, filepath)
    const size = statSync(filepath).size
    if (size < candidate.minSize) {
      warn(`下载完成但文件大小异常 (${size} bytes)`)
      return false
    }
    log(`✓ ${candidate.name} (${(size / 1024 / 1024).toFixed(1)} MB)`)
    return true
  } catch (err) {
    warn(`下载失败: ${err.message}`)
    return false
  }
}

async function main() {
  if (!existsSync(fontsDir)) {
    mkdirSync(fontsDir, { recursive: true })
  }

  let ok = false
  for (const candidate of FONT_CANDIDATES) {
    if (await ensureFont(candidate)) {
      ok = true
      break
    }
  }

  if (!ok) {
    console.warn('')
    console.warn('[fonts] ⚠ 无法自动下载中文字体，分享卡片功能可能无法使用')
    console.warn('[fonts] 手动解决方法：将任一静态 Source Han Sans 或 Noto Sans SC 的 TTF/OTF')
    console.warn('[fonts] 文件放到 public/fonts/SourceHanSansSC-Regular.otf')
    console.warn('')
    // 不阻塞安装 — 退出码 0
  }
}

main().catch(err => {
  warn(`字体准备脚本异常: ${err.message}`)
  // 静默退出，不阻塞 install
})
