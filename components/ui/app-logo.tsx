import Image from 'next/image';
import { cn } from '@/lib/utils';

const SIZE_PX = {
  sm: 16,
  md: 20,
} as const;

type AppLogoProps = {
  size?: keyof typeof SIZE_PX;
  className?: string;
};

export function AppLogo({ size = 'md', className }: AppLogoProps) {
  const px = SIZE_PX[size];

  return (
    <Image
      src="/favicon.png"
      alt=""
      width={px}
      height={px}
      className={cn('shrink-0 object-contain', size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', className)}
    />
  );
}
