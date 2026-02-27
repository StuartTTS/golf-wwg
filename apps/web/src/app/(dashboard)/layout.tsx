import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-surface-950">
      {/* Sidebar - hidden on mobile, visible on lg+ */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6 px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation - visible only on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
