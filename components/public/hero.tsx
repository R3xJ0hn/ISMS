"use client";

import HeroCarousel from "./hero-carousel";
import HeroForm from "./hero-form";

export default function Hero() {
  return (
    <section className="relative h-5/6 w-full overflow-hidden">
      {/* Background */}
      <div
        className="fixed -z-10 top-10 inset-0 bg-cover bg-center max-w-screen"
        style={{ backgroundImage: "url('https://res.cloudinary.com/dghjtnxjw/image/upload/v1772361480/uploads/obfeeocicbq2qm95osmn.png')" }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs max-w-screen" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 lg:py-20 ">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
          <div className="lg:col-span-2">
            <HeroCarousel />
          </div>

          <div className="lg:col-span-1">
            <HeroForm />
          </div>
        </div>
      </div>
    </section>
  );
}
