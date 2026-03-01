"use client";

import * as React from "react";
import AutoScroll from "embla-carousel-auto-scroll";
import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

type LifeCard = {
  id: string;
  title: string;
  description: string;
  image: string;
};

const lifeCards: LifeCard[] = [
  {
    id: "1",
    title: "Cheerdance Competition",
    description:
      "Dynamic moves, synchronized energy, and school pride on full display at our annual Sportfest.",
    image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772378733/643887033_26537294122554958_7318712699005860982_n_c7ycsh.jpg",
  },
  {
    id: "2",
    title: "Hands-on Programming Lab",
    description:
      "Through guided projects and practical exercises, ACT students develop technical skills and confidence in real-world coding environments.",
    image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772378273/315767624_435566088763546_4654058012204217999_n_d6jbrb.jpg",
  },
  {
    id: "3",
    title: "Buwan ng Wika: Recycled Fashion Showcase",
    description:
      "Celebrating Filipino culture and creativity, students transform recyclable materials into stunning gowns that reflect heritage, innovation, and environmental awareness.",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772362898/uploads/okyfmstphhh74qdur5pf.jpg",
  },
  {
    id: "4",
    title: "Living the Legacy of Rizal",
    description:
      "Bringing history to life, students portray key moments from Dr. Jose Rizal’s journey, deepening their understanding of courage, patriotism, and national identity.",
    image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772378273/448554163_773172711669547_4323797664346693034_n_xywyzc.jpg",
  },
  {
  id: "5",
  title: "SHS Laboratory Activity",
  description: "Senior High School students apply classroom knowledge through hands-on lab activities that strengthen technical and analytical skills.",
  image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772378272/462140510_843889427931208_8381110240280075940_n_at0u1b.jpg",
},
{
  id: "6",
  title: "NSTP Community Engagement",
  description: "Empowering communities through outreach activities, teamwork, and service-driven initiatives that build leadership and social responsibility.",
  image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772378273/447436132_122155094288130803_5707611443381433438_n_vax5rs.jpg",
},
{
  id: "7",
  title: "Hands-on Hardware Training",
  description: "Students explore computer hardware components and troubleshooting techniques through guided, practical learning sessions.",
  image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772378273/387868047_631371915849628_2101160376142995371_n_adfli1.jpg",
},
{
  id: "8",
  title: "Masskara Festival Performance",
  description: "Students showcase vibrant energy and cultural pride through a colorful Masskara-inspired dance performance in Physical Education.",
  image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772378273/487320623_968974232089393_8936991232657583952_n_kejxr4.jpg",
},
{
  id: "9",
  title: "Celebrating Filipino Flavors",
  description: "HM students showcase local dishes with refined plating and authentic flavors, honoring the richness of Filipino cuisine.",
  image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772379064/545565098_1093230092997139_7097329978153372353_n_yofeyf.jpg",
},
{
  id: "15",
  title: "IT Week: Memories",
  description: "A visually immersive IT Week setup celebrating shared experiences, milestones, and the lasting memories built within the campus community.",
  image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772379823/476778332_1786108562183954_417473847094311905_n_pb5osw.jpg",
},
{
  id: "16",
  title: "Celebrating Our Foundation",
  description: "Students gather in a lively campus celebration marking milestones, achievements, and the strong community that defines our school.",
  image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772379983/467748976_555898093996809_1324484631500305326_n_v1fw11.jpg",
}
];

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function SchoolLife() {
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const autoScroll = React.useMemo(() => {
    if (reducedMotion) {
      return null;
    }

    return AutoScroll({
      speed: 1.2,
      startDelay: 0,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    });
  }, [reducedMotion]);

  const sectionRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    el.style.setProperty("--bg-dark", "0.12");
    el.style.setProperty("--bg-blur", "0px");
    el.style.setProperty("--bg-scale", "1");
    el.style.setProperty("--bg-scalex", "0.88");
    el.style.setProperty("--bg-radius", "24px");

    let ticking = false;

    const update = () => {
      ticking = false;

      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight;

      const totalScrollable = Math.max(1, el.offsetHeight - viewportH);
      const scrolledInside = clamp(-rect.top, 0, totalScrollable);
      const p = scrolledInside / totalScrollable;

      const holdPoint = 0.5;
      const stage2 = clamp((p - holdPoint) / (1 - holdPoint), 0, 1);

      const baseDark = 0.1;
      const maxAddDark = 0.65;
      const dark = baseDark + maxAddDark * p;

      const maxBlur = 12;
      const blur = maxBlur * p;

      const scale = 1 + 0.1 * stage2;
      const scaleX = 0.88 + 0.12 * stage2;
      const radius = 24 * (1 - stage2);

      el.style.setProperty("--bg-dark", String(dark));
      el.style.setProperty("--bg-blur", `${blur.toFixed(2)}px`);
      el.style.setProperty("--bg-scale", scale.toFixed(4));
      el.style.setProperty("--bg-scalex", scaleX.toFixed(4));
      el.style.setProperty("--bg-radius", `${radius.toFixed(1)}px`);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const HERO_VH = 70;
  const stickyTop = `calc(50vh - ${HERO_VH / 2}vh)`;

  return (
    <section
      ref={sectionRef}
      className="relative isolate bg-background pt-10 overflow-x-clip"
    >
      {/* Top Intro (Readable on light background) */}
      <div className="mx-auto mb-8 max-w-5xl px-4 text-center">
        <h3 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Where Futures Begin at{" "}
          <span className="relative inline-block">
            <span className="relative text-primary">DATAMEX</span>
          </span>
        </h3>
        <p className="mx-auto mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Explore campus events, hands-on learning, and student-led communities
          built to grow confidence, creativity, and real-world readiness.
        </p>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4">
        {/* Sticky hero */}
        <div
          className="sticky z-0"
          style={{
            top: stickyTop,
            height: `${HERO_VH}vh`,
          }}
        >
          {/* FULL BLEED WRAPPER */}
          <div
            className="relative left-1/2 h-full w-screen"
            style={{
              transform: "translateX(-50%) translateZ(0)",
              willChange: "transform",
            }}
          >
            {/* CLIP CONTAINER */}
            <div
              className="absolute inset-0"
              style={{
                clipPath: "inset(0 round var(--bg-radius))",
                WebkitClipPath: "inset(0 round var(--bg-radius))",
              }}
            >
              {/* IMAGE SCALE */}
              <div
                className="absolute inset-0"
                style={{
                  transform:
                    "scaleX(var(--bg-scalex)) scale(var(--bg-scale)) translateZ(0)",
                  transformOrigin: "center",
                  willChange: "transform",
                }}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage:
                      "url('https://res.cloudinary.com/dghjtnxjw/image/upload/v1772362820/uploads/ejyjz7gxb3zcfvrkz7dm.jpg')",
                    filter: "blur(var(--bg-blur))",
                    transform: "scale(1.02)",
                    willChange: "filter, transform",
                  }}
                  aria-hidden="true"
                />
              </div>

              {/* OVERLAYS FULL WIDTH */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: "rgba(0,0,0,var(--bg-dark))" }}
                aria-hidden="true"
              />

              {/* ✅ transparent end prevents “white fog” */}
              <div
                className="absolute inset-0 bg-linear-to-b from-black/10 via-black/25 to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Header */}
        {/* Header */}
        <div className="relative z-10 -mt-24 pb-6">
          <div
            className="sticky z-20 pt-4"
            style={{ top: `calc(${stickyTop} + 50px)` }}
          >
            <div className="mx-auto max-w-3xl rounded-2xl bg-white/12 px-6 py-5 text-center backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                LIFE AT <span className="text-secondary">DATAMEX</span>
              </h1>

              <p className="mt-2 text-sm sm:text-base text-white/85">
                Experiences, spaces, and moments that shape student
                growth—inside and outside the classroom.
              </p>

              <div className="mx-auto mt-4 h-px w-24 bg-white/30" />
            </div>
          </div>
        </div>

        {/* ✅ FIX: Put spacing here (cards area), not at the end of section */}
        <div className="relative z-10 mt-8 pb-20">
          <Carousel
            opts={{ loop: true, align: "center" }}
            plugins={autoScroll ? [autoScroll] : []}
            className="w-full"
            onMouseEnter={() => autoScroll?.stop()}
            onMouseLeave={() => autoScroll?.play()}
          >
            <CarouselContent className="-ml-3">
              {lifeCards.map((item) => (
                <CarouselItem
                  key={item.id}
                  className="pl-3 basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/4"
                >
                  <Card className="group overflow-hidden rounded-2xl border bg-card py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="relative overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.title}
                          className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] sm:h-44"
                          width={600}
                          height={240}
                          sizes="100vw"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background/50 via-background/10 to-transparent" />
                      </div>

                      <div className="space-y-2 p-3">
                        <div className="space-y-1">
                          <h3 className="line-clamp-1 text-sm font-semibold tracking-tight">
                            {item.title}
                          </h3>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>

                        <div className="h-0.75 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="hidden md:inline-flex" />
            <CarouselNext className="hidden md:inline-flex" />
          </Carousel>
        </div>
      </div>
    </section>
  );
}
