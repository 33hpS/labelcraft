import React from 'react';
import Navigation from './Navigation';

/**
 * Main application layout component
 */
interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <Navigation />
      <main className="flex-1 w-full overflow-x-hidden">
        <div className="mx-auto w-full max-w-full lg:max-w-screen-2xl px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
