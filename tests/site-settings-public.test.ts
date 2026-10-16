import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import * as utils from "../lib/utils";
import { SCHOOL } from "../lib/public/site";
import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "../lib/site-settings/defaults";
import * as validation from "../lib/site-settings/validation";
import * as contactLinks from "../lib/public/contact-links";

type Props = Record<string, unknown> & { children?: React.ReactNode };
const settings: PublicSiteSettings = { ...DEFAULT_SITE_SETTINGS, aboutTitle: "Synthetic School <script>alert(1)</script>", aboutIntro: "Our school <b>story</b>.\n\nSecond paragraph & experience.", mission: "Serve <img src=x onerror=unsafe> learners.", vision: "A bright future.", contactIntro: "Contact our <strong>team</strong>.", contactEmail: "synthetic+registrar@example.test", contactPhone: "+63 (912) 345-6789", contactAddress: "123 Synthetic Street\nOur City", officeHours: "Monday to Friday\n8 AM – 5 PM", mapUrl: "https://maps.example.test/Campus", facebookUrl: "http://social.example.test/School", officialWebsiteUrl: "https://website.example.test/Portal" };

function load(path: string, values = settings, pathname = "/about") {
  let reads = 0;
  const modules: Record<string, unknown> = {
    react: { ...React, useState: () => [false, () => undefined] }, "react/jsx-runtime": jsxRuntime, "lucide-react": icons,
    "next/link": { default: ({ href, children, ...props }: Props) => React.createElement("a", { ...props, href }, children) },
    "next/image": { default: (props: Props) => {
      const attributes = { ...props };
      delete attributes.fill;
      delete attributes.priority;
      return React.createElement("img", attributes);
    } },
    "next/navigation": { usePathname: () => pathname },
    "@/lib/utils": utils,
    "@/lib/public/site": { SCHOOL },
    "@/lib/site-settings/defaults": { DEFAULT_SITE_SETTINGS },
    "@/lib/site-settings/validation": validation,
    "@/lib/public/contact-links": contactLinks,
    "@/lib/site-settings/service": { getPublicSiteSettings: async () => { reads++; return values; } },
  };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as { default: (props?: { settings?: PublicSiteSettings }) => React.ReactNode | Promise<React.ReactNode> } };
  runInNewContext(code, { module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected public settings dependency ${name}`); return modules[name]; } });
  return { component: loaded.exports.default, readCount: () => reads };
}

test("About Us displays saved prose as plain escaped text and working exploration links", async () => {
  const h = load("../app/(public)/about/page.tsx");
  const markup = renderToStaticMarkup(await h.component());
  assert.equal(h.readCount(), 1);
  assert.match(markup, /Synthetic School &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(markup, /Our school &lt;b&gt;story&lt;\/b&gt;\.\n\nSecond paragraph &amp; experience\./);
  assert.match(markup, /Serve &lt;img src=x onerror=unsafe&gt; learners\./);
  assert.match(markup, /Our mission/);
  assert.match(markup, /Our vision/);
  for (const href of ["/contact", "/programs", "/branches", "/admission"]) assert.match(markup, new RegExp(`href="${href}"`));
  assert.doesNotMatch(markup, /<script>|<strong>|<b>|onerror="/);
});

test("About Us omits unconfigured mission and vision without inventing school claims", async () => {
  const empty = load("../app/(public)/about/page.tsx", { ...settings, mission: "", vision: "" });
  const markup = renderToStaticMarkup(await empty.component());
  assert.doesNotMatch(markup, /Our mission|Our vision|Our mission and vision/);
  const missionOnly = load("../app/(public)/about/page.tsx", { ...settings, vision: "" });
  const missionMarkup = renderToStaticMarkup(await missionOnly.component());
  assert.match(missionMarkup, /Our mission/);
  assert.doesNotMatch(missionMarkup, /Our vision/);
});

test("Contact Us renders current email, phone, address, hours and safe external destinations", async () => {
  const h = load("../app/(public)/contact/page.tsx");
  const markup = renderToStaticMarkup(await h.component());
  assert.equal(h.readCount(), 1);
  assert.match(markup, /Contact our &lt;strong&gt;team&lt;\/strong&gt;\./);
  assert.match(markup, /href="mailto:synthetic%2Bregistrar@example.test"/);
  assert.match(markup, /href="tel:\+639123456789"/);
  assert.match(markup, /123 Synthetic Street\nOur City/);
  assert.match(markup, /Monday to Friday\n8 AM/);
  for (const href of [settings.mapUrl, settings.facebookUrl, settings.officialWebsiteUrl]) {
    assert.ok(markup.includes(`href="${href}" target="_blank" rel="noopener noreferrer"`));
  }
  for (const href of ["/branches", "/programs", "/admission"]) assert.match(markup, new RegExp(`href="${href}"`));
  assert.doesNotMatch(markup, /<form|<strong>/);
});

test("Contact Us never creates unsafe links from invalid saved contact data and handles empty details", async () => {
  const unsafe = load("../app/(public)/contact/page.tsx", { ...settings, contactEmail: "x@example.test?subject=Injected", contactPhone: "javascript:alert(1)", mapUrl: "javascript:alert(1)", facebookUrl: "https://user:secret@example.test/", officialWebsiteUrl: "data:text/html,unsafe" });
  const markup = renderToStaticMarkup(await unsafe.component());
  assert.doesNotMatch(markup, /href="(?:javascript:|data:|https:\/\/user:secret|tel:javascript)/);
  assert.doesNotMatch(markup, /href="mailto:[^"]*\?subject=/);
  const allEmpty = Object.fromEntries(Object.keys(settings).map((field) => [field, ""])) as PublicSiteSettings;
  const h = load("../app/(public)/contact/page.tsx", allEmpty);
  const empty = renderToStaticMarkup(await h.component());
  assert.match(empty, /Contact details will be available soon/);
  assert.doesNotMatch(empty, /href="mailto:|href="tel:|Office hours/);
});

test("public navigation resolves About Us and Contact to separate pages with correct current-page status", () => {
  for (const path of ["/about", "/contact"]) {
    const h = load("../components/public/navbar.tsx", settings, path);
    const markup = renderToStaticMarkup(h.component({ settings }) as React.ReactNode);
    assert.match(markup, /href="\/about"/);
    assert.match(markup, /href="\/contact"/);
    assert.match(markup, new RegExp(`<a(?=[^>]*href="${path}")(?=[^>]*aria-current="page")[^>]*>`));
    assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(markup, /synthetic\+registrar@example.test/);
    assert.match(markup, /\+63 \(912\) 345-6789/);
    assert.match(markup, /href="https:\/\/website.example.test\/Portal"/);
  }
});

test("navbar and footer support existing no-prop renders and current saved contacts", () => {
  for (const path of ["../components/public/navbar.tsx", "../components/public/footer.tsx"]) {
    const h = load(path);
    const defaults = renderToStaticMarkup(h.component() as React.ReactNode);
    assert.ok(defaults.includes(DEFAULT_SITE_SETTINGS.contactEmail));
    const saved = renderToStaticMarkup(h.component({ settings }) as React.ReactNode);
    assert.ok(saved.includes(settings.contactEmail));
    assert.equal(saved.includes(DEFAULT_SITE_SETTINGS.contactEmail), false);
    assert.match(saved, /href="\/about"/);
    assert.match(saved, /href="\/contact"/);
    const unsafe = renderToStaticMarkup(h.component({ settings: { ...settings, officialWebsiteUrl: "javascript:alert(1)", facebookUrl: "https://user:secret@example.test/", mapUrl: "data:text/html,unsafe" } }) as React.ReactNode);
    assert.doesNotMatch(unsafe, /href="(?:javascript:|data:|https:\/\/user:secret)/);
  }
});

test("email and phone destinations preserve legitimate contacts while blocking URI injection", () => {
  assert.equal(contactLinks.safeEmailHref(" registrar+admissions@example.test "), "mailto:registrar%2Badmissions@example.test");
  assert.equal(contactLinks.safePhoneHref(" +63 (912) 345-6789 "), "tel:+639123456789");
  assert.equal(contactLinks.safePhoneHref("(02) 921 8350"), "tel:029218350");
  for (const email of ["", "no-email", "x@example.test\nBcc:attack@example.test", "<x@example.test>"]) assert.equal(contactLinks.safeEmailHref(email), "");
  for (const phone of ["", "javascript:alert(1)", "12", "1234567890123456", "123;phone-context=unsafe", "1+2345"]) assert.equal(contactLinks.safePhoneHref(phone), "");
});
