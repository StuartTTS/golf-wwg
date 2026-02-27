import Link from 'next/link';
import { Flag, Gamepad2, Calculator, Users, Wallet, BarChart3 } from 'lucide-react';

const features = [
  { icon: Flag, title: 'Live Scorecard', description: 'Enter scores hole-by-hole with real-time sync across all players\u2019 devices.' },
  { icon: Gamepad2, title: 'Game Formats', description: 'Skins, Nassau, Match Play, Wolf, Best Ball, Scramble, and more running simultaneously.' },
  { icon: Calculator, title: 'WHS Handicaps', description: 'Automatic handicap tracking using the World Handicap System formula.' },
  { icon: Users, title: 'Group Management', description: 'Create groups, invite members, and track season-long leaderboards.' },
  { icon: Wallet, title: 'Settlement Tracking', description: 'Automatic payout calculations with debt simplification.' },
  { icon: BarChart3, title: 'Player Stats', description: 'Track fairways, greens, putts, scoring averages, and trends over time.' },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-surface-900/80 backdrop-blur-sm border-b border-surface-700">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-golf-600">
            <span className="text-sm font-bold text-white">&#9971;</span>
          </div>
          <span className="text-xl font-display font-bold text-surface-50">WWG</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-surface-300 hover:text-surface-50 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-golf-600 px-5 py-2 text-sm font-semibold text-white hover:bg-golf-500 transition-colors shadow-card"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="max-w-3xl text-5xl font-display font-extrabold tracking-tight text-surface-50 sm:text-6xl">
          Group Golf Scoring
          <span className="text-golf-400"> Made Simple</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-surface-300">
          Record scores in real-time, run multiple game formats simultaneously,
          track handicaps, and settle up with your golf group.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-golf-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-golf-500 transition-colors shadow-elevated"
          >
            Create Your Group
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-surface-500 bg-surface-800/50 px-8 py-3.5 text-base font-medium text-surface-200 hover:bg-surface-700 hover:text-surface-50 transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Features */}
        <div className="mt-24 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="group rounded-golf-lg border border-surface-500 bg-surface-800 p-6 text-left shadow-card hover:shadow-elevated hover:-translate-y-px transition-all duration-150">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-golf bg-golf-600/10">
        <Icon className="h-5 w-5 text-golf-400" />
      </div>
      <h3 className="text-base font-semibold text-surface-50">{title}</h3>
      <p className="mt-2 text-sm text-surface-300">{description}</p>
    </div>
  );
}
