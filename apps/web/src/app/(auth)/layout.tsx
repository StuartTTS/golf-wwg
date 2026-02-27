import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-surface-950 via-surface-900 to-golf-900 px-4 py-12 sm:px-6 lg:px-8">
      {/* Subtle pattern overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #22c55e 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Auth card */}
      <div className="relative w-full max-w-md mx-4">
        <div className="rounded-2xl border border-surface-700/50 bg-surface-800/80 shadow-elevated backdrop-blur-md p-8">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <Link href="/" className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-golf-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-white"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <span className="font-display text-2xl font-bold text-surface-50">
                WWG
              </span>
            </Link>
          </div>

          {/* Page content */}
          {children}
        </div>
      </div>
    </div>
  );
}
