import React from "react";

export default function Footer() {
  return (
    <footer className="w-full bg-primary text-slate-100">
      {/* <!-- TOP --> */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {/* <!-- Programs --> */}
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Programs
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="#"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Senior High School
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  College
                </a>
              </li>
            </ul>
          </div>

          {/* <!-- Admissions --> */}
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Admissions
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="#"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Procedures and Requirements
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Online Reservation
                </a>
              </li>
            </ul>
          </div>



          {/* <!-- Contact --> */}
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Contact
            </h3>

            <address className="mt-4 not-italic space-y-3 text-sm">
              <a
                href="https://maps.app.goo.gl/AYHnJy3oRhh6HsfC8"
                className="group flex items-start gap-3 text-slate-300 hover:text-white transition-colors"
              >
                <i className="fa-solid fa-location-dot mt-0.5"></i>
                <span>
                  Datamex bldg., Ngusong Buwaya St., Brgy Saluysoy Meycauayan
                  City Bulacan
                </span>
              </a>

              <a
                href="https://stadeline.education/"
                className="group flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
              >
                <i className="fa-regular fa-globe-pointer"></i>
                <span>Our Official Website</span>
              </a>

              <a
                href="https://www.facebook.com/datamexcollegeofstadelinemeycauayan/ "
                className="group flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
              >
                <i className="fa-brands fa-facebook"></i>
                <span>Datamex Meycauayan.</span>
              </a>
            </address>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-gray-950">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <span className="block text-center text-xs text-slate-400">
            © 2016 Datamex College of Saint Adeline · All rights reserved
          </span>
        </div>
      </div>
    </footer>
  );
}
