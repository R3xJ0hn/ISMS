"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studentThumbnailColor } from "@/lib/portal/classroom-colors";
import { filterTableRows } from "@/lib/table";
import { getInitials } from "@/lib/utils";

export type ClassStudentOption = { id: string; name: string; studentNumber: string | null; userImage?: string | null };

type Props = {
  students: readonly ClassStudentOption[];
  selectedIds: readonly string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
};

const rosterLimit = 1_000;
const resultLimit = 20;

function StudentIdentity({ student }: { student: ClassStudentOption }) {
  return <>
    <Avatar className="size-10">
      {student.userImage && <AvatarImage src={student.userImage} alt="" className="object-cover" />}
      <AvatarFallback className={studentThumbnailColor(student.id)}>{getInitials(student.name, "S")}</AvatarFallback>
    </Avatar>
    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
      <span className="block text-sm font-medium">{student.name}</span>
      <span className="block text-xs text-muted-foreground">{student.studentNumber ?? "Student number not assigned"}</span>
    </span>
  </>;
}

export function ClassStudentPicker({ students, selectedIds, disabled = false, onChange }: Props) {
  const id = useId();
  const listId = `${id}-results`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = useMemo(() => [...new Set(selectedIds)], [selectedIds]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const matches = useMemo(() => query.trim() ? filterTableRows(students.filter((student) => !selectedSet.has(student.id)), query,
    (student) => `${student.name} ${student.studentNumber ?? ""}`) : [], [students, selectedSet, query]);
  const options = matches.slice(0, resultLimit);
  const atLimit = selected.length >= rosterLimit;
  const searchDisabled = disabled || atLimit || students.length === 0;
  const open = expanded && Boolean(query.trim()) && !searchDisabled;
  const currentIndex = Math.min(activeIndex, options.length - 1);
  const activeId = open && currentIndex >= 0 ? `${id}-option-${currentIndex}` : undefined;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setExpanded(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (open && currentIndex >= 0) listRef.current?.children.item(currentIndex)?.scrollIntoView?.({ block: "nearest" });
  }, [open, currentIndex, query]);

  function addStudent(studentId: string) {
    if (searchDisabled || selectedSet.has(studentId) || !studentById.has(studentId)) return;
    onChange([...selected, studentId]);
    setQuery("");
    setExpanded(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && options[currentIndex]) addStudent(options[currentIndex].id);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
      setActiveIndex(0);
    } else if (event.key === "Tab") {
      setExpanded(false);
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && query.trim() && !searchDisabled) {
      event.preventDefault();
      setExpanded(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(!open ? (direction === 1 ? 0 : Math.max(options.length - 1, 0))
        : Math.max(0, Math.min(currentIndex + direction, options.length - 1)));
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : Math.max(options.length - 1, 0));
    }
  }

  return <div className="min-w-0 space-y-4">
    <div ref={rootRef} className="relative space-y-2" onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
    }}>
      <label htmlFor={id} className="block text-sm font-medium">Add students</label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={inputRef} id={id} type="text" role="combobox" value={query} disabled={searchDisabled}
          autoComplete="off" placeholder="Search name or student number..." className="pl-9"
          aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-activedescendant={activeId} aria-describedby={`${id}-help`}
          onChange={(event) => { setQuery(event.target.value); setExpanded(true); setActiveIndex(0); }}
          onFocus={() => { if (query.trim()) setExpanded(true); }} onKeyDown={keyDown} />
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{atLimit ? "This class has reached the limit of 1,000 students. Remove a student to add another."
        : students.length === 0 ? "No saved students are available yet. Add a student through Manage Students."
          : "Search and select a saved student to add them to this class."}</p>
      {open && <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
        <ul ref={listRef} id={listId} role="listbox" aria-label="Students matching your search" className="max-h-72 overflow-y-auto p-1">
          {options.map((student, index) => <li key={student.id} id={`${id}-option-${index}`} role="option"
            aria-selected={currentIndex === index} className={`flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 ${currentIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
            onPointerDown={(event) => event.preventDefault()} onPointerMove={() => setActiveIndex(index)}
            onClick={() => addStudent(student.id)}><StudentIdentity student={student} /></li>)}
        </ul>
        {options.length === 0 && <p role="status" className="px-3 py-4 text-sm text-muted-foreground">No students match your search, or they are already in this class.</p>}
        {matches.length > resultLimit && <p role="status" className="border-t px-3 py-2 text-xs text-muted-foreground">Showing the first {resultLimit} matches. Refine your search to find another student.</p>}
      </div>}
    </div>
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium">Students in this class</h3>
      <span role="status" className="text-xs text-muted-foreground">{selected.length} {selected.length === 1 ? "student" : "students"}</span>
    </div>
    {selected.length ? <ul aria-label="Students in this class" className="max-h-96 divide-y divide-border overflow-y-auto rounded-md border border-border">
      {selected.map((studentId) => {
        const student = studentById.get(studentId) ?? { id: studentId, name: "Unavailable student", studentNumber: null };
        return <li key={studentId} className="flex min-w-0 items-center gap-3 p-3">
          <StudentIdentity student={student} />
          <Button type="button" variant="ghost" size="icon" disabled={disabled} className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${student.name} from this class`} onClick={() => { if (!disabled) onChange(selected.filter((id) => id !== studentId)); }}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </li>;
      })}
    </ul> : <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No students added yet. Use the search above or upload an Excel roster.</p>}
  </div>;
}
