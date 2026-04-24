"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  CartesianGrid, Legend,
} from "recharts";
import type { CategoryReport, BrandStat } from "../types";
import { StrengthsWeaknesses } from "./StrengthsWeaknesses";

const TIER_COLOR: Record<string, string> = {
  "高端": "#FFD166",
  "大众": "#00FF88",
  "低价": "#4ECDC4",
};

const PLATFORM_COLOR: Record<string, string> = {
  "豆包": "#FF5E3A",
  "智谱 GLM": "#00FF88",
  "Kimi": "#FFD166",
  "MiniMax": "#4ECDC4",
};

export function CategoryPanel({ cat, r }: { cat: string; r: CategoryReport }) {
  const unileverBars = r.unilever_brands
    .map((b) => ({
      name: b.display.split(" ")[0],
      提及率: +(b.mention_rate * 100).toFixed(1),
      提及次数: b.mentions,
      tier: b.tier,
    }));

  const competitorBars = r.competitors
    .map((b) => ({
      name: b.display.split(" ")[0],
      提及率: +(b.mention_rate * 100).toFixed(1),
      提及次数: b.mentions,
      tier: b.tier,
    }));

  const platformRows = r.platform_stats.map((p) => ({
    name: p.platform,
    带品牌回答占比: +(p.mention_rate * 100).toFixed(1),
    平均延迟_s: +(p.avg_latency_ms / 1000).toFixed(1),
    errors: p.errors,
    total: p.total,
  }));

  // Radar data per tier: avg mention rate
  const tierRadar: { tier: string; 联合利华: number; 竞品: number }[] = [];
  for (const tier of ["高端", "大众", "低价"]) {
    const uTier = r.unilever_brands.filter((b) => b.tier === tier);
    const cTier = r.competitors.filter((b) => b.tier === tier);
    const uAvg = uTier.length ? uTier.reduce((a, b) => a + b.mention_rate, 0) / uTier.length : 0;
    const cAvg = cTier.length ? cTier.reduce((a, b) => a + b.mention_rate, 0) / cTier.length : 0;
    tierRadar.push({
      tier,
      "联合利华": +(uAvg * 100).toFixed(1),
      "竞品": +(cAvg * 100).toFixed(1),
    });
  }

  return (
    <div className="space-y-8">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <Kpi label="查询数" value={r.n_queries.toString()} />
        <Kpi label="独立 Prompt" value={r.unique_prompts.toString()} />
        <Kpi
          label="联合利华最强提及率"
          value={`${((r.unilever_brands[0]?.mention_rate ?? 0) * 100).toFixed(1)}%`}
          sub={r.unilever_brands[0]?.display.split(" ")[0] ?? "—"}
        />
        <Kpi
          label="失守 Prompt"
          value={`${r.failed_prompts.length}/${r.unique_prompts}`}
          sub={`${((r.failed_prompts.length / r.unique_prompts) * 100).toFixed(0)}% 没推联合利华`}
          bad
        />
      </div>

      {/* Bars: Unilever brands */}
      <div className="rounded border border-neutral-800 p-3 md:p-4 bg-[#0F0F0F]">
        <h3 className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
          联合利华品牌提及率（{cat}）
        </h3>
        <ResponsiveContainer width="100%" height={180 + 40 * Math.max(1, unileverBars.length)}>
          <BarChart data={unileverBars} layout="vertical" margin={{ left: 8, right: 30 }}>
            <CartesianGrid stroke="#222" strokeDasharray="3 3" />
            <XAxis type="number" stroke="#666" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="#ccc" fontSize={14} width={90} />
            <Tooltip
              cursor={{ fill: "#1a1a1a" }}
              contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
            />
            <Bar dataKey="提及率" unit="%" fill="#00FF88" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bars: competitors */}
      {competitorBars.length > 0 && (
        <div className="rounded border border-neutral-800 p-3 md:p-4 bg-[#0F0F0F]">
          <h3 className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
            竞品 SoV（{cat}，仅列有提及的）
          </h3>
          <ResponsiveContainer width="100%" height={180 + 35 * competitorBars.length}>
            <BarChart data={competitorBars} layout="vertical" margin={{ left: 8, right: 30 }}>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" />
              <XAxis type="number" stroke="#666" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#ccc" fontSize={13} width={110} />
              <Tooltip
                cursor={{ fill: "#1a1a1a" }}
                contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
              />
              <Bar dataKey="提及率" unit="%" fill="#FFD166" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two-column: platforms + tier radar */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded border border-neutral-800 p-3 md:p-4 bg-[#0F0F0F]">
          <h3 className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
            平台表现
          </h3>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono">
              <tr>
                <th className="py-2 text-left">平台</th>
                <th className="py-2 text-right">带品牌</th>
                <th className="py-2 text-right">延迟</th>
                <th className="py-2 text-right">错误</th>
              </tr>
            </thead>
            <tbody>
              {platformRows.map((p) => (
                <tr key={p.name} className="border-b border-neutral-900">
                  <td className="py-3">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                      style={{ background: PLATFORM_COLOR[p.name] ?? "#999" }}
                    />
                    {p.name}
                  </td>
                  <td className="py-3 text-right font-mono">{p.带品牌回答占比}%</td>
                  <td className="py-3 text-right font-mono text-neutral-400">{p.平均延迟_s}s</td>
                  <td className="py-3 text-right font-mono text-neutral-400">
                    {p.errors}/{p.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded border border-neutral-800 p-3 md:p-4 bg-[#0F0F0F]">
          <h3 className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
            档位对比（平均提及率）
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={tierRadar}>
              <PolarGrid stroke="#333" />
              <PolarAngleAxis dataKey="tier" stroke="#ccc" fontSize={13} />
              <PolarRadiusAxis stroke="#555" fontSize={10} />
              <Radar name="联合利华" dataKey="联合利华" stroke="#00FF88" fill="#00FF88" fillOpacity={0.35} />
              <Radar name="竞品" dataKey="竞品" stroke="#FFD166" fill="#FFD166" fillOpacity={0.25} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#ccc" }} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strengths / weaknesses by dimension */}
      {r.strengths_weaknesses && (
        <StrengthsWeaknesses
          cat={cat}
          brands={r.unilever_brands}
          sw={r.strengths_weaknesses}
        />
      )}

      {/* Unilever brand cards with samples */}
      <div className="space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-wider text-neutral-500">
          联合利华品牌明细
        </h3>
        {r.unilever_brands.map((b) => (
          <BrandCard key={b.key} b={b} />
        ))}
      </div>

      {/* Failed prompts */}
      {r.failed_prompts.length > 0 && (
        <details className="rounded border border-neutral-800 bg-[#0F0F0F]">
          <summary className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-neutral-500 hover:text-[#00FF88]">
            ⚠️ 失守 Prompt · {r.failed_prompts.length} 条（点开查看）
          </summary>
          <div className="p-4 space-y-2 text-sm">
            {r.failed_prompts.slice(0, 20).map((f, i) => (
              <div key={i} className="border-l-2 border-red-500/40 pl-3">
                <div className="text-neutral-300">{f.prompt}</div>
                {f.pushed_brands.length > 0 ? (
                  <div className="text-xs mt-1 text-neutral-500">
                    被推：{f.pushed_brands.map((p) => p.display.split(" ")[0]).join("、")}
                  </div>
                ) : (
                  <div className="text-xs mt-1 text-neutral-600">
                    各平台回答都未点名具体品牌
                  </div>
                )}
              </div>
            ))}
            {r.failed_prompts.length > 20 && (
              <div className="text-xs text-neutral-500 pt-2">
                …共 {r.failed_prompts.length} 条，仅显示前 20
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}


function Kpi({
  label, value, sub, bad,
}: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
      <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-xl md:text-3xl font-bold mt-1 break-words ${bad ? "text-red-400" : "text-[#00FF88]"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] md:text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}


function BrandCard({ b }: { b: BrandStat }) {
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-lg font-bold">{b.display}</span>
          <span
            className="ml-2 font-mono text-xs px-2 py-0.5 rounded"
            style={{ background: (TIER_COLOR[b.tier] ?? "#555") + "20", color: TIER_COLOR[b.tier] ?? "#999" }}
          >
            {b.tier}
          </span>
        </div>
        <div className="font-mono text-xl text-[#00FF88]">
          {(b.mention_rate * 100).toFixed(1)}%
        </div>
      </div>
      <div className="flex gap-3 text-xs text-neutral-500 font-mono mb-3">
        <span>提及：{b.mentions} 次</span>
        {Object.keys(b.per_platform).length > 0 && (
          <span>
            按平台：{Object.entries(b.per_platform).map(([p, n]) => `${p}:${n}`).join("、")}
          </span>
        )}
      </div>
      {b.sample_answers.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-neutral-500 hover:text-[#00FF88]">
            展开 {b.sample_answers.length} 条代表性回答
          </summary>
          <div className="mt-2 space-y-2">
            {b.sample_answers.map((s, i) => (
              <div key={i} className="border-l-2 border-neutral-700 pl-3 py-1">
                <div className="font-mono text-neutral-500 text-[11px] mb-1">
                  Q: {s.prompt}  ·  via {s.platform}
                </div>
                <div className="text-neutral-300 whitespace-pre-wrap">{s.answer}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

