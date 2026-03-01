"use client";

import Autoplay from "embla-carousel-autoplay";
import { useRef } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const slides = [
  {
    title: "S.Y. 2026-2027",
    highlight: "APPLICATIONS",
    subtitle: "ARE NOW OPEN",
    school: "FOR COLLEGE & SHS",
    location: "DATAMEX COLLEGE OF SAINT ADELINE",
  },
  {
    title: "YOUR PATH TO",
    highlight: "SUCCESS",
    subtitle: "STARTS HERE",
    school: "DATAMEX COLLEGE OF SAINT ADELINE",
    location: "MEYCAUAYAN",
  },
  {
    title: "BUILD YOUR",
    highlight: "FUTURE",
    subtitle: "WITH US",
    school: "QUALITY EDUCATION",
    location: "FOR TOMORROW",
  },
];

export default function HeroCarousel() {
  const autoplay = useRef(
    Autoplay({
      delay: 3000, // 3 seconds
      stopOnInteraction: false,
      stopOnMouseEnter: true, // pause on hover (optional)
    })
  );

  return (
    <Carousel
      plugins={[autoplay.current]}
      opts={{ loop: true }}
      className="w-full"
    >
      <CarouselContent>
        {slides.map((slide, index) => (
          <CarouselItem key={index}>
            <div className="text-gray-200 max-w-2xl  px-6 rounded-md h-full flex flex-col justify-center">
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
                {slide.title}{" "}
                <span className="text-white bg-primary px-3 rounded-md font-semibold shadow-amber-500/50 shadow-md">
                  {slide.highlight}
                </span>
                <br />
                {slide.subtitle}
              </h1>

              <div className="mt-6">
                <p className="uppercase tracking-widest text-sm opacity-80">
                  {slide.school}
                </p>
                <p className="text-accent font-semibold mt-1">
                  {slide.location}
                </p>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
