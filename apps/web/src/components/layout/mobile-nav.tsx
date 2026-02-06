'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/home', label: 'Home' },
  { href: '/groups', label: 'Groups' },
  { href: '/courses', label: 'Courses' },
  { href: '/profile', label: 'Profile' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-dark-300 bg-dark-100 lg:hidden">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center py-2 text-xs font-medium ${
              isActive ? 'text-golf-600' : 'text-dark-600'
            }`}
          >
            <span className={`mb-1 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-golf-600' : 'bg-transparent'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
