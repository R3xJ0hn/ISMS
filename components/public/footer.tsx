import React from "react";
import { Facebook, Globe, MapPin } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-primary text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Programs
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="#"
                  className="text-slate-300 transition-colors hover:text-white"
                >
                  Senior High School
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-slate-300 transition-colors hover:text-white"
                >
                  College
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Admissions
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/admission"
                  className="text-slate-300 transition-colors hover:text-white"
                >
                  Procedures and Requirements
                </Link>
              </li>
              <li>
                <Link
                  href="/admission"
                  className="text-slate-300 transition-colors hover:text-white"
                >
                  Online Reservation
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Contact
            </h3>

            <address className="mt-4 space-y-3 text-sm not-italic">
              <a
                href="https://maps.app.goo.gl/AYHnJy3oRhh6HsfC8"
                className="group flex items-start gap-3 text-slate-300 transition-colors hover:text-white"
              >
                <MapPin size={16} className="mt-0.5 shrink-0" />
                <span>
                  Datamex bldg., Ngusong Buwaya St., Brgy Saluysoy Meycauayan
                  City Bulacan
                </span>
              </a>

              <a
                href="https://stadeline.education/"
                className="group flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
              >
                <Globe size={16} className="shrink-0" />
                <span>Our Official Website</span>
              </a>

              <a
                href="https://www.facebook.com/datamexcollegeofstadelinemeycauayan/"
                className="group flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
              >
                <Facebook size={16} className="shrink-0" />
                <span>Datamex Meycauayan.</span>
              </a>
            </address>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-gray-950">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <span className="block text-center text-xs text-slate-400">
            Copyright {currentYear} Datamex College of Saint Adeline. All rights
            reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
