"use client";

import { useState } from "react";
import AnalyzeForm from "@/components/organisms/AnalyzeForm";
import AnalyzeVideoForm from "@/components/organisms/AnalyzeVideoForm";

type Tab = "image" | "video";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("image");

  return (
    <main className="flex flex-col items-center px-4 py-12 sm:px-8">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Gym Form Tracker
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload a photo or video of your exercise and get instant form
            feedback.
          </p>
        </header>

        <div className="flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["image", "video"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "flex-1 rounded-full py-2 text-sm font-medium transition-colors capitalize",
                activeTab === tab
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "image" ? <AnalyzeForm /> : <AnalyzeVideoForm />}
      </div>
    </main>
  );
}
