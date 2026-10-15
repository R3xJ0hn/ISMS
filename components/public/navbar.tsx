"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, Mail, Menu, X } from "lucide-react";
import { cn, isActivePath } from "@/lib/utils";
import { SCHOOL } from "@/lib/public/site";
import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "@/lib/site-settings/defaults";
import { safeExternalUrl } from "@/lib/site-settings/validation";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admissions", href: "/admission" },
  { label: "Programs", href: "/programs" },
  { label: "Branches", href: "/branches" },
  { label: "Contact", href: "/contact" },
  { label: "About Us", href: "/about" },
];

function isActiveLink(
  pathname: string,
  item: (typeof NAV_ITEMS)[number]
) {
  if (item.href === "/") {
    return item.label === "Home" && pathname === "/";
  }

  return isActivePath(pathname, item.href);
}

export default function Navbar({ settings = DEFAULT_SITE_SETTINGS }: { settings?: PublicSiteSettings } = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const portalActive = isActivePath(pathname, "/portal");
  const officialWebsite = safeExternalUrl(settings.officialWebsiteUrl);

  function renderLinks(mobile = false) {
    return NAV_ITEMS.map((item) => {
      const active = isActiveLink(pathname, item);

      return (
        <li key={item.label} className={mobile ? undefined : "flex items-center gap-1"}>
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={mobile ? () => setOpen(false) : undefined}
            className={cn(
              "border-b-2 border-transparent px-3 transition-colors hover:text-accent",
              mobile ? "block py-4" : "inline-flex py-2",
              active && "border-accent font-bold text-accent"
            )}
          >
            {item.label}
          </Link>
        </li>
      );
    });
  }

  return (
    <>
      {/* Top Bar */}
      <div className="flex w-full flex-col gap-2 bg-[#3b3570] px-5 py-1 text-xs text-white sm:flex-row sm:items-center sm:justify-between">
        <p className="whitespace-normal sm:min-w-0 sm:flex-1 sm:whitespace-nowrap sm:truncate">
          This is not the official website of Datamex College of Saint Adeline.
          {officialWebsite ? (
            <> For official information, visit the school&apos;s <a href={officialWebsite} className="underline">Official Website</a>.</>
          ) : (
            <> For official information, contact the school directly.</>
          )}
        </p>

        <div className="hidden min-w-0 max-w-[48%] items-center gap-4 sm:flex">
          {settings.contactPhone && <div className="flex min-w-0 items-center gap-1">
            <Phone size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{settings.contactPhone}</span>
          </div>}
          {settings.contactEmail && <div className="flex min-w-0 items-center gap-1">
            <Mail size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{settings.contactEmail}</span>
          </div>}
        </div>
      </div>

      {/* Main Nav */}
      <nav className="sticky top-0 z-50 bg-white shadow-2xs">
        <div className="mx-auto flex h-20 items-center justify-between gap-4 px-5 shadow-md/30 xl:px-10 2xl:px-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src={SCHOOL.assets.logo}
              alt="Logo"
              width={48}
              height={48}
              className="h-12 w-12"
            />
            <div className="border-l-4 border-amber-400 pl-3">
              <p className="font-bold text-[#2e2a6b] leading-tight">
                DATAMEX{" "}
                <span className="font-semibold text-[#f4a300]">Meycauayan</span>
              </p>
              <p className="text-sm text-gray-600">College of Saint Adeline</p>
            </div>
          </div>

          {/* Desktop Menu */}
          <ul className="hidden items-center gap-2 font-medium text-gray-600 xl:flex 2xl:gap-6">
            {renderLinks()}
          </ul>

          {/* Right Link */}
          <Link
            href="/portal"
            aria-current={portalActive ? "page" : undefined}
            className={cn(
              "hidden border-b-2 border-transparent px-3 py-2 font-semibold text-[#2e2a6b] transition-colors hover:text-accent xl:block",
              portalActive && "border-accent font-bold text-accent"
            )}
          >
            MyDCSAePortal
          </Link>

          {/* Mobile Toggle */}
          <button
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:hidden"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Toggle Menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div
            id="mobile-menu"
            className="absolute max-h-[calc(100dvh-5rem)] w-full overflow-y-auto border-t bg-white px-5 shadow-md/30 xl:hidden"
          >
            <ul className="flex flex-col divide-y text-center font-medium">
              {renderLinks(true)}
              <li className="font-semibold">
                <Link
                  href="/portal"
                  aria-current={portalActive ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block border-b-2 border-transparent px-3 py-4 text-[#2e2a6b] transition-colors hover:text-accent",
                    portalActive && "border-accent font-bold text-accent"
                  )}
                >
                  MyDCSAePortal
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </>
  );
}
