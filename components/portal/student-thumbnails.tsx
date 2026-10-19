"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { classStudentPreviewLimit, type ClassStudentPreview } from "@/lib/classes/student-preview";
import { studentThumbnailColor } from "@/lib/portal/classroom-colors";
import { cn, getInitials } from "@/lib/utils";

export function StudentThumbnails({ students = [], count, className }: {
  students?: ClassStudentPreview[];
  count?: number;
  className?: string;
}) {
  const visible = students.slice(0, classStudentPreviewLimit);
  if (!visible.length) return null;
  const remaining = Math.max(0, (count ?? students.length) - visible.length);

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex w-fit items-center -space-x-2", className)} aria-label="Students in this class">
        {visible.map((student) => (
          <Tooltip key={student.id}>
            <TooltipTrigger asChild>
              <span tabIndex={0} role="img" aria-label={`Student: ${student.name}`} title={student.name}
                className="relative cursor-default rounded-full outline-none transition-transform hover:z-10 hover:-translate-y-1 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <Avatar className="size-9 border-2 border-white shadow-sm">
                  <AvatarImage src={student.imageUrl ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className={cn("text-xs font-semibold", studentThumbnailColor(student.id))}>{getInitials(student.name)}</AvatarFallback>
                </Avatar>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="max-w-[calc(100vw-2rem)] [overflow-wrap:anywhere]">{student.name}</TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && <span className="relative flex size-9 items-center justify-center rounded-full border-2 border-white bg-white text-xs font-semibold text-slate-700 shadow-sm" title={`${remaining} more students`} aria-label={`${remaining} more students`}>+{remaining}</span>}
      </div>
    </TooltipProvider>
  );
}
