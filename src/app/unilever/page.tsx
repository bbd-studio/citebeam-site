"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UnileverReport } from "./types";
import { CategoryPanel } from "./_components/CategoryPanel";

const CATEGORIES = ["沐浴露", "洗发水", "身体乳"];

export default function UnileverDashboard() {
  const [report, setReport] = useState<UnileverReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("overview");

  useEffect(() => {
    fetch("/data/unilever-summary.json")
      .then((r) => r.json())
      .then((d: UnileverReport) => setReport(d))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="p-8 text-red-400">加载失败：{err}</div>;
  if (!report) return <div className="p-8 text-neutral-500 font-mono text-sm">loading...</div>;

  const totalMention = Object.values(report.categories).flatMap((c) => c.unilever_brands)
    .reduce((a, b) => a + b.mentions, 0);

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Hero */}
      <div className="mb-8">
        <div className="font-mono text-xs text-neutral-500 mb-2">
          <span className="text-[#00FF88]">$</span> demo/unilever/dashboard.md
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          联合利华 · AI 搜索可见度
        </h1>
        <p className="text-neutral-400 text-sm max-w-3xl">
          监测 4 家 AI 平台（豆包 / 智谱 GLM / Kimi / MiniMax）对联合利华 6 个自有品牌 +
          17 个竞品的推荐情况。
          <span className="text-neutral-500 ml-1">
            · 最后更新 {report.meta.generated_at?.slice(0, 10) ?? "—"}
          </span>
        </p>
      </div>

      {/* Global overview bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi label="总查询数" value={report.meta.total_queries.toString()} />
        <Kpi label="平台数" value={report.meta.platforms.length.toString()} />
        <Kpi label="子品类数" value={Object.keys(report.categories).length.toString()} />
        <Kpi label="联合利华总提及" value={totalMention.toString()} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-neutral-800 pb-3">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
          总览
        </TabBtn>
        {CATEGORIES.map((c) => (
          <TabBtn key={c} active={tab === c} onClick={() => setTab(c)}>
            {c}
          </TabBtn>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" ? (
        <Overview report={report} />
      ) : report.categories[tab] ? (
        <CategoryPanel cat={tab} r={report.categories[tab]} />
      ) : (
        <div className="text-neutral-500">该品类无数据</div>
      )}

      {/* Bottom CTA to chat */}
      <div className="mt-16 p-6 border border-neutral-800 rounded bg-gradient-to-br from-[#0F0F0F] to-[#0A0A0A]">
        <div className="font-mono text-xs text-neutral-500 mb-2">
          <span className="text-[#00FF88]">$</span> ./agent --ask "..."
        </div>
        <h3 className="text-xl md:text-2xl font-bold mb-2">想深入理解这些数字？</h3>
        <p className="text-neutral-400 text-sm mb-4">
          图表告诉你 <span className="text-[#00FF88]">what</span>。
          Agent 告诉你 <span className="text-[#00FF88]">why</span>。
          试试问："为什么凡士林被丝塔芙反超？"
        </p>
        <Link
          href="/unilever/chat"
          className="inline-block px-6 py-3 bg-[#00FF88] text-[#0A0A0A] rounded font-mono text-sm font-bold hover:opacity-90 transition-opacity"
        >
          打开对话助手 →
        </Link>
      </div>
    </main>
  );
}


function TabBtn({
  children, active, onClick,
}: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-mono text-sm rounded transition-all ${
        active
          ? "bg-[#00FF88] text-[#0A0A0A] font-bold"
          : "text-neutral-400 hover:text-[#00FF88] hover:bg-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}


function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1 text-[#00FF88]">{value}</div>
    </div>
  );
}


function Overview({ report }: { report: UnileverReport }) {
  return (
    <div className="space-y-6">
      {/* Per-category snapshot */}
      <div className="grid md:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const r = report.categories[cat];
          if (!r) return null;
          const top = r.unilever_brands[0];
          const topComp = r.competitors[0];
          return (
            <div key={cat} className="rounded border border-neutral-800 bg-[#0F0F0F] p-5">
              <div className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-2">
                {cat}
              </div>
              <div className="text-sm text-neutral-400 mb-3">
                {r.n_queries} 查询 · {r.unique_prompts} 独立 prompt
              </div>
              {top && (
                <div className="mb-3 pb-3 border-b border-neutral-800">
                  <div className="text-xs text-neutral-500 mb-1">联合利华领头</div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">{top.display.split(" ")[0]}</span>
                    <span className="text-lg font-mono text-[#00FF88]">
                      {(top.mention_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
              {topComp && (
                <div className="mb-3">
                  <div className="text-xs text-neutral-500 mb-1">竞品冠军</div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-300">{topComp.display.split(" ")[0]}</span>
                    <span className="text-lg font-mono text-[#FFD166]">
                      {(topComp.mention_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
              <div className="text-xs text-neutral-500 mt-3">
                失守 {r.failed_prompts.length}/{r.unique_prompts} prompt
              </div>
            </div>
          );
        })}
      </div>

      {/* Interpretation */}
      <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-5 text-sm">
        <div className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
          快速解读
        </div>
        <ul className="space-y-2 text-neutral-300">
          <li>
            <span className="text-[#00FF88] mr-2">●</span>
            <b>沐浴露</b>：多芬提及率领先（22.5%），但失守 prompt 过半 —
            敏感肌 / 孕期场景全被舒肤佳 + L'Occitane 吃掉。
          </li>
          <li>
            <span className="text-[#FFD166] mr-2">●</span>
            <b>洗发水</b>：清扬被海飞丝 + 卡诗双压，失守率高达 80%，
            需要重点优化。夏士莲零提及。
          </li>
          <li>
            <span className="text-red-400 mr-2">●</span>
            <b>身体乳</b>：凡士林被丝塔芙反超（25.8% vs 23.3%）—
            敏感肌 / 屏障修护话题几乎全被丝塔芙占据。
          </li>
          <li>
            <span className="text-neutral-500 mr-2">●</span>
            <b>平台偏好</b>：豆包偏国货，Kimi 偏高端沙龙，MiniMax 偏丝塔芙，
            智谱 GLM 对多芬异常低提（值得深究）。
          </li>
        </ul>
      </div>
    </div>
  );
}
