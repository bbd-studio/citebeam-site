"use client";

import { useState } from "react";
import Link from "next/link";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "你好。我是 citebeam 的助手。\n\n目前后端 agent 还没接通（脚手架状态），但我会按 verifier-first 原则回答 —— 系统里没有的数据，我直接说没有。\n\n试试问我：\n• 我品牌在豆包排第几？\n• 为什么本周变化了？\n• 这个数据是怎么来的？",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Placeholder echo until backend SSE is wired
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "(脚手架占位 — 后端 SSE / agent 还没接通。下一步会接 /api/chat 的 streaming endpoint。)",
        },
      ]);
      setIsStreaming(false);
    }, 600);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-[#FAFAF7]">
      <header className="border-b border-neutral-900 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm text-[#00FF88]">
          ← citebeam
        </Link>
        <span className="font-mono text-xs text-neutral-500">
          $ thinking... <span className="inline-block w-2 h-3 bg-[#00FF88] align-middle animate-pulse" />
        </span>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${
              m.role === "user" ? "ml-auto bg-[#00FF88] text-[#0A0A0A]" : "mr-auto bg-[#141414] text-[#FAFAF7]"
            } max-w-[85%] rounded-2xl px-5 py-3 whitespace-pre-wrap text-sm leading-relaxed`}
          >
            {m.content}
          </div>
        ))}
        {isStreaming && (
          <div className="mr-auto bg-[#141414] text-neutral-500 max-w-[85%] rounded-2xl px-5 py-3 text-sm font-mono">
            ...
          </div>
        )}
      </main>

      <form onSubmit={handleSubmit} className="border-t border-neutral-900 p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问你品牌的 AI 可见度..."
            disabled={isStreaming}
            className="flex-1 bg-[#141414] border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00FF88] transition-colors"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-6 py-3 bg-[#00FF88] text-[#0A0A0A] rounded-lg font-mono text-sm font-bold disabled:opacity-30 transition-opacity"
          >
            send →
          </button>
        </div>
      </form>
    </div>
  );
}
