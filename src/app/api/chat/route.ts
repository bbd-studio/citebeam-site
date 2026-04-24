import { NextRequest } from "next/server";
// Static import — bundled at build time. Works on CF Pages edge runtime.
import summary from "../../../../public/data/unilever-summary.json";
import { AGENT_CASCADE, PROVIDER_ENDPOINTS, PROVIDER_ENV_VARS } from "@/lib/agent-config";

export const runtime = "edge";
export const dynamic = "force-dynamic";


const SYSTEM_TEMPLATE = `你是 citebeam 的分析助手，帮客户理解他们的品牌在中国主流 AI 助手里的可见度数据。

## 你的行为原则

1. **只说数据里有的** —— 不编造数字、不给没证据的结论，每个数字都能在下方 JSON 里找到
2. **诚实承认缺口** —— 数据里没有的维度（如真实销量、投放归因）直接说"当前不掌握"
3. **完整且结构化** —— 回答要充分，**不要硬限字数**。用 markdown 列表 / 表格 / 加粗关键数字。
   - 回答结构建议：① 直接结论（1-2 句）→ ② 支撑数字（3-5 条） → ③ actionable 解读（1-2 句）
   - 列表用 \`- **XX** 25.8%（舒肤佳抢 8 次）\` 这样紧凑的格式
   - 涉及多个品牌/场景时用表格比散文清晰
4. **可解读不可决策** —— Phase 1 只解释 what + why，不给"你应该投 X KOL"这种战略建议
5. **可以追问用户** —— 如果问题过宽（如"怎么办"），反问"你更想看哪个品类 / 哪个平台？"
6. **中文回答，和图表看板一致**；数字统一保留 1 位小数

## 当前数据（JSON 格式的品牌监测快照，来源：DB · 实时聚合）

\`\`\`json
{{REPORT_JSON}}
\`\`\`

监测说明：
- **监测平台**（从 \`meta.platforms\` 动态取，**一切以 JSON 里的名字为准**，不要记死）：
  当前 8 家中国主流 AI 助手：豆包 · GLM · Kimi · MiniMax · DeepSeek · 夸克 · 文心 · 元宝
- **未覆盖**（无开放 API）：讯飞星火（待接）· 蚂蚁阿福
- **子品类**：沐浴露 / 洗发水 / 身体乳（以 \`meta.platforms\` 为准）
- **客户**：联合利华（6 个自有品牌 · 17 个竞品）
- **提及率计算**：品牌被提及的查询数 ÷ 该品类总查询数（包括错误调用，与 Profound 口径一致）
- **"失守 prompt"**：该 prompt 在所有平台上都没推荐任何联合利华品牌
- **数据时效性限制**：当前基于 LLM 训练数据，不含实时 web search（下一版接 Tavily 后补上）
- **回答禁忌**：**不要用英文字段代码**（如 \`intent=discovery\`、\`journey=awareness\`）答用户。看下面的翻译规则。

## 重要字段：\`strengths_weaknesses\`

对每个联合利华品牌，按 5 个维度（**场景** scenario / **诉求** attribute / **价格档位** price_tier / **人群** persona / **意图** intent）算了 top-5 强项 + top-5 劣项。

**⚠️ 输出给用户时**，以下英文字段值**必须翻译成中文**（数据库里存的是英文代码，你回答时要用中文展示）：

| 字段 | 英文值 → 用户看的中文 |
|---|---|
| intent | \`discovery\` → 发现型 · \`comparison\` → 比较型 · \`problem_solving\` → 解决问题型 · \`validation\` → 验证型 · \`transactional\` → 交易型 |
| journey | \`awareness\` → 认知期 · \`consideration\` → 考虑期 · \`decision\` → 决策期 |

其他字段（scenario / persona / attribute / price_tier 的值）原本就是中文，直接用。

字段含义：
- \`strong\`: 该维度下提及率最高的 5 个值（品牌在这些场景/诉求下 AI 愿意推荐）
- \`weak\`: 提及率最低的 5 个值（品牌在这些场景下不被推荐）
  - \`top_competitor\` 字段说明：劣项场景被哪个竞品抢走了（最关键的 actionable 信号）
- \`overall_rate\`: 品牌整体提及率（做对比用）
- 样本阈值：每个维度值至少 3 个样本才纳入分析

**用户常问的优劣类问题你都能直接从 \`strengths_weaknesses\` 回答**：
- "多芬在哪些场景最强？" → strong
- "清扬哪些场景被谁抢走？" → weak + top_competitor
- "凡士林的劣项是什么共性？" → 看 weak 里跨维度的共性词
- "按人群看我们最弱的 3 个 persona？" → persona.weak
`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: Msg[] };

  const reportJson = JSON.stringify(summary);
  const systemContent = SYSTEM_TEMPLATE.replace("{{REPORT_JSON}}", reportJson);

  // Pick first cascade entry whose env var is set. Avoids hardcoding —
  // swap the primary by editing AGENT_CASCADE in src/lib/agent-config.ts.
  let chosen: { key: string; model: string; displayName: string } | null = null;
  let apiKey = "";
  for (const entry of AGENT_CASCADE) {
    const envVar = PROVIDER_ENV_VARS[entry.key];
    const k = envVar ? process.env[envVar] : undefined;
    if (k) {
      chosen = entry;
      apiKey = k;
      break;
    }
  }
  if (!chosen) {
    return new Response(
      "No LLM key configured. Need one of: " +
      AGENT_CASCADE.map((e) => PROVIDER_ENV_VARS[e.key]).join(" / "),
      { status: 500 }
    );
  }
  const upstreamUrl = PROVIDER_ENDPOINTS[chosen.key];
  const modelName = chosen.model;

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: systemContent },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      temperature: 0.4,
      max_tokens: 2000,  // let the model answer fully
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      `Upstream ${upstream.status}: ${detail.slice(0, 400)}`,
      { status: 500 }
    );
  }

  // Transform upstream OpenAI-compat stream to plain text SSE that frontend can consume.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // OpenAI-compat SSE: `data: {json}\n\n`
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
              controller.close();
              return;
            }
            try {
              const obj = JSON.parse(payload);
              const delta = obj?.choices?.[0]?.delta?.content;
              if (delta) {
                // Forward as a plain-text-delta SSE
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            } catch {
              // Ignore non-JSON lines
            }
          }
        }
        controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // Tell the frontend which model actually answered, so the UI footer
      // stays truthful when we swap cascade order.
      "X-Agent-Provider": chosen.key,
      "X-Agent-Model": chosen.model,
      "X-Agent-Display": chosen.displayName,
    },
  });
}
