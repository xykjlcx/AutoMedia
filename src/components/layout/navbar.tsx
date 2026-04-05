"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Newspaper, Clock, Star, BarChart3, Search, Lightbulb, PenLine, Activity, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const navLinks = [
  { href: "/", label: "今日日报", icon: Newspaper },
  { href: "/history", label: "历史", icon: Clock },
  { href: "/favorites", label: "收藏", icon: Star },
  { href: "/summary", label: "汇总", icon: BarChart3 },
  { href: "/insights", label: "洞察", icon: Lightbulb },
  { href: "/search", label: "搜索", icon: Search },
  { href: "/studio", label: "Studio", icon: PenLine },
  { href: "/dashboard", label: "数据", icon: Activity },
  { href: "/settings", label: "设置", icon: Settings },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl h-full flex items-center justify-between px-4">
        {/* 报头 */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <img
            src="/logo.png"
            alt="AutoMedia"
            width={28}
            height={28}
            className="transition-transform group-hover:scale-105"
          />
          <span className="font-serif-display text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-[var(--color-warm-accent)] hidden sm:inline">
            AutoMedia
          </span>
        </Link>

        {/* 导航链接 */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/"
              ? pathname === "/"
              : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}
        </div>
        <ThemeToggle />
      </div>
    </nav>
  )
}
