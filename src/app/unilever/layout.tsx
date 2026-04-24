import Link from "next/link";

export default function UnileverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAF7]">
      <header className="border-b border-neutral-900 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="font-mono text-sm text-[#00FF88] shrink-0">
          ← citebeam
        </Link>
        <div className="font-mono text-xs text-neutral-500 flex gap-3 md:gap-5">
          <Link href="/unilever" className="hover:text-[#00FF88] transition-colors whitespace-nowrap">
            📊 图表
          </Link>
          <Link href="/unilever/chat" className="hover:text-[#00FF88] transition-colors whitespace-nowrap">
            💬 对话
          </Link>
        </div>
        <span className="hidden sm:inline font-mono text-xs text-neutral-600 shrink-0">
          client: Unilever
        </span>
      </header>
      {children}
    </div>
  );
}
