"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import type { TimelineBundle, UnileverReport } from "../types";

// ── Channel metadata ─────────────────────────────────────────────────
const CHANNELS = [
  { key: "微博", color: "#E6162D", desc: "实时声量 · 公众情感", source: "微博开放平台 (待接)" },
  { key: "小红书", color: "#FF2442", desc: "种草 / 测评 / KOC", source: "千瓜 trial (待开通)" },
  { key: "微信公众号", color: "#07C160", desc: "深度内容 / 品牌阵地", source: "新榜 trial (待开通)" },
  { key: "抖音", color: "#FE2C55", desc: "短视频曝光 / 互动率", source: "抖音指数 Playwright (待登录)" },
  { key: "知乎", color: "#0084FF", desc: "专业问答 / 长内容", source: "自爬 (collector 待写)" },
  { key: "B 站", color: "#00A1D6", desc: "测评 / 长视频 / Z 世代", source: "自爬 (bbd-crawlers 已有框架)" },
] as const;

type ChannelKey = typeof CHANNELS[number]["key"];

// Domain → channel mapping (so we can derive AEO 渠道信号 from existing citation data)
function classifyDomainToChannel(domain: string): ChannelKey | null {
  if (/weixin|mp\.weixin/i.test(domain)) return "微信公众号";
  if (/weibo/i.test(domain)) return "微博";
  if (/zhihu/i.test(domain)) return "知乎";
  if (/bilibili/i.test(domain)) return "B 站";
  if (/xiaohongshu|xhslink/i.test(domain)) return "小红书";
  if (/douyin|toutiao/i.test(domain)) return "抖音";
  return null;
}

export default function ChannelsPage() {
  const [report, setReport] = useState<UnileverReport | null>(null);
  const [timeline, setTimeline] = useState<TimelineBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/unilever-summary.json").then((r) => r.json()),
      fetch("/data/unilever-timeline.json").then((r) => r.json()),
    ])
      .then(([r, t]) => { setReport(r); setTimeline(t); })
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

  if (err) return <div className="p-8 text-red-400">加载失败：{err}</div>;
  if (!report) return <div className="p-8 text-neutral-500 font-mono text-sm">loading...</div>;

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6">
        <div className="font-mono text-xs text-neutral-500 mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <Link href="/unilever" className="hover:text-[#00FF88]">← 主仪表盘</Link>
            <span className="mx-2 text-neutral-700">/</span>
            <span className="text-[#00FF88]">$</span> channels · CMO 渠道营销看板
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/30 font-mono">
            v0 · 数据接入中
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
        <div className="mt-3 rounded border border-orange-900/50 bg-orange-950/20 px-4 py-3 text-xs text-orange-200/90 leading-relaxed">
          <b className="text-orange-300">⚠ 当前 v0 状态</b>
          ：真实渠道数据正在分批接入（千瓜 / 新榜 trial 申请 + 抖音指数 cookie 配置 + 微博开放平台审核）。
          下方"AEO 信号"区块基于现有 AI 引用数据 reframe 而成，可以提前看出哪些渠道在 AI 信源池里有份额。
          其余区块陆续上线。
        </div>
      </div>

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

      {/* Channel cards — placeholder until real data lands */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-3">6 大渠道 · 数据接入状态</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHANNELS.map((c) => {
            const aeo = aeoSignal.find((a) => a.name === c.key)?.AEO信号 ?? 0;
            return (
              <div key={c.key} className="rounded border border-neutral-800 bg-[#0F0F0F] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded" style={{ background: c.color }} />
                    <span className="font-bold text-neutral-100">{c.key}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-500 font-mono">
                    {aeo > 0 ? "AEO ✓" : "待接入"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mb-3">{c.desc}</p>

                {/* What we have today */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">AI 引用 (现有)</span>
                    <span className={`font-mono ${aeo > 0 ? "text-[#00FF88]" : "text-neutral-700"}`}>
                      {aeo > 0 ? `${aeo} 次` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">真实曝光</span>
                    <span className="font-mono text-neutral-700">— 待接</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">真实互动</span>
                    <span className="font-mono text-neutral-700">— 待接</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">竞品动作</span>
                    <span className="font-mono text-neutral-700">— 待接</span>
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
              <span className="text-neutral-300">基于现有 AI 引用数据 reframe AEO 渠道信号（即上方图）</span>
            </li>
            <li>
              <span className="text-[#FFD166] font-bold mr-2">⏳ Phase 1 (1-2 周)</span>
              <span className="text-neutral-300">
                抖音指数 (Playwright + 用户 cookie) ·
                B 站 + 知乎 (自爬) ·
                微博 (官方开放平台审核中)
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
