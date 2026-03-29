import AnalyzeForm from '@/components/organisms/AnalyzeForm'

export default function Home() {
  return (
    <main className="flex flex-col items-center px-4 py-12 sm:px-8">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Gym Form Tracker
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload a photo of your exercise and get instant form feedback.
          </p>
        </header>

        <AnalyzeForm />
      </div>
    </main>
  )
}
