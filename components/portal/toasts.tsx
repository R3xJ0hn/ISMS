"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Toast } from "radix-ui";
import { CircleCheck, CircleX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Notification = { id: number; message: string; variant: "success" | "error" };
type Notify = (message: string, variant: Notification["variant"]) => void;
const ToastContext = createContext<Notify | null>(null);

export function PortalToastProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextId = useRef(0);
  const notify = useCallback<Notify>((message, variant) => {
    if (!message.trim()) return;
    const notification = { id: ++nextId.current, message, variant };
    setNotifications((current) => [...current.slice(-3), notification]);
  }, []);
  const dismiss = useCallback((id: number) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      <Toast.Provider label="Portal notification" swipeDirection="right">
        {children}
        {notifications.map(({ id, message, variant }) => {
          const successful = variant === "success";
          const Icon = successful ? CircleCheck : CircleX;
          return (
            <Toast.Root key={id} open duration={successful ? 5000 : 8000} type={successful ? "background" : "foreground"}
              onOpenChange={(open) => { if (!open) dismiss(id); }} data-portal-toast={variant}
              className={cn("pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-right-5 motion-reduce:animate-none", successful ? "border-green-500/40" : "border-destructive/40")}>
              <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", successful ? "text-green-600" : "text-destructive")} />
              <Toast.Title className="min-w-0 flex-1 break-words text-sm font-medium leading-6">{message}</Toast.Title>
              <Toast.Close aria-label="Dismiss notification" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X aria-hidden="true" className="size-4" />
              </Toast.Close>
            </Toast.Root>
          );
        })}
        <Toast.Viewport label="Portal notifications ({hotkey})" className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex max-w-sm flex-col gap-3 outline-none sm:left-auto sm:w-96" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function usePortalToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("Portal notifications require PortalToastProvider.");
  return notify;
}

/** Announce each completed action once, including identical messages on retries. */
export function useActionToast(state: { success: boolean; message: string }) {
  const notify = usePortalToast();
  const previous = useRef<typeof state | null>(null);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    if (state.message) notify(state.message, state.success ? "success" : "error");
  }, [state, notify]);
}

/** A callback ref also protects forms mounted later inside a dialog portal. */
export function usePreservedFormDraft() {
  return useCallback((form: HTMLFormElement | null) => {
    if (!form) return;
    // React resets action forms during commit, when delegated reset handlers are disabled.
    const keepDraft = (event: Event) => event.preventDefault();
    form.addEventListener("reset", keepDraft);
    return () => form.removeEventListener("reset", keepDraft);
  }, []);
}

/** Preserve the draft through action-form resets, then announce and leave a successful save. */
export function usePortalFormFeedback(state: { success: boolean; message: string }, {
  returnTo, refresh = false,
}: { returnTo: string; refresh?: boolean }) {
  const router = useRouter();
  const formRef = usePreservedFormDraft();
  const completed = useRef<typeof state | null>(null);
  useActionToast(state);

  useEffect(() => {
    if (!state.success || completed.current === state) return;
    completed.current = state;
    router.push(returnTo);
    if (refresh) router.refresh();
  }, [state, router, returnTo, refresh]);

  return formRef;
}
