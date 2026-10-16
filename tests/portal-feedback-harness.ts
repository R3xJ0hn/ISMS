import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import type * as feedback from "../components/portal/toasts";

const source = ts.transpileModule(readFileSync(new URL("../components/portal/toasts.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

/** Execute the real shared lifecycle with the same React hooks and router as the form under test. */
export function loadPortalFeedback(hooks: Record<string, unknown>, router: { push: (url: string) => void; refresh?: () => void },
  notify: (message: string, variant: "success" | "error") => void = () => undefined
) {
  const modules: Record<string, unknown> = {
    react: { ...React, ...hooks, useContext: () => notify },
    "react/jsx-runtime": {}, "radix-ui": {}, "lucide-react": {}, "@/lib/utils": {},
    "next/navigation": { useRouter: () => router },
  };
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected feedback dependency: ${name}`);
    return modules[name];
  } });
  return loaded.exports as typeof feedback;
}
