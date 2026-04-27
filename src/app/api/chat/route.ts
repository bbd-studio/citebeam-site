import { NextRequest } from "next/server";
// Static import — bundled at build time. Works on CF Pages edge runtime.
import summary from "../../../../public/data/unilever-summary.json";
import timeline from "../../../../public/data/unilever-timeline.json";
import channels from "../../../../public/data/unilever-channels-slim.json";
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

## 当前数据 1 — 主监测数据 (按品类聚合的【非联网】视角评分 + 品牌 SoV + 维度优劣)

\`\`\`json
{{REPORT_JSON}}
\`\`\`

## 当前数据 3 — 【真实社交渠道数据 · CMO 视角】

下面 JSON 是 CMO 看板数据，覆盖 6 大社交渠道（抖音 / B 站 / 微博 / 小红书 / 微信公众号 / 知乎），目前已接通**抖音 + B 站**。

字段结构：
- \`series[].metric_type\` — 指标名称：
  - **抖音**：\`search_index\` (30 天搜索指数 daily) · \`search_index_period\` (30 天搜索指数 total) · \`consume_index_period\` · \`content_index_period\` · \`*_wow\` (周环比，0.05 = +5%) · \`*_yoy\` (同比)
  - **B 站**：\`video_count\` (该日视频数) · \`total_plays\` (该日播放总和) · \`total_likes\`
- \`per_brand[]\` — 每品牌跨渠道汇总：latest / mean / peak / n_points
- \`top_posts[]\` — 各品牌 Top 3 视频（B 站，含播放/赞/评等真实数据）

**CMO 关心的问题你直接从这里答**：
- "我品牌哪个渠道最弱 / 最强" → 比 \`per_brand[].channels\` 里同一品牌跨渠道值
- "下个 ¥10w 投哪个渠道" → 看哪个渠道我方品牌弱 + 对应渠道竞品强（机会窗口）
- "竞品本周在做什么" → 找 \`metric_type\` 含 \`_wow\` 且 brand_type=\`competitor\` 且 value > 0.1 的（涨 10%+）
- "B 站上多芬最热的视频" → \`top_posts\` 里 brand=多芬 channel=B 站
- "抖音搜索 vs 消费指数差异" → 搜索高消费低 = 用户主动搜但不看视频；反过来 = 被动曝光多但搜索少

\`\`\`json
{{CHANNELS_JSON}}
\`\`\`

数据声明：
- 抖音指数走 creator.douyin.com Playwright 抓取，**周更新**
- B 站走 bilibili-api 公开搜索，**周更新**
- 微博 / 小红书 / 微信公众号 / 知乎 当前**未接入**（需要 SaaS 采购或 API 审核）— 用户问这些时要明说"目前未接入"，不要瞎编

## 当前数据 2 — 【非联网 vs 联网】配对分析数据

下面这个 JSON 包含：
- \`meta\` — 非联网 / 联网 / 引用源 / 配对数 总览（JSON 字段名仍叫 \`total_l1\` / \`total_l2\`，对应"非联网" / "联网"）
- \`timeline\` — 每天 非联网 vs 联网 sample 数（趋势）
- \`by_platform\` — 每家平台的 非联网 / 联网 / 引用统计 + 是否接通联网搜索 (\`has_l2\`)
- \`pairs\` — 同一条 prompt 在同一家平台两种模式都跑了的配对答案，含：
  - \`l1.excerpt\` / \`l2.excerpt\` — 双方答案前 600 字（**l1 = 非联网，l2 = 联网**）
  - \`l1.brand_hits\` / \`l2.brand_hits\` — 命中的品牌列表
  - \`diff.only_l1\` / \`diff.only_l2\` / \`diff.both\` — 品牌差异
  - \`l2.citations\` — 联网时 AI 拿到的真实 URL 引用列表 (含域名 + 标题 + position)

**用户问这类问题时直接从这里答**：
- "联网前后差别多大" / "联网比非联网多推了什么" → meta + 遍历 \`pairs[].diff.only_l2\` 汇总
- "豆包/GLM 联网后会推什么品牌而非联网不会" → 平台 filter + \`diff.only_l2\`
- "AI 联网时引用了哪些网站" → 遍历 \`pairs[].l2.citations\` 按 domain 聚合

\`\`\`json
{{TIMELINE_JSON}}
\`\`\`

监测说明：
- **监测平台**（从 \`meta.platforms\` 动态取，**一切以 JSON 里的名字为准**，不要记死）：
  当前 8 家中国主流 AI 助手：豆包 · GLM · Kimi · MiniMax · DeepSeek · 夸克 · 文心 · 元宝
- **未覆盖**（无开放 API）：讯飞星火（待接）· 蚂蚁阿福
- **子品类**：沐浴露 / 洗发水 / 身体乳
- **客户**：联合利华（6 个自有品牌 · 17 个竞品）
- **提及率计算**：品牌被提及的查询数 ÷ 该品类总查询数（包括错误调用，与 Profound 口径一致）
- **"失守 prompt"**：该 prompt 在所有平台上都没推荐任何联合利华品牌
- **两种监测模式**：
  - **非联网模式** — 8 家 AI 平台裸调用（不带联网搜索工具）的回答，反映模型训练数据里"AI 默认会推什么"。约 2024 年训练快照。
  - **联网模式** — 豆包 + GLM 已经接通联网搜索，能拿到 2026 实时网页 + 真实 URL 引用
  - 用户问"AI 实际会推什么"看非联网（覆盖广）；问"如果用户开了联网搜索 AI 会推什么"看联网；问"两者差异"看上面的 timeline 数据 \`pairs[]\`
- **绝对禁止用 L1 / L2 这种术语回答用户**。一律说"非联网" / "联网"。
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
  const channelsJson = JSON.stringify(channels);
  const systemContent = SYSTEM_TEMPLATE
    .replace("{{REPORT_JSON}}", reportJson)
    .replace("{{TIMELINE_JSON}}", timelineJson)
    .replace("{{CHANNELS_JSON}}", channelsJson);

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
      const finalize = async (closeReason: "done" | "error" | "incomplete", err?: unknown) => {
        if (closeReason === "error") {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
        } else {
          controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
        }
        // Await the archive POST BEFORE closing the stream, otherwise CF
        // edge runtime GCs the worker as soon as we close and the
        // fire-and-forget fetch never actually leaves. The user already
        // saw all the deltas before [DONE], so the extra ~50–200 ms
        // before close doesn't affect the UX.
        if (assistantText && chosen) {
          await archiveTurn({
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
        controller.close();
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
              await finalize("done");
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
        await finalize("done");
      } catch (e) {
        await finalize("error", e);
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
