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
  { key: "微博", color: "#E6162D", desc: "实时声量 · 公众情感", source: "微博开放平台 (待接)" },
  { key: "小红书", color: "#FF2442", desc: "种草 / 测评 / KOC", source: "千瓜 trial (待开通)" },
  { key: "微信公众号", color: "#07C160", desc: "深度内容 / 品牌阵地", source: "新榜 trial (待开通)" },
  { key: "抖音", color: "#FE2C55", desc: "短视频曝光 / 关键词搜索热度", source: "抖音指数 Playwright (✓ 已接)" },
  { key: "知乎", color: "#0084FF", desc: "专业问答 / 长内容", source: "自爬 (collector 待写)" },
  { key: "B 站", color: "#00A1D6", desc: "测评 / 长视频 / Z 世代", source: "自爬 (bbd-crawlers 已有框架)" },
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

// ── Channels bundle (real-channel data, optional — 404 OK) ───────────
type ChannelSeries = {
  brand: string;
  brand_type: "unilever" | "competitor" | "dark_horse";
  channel: string;
  metric_type: string;
  source: string;
  points: { date: string; value: number }[];
};
type ChannelsBundle = {
  meta: { generated_at: string; n_series: number; n_brands: number; channels: string[] };
  series: ChannelSeries[];
  per_brand: { brand: string; brand_type: string; channels: Record<string, { latest: number; latest_date: string; mean: number; peak: number; n_points: number }> }[];
  per_channel: Record<string, { n_brands: number; n_metrics: number; n_points: number; sources: string[] }>;
};

// Color palette per brand for time-series chart (cycle if more brands than colors)
const BRAND_COLORS = [
  "#00FF88", "#FFD166", "#06D6A0", "#118AB2", "#EF476F",
  "#9D8DF1", "#FE2C55", "#E6162D", "#FF2442", "#07C160",
];

export default function ChannelsPage() {
  const [report, setReport] = useState<UnileverReport | null>(null);
  const [timeline, setTimeline] = useState<TimelineBundle | null>(null);
  const [channels, setChannels] = useState<ChannelsBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/unilever-summary.json").then((r) => r.json()),
      fetch("/data/unilever-timeline.json").then((r) => r.json()),
      fetch("/data/unilever-channels.json").then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([r, t, c]) => { setReport(r); setTimeline(t); setChannels(c); })
      .catch((e) => setErr(String(e)));
  }, []);

  // Derive "AEO 渠道信号" from existing citation domains
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
      name: c.key,
      AEO信号: counts[c.key] ?? 0,
      color: c.color,
    }));
  }, [timeline]);

  const totalAeoCitations = aeoSignal.reduce((a, b) => a + b.AEO信号, 0);

  // 抖音 keyword_index time series — pivot to {date, brandA: v, brandB: v, ...}
  const douyinChart = useMemo(() => {
    if (!channels) return { data: [], brands: [] };
    const series = channels.series.filter((s) => s.channel === "抖音" && s.metric_type === "keyword_index");
    if (series.length === 0) return { data: [], brands: [] };
    const brands = series.map((s) => s.brand);
    const dateMap: Record<string, Record<string, number>> = {};
    for (const s of series) {
      for (const p of s.points) {
        if (!dateMap[p.date]) dateMap[p.date] = { date: p.date as unknown as number };
        dateMap[p.date][s.brand] = p.value;
      }
    }
    const data = Object.values(dateMap).sort((a: Record<string, number | string>, b: Record<string, number | string>) =>
      String(a.date).localeCompare(String(b.date))
    );
    return { data, brands };
  }, [channels]);

  // Per-brand summary table for 抖音
  const douyinTable = useMemo(() => {
    if (!channels) return [];
    return channels.per_brand
      .filter((b) => b.channels["抖音.keyword_index"])
      .map((b) => ({
        brand: b.brand,
        brand_type: b.brand_type,
        latest: b.channels["抖音.keyword_index"].latest,
        latest_date: b.channels["抖音.keyword_index"].latest_date,
        mean: b.channels["抖音.keyword_index"].mean,
        peak: b.channels["抖音.keyword_index"].peak,
      }))
      .sort((a, b) => b.latest - a.latest);
  }, [channels]);

  if (err) return <div className="p-8 text-red-400">加载失败：{err}</div>;
  if (!report) return <div className="p-8 text-neutral-500 font-mono text-sm">loading...</div>;

  const hasDouyinData = douyinTable.length > 0;
  const channelsAtv = channels?.meta.channels?.length ?? 0;

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
            channelsAtv > 0
              ? "bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30"
              : "bg-orange-500/10 text-orange-300 border border-orange-500/30"
          }`}>
            {channelsAtv > 0 ? `v0.5 · ${channelsAtv} 渠道接入中` : "v0 · 数据接入中"}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          CMO 视角 · 渠道营销看板
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-3xl leading-relaxed">
          回答 CMO 每天问的两个问题：<b className="text-neutral-200">"我下个 ¥X 该往哪个渠道投？"</b>
          + <b className="text-neutral-200">"竞品在哪些渠道有动作？"</b>
          覆盖 6 大社交渠道：微博 / 小红书 / 微信公众号 / 抖音 / 知乎 / B 站。
        </p>
      </div>

      {/* 抖音 keyword index — REAL DATA ✓ */}
      {hasDouyinData && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg md:text-xl font-bold">抖音 · 品牌关键词搜索热度</h2>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30 font-mono">
              ✓ 真实数据
            </span>
          </div>
          <p className="text-sm text-neutral-400 mb-3">
            抖音指数（"用户主动搜你的次数"）过去 30 天每日热度。数据源：抖音指数 (creator.douyin.com) · 每周自动刷新。
            <span className="text-neutral-500 ml-1">→ 数字大 = 用户主动搜量大 = 你品牌正在被关注；数字降 = 声量在掉，需要内容/投放刺激。</span>
          </p>

          <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={douyinChart.data} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
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
                {douyinChart.brands.map((b, i) => (
                  <Line
                    key={b}
                    type="monotone"
                    dataKey={b}
                    stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Per-brand table */}
          <div className="mt-3 rounded border border-neutral-800 bg-[#0F0F0F] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
                <tr>
                  <th className="py-3 px-4 text-left">品牌</th>
                  <th className="py-3 px-4 text-right">最新指数</th>
                  <th className="py-3 px-4 text-right">30 天均值</th>
                  <th className="py-3 px-4 text-right">30 天峰值</th>
                  <th className="py-3 px-4 text-right">最新日期</th>
                </tr>
              </thead>
              <tbody>
                {douyinTable.map((row) => (
                  <tr key={row.brand} className="border-b border-neutral-900 hover:bg-[#141414]">
                    <td className="py-3 px-4 font-bold text-neutral-100">
                      <span className={`mr-2 ${
                        row.brand_type === "unilever" ? "text-[#00FF88]"
                        : row.brand_type === "competitor" ? "text-[#FFD166]"
                        : "text-neutral-500"
                      }`}>●</span>
                      {row.brand}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#00FF88] font-bold">
                      {Math.round(row.latest).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300">
                      {Math.round(row.mean).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-400">
                      {Math.round(row.peak).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-neutral-500">
                      {row.latest_date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-neutral-500 px-4 py-2 border-t border-neutral-900">
              <span className="text-[#00FF88]">●</span> 联合利华自有 ·
              <span className="text-[#FFD166] mx-1">●</span> 已知竞品 ·
              排序：最新指数从高到低
            </p>
          </div>
        </section>
      )}

      {/* AEO signal — derived from existing citation data */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-1">AEO 渠道信号 · 已上线 ✓</h2>
        <p className="text-sm text-neutral-400 mb-3">
          AI 在联网回答时引用了哪些渠道的内容（基于现有 {totalAeoCitations} 条引用聚合）。
          <span className="text-neutral-500 ml-1">
            → 引用数高的渠道 = AI 在它的信源池里给你份额，AEO 投入 ROI 优先该往那里铺。
          </span>
        </p>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
          <ResponsiveContainer width="100%" height={260}>
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

      {/* Channel cards */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-3">6 大渠道 · 数据接入状态</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHANNELS.map((c) => {
            const aeo = aeoSignal.find((a) => a.name === c.key)?.AEO信号 ?? 0;
            const realChannel = channels?.per_channel?.[c.key];
            const hasReal = !!realChannel;
            return (
              <div key={c.key} className={`rounded border p-4 ${
                hasReal
                  ? "border-[#00FF88]/30 bg-[#0F0F0F]"
                  : "border-neutral-800 bg-[#0F0F0F]"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded" style={{ background: c.color }} />
                    <span className="font-bold text-neutral-100">{c.key}</span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${
                    hasReal ? "bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30" : "bg-neutral-900 text-neutral-500"
                  }`}>
                    {hasReal ? "✓ 已接" : aeo > 0 ? "AEO ✓" : "待接入"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mb-3">{c.desc}</p>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">AI 引用</span>
                    <span className={`font-mono ${aeo > 0 ? "text-[#00FF88]" : "text-neutral-700"}`}>
                      {aeo > 0 ? `${aeo} 次` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">真实渠道数据</span>
                    <span className={`font-mono ${hasReal ? "text-[#00FF88]" : "text-neutral-700"}`}>
                      {hasReal ? `${realChannel.n_brands} 品牌 · ${realChannel.n_points} 数据点` : "— 待接"}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-neutral-600 mt-3 font-mono">数据源：{c.source}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Roadmap */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-3">接入路线图</h2>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-5 text-sm">
          <ol className="space-y-3 list-none pl-0">
            <li>
              <span className="text-[#00FF88] font-bold mr-2">✓ Phase 0 (上线)</span>
              <span className="text-neutral-300">基于现有 AI 引用数据 reframe AEO 渠道信号</span>
            </li>
            <li>
              <span className="text-[#00FF88] font-bold mr-2">✓ Phase 1a</span>
              <span className="text-neutral-300">
                抖音指数 · Playwright + Cookie + AES decrypt · {hasDouyinData ? `${douyinTable.length} 个品牌已落 DB` : "数据加载中"}
              </span>
            </li>
            <li>
              <span className="text-[#FFD166] font-bold mr-2">⏳ Phase 1b (1-2 周)</span>
              <span className="text-neutral-300">
                B 站 + 知乎 (自爬) · 微博 (官方开放平台审核中)
              </span>
            </li>
            <li>
              <span className="text-neutral-500 font-bold mr-2">⏳ Phase 2 (1-2 月)</span>
              <span className="text-neutral-400">
                小红书 (千瓜 ¥3-10w/年) · 微信公众号 (新榜 ¥5-30w/年) · 内容草稿生成 agent
              </span>
            </li>
            <li>
              <span className="text-neutral-500 font-bold mr-2">⏳ Phase 3 (V2)</span>
              <span className="text-neutral-400">
                对接广告投放后台（巨量引擎 / 腾讯广告 / 微信广告）— CMO 看完→直接点投放
              </span>
            </li>
          </ol>
        </div>
      </section>

      <div className="text-xs text-neutral-600 mt-12 pt-4 border-t border-neutral-900">
        现有 AEO 视角看板（产品/调研团队用）→ <Link href="/unilever" className="text-[#00FF88] hover:underline">主仪表盘</Link> ·
        训练数据 vs 联网对比 → <Link href="/unilever/timeline" className="text-[#00FF88] hover:underline">timeline</Link> ·
        运维 → <Link href="/unilever/ops" className="text-[#00FF88] hover:underline">ops</Link>
      </div>
    </main>
  );
}
