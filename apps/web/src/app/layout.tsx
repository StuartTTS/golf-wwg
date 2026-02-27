import type { Metadata } from 'next';
import { SupabaseProvider } from '@/providers/supabase-provider';
import { AuthProvider } from '@/providers/auth-provider';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'WWG - Group Golf Scoring',
  description: 'Record group golf scores, manage games, and track handicaps.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-900 font-sans antialiased">
        <SupabaseProvider>
          <AuthProvider>{children}</AuthProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
