'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { cn } from '@/lib/utils';

const FORM_REVEAL_MS = 2400;

interface AuthPageShellProps {
  children: React.ReactNode;
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const formTimer = window.setTimeout(() => setShowForm(true), FORM_REVEAL_MS);

    return () => {
      window.clearTimeout(formTimer);
    };
  }, []);

  useEffect(() => {
    if (showForm) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showForm]);

  return (
    <div className="relative min-h-screen bg-background px-3 py-6 pb-12 sm:px-4 sm:py-8 sm:pb-16">
      <div
        className={cn(
          'absolute right-3 top-3 transition-opacity duration-700 sm:right-6 sm:top-6',
          showForm ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <LanguageToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 pt-8 sm:gap-5 sm:pt-10">
        <div className="flex w-full justify-center px-1 sm:px-2">
          <div className="auth-logo-rise">
            <Image
              src="/delivery-tracker-logo.png"
              alt="Delivery Tracker"
              width={320}
              height={320}
              className="h-auto w-56 max-w-full object-contain sm:w-72 md:w-80"
              priority
            />
          </div>
        </div>

        <div
          className={cn(
            'w-full transition-[opacity,transform,max-height] duration-700 ease-out',
            showForm
              ? 'max-h-[1200px] translate-y-0 opacity-100'
              : 'max-h-0 translate-y-6 opacity-0'
          )}
        >
          <div className={cn(!showForm && 'pointer-events-none')}>{children}</div>
        </div>
      </div>
    </div>
  );
}
