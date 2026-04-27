"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import type {
  TimelineBundle, TimelinePair, UnileverReport,
} from "../types";

// ── Brand classification ───────────────────────────────────────────────
type BrandType = "unilever" | "competitor" | "dark_horse";
type BrandMeta = { display: string; type: BrandType };
type BrandIndex = Record<string, BrandMeta>;

type BrandDiff = {
  key: string;
  display: string;
  type: BrandType;
  before: number;   // 训练数据视角命中数
  after: number;    // 联网后视角命中数
  delta: number;    // after - before
};

function buildBrandIndex(report: UnileverReport): BrandIndex {
  const idx: BrandIndex = {};
  for (const cat of Object.values(report.categories)) {
    for (const b of cat.unilever_brands) {
      idx[b.key] = { display: b.display, type: "unilever" };
    }
    for (const b of cat.competitors) {
      // unilever 优先（同 key 不会被 competitor 覆盖）
      if (!idx[b.key]) idx[b.key] = { display: b.display, type: "competitor" };
    }
  }
  return idx;
}

function aggregateBrandDiff(pairs: TimelinePair[], idx: BrandIndex): BrandDiff[] {
  const map = new Map<string, BrandDiff>();
  const get = (b: string): BrandDiff => {
    let cur = map.get(b);
    if (!cur) {
      const meta = idx[b] ?? { display: b, type: "dark_horse" as BrandType };
      cur = { key: b, display: meta.display, type: meta.type, before: 0, after: 0, delta: 0 };
      map.set(b, cur);
    }
    return cur;
  };
  for (const p of pairs) {
    for (const b of p.l1.brand_hits) get(b).before++;
    for (const b of p.l2.brand_hits) get(b).after++;
  }
  const out = Array.from(map.values());
  for (const v of out) v.delta = v.after - v.before;
  // 按"绝对变化最大"排序，平手按总命中数排
  out.sort((a, b) => {
    const d = Math.abs(b.delta) - Math.abs(a.delta);
    if (d !== 0) return d;
    return (b.after + b.before) - (a.after + a.before);
  });
  return out;
}

const TYPE_LABEL: Record<BrandType, string> = {
  unilever: "联合利华",
  competitor: "竞品",
  dark_horse: "黑马",
};
const TYPE_COLOR: Record<BrandType, string> = {
  unilever: "text-[#00FF88]",
  competitor: "text-[#FFD166]",
  dark_horse: "text-neutral-400",
};

export default function TimelinePage() {
  const [data, setData] = useState<TimelineBundle | null>(null);
  const [report, setReport] = useState<UnileverReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      fetch("/data/unilever-timeline.json").then((r) => r.json()),
      fetch("/data/unilever-summary.json").then((r) => r.json()),
    ])
      .then(([d, r]) => { setData(d as TimelineBundle); setReport(r as UnileverReport); })
      .catch((e) => setErr(String(e)));
  }, []);

  const brandIndex = useMemo(() => report ? buildBrandIndex(report) : {}, [report]);

  // 仅保留至少有一边命中的 pair（两边都空就过滤掉）
  const meaningfulPairs = useMemo(() => {
    if (!data) return [];
    return data.pairs.filter(
      (p) => p.l1.brand_hits.length + p.l2.brand_hits.length > 0
    );
  }, [data]);

  const brandDiffs = useMemo(
    () => aggregateBrandDiff(meaningfulPairs, brandIndex),
    [meaningfulPairs, brandIndex]
  );

  const onlyAfter = useMemo(
    () => brandDiffs.filter((b) => b.before === 0 && b.after > 0),
    [brandDiffs]
  );
  const onlyBefore = useMemo(
    () => brandDiffs.filter((b) => b.after === 0 && b.before > 0),
    [brandDiffs]
  );

  // bar chart：取前 12 个变化大的（含 type 用于上色 fallback，但 recharts 直接读 dataKey）
  const chartData = useMemo(
    () => brandDiffs.slice(0, 12).map((b) => ({
      name: b.display.split(" ")[0],
      type: b.type,
      训练数据: b.before,
      联网后: b.after,
    })),
    [brandDiffs]
  );

  const filteredPairs = useMemo(() => {
    if (!data) return [];
    return data.pairs.filter((p) => {
      if (filterPlatform !== "all" && p.platform !== filterPlatform) return false;
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      return true;
    });
  }, [data, filterPlatform, filterCategory]);

  if (err) return <div className="p-8 text-red-400">加载失败：{err}</div>;
  if (!data || !report) return <div className="p-8 text-neutral-500 font-mono text-sm">loading...</div>;

  const m = data.meta;
  const allPlatforms = report.meta.platforms;
  const categories = Array.from(new Set(data.pairs.map((p) => p.category))).sort();
  const pairPlatforms = Array.from(new Set(data.pairs.map((p) => p.platform))).sort();

  const unileverInBoth = brandDiffs.filter((b) => b.type === "unilever").length;
  const competitorInBoth = brandDiffs.filter((b) => b.type === "competitor").length;
  const darkInBoth = brandDiffs.filter((b) => b.type === "dark_horse").length;

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="font-mono text-xs text-neutral-500 mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <Link href="/unilever" className="hover:text-[#00FF88]">← 主仪表盘</Link>
            <span className="mx-2 text-neutral-700">/</span>
            <span className="text-[#00FF88]">$</span> 联网前后 · 品牌可见度变化
          </div>
          <Link
            href="/unilever/chat"
            className="text-[#00FF88]/80 hover:text-[#00FF88] underline-offset-2 hover:underline"
          >
            → 问 Agent
          </Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          AI 联网前后 · 品牌可见度变化
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-3xl leading-relaxed">
          AI 助手默认调用时基于<span className="text-neutral-200">训练数据</span>给推荐；
          用户开启<span className="text-[#00FF88]">实时联网</span>后，AI 会去网上抓最新内容再答。
          这页对比同一条 prompt 在两种模式下，
          <span className="text-neutral-200">推荐了哪些品牌、有什么变化</span>。
          <span className="text-neutral-500 ml-1">
            · 数据时间 {m.first_sample?.slice(0, 10)} → {m.last_sample?.slice(0, 10)}
          </span>
        </p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi
          label="配对答案"
          value={`${m.total_pairs}`}
          sub="同 prompt 两种模式各跑 1 次"
          hi
        />
        <Kpi
          label="实际推荐过的品牌"
          value={brandDiffs.length.toString()}
          sub={`${unileverInBoth} 联合利华 / ${competitorInBoth} 竞品 / ${darkInBoth} 黑马`}
        />
        <Kpi
          label="已接通联网的平台"
          value={`${m.platforms_with_l2.length} / ${allPlatforms.length}`}
          sub={m.platforms_with_l2.join(" · ") || "尚无"}
        />
        <Kpi
          label="联网后引用的网页"
          value={m.total_citations.toLocaleString()}
          sub="可点击追溯到原文"
        />
      </div>

      {/* Brand change bar chart */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-1">品牌可见度 · 联网前 vs 后</h2>
        <p className="text-sm text-neutral-400 mb-4">
          按"两种模式命中差最大"排序。
          <span className="text-[#00FF88] mx-1">●</span>=联合利华自有品牌
          <span className="text-[#FFD166] mx-1">●</span>=已知竞品
          <span className="text-neutral-400 mx-1">●</span>=未追踪黑马
        </p>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
          {chartData.length === 0 ? (
            <p className="text-neutral-500 text-center py-8 text-sm">暂无配对数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(320, 50 * chartData.length)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 30, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#666" fontSize={11} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#ccc" fontSize={13} width={90} />
                <Tooltip
                  cursor={{ fill: "#1a1a1a" }}
                  contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
                  formatter={(v, name) => [`${v} 次命中`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#ccc" }} />
                <Bar dataKey="训练数据" fill="#666" radius={[0, 4, 4, 0]} />
                <Bar dataKey="联网后" fill="#00FF88" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top movers insight */}
        {brandDiffs.length > 0 && (
          <div className="mt-3 rounded border border-neutral-800 bg-[#0F0F0F] p-4">
            <div className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-2">
              最大变动 (Top {Math.min(5, brandDiffs.length)})
            </div>
            <ul className="text-sm space-y-1.5">
              {brandDiffs.slice(0, 5).map((b) => {
                const arrow = b.delta > 0 ? "↑" : b.delta < 0 ? "↓" : "·";
                const arrowColor = b.delta > 0
                  ? "text-[#00FF88]"
                  : b.delta < 0
                  ? "text-orange-400"
                  : "text-neutral-500";
                return (
                  <li key={b.key} className="text-neutral-300">
                    <span className={`${TYPE_COLOR[b.type]} font-bold mr-2`}>●</span>
                    <span className="font-bold">{b.display.split(" ")[0]}</span>
                    <span className="text-neutral-500 mx-1">({TYPE_LABEL[b.type]})</span>
                    ：训练数据 <b>{b.before}</b> 次 → 联网后 <b>{b.after}</b> 次
                    <span className={`ml-2 font-mono ${arrowColor}`}>
                      {arrow} {Math.abs(b.delta)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* New & disappeared brands */}
      {(onlyAfter.length > 0 || onlyBefore.length > 0) && (
        <section className="mb-10 grid md:grid-cols-2 gap-4">
          <BrandColumn
            title="联网后冒出的品牌"
            arrow="⤴"
            arrowColor="text-[#00FF88]"
            countColor="text-[#00FF88]"
            count={onlyAfter.length}
            note="训练数据里 AI 不会推，但联网后开始推 — 来自外部内容（评测 / 电商 / 媒体）的影响"
            items={onlyAfter.map((b) => ({ key: b.key, display: b.display, type: b.type, n: b.after, sign: "+" }))}
          />
          <BrandColumn
            title="联网后消失的品牌"
            arrow="⤵"
            arrowColor="text-orange-400"
            countColor="text-orange-400"
            count={onlyBefore.length}
            note="训练数据里被推过，但联网后 AI 转头推别的 — 网上声量没跟上的品牌"
            items={onlyBefore.map((b) => ({ key: b.key, display: b.display, type: b.type, n: b.before, sign: "-" }))}
          />
        </section>
      )}

      {/* Per-platform 联网状态 (no cost / latency / models) */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-1">平台联网状态</h2>
        <p className="text-sm text-neutral-400 mb-3">
          已经接通联网搜索的平台 — 这些平台能拿到 AI 联网时引用的真实 URL，可以追溯品牌从哪个网站被推出来。
        </p>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
              <tr>
                <th className="py-3 px-4 text-left">平台</th>
                <th className="py-3 px-4 text-left">联网状态</th>
                <th className="py-3 px-4 text-right">联网答案</th>
                <th className="py-3 px-4 text-right">引用网页数</th>
              </tr>
            </thead>
            <tbody>
              {data.by_platform.map((p) => (
                <tr key={p.platform} className="border-b border-neutral-900 hover:bg-[#141414]">
                  <td className="py-3 px-4 font-bold text-neutral-200">{p.platform}</td>
                  <td className="py-3 px-4">
                    {p.has_l2 ? (
                      <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30">
                        ✓ 已接通联网
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-800/40 text-neutral-500 border border-neutral-800">
                        — 仅训练数据
                      </span>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${p.l2_ok ? "text-[#00FF88]" : "text-neutral-700"}`}>
                    {p.l2_ok || "—"}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${p.citations ? "text-neutral-200" : "text-neutral-700"}`}>
                    {p.citations || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pairs evidence */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-bold">配对答案证据</h2>
            <p className="text-xs text-neutral-500 mt-1">
              展开看 AI 在两种模式下的原话差异（{filteredPairs.length} / {m.total_pairs} 组）
            </p>
          </div>
          <div className="flex gap-2 text-xs font-mono">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="bg-[#0F0F0F] border border-neutral-800 rounded px-2 py-1 text-neutral-300"
            >
              <option value="all">所有平台</option>
              {pairPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-[#0F0F0F] border border-neutral-800 rounded px-2 py-1 text-neutral-300"
            >
              <option value="all">所有类目</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {filteredPairs.length === 0 ? (
          <div className="text-neutral-500 text-sm font-mono p-8 text-center border border-neutral-800 rounded">
            无符合条件的配对答案
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPairs.map((pair) => (
              <PairCard
                key={`${pair.prompt_id}-${pair.platform}`}
                pair={pair}
                brandIndex={brandIndex}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}


// ── small components ────────────────────────────────────────────────────

function Kpi({ label, value, sub, hi }: {
  label: string; value: string; sub?: string; hi?: boolean;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
      <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`text-xl md:text-3xl font-bold mt-1 break-words ${
        hi ? "text-[#00FF88]" : "text-neutral-100"
      }`}>
        {value}
      </div>
      {sub && <div className="text-[10px] md:text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function BrandColumn({
  title, arrow, arrowColor, count, countColor, note, items,
}: {
  title: string;
  arrow: string;
  arrowColor: string;
  count: number;
  countColor: string;
  note: string;
  items: { key: string; display: string; type: BrandType; n: number; sign: "+" | "-" }[];
}) {
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-4">
      <div className="flex items-center mb-2">
        <span className={`${arrowColor} font-bold text-lg mr-2`}>{arrow}</span>
        <h3 className="text-base font-bold">{title}</h3>
        <span className={`ml-2 text-xs font-mono ${countColor}`}>({count})</span>
      </div>
      <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{note}</p>
      {items.length === 0 ? (
        <p className="text-neutral-600 text-sm">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.slice(0, 12).map((b) => (
            <li key={b.key} className="flex items-center justify-between">
              <span className="text-neutral-200">
                <span className={`mr-1.5 ${TYPE_COLOR[b.type]}`}>●</span>
                {b.display.split(" ")[0]}
                <span className="text-neutral-500 text-xs ml-2">({TYPE_LABEL[b.type]})</span>
              </span>
              <span className={`font-mono text-xs ${countColor}`}>
                {b.sign}{b.n}
              </span>
            </li>
          ))}
          {items.length > 12 && (
            <li className="text-neutral-600 text-xs italic">… 另 {items.length - 12} 个</li>
          )}
        </ul>
      )}
    </div>
  );
}


function PairCard({ pair, brandIndex }: { pair: TimelinePair; brandIndex: BrandIndex }) {
  const onlyL2 = pair.diff.only_l2;
  const onlyL1 = pair.diff.only_l1;
  const both = pair.diff.both;
  const movedNeedle = onlyL1.length + onlyL2.length > 0;

  function tagFor(key: string) {
    const meta = brandIndex[key] ?? { display: key, type: "dark_horse" as BrandType };
    return {
      name: meta.display.split(" ")[0],
      color: TYPE_COLOR[meta.type],
    };
  }

  return (
    <article className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 bg-[#0a0a0a] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-neutral-500">[{pair.platform}]</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">{pair.category}</span>
          {movedNeedle && (
            <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded
                             bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30">
              品牌差异
            </span>
          )}
        </div>
      </div>

      {/* Prompt */}
      <div className="px-4 py-3 border-b border-neutral-900 text-sm text-neutral-300">
        <span className="font-mono text-xs text-neutral-500 mr-2">用户问：</span>
        {pair.prompt}
      </div>

      {/* Diff chips */}
      {(onlyL2.length > 0 || onlyL1.length > 0 || both.length > 0) && (
        <div className="px-4 py-3 border-b border-neutral-900 space-y-1.5 text-xs">
          {onlyL2.length > 0 && (
            <div>
              <span className="text-[#00FF88] font-mono mr-2">联网后新增 ({onlyL2.length})：</span>
              {onlyL2.map((b) => {
                const t = tagFor(b);
                return <span key={b} className={`mr-2 ${t.color}`}>{t.name}</span>;
              })}
            </div>
          )}
          {onlyL1.length > 0 && (
            <div>
              <span className="text-orange-400 font-mono mr-2">联网后消失 ({onlyL1.length})：</span>
              {onlyL1.map((b) => {
                const t = tagFor(b);
                return <span key={b} className={`mr-2 ${t.color}`}>{t.name}</span>;
              })}
            </div>
          )}
          {both.length > 0 && (
            <div>
              <span className="text-neutral-500 font-mono mr-2">两种都有 ({both.length})：</span>
              {both.map((b) => {
                const t = tagFor(b);
                return <span key={b} className={`mr-2 ${t.color}`}>{t.name}</span>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Side-by-side */}
      <div className="grid md:grid-cols-2">
        {/* Default (was L1) */}
        <div className="p-4 md:border-r border-b md:border-b-0 border-neutral-800">
          <div className="mb-2 text-xs font-mono text-neutral-400">
            <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 mr-2">默认</span>
            AI 默认回答（基于训练数据）
          </div>
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
            {pair.l1.excerpt || "(无答案)"}
          </p>
        </div>

        {/* Web (was L2) */}
        <div className="p-4">
          <div className="mb-2 text-xs font-mono text-[#00FF88]">
            <span className="px-1.5 py-0.5 rounded bg-[#00FF88]/15 text-[#00FF88] mr-2">联网</span>
            AI 联网后回答（带实时网页）
          </div>
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
            {pair.l2.excerpt || "(无答案)"}
          </p>
          {pair.l2.citations && pair.l2.citations.length > 0 && (
            <details className="mt-3 pt-3 border-t border-neutral-900 text-xs">
              <summary className="cursor-pointer text-neutral-500 hover:text-[#00FF88] font-mono">
                ▸ AI 引用了 {pair.l2.citations.length} 个网页
              </summary>
              <ul className="mt-2 space-y-1">
                {pair.l2.citations.slice(0, 8).map((c, i) => (
                  <li key={i} className="text-neutral-400">
                    <span className="text-neutral-600 mr-1">[{c.position ?? i + 1}]</span>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener" className="hover:text-[#00FF88]">
                        {c.title || c.url}
                      </a>
                    ) : (c.title || "(no url)")}
                    {c.domain && <span className="text-neutral-600 ml-1">— {c.domain}</span>}
                  </li>
                ))}
                {pair.l2.citations.length > 8 && (
                  <li className="text-neutral-600 text-[10px]">
                    … 另 {pair.l2.citations.length - 8} 条
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
