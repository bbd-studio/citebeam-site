import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAF7]">
      <section className="max-w-5xl mx-auto px-6 pt-24 md:pt-32 pb-12">
        <p className="font-mono text-sm text-neutral-500 mb-6">
          <span className="text-[#00FF88]">$</span> ./citebeam --help
        </p>
        <h1 className="font-bold text-5xl md:text-7xl tracking-tight leading-[1.05] mb-8">
          Know what AI is saying<br />
          about your <span className="text-[#00FF88]">brand</span>
          <span className="ml-1 inline-block w-3 h-12 bg-[#00FF88] align-middle animate-pulse" />
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 max-w-2xl leading-relaxed mb-10">
          Citebeam monitors your brand across 8 Chinese AI assistants
          (豆包 · Kimi · 通义 · 文心 · DeepSeek · 智谱 · 元宝 · 百度) plus ChatGPT
          and Claude — and answers your questions about the data via chat,
          never by burying you in dashboards.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Link
            href="/chat"
            className="px-6 py-3 bg-[#00FF88] text-[#0A0A0A] hover:opacity-90 rounded font-mono text-sm font-bold transition-opacity"
          >
            open the agent →
          </Link>
          <Link
            href="#how"
            className="px-6 py-3 border border-neutral-700 hover:border-[#00FF88] hover:text-[#00FF88] rounded font-mono text-sm transition-colors"
          >
            see how it works ↓
          </Link>
        </div>
      </section>

      <section id="how" className="border-t border-neutral-900 max-w-5xl mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-2">
          ## what.you.ask
        </p>
        <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-12 max-w-3xl">
          Ask in plain language. Get answers grounded in real data.
        </h2>
        <div className="grid md:grid-cols-2 gap-6 font-mono text-sm">
          {SAMPLE_QUERIES.map((q) => (
            <div
              key={q}
              className="border border-neutral-800 p-5 rounded bg-[#111] hover:border-[#00FF88]/50 transition-colors"
            >
              <span className="text-[#00FF88]">{">"} </span>
              {q}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-900 max-w-5xl mx-auto px-6 py-12 font-mono text-xs text-neutral-500">
        a service line of{" "}
        <a className="text-[#00FF88] hover:underline" href="https://www.bbd.sh">
          bbd.sh studio
        </a>
        &nbsp;·&nbsp; hello@bbd.sh
      </footer>
    </main>
  );
}

const SAMPLE_QUERIES = [
  "我品牌在豆包敏感肌防晒推荐里排第几？",
  "为什么本周比上周排名上升了？",
  "AI 提到我的时候用了哪些形容词？",
  "竞品 X 跟我相比在哪些 prompt 上更强？",
  "豆包 vs 通义 对我的描述有什么差异？",
  "AI 引用了哪些来源在推荐我？",
  "敏感肌人群对我的口碑跟真实小红书评论有差距吗？",
  "我没有 YouTube 投放数据吗？",
];
