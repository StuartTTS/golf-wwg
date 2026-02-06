import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">&#9971;</span>
          <span className="text-xl font-bold text-slate-900">GolfApp</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-golf-600 px-4 py-2 text-sm font-medium text-white hover:bg-golf-700"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Group Golf Scoring
          <span className="text-golf-600"> Made Simple</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          Record scores in real-time, run multiple game formats simultaneously,
          track handicaps, and settle up with your golf group.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/register"
            className="rounded-md bg-golf-600 px-6 py-3 text-base font-medium text-white hover:bg-golf-700"
          >
            Create Your Group
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign In
          </Link>
        </div>

        {/* Features */}
        <div className="mt-20 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Live Scorecard"
            description="Enter scores hole-by-hole with real-time sync across all players' devices."
          />
          <FeatureCard
            title="Game Formats"
            description="Skins, Nassau, Match Play, Wolf, Best Ball, Scramble, and more running simultaneously."
          />
          <FeatureCard
            title="WHS Handicaps"
            description="Automatic handicap tracking using the World Handicap System formula."
          />
          <FeatureCard
            title="Group Management"
            description="Create groups, invite members, and track season-long leaderboards."
          />
          <FeatureCard
            title="Settlement Tracking"
            description="Automatic payout calculations with debt simplification."
          />
          <FeatureCard
            title="Player Stats"
            description="Track fairways, greens, putts, scoring averages, and trends over time."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-left">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
