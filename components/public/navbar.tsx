"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, Mail, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admissions", href: "/admission" },
  { label: "Programs", href: "/" },
  { label: "Branches", href: "/" },
  { label: "Contact", href: "/" },
  { label: "About Us", href: "/" },
];

function isActiveLink(
  pathname: string,
  item: (typeof NAV_ITEMS)[number]
) {
  if (item.href === "/") {
    return item.label === "Home" && pathname === "/";
  }

  return isActiveHref(pathname, item.href);
}

function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const portalActive = isActiveHref(pathname, "/portal");

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
        <p className="whitespace-normal sm:whitespace-nowrap sm:truncate">
          This is not the official website of Datamex College of Saint Adeline.
          For official information, visit the school&apos;s
          <a href="https://www.stadeline.education/" className="underline">
            {" "}
            Official Website
          </a>
          .
        </p>

        <div className="hidden items-center gap-6 sm:flex">
          <div className="flex items-center gap-1">
            <Phone size={12} />
            <span>(02) 921 8350</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail size={12} />
            <span>datamex_registrar@stadeline.edu.ph</span>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="sticky top-0 z-50 bg-white shadow-2xs">
        <div className="flex h-20 items-center justify-between mx-auto px-5 lg:px-20 shadow-md/30">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772363064/uploads/czeccbdle54njfottdz1.png"
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
          <ul className="hidden lg:flex items-center gap-10 font-medium text-gray-600">
            {renderLinks()}
          </ul>

          {/* Right Link */}
          <Link
            href="/portal"
            aria-current={portalActive ? "page" : undefined}
            className={cn(
              "hidden border-b-2 border-transparent px-3 py-2 font-semibold text-[#2e2a6b] transition-colors hover:text-accent lg:block",
              portalActive && "border-accent font-bold text-accent"
            )}
          >
            MyDCSAePortal
          </Link>

          {/* Mobile Toggle */}
          <button
            className="lg:hidden"
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
            className="lg:hidden border-t bg-white absolute w-full px-5 shadow-md/30"
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
