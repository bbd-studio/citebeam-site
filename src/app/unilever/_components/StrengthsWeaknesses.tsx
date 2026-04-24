"use client";

import { useState } from "react";
import type { BrandStat, BrandSW, DimEntry } from "../types";

const DIM_LABELS: Record<string, string> = {
  scenario: "场景",
  attribute: "诉求",
  price_tier: "价格档位",
  persona: "人群",
  intent: "意图",
};
const DIM_ORDER = ["scenario", "attribute", "price_tier", "persona", "intent"] as const;

export function StrengthsWeaknesses({
  cat,
  brands,
  sw,
}: {
  cat: string;
  brands: BrandStat[];
  sw: Record<string, BrandSW>;
}) {
  const validBrands = brands.filter((b) => sw[b.key] && Object.keys(sw[b.key]).length > 0);
  const [activeBrand, setActiveBrand] = useState(validBrands[0]?.key ?? "");
  if (validBrands.length === 0) return null;

  const brandSW = sw[activeBrand];
  if (!brandSW) return null;

  return (
    <div className="rounded border border-neutral-800 bg-[#0F0F0F] p-3 md:p-4">
      <h3 className="font-mono text-xs uppercase tracking-wider text-neutral-500 mb-3">
        🎯 品牌场景优劣（{cat}）
      </h3>

      {/* Brand selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {validBrands.map((b) => (
          <button
            key={b.key}
            onClick={() => setActiveBrand(b.key)}
            className={`text-xs px-3 py-1.5 rounded font-mono transition-colors ${
              activeBrand === b.key
                ? "bg-[#00FF88] text-[#0A0A0A] font-bold"
                : "bg-neutral-900 text-neutral-400 hover:text-[#00FF88] border border-neutral-800"
            }`}
          >
            {b.display.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Per-dimension strong/weak */}
      <div className="space-y-5">
        {DIM_ORDER.filter((d) => brandSW[d]).map((dim) => {
          const a = brandSW[dim]!;
          return (
            <div key={dim}>
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                by {DIM_LABELS[dim]}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <DimColumn
                  title="强项"
                  color="#00FF88"
                  entries={a.strong}
                  showComp={false}
                />
                <DimColumn
                  title="劣项"
                  color="#FF5E3A"
                  entries={a.weak}
                  showComp={true}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-800 font-mono text-[10px] text-neutral-600">
        样本阈值 ≥ 3 · 劣项显示被哪个竞品抢走
      </div>
    </div>
  );
}


function DimColumn({
  title, color, entries, showComp,
}: {
  title: string; color: string; entries: DimEntry[]; showComp: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-bold mb-2" style={{ color }}>
        {title === "强项" ? "🟢" : "🔴"} {title}
      </div>
      {entries.length === 0 ? (
        <div className="text-xs text-neutral-600 font-mono">—</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => {
            const comp = e.top_competitor;
            return (
              <div
                key={i}
                className="flex items-start justify-between gap-2 text-xs py-1.5 border-b border-neutral-900 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-neutral-200 break-words">{e.value}</div>
                  {showComp && comp && (
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      被 <span className="text-[#FFD166]">{comp.display.split(" ")[0]}</span>{" "}
                      占 {comp.hits} 次
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right font-mono">
                  <div className="font-bold" style={{ color }}>
                    {(e.rate * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {e.hits}/{e.total}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
