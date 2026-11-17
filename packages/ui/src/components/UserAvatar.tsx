import { initialsOf } from '../format.ts';
import { Avatar, AvatarFallback } from '../primitives/avatar.tsx';

/** Initials avatar for a person (no photos in this demo). */
export function UserAvatar({
  name,
  size = 'sm',
}: {
  name: string;
  size?: 'sm' | 'default' | 'lg';
}) {
  return (
    <Avatar size={size} aria-hidden>
      <AvatarFallback className="text-[10px] font-medium">{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );
}
