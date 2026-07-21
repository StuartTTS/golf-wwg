'use client';

// Home action-card row for the action-centric experience. Reads the same
// lib/nav-modes source of truth as the sidebar + Start sheet, so labels and
// descriptions stay in sync. Live modes are links; unbuilt modes render as
// "Soon" placeholders. See the home/menu discussion.

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { startModes, joinGame, type NavAction } from '@/lib/nav-modes';

function SoonBadge() {
  return (
    <span className="rounded bg-surface-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-surface-400">
      Soon
    </span>
  );
}

function ActionCard({ action }: { action: NavAction }) {
  const Icon = action.icon;

  const body = (
    <CardHeader className="flex-row items-start gap-3">
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
          action.available ? 'bg-golf-800 text-golf-300' : 'bg-surface-700 text-surface-400'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          {action.label}
          {!action.available && <SoonBadge />}
        </CardTitle>
        <CardDescription className="mt-0.5">{action.description}</CardDescription>
      </div>
    </CardHeader>
  );

  if (action.available) {
    return (
      <Link href={action.href} className="block">
        <Card className="h-full cursor-pointer border-2 border-golf-600 bg-golf-900/20 transition-shadow hover:shadow-md">
          {body}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      className="h-full cursor-default select-none opacity-70"
      title={`${action.description} — coming soon`}
    >
      {body}
    </Card>
  );
}

export function HomeActionCards() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
        Start a round
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {startModes.map((m) => (
          <ActionCard key={m.key} action={m} />
        ))}
        <ActionCard action={joinGame} />
      </div>
    </section>
  );
}
