"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { studentThumbnailColor } from "@/lib/portal/classroom-colors";
import { cn, getInitials } from "@/lib/utils";

export function StudentIdentity({ id, name, imageUrl, nameClassName }: {
  id: string;
  name: string;
  imageUrl?: string | null;
  nameClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar aria-hidden="true" className="size-9">
        <AvatarImage src={imageUrl?.trim() || undefined} alt="" className="object-cover" />
        <AvatarFallback className={cn("text-xs font-semibold", studentThumbnailColor(id))}>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className={cn("min-w-0 whitespace-normal font-medium [overflow-wrap:anywhere]", nameClassName)}>{name}</span>
    </div>
  );
}
