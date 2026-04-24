import { NextRequest } from "next/server";
// Static import — bundled at build time. Works on CF Pages edge runtime.
import summary from "../../../../public/data/unilever-summary.json";

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
- **监测平台**（从 \`meta.platforms\` 动态取，当前是 7 家中国主流 AI 助手）：
  豆包（字节 · volcengine/doubao）· 智谱 GLM · Kimi（月之暗面）· MiniMax 海螺 ·
  DeepSeek · 通义千问（阿里 DashScope · 夸克同款底层）· 文心一言（百度）
- **未覆盖**（无开放 API）：腾讯元宝（待接）· 讯飞星火（待接）· 蚂蚁阿福 · 夸克 UI 层
- **子品类**：沐浴露 / 洗发水 / 身体乳
- **客户**：联合利华（6 个自有品牌 · 17 个竞品）
- **提及率计算**：品牌被提及的查询数 ÷ 该品类总查询数（包括错误调用，与 Profound 口径一致）
- **"失守 prompt"**：该 prompt 在所有平台上都没推荐任何联合利华品牌
- **数据时效性限制**：当前基于 LLM 训练数据，不含实时 web search（下一版接 Tavily 后补上）

## 重要字段：\`strengths_weaknesses\`

对每个联合利华品牌，按 5 个维度（scenario / attribute / price_tier / persona / intent）
算了 top-5 强项 + top-5 劣项：
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

  // Chat agent — prefer clean non-thinking models for good streaming UX.
  // Order: DeepSeek (clean, fast 0.7s, cheap) → Zhipu GLM-4.5-air (clean) → Anthropic.
  // MiniMax-M2 skipped for chat because it emits <think>…</think> and strip_think
  // is not implemented in the edge-runtime stream parser.
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const zhipuKey = process.env.ZHIPU_API_KEY;

  let upstreamUrl = "";
  let apiKey = "";
  let modelName = "";
  if (deepseekKey) {
    upstreamUrl = "https://api.deepseek.com/v1/chat/completions";
    apiKey = deepseekKey;
    modelName = "deepseek-chat";  // V3.2 / V4 non-thinking
  } else if (zhipuKey) {
    upstreamUrl = "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
    apiKey = zhipuKey;
    modelName = "GLM-4.5-air";
  } else {
    return new Response("No LLM key configured (need DEEPSEEK_API_KEY or ZHIPU_API_KEY).", { status: 500 });
  }

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
    },
  });
}
