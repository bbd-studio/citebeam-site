"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line, Legend,
} from "recharts";
import type { TimelineBundle, UnileverReport } from "../types";

// ── Channel metadata ─────────────────────────────────────────────────
const CHANNELS = [
  { key: "抖音", color: "#FE2C55", desc: "短视频 · 关键词搜索热度", source: "抖音指数 Playwright" },
  { key: "B 站", color: "#00A1D6", desc: "测评 · 长视频 · Z 世代", source: "bilibili-api 公开搜索" },
  { key: "微博", color: "#E6162D", desc: "实时声量 · 公众情感", source: "微博开放平台 (待接)" },
  { key: "小红书", color: "#FF2442", desc: "种草 · 测评 · KOC", source: "千瓜 SaaS (待开通)" },
  { key: "微信公众号", color: "#07C160", desc: "深度内容 · 品牌阵地", source: "新榜 SaaS (待开通)" },
  { key: "知乎", color: "#0084FF", desc: "专业问答 · 长内容", source: "Playwright (待登录)" },
] as const;

type ChannelKey = typeof CHANNELS[number]["key"];

function classifyDomainToChannel(domain: string): ChannelKey | null {
  if (/weixin|mp\.weixin/i.test(domain)) return "微信公众号";
  if (/weibo/i.test(domain)) return "微博";
  if (/zhihu/i.test(domain)) return "知乎";
  if (/bilibili/i.test(domain)) return "B 站";
  if (/xiaohongshu|xhslink/i.test(domain)) return "小红书";
  if (/douyin|toutiao/i.test(domain)) return "抖音";
  return null;
}

// ── Data shapes ──────────────────────────────────────────────────────
type ChannelSeries = {
  brand: string;
  brand_type: "unilever" | "competitor" | "dark_horse";
  channel: string;
  metric_type: string;
  source: string;
  points: { date: string; value: number }[];
};
type TopPost = {
  post_id: string;
  url: string | null;
  title: string | null;
  author: string | null;
  pubdate: string | null;
  duration_s: number | null;
  plays: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  favorites: number | null;
  danmaku: number | null;
  cover_url: string | null;
};
type CategoryQuery = {
  date: string | null;
  query: string;
  brand: string | null;
  is_tracked: boolean;
};
type CategoryVideo = {
  date: string | null;
  item_id: string;
  title: string | null;
  url: string | null;
};
type CategoryOverview = {
  category: string;
  top_videos: CategoryVideo[];
  top_queries: CategoryQuery[];
  dark_horses: { brand: string; mentions: number }[];
};
type Kol = {
  author: string;
  videos: number;
  plays: number;
  likes: number;
  comments: number;
  favorites: number;
  shares: number;
  danmaku: number;
  engagement: number;
  brands_unilever: string[];
  brands_competitor: string[];
  latest_pubdate: string | null;
};
type CompareEntry = {
  videos: number;
  plays: number;
  likes: number;
  comments: number;
  favorites: number;
  avg_plays: number;
  avg_likes: number;
  avg_comments: number;
  engagement_rate: number;
};
type ChannelsBundle = {
  meta: { generated_at: string; n_series: number; n_brands: number; channels: string[]; n_posts?: number; n_authors?: number };
  series: ChannelSeries[];
  per_brand: { brand: string; brand_type: string; channels: Record<string, { latest: number; latest_date: string; mean: number; peak: number; n_points: number }> }[];
  per_channel: Record<string, { n_brands: number; n_metrics: number; n_points: number; sources: string[] }>;
  top_posts?: { brand: string; channel: string; posts: TopPost[] }[];
  category_overview?: CategoryOverview[];
  top_kols?: Kol[];
  compare_unilever_vs_competitor?: { unilever: CompareEntry; competitor: CompareEntry };
};

function fmtN(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString();
}
function fmtDur(s: number | null | undefined): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
function fmtPct(n: number, withSign = true): string {
  if (n == null || isNaN(n)) return "—";
  const sign = n > 0 && withSign ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

// Brand-type tag color
const TYPE_DOT: Record<string, string> = {
  unilever: "text-[#00FF88]",
  competitor: "text-[#FFD166]",
  dark_horse: "text-neutral-400",
};
const TYPE_LABEL: Record<string, string> = {
  unilever: "联合利华",
  competitor: "竞品",
  dark_horse: "黑马",
};

// Color palette per brand for time-series chart
const BRAND_COLORS = [
  "#00FF88", "#FFD166", "#06D6A0", "#118AB2", "#EF476F",
  "#9D8DF1", "#FE2C55", "#E6162D", "#FF2442", "#07C160",
  "#00A1D6", "#0084FF", "#FFA94D", "#22D3EE", "#FB7185",
];


export default function ChannelsPage() {
  const [report, setReport] = useState<UnileverReport | null>(null);
  const [timeline, setTimeline] = useState<TimelineBundle | null>(null);
  const [channels, setChannels] = useState<ChannelsBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChannelKey>("抖音");

  useEffect(() => {
    Promise.all([
      fetch("/data/unilever-summary.json").then((r) => r.json()),
      fetch("/data/unilever-timeline.json").then((r) => r.json()),
      fetch("/data/unilever-channels.json").then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([r, t, c]) => { setReport(r); setTimeline(t); setChannels(c); })
      .catch((e) => setErr(String(e)));
  }, []);

  // AEO signal — citation domain → channel (kept from previous version)
  const aeoSignal = useMemo(() => {
    if (!timeline) return [];
    const counts: Record<ChannelKey, number> = {
      "微博": 0, "小红书": 0, "微信公众号": 0, "抖音": 0, "知乎": 0, "B 站": 0,
    };
    for (const pair of timeline.pairs) {
      for (const c of pair.l2.citations ?? []) {
        if (!c.domain) continue;
        const ch = classifyDomainToChannel(c.domain);
        if (ch) counts[ch] = (counts[ch] ?? 0) + 1;
      }
    }
    return CHANNELS.map((c) => ({
      name: c.key, AEO信号: counts[c.key] ?? 0, color: c.color,
    }));
  }, [timeline]);
  const totalAeoCitations = aeoSignal.reduce((a, b) => a + b.AEO信号, 0);

  // ── Weekly highlights — split into unilever vs competitor ────────────
  // Use API-provided WoW (search_index_wow) when present (more accurate)
  // — fall back to compute (last7 vs prev7) for B站 / channels w/o WoW field.
  const movers = useMemo(() => {
    if (!channels) return { ours: [], theirs: [] };
    type Mover = { brand: string; brand_type: string; channel: string;
                    metric: string; latest: number; delta_pct: number; method: string };
    const out: Mover[] = [];
    // (1) API-provided WoW for 抖音 search/consume/content
    const wowSeries = channels.series.filter((s) => s.metric_type.endsWith("_wow"));
    for (const s of wowSeries) {
      if (s.points.length === 0) continue;
      const latestPoint = s.points[s.points.length - 1];
      // value here is fractional change (e.g. -0.04 = -4%)
      const delta_pct = latestPoint.value * 100;
      const indexBase = s.metric_type.replace("_wow", "_period");
      const baseSeries = channels.series.find(
        (x) => x.brand === s.brand && x.channel === s.channel && x.metric_type === indexBase
      );
      const latestVal = baseSeries?.points[baseSeries.points.length - 1]?.value ?? 0;
      const metric_zh = s.metric_type.startsWith("search") ? "搜索指数"
                       : s.metric_type.startsWith("consume") ? "消费指数"
                       : "内容指数";
      out.push({
        brand: s.brand, brand_type: s.brand_type, channel: s.channel,
        metric: metric_zh, latest: latestVal, delta_pct,
        method: "API WoW",
      });
    }
    // (2) Compute WoW for B站 (no API field) — last 7d sum vs prev 7d sum
    const dailySeries = channels.series.filter((s) =>
      s.channel === "B 站" && (s.metric_type === "total_plays" || s.metric_type === "video_count")
    );
    for (const s of dailySeries) {
      if (s.points.length < 14) continue;
      const lw = s.points.slice(-7).reduce((a, b) => a + b.value, 0);
      const pw = s.points.slice(-14, -7).reduce((a, b) => a + b.value, 0);
      if (pw === 0) continue;
      const delta_pct = ((lw - pw) / pw) * 100;
      const metric_zh = s.metric_type === "total_plays" ? "总播放" : "视频数";
      out.push({
        brand: s.brand, brand_type: s.brand_type, channel: s.channel,
        metric: metric_zh, latest: lw, delta_pct, method: "近7d/上7d",
      });
    }
    out.sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct));
    // Split & take top 5 each (only unilever + competitor — ignore dark_horse)
    const ours = out.filter((m) => m.brand_type === "unilever").slice(0, 8);
    const theirs = out.filter((m) => m.brand_type === "competitor").slice(0, 8);
    return { ours, theirs };
  }, [channels]);

  // ── 抖音 data prep ───────────────────────────────────────────────────
  const douyinChart = useMemo(() => {
    if (!channels) return { data: [], brands: [] };
    // Use either keyword_index (legacy) or search_index (new)
    const series = channels.series.filter((s) =>
      s.channel === "抖音" && (s.metric_type === "search_index" || s.metric_type === "keyword_index")
    );
    if (series.length === 0) return { data: [], brands: [] };
    // Pivot
    const dateMap: Record<string, Record<string, number | string>> = {};
    for (const s of series) {
      for (const p of s.points) {
        if (!dateMap[p.date]) dateMap[p.date] = { date: p.date };
        dateMap[p.date][s.brand] = p.value;
      }
    }
    const data = Object.values(dateMap).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const brands = series.map((s) => s.brand);
    return { data, brands };
  }, [channels]);

  // 抖音 3-index period totals + WoW table
  const douyin3Idx = useMemo(() => {
    if (!channels) return [];
    type Row = {
      brand: string; brand_type: string;
      search: number; consume: number; content: number;
      search_wow: number | null; consume_wow: number | null; content_wow: number | null;
    };
    const map = new Map<string, Row>();
    for (const s of channels.series) {
      if (s.channel !== "抖音") continue;
      const latest = s.points[s.points.length - 1];
      if (!latest) continue;
      const v = latest.value;
      const r = map.get(s.brand) || {
        brand: s.brand, brand_type: s.brand_type,
        search: 0, consume: 0, content: 0,
        search_wow: null, consume_wow: null, content_wow: null,
      };
      if (s.metric_type === "search_index_period") r.search = v;
      else if (s.metric_type === "consume_index_period") r.consume = v;
      else if (s.metric_type === "content_index_period") r.content = v;
      else if (s.metric_type === "search_index_wow") r.search_wow = v * 100;
      else if (s.metric_type === "consume_index_wow") r.consume_wow = v * 100;
      else if (s.metric_type === "content_index_wow") r.content_wow = v * 100;
      map.set(s.brand, r);
    }
    return Array.from(map.values())
      .filter((r) => r.search > 0 || r.consume > 0 || r.content > 0)
      .sort((a, b) => b.search - a.search);
  }, [channels]);

  // B 站 brand-level summary
  const biliBrands = useMemo(() => {
    if (!channels) return [];
    type Row = { brand: string; brand_type: string; n_videos: number; total_plays: number; total_likes: number };
    const map = new Map<string, Row>();
    for (const s of channels.series) {
      if (s.channel !== "B 站") continue;
      const total = s.points.reduce((a, b) => a + b.value, 0);
      const r = map.get(s.brand) || { brand: s.brand, brand_type: s.brand_type, n_videos: 0, total_plays: 0, total_likes: 0 };
      if (s.metric_type === "video_count") r.n_videos = total;
      else if (s.metric_type === "total_plays") r.total_plays = total;
      else if (s.metric_type === "total_likes") r.total_likes = total;
      map.set(s.brand, r);
    }
    return Array.from(map.values())
      .filter((r) => r.n_videos > 0)
      .sort((a, b) => b.total_plays - a.total_plays);
  }, [channels]);

  if (err) return <div className="p-8 text-red-400">加载失败：{err}</div>;
  if (!report) return <div className="p-8 text-neutral-500 font-mono text-sm">loading...</div>;

  const channelsAtv = channels?.meta.channels?.length ?? 0;
  const ourBrandCount = douyin3Idx.filter((r) => r.brand_type === "unilever").length;
  const compBrandCount = douyin3Idx.filter((r) => r.brand_type === "competitor").length;
  const darkBrandCount = douyin3Idx.filter((r) => r.brand_type === "dark_horse").length;

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6">
        <div className="font-mono text-xs text-neutral-500 mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <Link href="/unilever" className="hover:text-[#00FF88]">← 主仪表盘</Link>
            <span className="mx-2 text-neutral-700">/</span>
            <span className="text-[#00FF88]">$</span> channels · CMO 渠道营销看板
          </div>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono ${
            channelsAtv > 0 ? "bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30"
                            : "bg-orange-500/10 text-orange-300 border border-orange-500/30"
          }`}>
            {channelsAtv > 0 ? `v0.7 · ${channelsAtv} 渠道接入中` : "v0 · 数据接入中"}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          CMO 视角 · 渠道营销看板
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-3xl leading-relaxed">
          回答 CMO 每天问的两个问题：<b className="text-neutral-200">"我下个 ¥X 该往哪个渠道投？"</b>
          + <b className="text-neutral-200">"竞品在哪些渠道有动作？"</b>
          监测{ourBrandCount > 0 ? `联合利华 ${ourBrandCount} 个自有品牌 + ${compBrandCount} 个竞品` : "联合利华 + 竞品 + 黑马"}
          在 6 大社交渠道的真实表现。
        </p>
      </div>

      {/* ═══ 投放效果对比 · 我方 vs 竞品（KPI 卡 + 平均互动率图） ═══ */}
      {channels?.compare_unilever_vs_competitor && (
        <section className="mb-8">
          <h2 className="text-lg md:text-xl font-bold mb-1">
            投放效果总结 · 我方 vs 竞品（B 站，{channels.compare_unilever_vs_competitor.unilever.videos + channels.compare_unilever_vs_competitor.competitor.videos} 个相关视频）
          </h2>
          <p className="text-xs text-neutral-500 mb-3">
            数据：B 站近 30 天提到我方/竞品品牌的视频，经 LLM 相关性过滤 (L3 verifier)。每条视频含播放/点赞/评论/收藏。
          </p>
          {(() => {
            const cmp = channels.compare_unilever_vs_competitor!;
            const u = cmp.unilever; const c = cmp.competitor;
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Kpi
                    label="视频数 我方 / 竞品"
                    value={`${u.videos} / ${c.videos}`}
                    sub={`比 ${(u.videos / Math.max(c.videos, 1) * 100).toFixed(0)}%`}
                    hi={u.videos >= c.videos}
                  />
                  <Kpi
                    label="均播放 我方 / 竞品"
                    value={`${Math.round(u.avg_plays).toLocaleString()} / ${Math.round(c.avg_plays).toLocaleString()}`}
                    sub={u.avg_plays >= c.avg_plays ? "我方 ≥ 竞品 ✓" : "我方落后 " + (((c.avg_plays - u.avg_plays) / c.avg_plays * 100).toFixed(0)) + "%"}
                    bad={u.avg_plays < c.avg_plays * 0.7}
                  />
                  <Kpi
                    label="均评论 我方 / 竞品"
                    value={`${u.avg_comments.toFixed(1)} / ${c.avg_comments.toFixed(1)}`}
                    sub={u.avg_comments >= c.avg_comments ? "互动好" : "互动弱"}
                    bad={u.avg_comments < c.avg_comments}
                  />
                  <Kpi
                    label="互动率 我方 / 竞品"
                    value={`${(u.engagement_rate * 100).toFixed(2)}% / ${(c.engagement_rate * 100).toFixed(2)}%`}
                    sub={u.engagement_rate >= c.engagement_rate ? "✓" : "✗"}
                    bad={u.engagement_rate < c.engagement_rate * 0.7}
                  />
                </div>
                {/* Bar chart 4 metric 对比 */}
                <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={[
                      { name: "均播放", "我方": Math.round(u.avg_plays), "竞品": Math.round(c.avg_plays) },
                      { name: "均点赞", "我方": Math.round(u.avg_likes), "竞品": Math.round(c.avg_likes) },
                      { name: "均评论", "我方": Math.round(u.avg_comments * 10) / 10, "竞品": Math.round(c.avg_comments * 10) / 10 },
                      { name: "互动率(‰)", "我方": Math.round(u.engagement_rate * 1000), "竞品": Math.round(c.engagement_rate * 1000) },
                    ]} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                      <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#ccc" fontSize={12} />
                      <YAxis stroke="#666" fontSize={11} />
                      <Tooltip
                        cursor={{ fill: "#1a1a1a" }}
                        contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
                        formatter={(v: unknown) => Number(v).toLocaleString()}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#ccc" }} />
                      <Bar dataKey="我方" fill="#00FF88" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="竞品" fill="#FFD166" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  → CMO 解读：单条视频均互动率 = (赞+评+藏) ÷ 播放 × 1000。我方 vs 竞品 落差大就是优化空间。
                </p>
              </>
            );
          })()}
        </section>
      )}

      {/* ═══ Top KOL · 投放潜力账号排行（CMO 关心的真问题）═══ */}
      {channels?.top_kols && channels.top_kols.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg md:text-xl font-bold mb-1">Top KOL / 投放账号排行（B 站）</h2>
          <p className="text-xs text-neutral-500 mb-3">
            综合得分 = 总播放 + (赞+评+藏) × 30 ｜ 排序看哪些账号已经在覆盖我方/竞品品牌，**值得继续投或反向挖**。
          </p>
          <div className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
                <tr>
                  <th className="py-3 px-4 text-left">#</th>
                  <th className="py-3 px-4 text-left">作者</th>
                  <th className="py-3 px-4 text-right">视频</th>
                  <th className="py-3 px-4 text-right">总播放</th>
                  <th className="py-3 px-4 text-right">点赞</th>
                  <th className="py-3 px-4 text-right">评论</th>
                  <th className="py-3 px-4 text-right">收藏</th>
                  <th className="py-3 px-4 text-left">覆盖我方</th>
                  <th className="py-3 px-4 text-left">覆盖竞品</th>
                </tr>
              </thead>
              <tbody>
                {channels.top_kols.slice(0, 25).map((k, i) => (
                  <tr key={k.author} className="border-b border-neutral-900 hover:bg-[#141414]">
                    <td className="py-3 px-4 text-neutral-500">{i + 1}</td>
                    <td className="py-3 px-4 font-bold text-neutral-100">{k.author}</td>
                    <td className="py-3 px-4 text-right font-mono">{k.videos}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#00FF88] font-bold">
                      {k.plays.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300">{k.likes.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300">{k.comments.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300">{k.favorites.toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs">
                      {k.brands_unilever.length > 0
                        ? k.brands_unilever.map(b => <span key={b} className="text-[#00FF88] mr-1">{b}</span>)
                        : <span className="text-neutral-700">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {k.brands_competitor.length > 0
                        ? k.brands_competitor.map(b => <span key={b} className="text-[#FFD166] mr-1">{b}</span>)
                        : <span className="text-neutral-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            <span className="text-[#00FF88]">绿</span>=覆盖我方（已有合作或自然提及）·
            <span className="text-[#FFD166] mx-1">黄</span>=覆盖竞品（可能可挖）·
            **三类机会**：① 高播+绿绿 = 持续投；② 高播+黄黄 = 找他换合作；③ 高播+无绿无黄 = 中立 KOL，新机会
          </p>
        </section>
      )}

      {/* ═══ 本周亮点 — 我方 / 竞品 拆开看 ═══ */}
      {(movers.ours.length > 0 || movers.theirs.length > 0) && (
        <section className="mb-8">
          <h2 className="text-lg md:text-xl font-bold mb-1">本周亮点</h2>
          <p className="text-xs text-neutral-500 mb-3">
            算法：抖音用 API 返回的<b>周环比 (WoW)</b>（最准）；B 站用<b>近 7 天 vs 上 7 天</b>聚合（自算）。
            只看你品牌 + 已知竞品，黑马见各渠道详情。
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {/* 我方 */}
            <div className="rounded border border-[#00FF88]/30 bg-gradient-to-br from-[#0F0F0F] to-[#0a0a0a] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#00FF88] text-base">●</span>
                <h3 className="text-base font-bold">联合利华自有品牌</h3>
                <span className="text-[10px] text-neutral-500 font-mono ml-auto">
                  {movers.ours.length} 条波动
                </span>
              </div>
              {movers.ours.length === 0 ? (
                <p className="text-xs text-neutral-500">本周无显著波动</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {movers.ours.map((m, i) => {
                    const up = m.delta_pct >= 0;
                    return (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-neutral-200">
                          <span className="font-bold">{m.brand}</span>
                          <span className="text-[10px] text-neutral-500 ml-2 font-mono">
                            [{m.channel} · {m.metric}]
                          </span>
                        </span>
                        <span className={`font-mono font-bold ${up ? "text-[#00FF88]" : "text-orange-400"}`}>
                          {up ? "↑" : "↓"} {fmtPct(m.delta_pct, false)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 竞品 */}
            <div className="rounded border border-[#FFD166]/30 bg-gradient-to-br from-[#0F0F0F] to-[#0a0a0a] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#FFD166] text-base">●</span>
                <h3 className="text-base font-bold">已知竞品动作</h3>
                <span className="text-[10px] text-neutral-500 font-mono ml-auto">
                  {movers.theirs.length} 条波动
                </span>
              </div>
              {movers.theirs.length === 0 ? (
                <p className="text-xs text-neutral-500">本周竞品无显著波动</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {movers.theirs.map((m, i) => {
                    const up = m.delta_pct >= 0;
                    return (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-neutral-200">
                          <span className="font-bold">{m.brand}</span>
                          <span className="text-[10px] text-neutral-500 ml-2 font-mono">
                            [{m.channel} · {m.metric}]
                          </span>
                        </span>
                        <span className={`font-mono font-bold ${up ? "text-[#FFD166]" : "text-neutral-500"}`}>
                          {up ? "↑" : "↓"} {fmtPct(m.delta_pct, false)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 渠道 Tabs ═══ */}
      <section className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4 border-b border-neutral-800 pb-3">
          {CHANNELS.map((c) => {
            const has = (channels?.per_channel?.[c.key]?.n_points ?? 0) > 0;
            const aeo = aeoSignal.find((a) => a.name === c.key)?.AEO信号 ?? 0;
            const isActive = activeTab === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActiveTab(c.key)}
                className={`px-3 py-2 font-mono text-sm rounded transition-all ${
                  isActive
                    ? "text-[#0A0A0A] font-bold"
                    : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
                }`}
                style={isActive ? { background: c.color } : {}}
              >
                <span className="w-2 h-2 rounded inline-block mr-1.5 align-middle" style={{ background: isActive ? "#0A0A0A" : c.color }} />
                {c.key}
                {has ? (
                  <span className={`ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded ${
                    isActive ? "bg-[#0A0A0A]/20" : "bg-[#00FF88]/15 text-[#00FF88]"
                  }`}>已接</span>
                ) : aeo > 0 ? (
                  <span className={`ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded ${
                    isActive ? "bg-[#0A0A0A]/20" : "bg-neutral-800 text-neutral-500"
                  }`}>aeo {aeo}</span>
                ) : (
                  <span className={`ml-1.5 text-[9px] uppercase tracking-wider ${
                    isActive ? "" : "text-neutral-700"
                  }`}>—</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Per-tab content */}
        {activeTab === "抖音" && (
          <DouyinTab chart={douyinChart} idxRows={douyin3Idx} />
        )}
        {activeTab === "B 站" && (
          <BilibiliTab brands={biliBrands} topPosts={channels?.top_posts ?? []} />
        )}
        {activeTab !== "抖音" && activeTab !== "B 站" && (
          <NotConnectedTab channelKey={activeTab} aeo={aeoSignal.find((a) => a.name === activeTab)?.AEO信号 ?? 0} />
        )}
      </section>

      {/* ═══ 抖音品类概览 — top 视频 + top 搜索 + 黑马品牌 ═══ */}
      {channels?.category_overview && channels.category_overview.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg md:text-xl font-bold mb-1">抖音品类概览 · 黑马品牌发现</h2>
          <p className="text-sm text-neutral-400 mb-4">
            按 3 个监测品类（沐浴露 / 洗发水 / 身体乳）拉抖音指数后台的<b>每日 Top 视频 + Top 搜索 query</b>，
            LLM 从 query 里抽出品牌名，<b className="text-orange-300">不在 17 个跟踪竞品里的就标为"黑马"</b>。
            意义：揭露你监测之外正在抢声量的对手。
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {channels.category_overview.map((cat) => (
              <div key={cat.category} className="rounded border border-neutral-800 bg-[#0F0F0F] p-4">
                <h3 className="text-base font-bold text-[#FE2C55] mb-3">
                  {cat.category}
                </h3>

                {cat.dark_horses.length > 0 && (
                  <div className="mb-4">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-orange-300 mb-2">
                      🔥 黑马品牌（未跟踪）
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {cat.dark_horses.map((dh) => (
                        <li key={dh.brand} className="flex items-center justify-between">
                          <span className="text-neutral-100">
                            <span className="text-orange-400 mr-1.5">●</span>
                            {dh.brand}
                          </span>
                          <span className="text-xs font-mono text-neutral-500">×{dh.mentions}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cat.top_queries.length > 0 && (
                  <div className="mb-4">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                      Top 搜索 query
                    </div>
                    <ul className="space-y-1 text-xs">
                      {cat.top_queries.slice(0, 8).map((q, i) => (
                        <li key={i} className="text-neutral-300 truncate">
                          <span className={`mr-1 ${
                            q.brand && q.is_tracked ? "text-[#00FF88]"
                            : q.brand ? "text-orange-400"
                            : "text-neutral-600"
                          }`}>●</span>
                          {q.query}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cat.top_videos.length > 0 && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                      Top 视频 (近 30 天)
                    </div>
                    <ul className="space-y-1 text-xs">
                      {cat.top_videos.slice(0, 5).map((v) => (
                        <li key={v.item_id} className="text-neutral-300">
                          <a href={v.url || "#"} target="_blank" rel="noopener"
                             className="hover:text-[#FE2C55] line-clamp-1 underline-offset-2 hover:underline">
                            {v.title || "(无标题)"}
                          </a>
                          <span className="text-[9px] text-neutral-600 ml-1">{v.date}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500 mt-3">
            <span className="text-[#00FF88]">●</span> 已跟踪品牌 ·
            <span className="text-orange-400 mx-1">●</span> 黑马（未跟踪）·
            <span className="text-neutral-600 mx-1">●</span> 通用词
            ｜ 数据：抖音指数 top_point_list + L3 LLM 品牌抽取
          </p>
        </section>
      )}

      {/* AEO signal — derived from existing citation data */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-1">AEO 渠道信号</h2>
        <p className="text-sm text-neutral-400 mb-3">
          AI 联网回答时引用了哪些渠道的内容（基于现有 {totalAeoCitations} 条引用聚合）。
          → 引用数高的渠道 = AI 在它的信源池里给你份额，AEO 投入 ROI 优先该往那里铺。
        </p>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={aeoSignal} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#ccc" fontSize={12} />
              <YAxis stroke="#666" fontSize={11} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "#1a1a1a" }}
                contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
                formatter={(v) => [`${v} 次 AI 引用`, "AEO 信号"]}
              />
              <Bar dataKey="AEO信号" radius={[4, 4, 0, 0]}>
                {aeoSignal.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="text-xs text-neutral-600 mt-12 pt-4 border-t border-neutral-900">
        AEO 视角看板（产品/调研团队用）→ <Link href="/unilever" className="text-[#00FF88] hover:underline">主仪表盘</Link> ·
        训练数据 vs 联网对比 → <Link href="/unilever/timeline" className="text-[#00FF88] hover:underline">timeline</Link> ·
        运维 → <Link href="/unilever/ops" className="text-[#00FF88] hover:underline">ops</Link>
      </div>
    </main>
  );
}


// ─────────────────────────────────────────────────────────────────────
function DouyinTab({ chart, idxRows }: {
  chart: { data: Record<string, number | string>[]; brands: string[] };
  idxRows: Array<{ brand: string; brand_type: string; search: number; consume: number; content: number;
                    search_wow: number | null; consume_wow: number | null; content_wow: number | null }>;
}) {
  return (
    <div className="space-y-6">
      {/* 3 indices summary table */}
      {idxRows.length > 0 && (
        <div>
          <h3 className="text-base font-bold mb-2">抖音三大指数 · 30 天 totals + 周环比</h3>
          <p className="text-xs text-neutral-500 mb-3">
            <b>搜索指数</b>：用户主动搜你的次数 · <b>消费指数</b>：用户被动看到你的次数 ·
            <b>内容指数</b>：含你品牌的视频被消费的程度。WoW = 周环比。
          </p>
          <div className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
                <tr>
                  <th className="py-3 px-4 text-left">品牌</th>
                  <th className="py-3 px-4 text-right">搜索指数</th>
                  <th className="py-3 px-4 text-right">WoW</th>
                  <th className="py-3 px-4 text-right">消费指数</th>
                  <th className="py-3 px-4 text-right">WoW</th>
                  <th className="py-3 px-4 text-right">内容指数</th>
                  <th className="py-3 px-4 text-right">WoW</th>
                </tr>
              </thead>
              <tbody>
                {idxRows.map((r) => (
                  <tr key={r.brand} className="border-b border-neutral-900 hover:bg-[#141414]">
                    <td className="py-2.5 px-4 font-bold text-neutral-100">
                      <span className={`mr-2 ${TYPE_DOT[r.brand_type]}`}>●</span>
                      {r.brand}
                      <span className="text-[9px] text-neutral-600 ml-1">{TYPE_LABEL[r.brand_type]}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#FE2C55] font-bold">{fmtN(r.search)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono text-xs ${
                      r.search_wow == null ? "text-neutral-700" : r.search_wow >= 0 ? "text-[#00FF88]" : "text-orange-400"
                    }`}>{r.search_wow == null ? "—" : fmtPct(r.search_wow)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-neutral-300">{fmtN(r.consume)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono text-xs ${
                      r.consume_wow == null ? "text-neutral-700" : r.consume_wow >= 0 ? "text-[#00FF88]" : "text-orange-400"
                    }`}>{r.consume_wow == null ? "—" : fmtPct(r.consume_wow)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-neutral-300">{fmtN(r.content)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono text-xs ${
                      r.content_wow == null ? "text-neutral-700" : r.content_wow >= 0 ? "text-[#00FF88]" : "text-orange-400"
                    }`}>{r.content_wow == null ? "—" : fmtPct(r.content_wow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 30 day daily search index line chart */}
      {chart.data.length > 0 && (
        <div>
          <h3 className="text-base font-bold mb-2">搜索指数 · 30 天日趋势（多品牌叠加）</h3>
          <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chart.data} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#666" fontSize={10}
                       tickFormatter={(d: string) => d?.slice(5)} />
                <YAxis stroke="#666" fontSize={11} />
                <Tooltip
                  cursor={{ stroke: "#333" }}
                  contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff", fontSize: 12 }}
                  formatter={(v: unknown) => [Number(v).toLocaleString(), ""]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#ccc" }} />
                {chart.brands.map((b, i) => (
                  <Line key={b} type="monotone" dataKey={b} stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                        strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────
function BilibiliTab({ brands, topPosts }: {
  brands: Array<{ brand: string; brand_type: string; n_videos: number; total_plays: number; total_likes: number }>;
  topPosts: { brand: string; channel: string; posts: TopPost[] }[];
}) {
  const biliPosts = topPosts.filter((tp) => tp.channel === "B 站" && tp.posts.length > 0);
  return (
    <div className="space-y-6">
      {brands.length > 0 && (
        <div>
          <h3 className="text-base font-bold mb-2">B 站 · 品牌相关视频聚合 (近 30 天)</h3>
          <div className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
                <tr>
                  <th className="py-3 px-4 text-left">品牌</th>
                  <th className="py-3 px-4 text-right">视频数</th>
                  <th className="py-3 px-4 text-right">总播放</th>
                  <th className="py-3 px-4 text-right">总点赞</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((r) => (
                  <tr key={r.brand} className="border-b border-neutral-900 hover:bg-[#141414]">
                    <td className="py-2.5 px-4 font-bold text-neutral-100">
                      <span className={`mr-2 ${TYPE_DOT[r.brand_type]}`}>●</span>
                      {r.brand}
                      <span className="text-[9px] text-neutral-600 ml-1">{TYPE_LABEL[r.brand_type]}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{r.n_videos}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#00A1D6] font-bold">{fmtN(r.total_plays)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-neutral-300">{fmtN(r.total_likes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {biliPosts.length > 0 && (
        <div>
          <h3 className="text-base font-bold mb-2">B 站 · 各品牌热门视频</h3>
          <div className="space-y-4">
            {biliPosts.map((tp) => (
              <div key={tp.brand} className="rounded border border-neutral-800 bg-[#0F0F0F] p-4">
                <h4 className="font-bold mb-3 text-neutral-100">
                  <span className="text-[#00A1D6] mr-2">B 站</span> {tp.brand}
                  <span className="text-xs text-neutral-500 ml-2 font-normal">Top {Math.min(tp.posts.length, 6)}</span>
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {tp.posts.slice(0, 6).map((p) => (
                    <a key={p.post_id} href={p.url || "#"} target="_blank" rel="noopener"
                       className="flex gap-3 p-2 rounded border border-neutral-900 hover:border-[#00A1D6]/40 hover:bg-[#141414] transition-colors">
                      {p.cover_url && (
                        // B 站 hotlinks blocked → use referrerpolicy=no-referrer
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.cover_url.startsWith("//") ? `https:${p.cover_url}@320w_200h_1c.webp` : p.cover_url}
                          alt=""
                          className="w-24 h-16 object-cover rounded flex-shrink-0 bg-neutral-900"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-neutral-200 line-clamp-2 mb-1">
                          {p.title || "(无标题)"}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          <span>{p.author || "?"}</span>
                          <span className="mx-1">·</span>
                          <span>{p.pubdate || "?"}</span>
                          {p.duration_s ? <span className="ml-1">· {fmtDur(p.duration_s)}</span> : null}
                        </div>
                        <div className="text-[10px] mt-1 flex gap-2 font-mono text-neutral-400 flex-wrap">
                          <span>▶ {fmtN(p.plays)}</span>
                          <span>👍 {fmtN(p.likes)}</span>
                          <span>💬 {fmtN(p.comments)}</span>
                          <span>★ {fmtN(p.favorites)}</span>
                          {p.danmaku ? <span>弹 {fmtN(p.danmaku)}</span> : null}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, hi, bad }: {
  label: string; value: string; sub?: string; hi?: boolean; bad?: boolean;
}) {
  const color = bad ? "text-red-400" : hi ? "text-[#00FF88]" : "text-neutral-100";
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
      <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`text-lg md:text-2xl font-bold mt-1 break-words ${color}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] md:text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function NotConnectedTab({ channelKey, aeo }: { channelKey: ChannelKey; aeo: number }) {
  const meta = CHANNELS.find((c) => c.key === channelKey)!;
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-8 text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="w-3 h-3 rounded inline-block" style={{ background: meta.color }} />
        <h3 className="text-lg font-bold">{channelKey}</h3>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/30 font-mono ml-2">
          数据接入中
        </span>
      </div>
      <p className="text-sm text-neutral-400 mb-4">{meta.desc}</p>
      {aeo > 0 && (
        <p className="text-xs text-neutral-500">
          → AI 联网回答里引用此渠道 <b className="text-[#00FF88]">{aeo}</b> 次（来自现有 AEO 监测）
        </p>
      )}
    </div>
  );
}
