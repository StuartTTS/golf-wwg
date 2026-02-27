import type { ImgHTMLAttributes } from 'react';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  image?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, image, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name);

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-golf-700 to-golf-500 font-semibold text-white ${sizeClasses[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
