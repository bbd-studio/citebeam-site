import { NextRequest } from "next/server";
// Static import — bundled at build time. Works on CF Pages edge runtime.
import summary from "../../../../public/data/unilever-summary.json";
import timeline from "../../../../public/data/unilever-timeline.json";
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

## 当前数据 1 — 主监测数据 (按品类聚合的 L1 层评分 + 品牌 SoV + 维度优劣)

\`\`\`json
{{REPORT_JSON}}
\`\`\`

## 当前数据 2 — 联网前/后 timeline 数据 (L1 vs L2 配对分析)

下面这个 JSON 包含：
- \`meta\` — L1 / L2 / 引用源 / 配对数 总览
- \`timeline\` — 每天 L1 vs L2 sample 数（趋势）
- \`by_platform\` — 每家平台的 L1 / L2 / 引用统计 + 是否接通 web_search (\`has_l2\`)
- \`pairs\` — 同一条 prompt 在同一家平台两个层都跑了的 16 对答案，含：
  - \`l1.excerpt\` / \`l2.excerpt\` — 双方答案前 600 字
  - \`l1.brand_hits\` / \`l2.brand_hits\` — 命中的品牌列表
  - \`diff.only_l1\` / \`diff.only_l2\` / \`diff.both\` — 品牌差异
  - \`l2.citations\` — L2 拿到的真实 URL 引用列表 (含域名 + 标题 + position)
  - 双方 cost / tokens / latency

**用户问这类问题时直接从这里答**：
- "联网前后差别多大" / "L2 比 L1 多推了什么" → meta + 遍历 \`pairs[].diff.only_l2\` 汇总
- "豆包/GLM 联网后会推什么品牌而裸调用不会" → 平台 filter + \`diff.only_l2\`
- "AI 联网时引用了哪些网站" → 遍历 \`pairs[].l2.citations\` 按 domain 聚合
- "联网搜索值不值这个钱" → 比较 L1 vs L2 cost，再看 brand discovery 增量
- "Africa AI VC 也在哪些站上被讨论" / 类似 site-source 问题 → 引用源域名分布

\`\`\`json
{{TIMELINE_JSON}}
\`\`\`

监测说明：
- **监测平台**（从 \`meta.platforms\` 动态取，**一切以 JSON 里的名字为准**，不要记死）：
  当前 8 家中国主流 AI 助手：豆包 · GLM · Kimi · MiniMax · DeepSeek · 夸克 · 文心 · 元宝
- **未覆盖**（无开放 API）：讯飞星火（待接）· 蚂蚁阿福
- **子品类**：沐浴露 / 洗发水 / 身体乳（以 \`meta.platforms\` 为准）
- **客户**：联合利华（6 个自有品牌 · 17 个竞品）
- **提及率计算**：品牌被提及的查询数 ÷ 该品类总查询数（包括错误调用，与 Profound 口径一致）
- **"失守 prompt"**：该 prompt 在所有平台上都没推荐任何联合利华品牌
- **数据时效性 — 双层监测**：
  - **L1 层 (训练数据视角)** — 8 家 AI 平台**裸调用**（无 web_search 工具）的回答，反映模型训练数据里"AI 默认会推什么"
  - **L2 层 (实时联网视角)** — 豆包 + GLM 已经接通 native web_search，能拿到 2026 实时网页 + 真实 URL 引用
  - 用户问"AI 实际会推什么"看 L1（覆盖广）；问"如果用户开了联网搜索 AI 会推什么"看 L2；问"两者差异"看下面的 \`timeline\` 字段
- **回答禁忌**：**不要用英文字段代码**（如 \`intent=discovery\`、\`journey=awareness\`）答用户。看下面的翻译规则。

## 重要字段：\`strengths_weaknesses\`

对每个联合利华品牌，按 5 个维度（**场景** scenario / **诉求** attribute / **价格档位** price_tier / **人群** persona / **意图** intent）算了 top-5 强项 + top-5 劣项。

**⚠️ 输出给用户时**，以下英文字段值**必须翻译成中文**（数据库里存的是英文代码，你回答时要用中文展示）：

| 字段 | 英文值 → 用户看的中文 |
|---|---|
| intent | \`discovery\` → 发现型 · \`comparison\` → 比较型 · \`problem_solving\` → 解决问题型 · \`validation\` → 验证型 · \`transactional\` → 交易型 |
| journey | \`awareness\` → 认知期 · \`consideration\` → 考虑期 · \`decision\` → 决策期 |

其他字段（scenario / persona / attribute / price_tier 的值）原本就是中文，直接用。

## 重要字段：\`dark_horse_competitors\`

每个品类可能带 \`dark_horse_competitors\` 数组 —— 这些是**LLM 从真实答案里抽取、但不在联合利华品牌表里的品牌**。用户的 \`competitors\` 是预先手工标记的竞品（17 个），但 AI 实际推荐里出现的品牌往往**远不止这些**。dark horse 就是"未追踪但值得警觉"的对手，按答案提及次数排序。

用户问"哪些竞品我们没在监测"、"黑马"、"还有谁在抢"、"漏掉的对手"、"values we should be watching" 时直接从这里答。每条只有 name + mentions，没有按平台/场景细分（未来 v2 再做）。

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
type ChatBody = {
  messages: Msg[];
  // Optional client-provided session UID. When omitted we generate one.
  session_uid?: string;
};

// Best-effort archive POST. Never throws — failure must not affect the
// user-facing chat. Reads CHAT_ARCHIVE_URL + CHAT_ARCHIVE_SECRET env at
// runtime; if either is missing this is a no-op.
async function archiveTurn(payload: {
  session_uid: string; customer_slug: string; turn_no: number;
  role: "user" | "assistant"; content: string;
  agent_provider?: string; agent_model?: string; agent_display?: string;
  latency_ms?: number;
  user_agent?: string; ip_country?: string; referer?: string;
}): Promise<void> {
  const url = process.env.CHAT_ARCHIVE_URL;
  const secret = process.env.CHAT_ARCHIVE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Archive-Secret": secret,
      },
      body: JSON.stringify(payload),
      // Edge runtime: keepalive helps the request survive after we return
      // the streaming response to the browser.
      keepalive: true,
    });
  } catch {
    // swallow — archiving must never break the user
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatBody;
  const { messages } = body;
  // Stable session id for grouping a multi-turn conversation. Client may pass
  // its own (so a refresh doesn't break the session), else we synthesize.
  const sessionUid = (body.session_uid && body.session_uid.length >= 8)
    ? body.session_uid
    : crypto.randomUUID();

  // Pull anonymised request context for archive
  const userAgent = req.headers.get("user-agent")?.slice(0, 280) || undefined;
  const referer = req.headers.get("referer")?.slice(0, 280) || undefined;
  const ipCountry = req.headers.get("cf-ipcountry") || undefined;

  const turnNo = messages.length;          // last message is this turn's user msg
  const lastUserMsg = messages[messages.length - 1];

  const reportJson = JSON.stringify(summary);
  const timelineJson = JSON.stringify(timeline);
  const systemContent = SYSTEM_TEMPLATE
    .replace("{{REPORT_JSON}}", reportJson)
    .replace("{{TIMELINE_JSON}}", timelineJson);

  // Build provider candidate list: every cascade entry whose env var is set.
  // Will try them in order; failover on upstream non-2xx or fetch error.
  const candidates: { key: string; model: string; displayName: string; apiKey: string }[] = [];
  for (const entry of AGENT_CASCADE) {
    const envVar = PROVIDER_ENV_VARS[entry.key];
    const k = envVar ? process.env[envVar] : undefined;
    if (k) candidates.push({ ...entry, apiKey: k });
  }
  if (candidates.length === 0) {
    return new Response(
      "No LLM key configured. Need one of: " +
      AGENT_CASCADE.map((e) => PROVIDER_ENV_VARS[e.key]).join(" / "),
      { status: 500 }
    );
  }

  // Try each candidate in order; first one with a 2xx + body wins.
  let upstream: Response | null = null;
  let chosen: typeof candidates[number] | null = null;
  const tried: string[] = [];
  for (const cand of candidates) {
    const url = PROVIDER_ENDPOINTS[cand.key];
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cand.apiKey}`,
        },
        body: JSON.stringify({
          model: cand.model,
          messages: [
            { role: "system", content: systemContent },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          stream: true,
          temperature: 0.4,
          max_tokens: 2000,
        }),
      });
      if (r.ok && r.body) {
        upstream = r;
        chosen = cand;
        break;
      }
      tried.push(`${cand.key}:${r.status}`);
    } catch (e) {
      tried.push(`${cand.key}:err(${String(e).slice(0, 40)})`);
    }
  }
  if (!upstream || !chosen) {
    return new Response(
      `All providers failed. Tried: ${tried.join(" → ")}`,
      { status: 502 }
    );
  }

  // Fire user-turn archive (don't await — let it race the response).
  if (lastUserMsg && lastUserMsg.role === "user") {
    archiveTurn({
      session_uid: sessionUid,
      customer_slug: "unilever",
      turn_no: turnNo,
      role: "user",
      content: lastUserMsg.content,
      user_agent: userAgent,
      ip_country: ipCountry,
      referer,
    });
  }

  const startedAt = Date.now();

  // Transform upstream OpenAI-compat stream to plain text SSE that frontend can consume.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Capture full assistant text + final usage as the stream goes by, so we can
  // archive once the upstream completes.
  let assistantText = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buf = "";
      const finalize = (closeReason: "done" | "error" | "incomplete", err?: unknown) => {
        if (closeReason === "error") {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
        } else {
          controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
        }
        controller.close();
        // Best-effort archive of assistant turn (not awaited).
        if (assistantText && chosen) {
          archiveTurn({
            session_uid: sessionUid,
            customer_slug: "unilever",
            turn_no: turnNo,
            role: "assistant",
            content: assistantText,
            agent_provider: chosen.key,
            agent_model: chosen.model,
            agent_display: chosen.displayName,
            latency_ms: Date.now() - startedAt,
            user_agent: userAgent,
            ip_country: ipCountry,
            referer,
          });
        }
      };
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
              finalize("done");
              return;
            }
            try {
              const obj = JSON.parse(payload);
              const delta = obj?.choices?.[0]?.delta?.content;
              if (delta) {
                assistantText += delta;
                // Forward as a plain-text-delta SSE
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            } catch {
              // Ignore non-JSON lines
            }
          }
        }
        finalize("done");
      } catch (e) {
        finalize("error", e);
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
      // Echo the session uid so the client can pin it for follow-ups.
      "X-Session-Uid": sessionUid,
    },
  });
}
