"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LineChart, Line,
} from "recharts";

type TierStats = {
  samples: number;
  errors: number;
  error_rate: number;
  avg_latency_ms: number;
  max_latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_cny: number;
};
type PlatformStats = {
  platform: string;
  tiers: { L1?: TierStats; L2?: TierStats };
  total_samples: number;
  total_cost_cny: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_errors: number;
};
type DailyPoint = { date: string; cost_cny: number; samples: number };
type ChatArchiveStats = {
  total_turns: number;
  unique_sessions: number;
  assistant_latency_ms: { p50: number; p95: number; mean: number };
  by_provider: { provider: string; answers: number; avg_latency_ms: number }[];
};
type OpsBundle = {
  meta: { generated_at: string; customer: string };
  totals: {
    samples: number; cost_cny: number; errors: number; platforms: number;
    input_tokens: number; output_tokens: number;
    overall_error_rate: number;
  };
  platforms: PlatformStats[];
  daily: DailyPoint[];
  chat_archive: ChatArchiveStats;
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
function fmtMs(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${n}ms`;
}

export default function OpsPage() {
  const [data, setData] = useState<OpsBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/unilever-ops.json")
      .then((r) => r.json())
      .then((d: OpsBundle) => setData(d))
      .catch((e) => setErr(String(e)));
  }, []);

  const dailyChart = useMemo(() => {
    if (!data) return [];
    let cum = 0;
    return data.daily.map((d) => {
      cum += d.cost_cny;
      return { date: d.date.slice(5), 当日: d.cost_cny, 累计: Number(cum.toFixed(4)), samples: d.samples };
    });
  }, [data]);

  const platformBars = useMemo(() => {
    if (!data) return [];
    return data.platforms.map((p) => ({
      name: p.platform,
      非联网: p.tiers.L1?.samples ?? 0,
      联网: p.tiers.L2?.samples ?? 0,
      cost: Number(p.total_cost_cny.toFixed(4)),
      err: p.total_errors,
    }));
  }, [data]);

  if (err) return <div className="p-8 text-red-400">加载失败：{err}</div>;
  if (!data) return <div className="p-8 text-neutral-500 font-mono text-sm">loading...</div>;

  const t = data.totals;

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6">
        <div className="font-mono text-xs text-neutral-500 mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <Link href="/unilever" className="hover:text-[#00FF88]">← 主仪表盘</Link>
            <span className="mx-2 text-neutral-700">/</span>
            <span className="text-[#00FF88]">$</span> ops · 监测系统运维报表
          </div>
          <span className="text-neutral-600">
            {data.meta.generated_at?.slice(0, 16).replace("T", " ")} 生成
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          监测系统 · 运维报表
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-3xl leading-relaxed">
          这页是给我们自己看的 —— 平台调用次数、token 消耗、平均延迟、累计花费、错误率。
          客户视角的 timeline / dashboard 不展示这些指标。
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi label="累计调用" value={t.samples.toLocaleString()} sub={`${t.platforms} 平台`} />
        <Kpi label="累计花费" value={`¥${t.cost_cny.toFixed(2)}`} sub={`真实扣费 ${data.platforms.filter(p => p.total_cost_cny > 0).length} 家`} hi />
        <Kpi label="累计 token" value={`${fmtTokens(t.input_tokens + t.output_tokens)}`}
             sub={`in ${fmtTokens(t.input_tokens)} / out ${fmtTokens(t.output_tokens)}`} />
        <Kpi label="错误率" value={`${(t.overall_error_rate * 100).toFixed(2)}%`}
             sub={`${t.errors} / ${t.samples} 错`} bad={t.overall_error_rate > 0.05} />
      </div>

      {/* Daily cost trend */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-1">每日 API 花费</h2>
        <p className="text-sm text-neutral-400 mb-3">
          蓝线 = 当日花费 · 绿线 = 累计花费（¥CNY）。仅 4 家有真实计费（豆包 / DeepSeek / 元宝 / 文心），其余在免费额度内。
        </p>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
          {dailyChart.length === 0 ? (
            <p className="text-neutral-500 text-center py-8 text-sm">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyChart} margin={{ left: 4, right: 24, top: 8, bottom: 4 }}>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#666" fontSize={11} />
                <YAxis stroke="#666" fontSize={11} />
                <Tooltip
                  cursor={{ stroke: "#333" }}
                  contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
                  formatter={(v) => `¥${Number(v).toFixed(4)}`}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#ccc" }} />
                <Line type="monotone" dataKey="当日" stroke="#118AB2" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="累计" stroke="#00FF88" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Platform breakdown table */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-3">平台运营明细</h2>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
              <tr>
                <th className="py-3 px-4 text-left">平台</th>
                <th className="py-3 px-4 text-right">非联网 调用</th>
                <th className="py-3 px-4 text-right">联网 调用</th>
                <th className="py-3 px-4 text-right">avg 延迟</th>
                <th className="py-3 px-4 text-right">总 in→out token</th>
                <th className="py-3 px-4 text-right">错误率</th>
                <th className="py-3 px-4 text-right">累计 ¥</th>
              </tr>
            </thead>
            <tbody>
              {data.platforms.map((p) => {
                const l1 = p.tiers.L1;
                const l2 = p.tiers.L2;
                const totalSamples = (l1?.samples ?? 0) + (l2?.samples ?? 0);
                const wAvgMs = totalSamples
                  ? Math.round((((l1?.avg_latency_ms ?? 0) * (l1?.samples ?? 0)) + ((l2?.avg_latency_ms ?? 0) * (l2?.samples ?? 0))) / totalSamples)
                  : 0;
                const errRate = totalSamples ? p.total_errors / totalSamples : 0;
                const isFree = p.total_cost_cny === 0;
                return (
                  <tr key={p.platform} className="border-b border-neutral-900 hover:bg-[#141414]">
                    <td className="py-3 px-4 font-bold text-neutral-100">{p.platform}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {l1 ? l1.samples : <span className="text-neutral-700">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {l2 ? <span className="text-[#00FF88]">{l2.samples}</span> : <span className="text-neutral-700">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300">
                      {fmtMs(wAvgMs)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300 text-xs">
                      {fmtTokens(p.total_input_tokens)} → {fmtTokens(p.total_output_tokens)}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${errRate > 0.05 ? "text-red-400" : errRate > 0 ? "text-orange-300" : "text-neutral-500"}`}>
                      {errRate > 0 ? `${(errRate * 100).toFixed(1)}%` : "0"}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${isFree ? "text-neutral-600" : "text-[#00FF88]"}`}>
                      {isFree ? "—" : `¥${p.total_cost_cny.toFixed(4)}`}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#0a0a0a]">
                <td className="py-3 px-4 font-bold text-neutral-300">合计</td>
                <td className="py-3 px-4 text-right font-mono text-neutral-300">
                  {data.platforms.reduce((s, p) => s + (p.tiers.L1?.samples ?? 0), 0)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#00FF88]">
                  {data.platforms.reduce((s, p) => s + (p.tiers.L2?.samples ?? 0), 0)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-neutral-500">—</td>
                <td className="py-3 px-4 text-right font-mono text-neutral-300 text-xs">
                  {fmtTokens(t.input_tokens)} → {fmtTokens(t.output_tokens)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-neutral-300">
                  {(t.overall_error_rate * 100).toFixed(2)}%
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#00FF88] font-bold">
                  ¥{t.cost_cny.toFixed(4)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          延迟为加权平均；"—" 表示该平台目前在免费额度（codeplan / 月度赠 token）内，边际现金成本 0；额度耗尽切现金扣费时自动出价。
        </p>
      </section>

      {/* Platform call-count bar chart */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-3">平台调用量分布（非联网 vs 联网）</h2>
        <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={platformBars} margin={{ left: 4, right: 24, top: 8, bottom: 4 }}>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#ccc" fontSize={12} />
              <YAxis stroke="#666" fontSize={11} />
              <Tooltip
                cursor={{ fill: "#1a1a1a" }}
                contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#ccc" }} />
              <Bar dataKey="非联网" stackId="a" fill="#666" />
              <Bar dataKey="联网" stackId="a" fill="#00FF88" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Chat archive */}
      <section className="mb-10">
        <h2 className="text-lg md:text-xl font-bold mb-1">客户 chat agent 使用情况</h2>
        <p className="text-sm text-neutral-400 mb-3">
          来源：<code className="bg-neutral-900 px-1 rounded">chat_archive</code> 表（每次客户在 /unilever/chat 提问都会落 1 条 user + 1 条 assistant）。
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Kpi label="累计 turn 数" value={data.chat_archive.total_turns.toString()} />
          <Kpi label="独立 session" value={data.chat_archive.unique_sessions.toString()} />
          <Kpi label="assistant 延迟 P50" value={fmtMs(data.chat_archive.assistant_latency_ms.p50)} />
          <Kpi label="assistant 延迟 P95" value={fmtMs(data.chat_archive.assistant_latency_ms.p95)} bad={data.chat_archive.assistant_latency_ms.p95 > 15000} />
        </div>

        {data.chat_archive.by_provider.length > 0 && (
          <div className="rounded border border-neutral-800 bg-[#0F0F0F] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider font-mono bg-[#0a0a0a]">
                <tr>
                  <th className="py-3 px-4 text-left">provider</th>
                  <th className="py-3 px-4 text-right">回答数</th>
                  <th className="py-3 px-4 text-right">avg 延迟</th>
                </tr>
              </thead>
              <tbody>
                {data.chat_archive.by_provider.map((p) => (
                  <tr key={p.provider} className="border-b border-neutral-900">
                    <td className="py-3 px-4 font-mono">{p.provider}</td>
                    <td className="py-3 px-4 text-right font-mono">{p.answers}</td>
                    <td className="py-3 px-4 text-right font-mono">{fmtMs(p.avg_latency_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-xs text-neutral-600 mt-12 pt-4 border-t border-neutral-900">
        本页只在监测系统重建数据 bundle 时刷新（手动跑 <code className="bg-neutral-900 px-1 rounded">scripts/build_ops_bundle.py</code>，或并入 weekly cron）。
        生产数据落地时点 → bundle 生成时点之间会有几小时延迟。
      </div>
    </main>
  );
}


function Kpi({ label, value, sub, hi, bad }: {
  label: string; value: string; sub?: string; hi?: boolean; bad?: boolean;
}) {
  const color = bad ? "text-red-400" : hi ? "text-[#00FF88]" : "text-neutral-100";
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
      <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`text-xl md:text-3xl font-bold mt-1 break-words ${color}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] md:text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}
