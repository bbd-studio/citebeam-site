"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import type { TimelineBundle, TimelinePair, PlatformRollup } from "../types";

export default function TimelinePage() {
  const [data, setData] = useState<TimelineBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    fetch("/data/unilever-timeline.json")
      .then((r) => r.json())
      .then((d: TimelineBundle) => setData(d))
      .catch((e) => setErr(String(e)));
  }, []);

  const filteredPairs = useMemo(() => {
    if (!data) return [];
    return data.pairs.filter((p) => {
      if (filterPlatform !== "all" && p.platform !== filterPlatform) return false;
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      return true;
    });
  }, [data, filterPlatform, filterCategory]);

  if (err) return <div className="p-8 text-red-400">加载失败：{err}</div>;
  if (!data) return <div className="p-8 text-neutral-500 font-mono text-sm">loading...</div>;

  const m = data.meta;
  const categories = Array.from(new Set(data.pairs.map((p) => p.category))).sort();
  const platforms = Array.from(new Set(data.pairs.map((p) => p.platform))).sort();

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Hero */}
      <div className="mb-6">
        <div className="font-mono text-xs text-neutral-500 mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <Link href="/unilever" className="hover:text-[#00FF88]">← 主仪表盘</Link>
            <span className="mx-2 text-neutral-700">/</span>
            <span className="text-[#00FF88]">$</span> timeline · L1 vs L2 (web_search) 对比
          </div>
          <Link
            href="/unilever/chat"
            className="text-[#00FF88]/80 hover:text-[#00FF88] underline-offset-2 hover:underline"
          >
            → 问 Agent (含 timeline 数据)
          </Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          联网前 vs 联网后 · 时间线对比
        </h1>
        <p className="text-neutral-400 text-sm max-w-3xl leading-relaxed">
          <span className="text-neutral-300">L1</span> = 裸调用 AI（训练数据视角）·
          <span className="text-[#00FF88] ml-2">L2</span> = 带 web_search 工具（实时联网视角）。
          同一条 prompt × 同一家平台两边都跑，看 AI 的回答和品牌推荐有什么差异。
          <span className="text-neutral-500 ml-1">
            · 数据时间 {m.first_sample?.slice(0, 10)} → {m.last_sample?.slice(0, 10)}
          </span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Kpi label="L1 sample" value={m.total_l1.toLocaleString()}
             sub={`${m.total_l1_errors} 错误`} dim />
        <Kpi label="L2 sample (联网)" value={m.total_l2.toLocaleString()}
             sub={`${m.total_l2_errors} 错误`} hi />
        <Kpi label="引用源" value={m.total_citations.toLocaleString()}
             sub="L2 抓回的 URL 数" hi />
        <Kpi label="paired prompts"
             value={m.total_pairs.toString()}
             sub="同 prompt L1+L2 都有" />
        <Kpi label="L2 平台"
             value={m.platforms_with_l2.length.toString()}
             sub={m.platforms_with_l2.join(" · ")} />
      </div>

      {/* Timeline chart */}
      <section className="mb-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
          ## sample / day — L1 vs L2
        </h2>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.timeline} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} />
              <Tooltip
                cursor={{ fill: "#1a1a1a" }}
                contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#ccc" }} />
              <Bar dataKey="l1" name="L1 (裸 AI)" stackId="a" fill="#666" />
              <Bar dataKey="l2" name="L2 (+web_search)" stackId="a" fill="#00FF88" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Per-platform rollup */}
      <section className="mb-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
          ## 平台覆盖
        </h2>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
              <tr>
                <th className="py-3 px-4 text-left">平台</th>
                <th className="py-3 px-4 text-right">L1 ok</th>
                <th className="py-3 px-4 text-right">L2 ok</th>
                <th className="py-3 px-4 text-right">引用</th>
                <th className="py-3 px-4 text-left">model</th>
              </tr>
            </thead>
            <tbody>
              {data.by_platform.map((p) => <PlatformRow key={p.platform} p={p} />)}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pairs */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-500">
            ## L1 vs L2 配对答案 ({filteredPairs.length}/{m.total_pairs})
          </h2>
          <div className="flex gap-2 text-xs font-mono">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="bg-[#0F0F0F] border border-neutral-800 rounded px-2 py-1 text-neutral-300"
            >
              <option value="all">所有平台</option>
              {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
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
            (no pairs match filters — try broadening)
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPairs.map((pair) => <PairCard key={`${pair.prompt_id}-${pair.platform}`} pair={pair} />)}
          </div>
        )}
      </section>
    </main>
  );
}


function Kpi({ label, value, sub, hi, dim }: {
  label: string; value: string; sub?: string; hi?: boolean; dim?: boolean;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
      <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`text-xl md:text-3xl font-bold mt-1 break-words ${
        hi ? "text-[#00FF88]" : dim ? "text-neutral-400" : "text-neutral-100"
      }`}>
        {value}
      </div>
      {sub && <div className="text-[10px] md:text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}


function PlatformRow({ p }: { p: PlatformRollup }) {
  return (
    <tr className="border-b border-neutral-900 hover:bg-[#141414]">
      <td className="py-3 px-4 font-bold text-neutral-200">
        {p.platform}
        {p.has_l2 && (
          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded
                           border border-[#00FF88]/40 text-[#00FF88] bg-[#00FF88]/5">
            🔍 L2
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right font-mono text-neutral-300">
        {p.l1_ok}
        {p.l1_err > 0 && <span className="text-red-400 text-xs ml-1">({p.l1_err} err)</span>}
      </td>
      <td className={`py-3 px-4 text-right font-mono ${p.l2_ok ? "text-[#00FF88]" : "text-neutral-700"}`}>
        {p.l2_ok || "—"}
        {p.l2_err > 0 && <span className="text-red-400 text-xs ml-1">({p.l2_err} err)</span>}
      </td>
      <td className="py-3 px-4 text-right font-mono text-neutral-300">
        {p.citations || "—"}
      </td>
      <td className="py-3 px-4 font-mono text-xs text-neutral-500">
        {p.models.join(", ")}
      </td>
    </tr>
  );
}


function PairCard({ pair }: { pair: TimelinePair }) {
  const onlyL2 = pair.diff.only_l2;
  const onlyL1 = pair.diff.only_l1;
  const both = pair.diff.both;
  const movedNeedle = onlyL1.length + onlyL2.length > 0;

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
              has diff
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-neutral-600">
          prompt #{pair.prompt_id}
        </div>
      </div>

      {/* Prompt */}
      <div className="px-4 py-3 border-b border-neutral-900 text-sm text-neutral-300">
        <span className="font-mono text-xs text-neutral-500 mr-2">Q:</span>
        {pair.prompt}
      </div>

      {/* Diff summary chips */}
      {(onlyL2.length > 0 || onlyL1.length > 0 || both.length > 0) && (
        <div className="px-4 py-2 border-b border-neutral-900 flex flex-wrap gap-2 text-xs font-mono">
          {onlyL2.length > 0 && (
            <span className="text-[#00FF88]">
              only-L2 ({onlyL2.length}): {onlyL2.join(", ")}
            </span>
          )}
          {onlyL1.length > 0 && (
            <span className="text-orange-400">
              only-L1 ({onlyL1.length}): {onlyL1.join(", ")}
            </span>
          )}
          {both.length > 0 && (
            <span className="text-neutral-500">
              ∩ ({both.length}): {both.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Side-by-side */}
      <div className="grid md:grid-cols-2">
        {/* L1 */}
        <div className="p-4 md:border-r border-b md:border-b-0 border-neutral-800">
          <div className="flex items-center justify-between mb-2 text-xs font-mono">
            <span className="uppercase tracking-wider text-neutral-400">
              <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 mr-2">L1</span>
              裸 AI · {pair.l1.model}
            </span>
            <span className="text-neutral-600">{pair.l1.created_at?.slice(0, 16)}</span>
          </div>
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
            {pair.l1.excerpt || "(empty answer)"}
          </p>
          <div className="mt-3 pt-3 border-t border-neutral-900 text-xs text-neutral-500 font-mono">
            in {pair.l1.input_tokens} · out {pair.l1.output_tokens} · {pair.l1.latency_ms}ms · ¥{pair.l1.cost_cny.toFixed(5)}
          </div>
        </div>

        {/* L2 */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2 text-xs font-mono">
            <span className="uppercase tracking-wider text-[#00FF88]">
              <span className="px-1.5 py-0.5 rounded bg-[#00FF88]/15 text-[#00FF88] mr-2">L2 🔍</span>
              +web_search · {pair.l2.model}
            </span>
            <span className="text-neutral-600">{pair.l2.created_at?.slice(0, 16)}</span>
          </div>
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
            {pair.l2.excerpt || "(empty answer)"}
          </p>
          {pair.l2.citations && pair.l2.citations.length > 0 && (
            <details className="mt-3 pt-3 border-t border-neutral-900 text-xs">
              <summary className="cursor-pointer text-neutral-500 hover:text-[#00FF88] font-mono">
                ▸ {pair.l2.citations.length} 条引用
              </summary>
              <ul className="mt-2 space-y-1">
                {pair.l2.citations.slice(0, 8).map((c, i) => (
                  <li key={i} className="text-neutral-400">
                    <span className="text-neutral-600 mr-1">[{c.position ?? i+1}]</span>
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
          <div className="mt-3 pt-3 border-t border-neutral-900 text-xs text-neutral-500 font-mono">
            in {pair.l2.input_tokens} · out {pair.l2.output_tokens} · {pair.l2.latency_ms}ms · ¥{pair.l2.cost_cny.toFixed(5)}
          </div>
        </div>
      </div>
    </article>
  );
}
