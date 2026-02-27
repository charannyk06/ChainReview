import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Chain<span className="text-brand-500">Review</span>
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            Advanced repo-scale AI code reviewer for TypeScript repos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 text-left">
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Usage Tracking</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Monitor token usage, API calls, and cost estimates across all your reviews.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Review History</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Browse past review runs, findings breakdown, and severity trends.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">API Key Management</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Manage your BYOK API keys securely from the dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
