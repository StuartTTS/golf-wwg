import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar - hidden on mobile, visible on md+ */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <Sidebar />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col md:pl-64">
        <Header />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-6 px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation - visible only on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
