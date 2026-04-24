"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string };

const SEED_SUGGESTIONS = [
  "多芬在沐浴露的强项场景有哪些？劣项被谁抢走？",
  "清扬按 persona 看最弱的 3 个人群是什么？",
  "凡士林的劣项场景有什么共性？",
  "为什么凡士林被丝塔芙反超了？",
  "哪个平台对多芬最不友好？",
  "夏士莲为什么零提及？",
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "我是 citebeam 的分析助手，手上有联合利华 6 个自有品牌 + 17 个竞品在 **7 家**中国主流 AI 助手（豆包 / 智谱 / Kimi / MiniMax / DeepSeek / 通义 / 文心）上的完整监测数据。\n\n问我具体的「为什么」，比如：\n\n- 为什么多芬在沐浴露领先但在身体乳落后？\n- 清扬被哪些竞品吃掉了？各平台偏好差在哪？\n- 凡士林劣项场景的共性是什么？\n- 哪些 prompt 是所有平台都推竞品？\n\n📌 回答只来自数据，没有的维度（真实销量、投放归因）我会直说。",
};

export default function UnileverChatPage() {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);
    const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Strip the hard-coded greeting from the server-side context
          messages: nextMsgs.filter((m) => m !== GREETING),
        }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";
      // seed empty assistant message to stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const lines = ev.split("\n");
          let eventType = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) data = line.slice(5).trim();
          }
          if (eventType === "done") {
            // finished
          } else if (eventType === "error") {
            throw new Error(data);
          } else if (data) {
            try {
              const obj = JSON.parse(data);
              if (obj.delta) {
                assistantText += obj.delta;
                setMessages((prev) => {
                  const out = [...prev];
                  const last = out[out.length - 1];
                  if (last && last.role === "assistant") {
                    out[out.length - 1] = { role: "assistant", content: assistantText };
                  }
                  return out;
                });
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (e) {
      setError(String(e));
      setMessages((prev) => {
        const out = [...prev];
        // remove empty assistant if nothing streamed
        if (out[out.length - 1]?.role === "assistant" && out[out.length - 1].content === "") {
          out.pop();
        }
        return out;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`${
                m.role === "user"
                  ? "ml-auto bg-[#00FF88] text-[#0A0A0A]"
                  : "mr-auto bg-[#141414] text-[#FAFAF7] border border-neutral-900"
              } max-w-[85%] rounded-2xl px-4 md:px-5 py-3 text-sm leading-relaxed`}
            >
              {m.content ? (
                m.role === "user" ? (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-bold
                    prose-p:my-1.5 prose-p:leading-relaxed
                    prose-ul:my-1.5 prose-ul:pl-4 prose-li:my-0.5 prose-li:marker:text-[#00FF88]
                    prose-ol:my-1.5 prose-ol:pl-4
                    prose-strong:text-[#00FF88] prose-strong:font-bold
                    prose-code:text-[#FFD166] prose-code:bg-neutral-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-[''] prose-code:after:content-['']
                    prose-table:text-xs prose-th:border prose-th:border-neutral-800 prose-th:px-2 prose-th:py-1
                    prose-td:border prose-td:border-neutral-800 prose-td:px-2 prose-td:py-1
                    prose-a:text-[#00FF88]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                )
              ) : (
                m.role === "assistant" && streaming ? (
                  <span className="text-neutral-500 font-mono">thinking…</span>
                ) : null
              )}
            </div>
          ))}
          {error && (
            <div className="max-w-[85%] mr-auto text-xs text-red-400 bg-red-950/30 border border-red-900 rounded px-3 py-2 font-mono">
              ⚠️ {error}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      {/* Seed suggestions */}
      {messages.length <= 2 && (
        <div className="border-t border-neutral-900 px-4 md:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 mb-2">
              试试问：
            </div>
            <div className="flex flex-wrap gap-2">
              {SEED_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={streaming}
                  className="text-xs px-3 py-2 rounded border border-neutral-800 text-neutral-400 hover:text-[#00FF88] hover:border-[#00FF88]/40 font-mono disabled:opacity-30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-neutral-900 p-4"
      >
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="追问你的品牌数据..."
            disabled={streaming}
            className="flex-1 min-w-0 bg-[#141414] border border-neutral-800 rounded-lg px-4 py-3 text-base md:text-sm focus:outline-none focus:border-[#00FF88] transition-colors"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-5 py-3 bg-[#00FF88] text-[#0A0A0A] rounded-lg font-mono text-sm font-bold disabled:opacity-30 transition-opacity"
          >
            send →
          </button>
        </div>
        <div className="max-w-3xl mx-auto mt-2 font-mono text-[10px] text-neutral-600 flex items-center justify-between">
          <span>via 智谱 GLM-4.5-air · streaming SSE</span>
          <Link href="/unilever" className="hover:text-[#00FF88]">
            ← 回图表看板
          </Link>
        </div>
      </form>
    </div>
  );
}
