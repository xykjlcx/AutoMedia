// RSS 源目录 — 按分类组织的高质量公开 RSS 源

export interface CatalogEntry {
  name: string
  description: string
  rssUrl: string // 完整 URL 或 RSSHub 路径（以 / 开头表示 RSSHub）
  category: 'ai' | 'ecommerce' | 'tech' | 'startup' | 'general'
  tags: string[]
}

export const RSS_CATALOG: CatalogEntry[] = [
  // ── AI / ML ──
  {
    name: 'MIT Technology Review - AI',
    description: 'MIT 科技评论 AI 板块，深度报道前沿人工智能研究与应用',
    rssUrl: 'https://www.technologyreview.com/feed/',
    category: 'ai',
    tags: ['ai', '研究', '深度'],
  },
  {
    name: 'The Batch (DeepLearning.AI)',
    description: 'Andrew Ng 团队的 AI 周报，覆盖最新研究、行业动态',
    rssUrl: 'https://www.deeplearning.ai/the-batch/feed/',
    category: 'ai',
    tags: ['ai', '周报', '研究'],
  },
  {
    name: 'OpenAI Blog',
    description: 'OpenAI 官方博客，发布最新模型和研究成果',
    rssUrl: 'https://openai.com/blog/rss.xml',
    category: 'ai',
    tags: ['ai', 'openai', '大模型'],
  },
  {
    name: 'Hugging Face Blog',
    description: '开源 AI 社区 Hugging Face 博客，模型、数据集、工具动态',
    rssUrl: 'https://huggingface.co/blog/feed.xml',
    category: 'ai',
    tags: ['ai', '开源', '模型'],
  },
  {
    name: '机器之心',
    description: '国内领先的 AI 资讯平台，覆盖学术论文解读和行业动态',
    rssUrl: '/jiqizhixin/daily',
    category: 'ai',
    tags: ['ai', '中文', '资讯'],
  },
  {
    name: 'AI News (Sebastian Raschka)',
    description: 'AI 研究者 Sebastian Raschka 的 Substack，深度技术分析',
    rssUrl: 'https://magazine.sebastianraschka.com/feed',
    category: 'ai',
    tags: ['ai', '研究', '技术分析'],
  },
  {
    name: 'Google AI Blog',
    description: 'Google AI 研究博客，发布 DeepMind、Brain 等团队成果',
    rssUrl: 'https://blog.research.google/feeds/posts/default?alt=rss',
    category: 'ai',
    tags: ['ai', 'google', '研究'],
  },
  {
    name: 'Anthropic Research',
    description: 'Anthropic 研究博客，AI 安全和大模型方向',
    rssUrl: 'https://www.anthropic.com/feed',
    category: 'ai',
    tags: ['ai', 'anthropic', '安全'],
  },

  // ── 技术开发 ──
  {
    name: 'TechCrunch',
    description: '全球科技媒体，覆盖创业、融资、产品发布',
    rssUrl: 'https://techcrunch.com/feed/',
    category: 'tech',
    tags: ['科技', '创业', '产品'],
  },
  {
    name: 'Ars Technica',
    description: '深度科技报道，涵盖硬件、软件、科学',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'tech',
    tags: ['科技', '深度', '硬件'],
  },
  {
    name: 'The Verge',
    description: '消费科技与数字文化报道',
    rssUrl: 'https://www.theverge.com/rss/index.xml',
    category: 'tech',
    tags: ['科技', '消费电子', '文化'],
  },
  {
    name: 'InfoQ',
    description: '面向开发者的技术资讯，架构、DevOps、AI 实践',
    rssUrl: 'https://feed.infoq.com/',
    category: 'tech',
    tags: ['开发', '架构', 'devops'],
  },
  {
    name: 'InfoQ 中文',
    description: 'InfoQ 中文站，国内技术社区动态和实践分享',
    rssUrl: '/infoq/recommend',
    category: 'tech',
    tags: ['开发', '中文', '架构'],
  },
  {
    name: '极客公园',
    description: '中国科技创新资讯，关注互联网产品和创业',
    rssUrl: '/geekpark/breakingnews',
    category: 'tech',
    tags: ['科技', '中文', '创新'],
  },
  {
    name: '虎嗅',
    description: '商业科技深度报道，关注互联网、消费、投资',
    rssUrl: '/huxiu/article',
    category: 'tech',
    tags: ['商业', '中文', '深度'],
  },
  {
    name: '品玩',
    description: '全球科技生活方式，关注海外科技和消费',
    rssUrl: '/pingwest/home',
    category: 'tech',
    tags: ['科技', '中文', '海外'],
  },
  {
    name: 'Dev.to',
    description: '开发者社区，编程实践、工具推荐、经验分享',
    rssUrl: 'https://dev.to/feed',
    category: 'tech',
    tags: ['开发', '社区', '实践'],
  },
  {
    name: 'CSS-Tricks',
    description: '前端开发技巧，CSS、JavaScript、Web 开发',
    rssUrl: 'https://css-tricks.com/feed/',
    category: 'tech',
    tags: ['前端', 'css', 'web'],
  },
  {
    name: 'Changelog',
    description: '开源和软件开发新闻播客，每周精选',
    rssUrl: 'https://changelog.com/feed',
    category: 'tech',
    tags: ['开源', '开发', '播客'],
  },
  {
    name: 'V2EX',
    description: '创意工作者社区，技术讨论和分享',
    rssUrl: '/v2ex/topics/hot',
    category: 'tech',
    tags: ['社区', '中文', '技术'],
  },

  // ── 跨境电商 ──
  {
    name: 'Shopify Engineering',
    description: 'Shopify 工程博客，技术架构、性能优化、电商基础设施',
    rssUrl: 'https://shopify.engineering/blog.atom',
    category: 'ecommerce',
    tags: ['电商', 'shopify', '工程'],
  },
  {
    name: 'BigCommerce Blog',
    description: 'BigCommerce 博客，电商策略、增长技巧',
    rssUrl: 'https://www.bigcommerce.com/blog/feed/',
    category: 'ecommerce',
    tags: ['电商', 'bigcommerce', '策略'],
  },
  {
    name: '雨果跨境',
    description: '跨境电商资讯平台，覆盖亚马逊、独立站、物流',
    rssUrl: '/cifnews/index',
    category: 'ecommerce',
    tags: ['跨境', '中文', '亚马逊'],
  },
  {
    name: 'Practical Ecommerce',
    description: '电商实战指南，SEO、支付、物流、营销',
    rssUrl: 'https://www.practicalecommerce.com/feed',
    category: 'ecommerce',
    tags: ['电商', '实战', '营销'],
  },
  {
    name: 'Ecommerce Fuel',
    description: '面向高营收独立站创业者的社区和博客',
    rssUrl: 'https://www.ecommercefuel.com/feed/',
    category: 'ecommerce',
    tags: ['电商', '独立站', '创业'],
  },
  {
    name: 'A Better Lemonade Stand',
    description: '独立站创业资源，选品、品牌、营销策略',
    rssUrl: 'https://www.abetterlemonadestand.com/feed/',
    category: 'ecommerce',
    tags: ['电商', '独立站', '选品'],
  },

  // ── 创业 / 产品 ──
  {
    name: 'Product Hunt',
    description: '每日新产品发现，创业者和产品经理必读',
    rssUrl: '/producthunt/today',
    category: 'startup',
    tags: ['产品', '创业', '发现'],
  },
  {
    name: 'Y Combinator Blog',
    description: 'YC 官方博客，创业方法论和 batch 动态',
    rssUrl: 'https://www.ycombinator.com/blog/feed/',
    category: 'startup',
    tags: ['创业', 'yc', '方法论'],
  },
  {
    name: 'Paul Graham Essays',
    description: 'YC 联合创始人的创业思考，经典长文',
    rssUrl: 'http://www.aaronsw.com/2002/feeds/pgessays.rss',
    category: 'startup',
    tags: ['创业', '思考', '长文'],
  },
  {
    name: 'Indie Hackers',
    description: '独立开发者社区，盈利项目案例和经验分享',
    rssUrl: 'https://www.indiehackers.com/feed.xml',
    category: 'startup',
    tags: ['独立开发', '盈利', '社区'],
  },
  {
    name: '小众软件',
    description: '发现实用工具和小而美的软件',
    rssUrl: '/appinn/index',
    category: 'startup',
    tags: ['工具', '中文', '软件'],
  },
  {
    name: 'First Round Review',
    description: '创业公司管理、招聘、产品、增长的深度文章',
    rssUrl: 'https://review.firstround.com/feed.xml',
    category: 'startup',
    tags: ['创业', '管理', '增长'],
  },
  {
    name: '即刻精选',
    description: '即刻社区精选内容，创业、产品、科技',
    rssUrl: '/jike/editor_choice',
    category: 'startup',
    tags: ['社区', '中文', '产品'],
  },

  // ── 综合资讯 ──
  {
    name: 'Wired',
    description: '连线杂志，科技与文化交汇的深度报道',
    rssUrl: 'https://www.wired.com/feed/rss',
    category: 'general',
    tags: ['科技', '文化', '深度'],
  },
  {
    name: '澎湃新闻 - 科技',
    description: '澎湃新闻科技频道，国内外科技热点',
    rssUrl: '/thepaper/channel/25950',
    category: 'general',
    tags: ['新闻', '中文', '科技'],
  },
  {
    name: 'Hacker News Best',
    description: 'YC 社区高票技术文章和讨论',
    rssUrl: '/hackernews/best',
    category: 'general',
    tags: ['技术', '社区', '综合'],
  },
  {
    name: 'Lobsters',
    description: '技术社区，注重高质量的技术讨论',
    rssUrl: 'https://lobste.rs/rss',
    category: 'general',
    tags: ['技术', '社区', '讨论'],
  },
  {
    name: 'Slashdot',
    description: '老牌技术社区，技术新闻和讨论',
    rssUrl: 'https://rss.slashdot.org/Slashdot/slashdotMain',
    category: 'general',
    tags: ['技术', '新闻', '社区'],
  },
  {
    name: 'Solidot',
    description: '奇客资讯，科技新闻聚合',
    rssUrl: 'https://www.solidot.org/index.rss',
    category: 'general',
    tags: ['科技', '中文', '新闻'],
  },
]

// 分类标签映射
export const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI / ML',
  ecommerce: '跨境电商',
  tech: '技术开发',
  startup: '创业 / 产品',
  general: '综合资讯',
}
