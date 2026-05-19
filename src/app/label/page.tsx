"use client";

import { useRef, useState } from "react";
import LabelingForm from "@/components/organisms/LabelingForm";

const PASSWORD = "TESTING";

export default function LabelPage() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("labelingUnlocked") === "true";
  });
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem("labelingUnlocked", "true");
      setIsUnlocked(true);
    } else {
      setError(true);
      setInput("");
      inputRef.current?.focus();
    }
  };

  return (
    <main className="flex flex-col items-center px-5 py-10 sm:px-8 min-h-screen bg-[#0d0d0f]">
      <div className="w-full sm:max-w-xl flex flex-col gap-7">
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          FormCheck — Label Data
        </span>

        {!isUnlocked ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Access code required
            </p>
            <input
              ref={inputRef}
              type="password"
              value={input}
              autoFocus
              onChange={(e) => {
                setInput(e.target.value);
                setError(false);
              }}
              placeholder="Enter access code"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
            />
            {error && (
              <p className="text-xs text-red-400">Incorrect access code.</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              Unlock
            </button>
          </form>
        ) : (
          <LabelingForm />
        )}
      </div>
    </main>
  );
}
