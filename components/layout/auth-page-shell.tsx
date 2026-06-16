'use client';

import Image from 'next/image';
import { LanguageToggle } from '@/components/ui/language-toggle';

interface AuthPageShellProps {
  children: React.ReactNode;
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-3 py-6 pb-12 sm:px-4 sm:py-8 sm:pb-16">
      <div className="absolute right-3 top-3 sm:right-6 sm:top-6">
        <LanguageToggle />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 sm:-right-32 sm:-top-32 sm:h-96 sm:w-96" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary/5 sm:-bottom-32 sm:-left-32 sm:h-96 sm:w-96" />
      </div>

      <div className="relative flex w-full max-w-md flex-col items-center gap-4 sm:gap-5">
        <div className="flex w-full items-center justify-center px-1 sm:px-2">
          <Image
            src="/delivery-tracker-logo.png"
            alt="Delivery Tracker"
            width={320}
            height={320}
            className="h-auto w-56 max-w-full object-contain sm:w-72 md:w-80"
            priority
          />
        </div>
        {children}
      </div>
    </div>
  );
}
