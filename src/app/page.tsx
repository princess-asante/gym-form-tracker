"use client";

import { useState } from "react";
import AnalyzeForm from "@/components/organisms/AnalyzeForm";
import LiveForm from "@/components/organisms/LiveForm";

type Tab = "upload" | "live";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("upload");

  const tabs: { id: Tab; label: string }[] = [
    { id: "upload", label: "Upload Video" },
    { id: "live", label: "Live Session" },
  ];

  return (
    <main className="flex flex-col items-center px-5 py-10 sm:px-8 min-h-screen bg-[#0d0d0f]">
      <div className="w-full sm:max-w-xl flex flex-col gap-7">

        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center">
            {/* Lightning bolt / coach icon */}
            <svg viewBox="0 0 24 24" fill="none" className="size-5 text-zinc-100" aria-hidden="true">
              <path
                d="M13 2L4.5 13.5H11.5L11 22L19.5 10.5H12.5L13 2Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">FormCheck</span>
        </div>

        {/* Hero */}
        <div className="flex flex-col gap-5">
          <h1 className="text-3xl font-semibold leading-snug tracking-tight text-zinc-50">
            Your <em className="not-italic font-semibold italic">personal coach</em>
            <br />on your phone.
          </h1>

          {/* Tab switcher */}
          <div className="flex rounded-full bg-zinc-900 border border-zinc-800 p-1 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex-1 rounded-full py-2 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-zinc-100 text-zinc-900 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-sm text-zinc-400 leading-relaxed">
            Upload a photo or video. Get specific, actionable form feedback.
          </p>
        </div>

        {/* Active tab content */}
        {activeTab === "upload" && <AnalyzeForm />}
        {activeTab === "live" && <LiveForm />}
      </div>
    </main>
  );
}
