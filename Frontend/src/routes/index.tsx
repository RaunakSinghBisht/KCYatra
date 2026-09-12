import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { ArrowRight, BedDouble, Music4, UtensilsCrossed, Drama, BookOpenText, Headphones, Mail, Phone, MessageCircle, CalendarCheck } from "lucide-react";
import yatra1 from "@/assets/yatra-1.jpg";
import yatra2 from "@/assets/yatra-2.jpg";
import yatra3 from "@/assets/yatra-3.jpg";
import banner1 from "@/assets/banner-1.jpg.asset.json";
import banner2 from "@/assets/banner-2.jpg.asset.json";
import banner3 from "@/assets/banner-3.jpg.asset.json";
import banner4 from "@/assets/banner-4.jpg.asset.json";
import banner5 from "@/assets/banner-5.jpg.asset.json";
import banner6 from "@/assets/banner-6.jpg.asset.json";
import banner7 from "@/assets/banner-7.jpg.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Krishna Conscious Yatra — Divine Dham Yatras & Sacred Pilgrimages" },
      {
        name: "description",
        content:
          "Join our upcoming divine Dham Yatras. Comfortable stay, ecstatic kirtan, Krishna prasadam, dramas and Hari Katha. Limited seats — register with phone OTP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Krishna Conscious Yatra — Divine Dham Yatras" },
      {
        property: "og:description",
        content: "More than a yatra — a living experience of bhakti. Secure your spot today.",
      },
    ],
  }),
  component: Landing,
});

const slides = [
  { img: banner1.url, alt: "Chalo Dwarka — a sacred journey awaits" },
  { img: banner4.url, alt: "Dwarka Yatra 2026, 25–31 May 2026" },
  { img: banner5.url, alt: "Experience the magic of Krishna's kingdom" },
  { img: banner2.url, alt: "One yatra, complete divine darshan of all sacred temples" },
  { img: banner3.url, alt: "More than a yatra — a living experience of bhakti" },
  { img: banner6.url, alt: "Yatra packages — Basic, Standard and Premium" },
  { img: banner7.url, alt: "Package description — accommodation, meals and bus fares" },
];


const experiences = [
  {
    key: "stay",
    icon: BedDouble,
    label: "Comfortable Stay",
    tagline: "Accommodation arrangements for all yatris.",
    title: "Comfortable Accommodation",
    img: yatra1,
    body: [
      "We arrange comfortable and hygienic accommodations near the temple premises to ensure a peaceful and relaxing stay during your yatra.",
      "Prasadam is provided by us and is included in your hotel package.",
      "Premium pure vegetarian food is prepared with utmost hygiene and devotion to maintain the sanctity of your spiritual experience.",
    ],
  },
  {
    key: "kirtan",
    icon: Music4,
    label: "Kirtan",
    tagline: "Soul-stirring chanting of the Holy Names.",
    title: "Ecstatic Kirtan",
    img: yatra2,
    body: [
      "Engage in melodious and blissful Sankirtan, singing the holy names of the Lord accompanied by traditional instruments.",
      "It is the supreme process of awakening our dormant love for Krishna in this age.",
      "In this sacred vibration the restless mind finds peace, the heavy heart becomes light, and every participant becomes immersed in divine joy and unity.",
    ],
  },
  {
    key: "prasadam",
    icon: UtensilsCrossed,
    label: "Prasadam",
    tagline: "Sanctified food offered to the Lord.",
    title: "Krishna Prasadam",
    img: yatra3,
    body: [
      "Enjoy sumptuous and purely vegetarian meals that have been lovingly cooked and offered to the Deities first.",
      "Eating Prasadam purifies our existence and helps us advance spiritually.",
    ],
  },
  {
    key: "drama",
    icon: Drama,
    label: "Drama",
    tagline: "Enactments of Lord Krishna's divine pastimes.",
    title: "Spiritual Dramas",
    img: yatra1,
    body: [
      "Witness captivating theatrical performances bringing the timeless pastimes of the Lord and His devotees to life.",
      "A powerful way to absorb our minds in remembering the Lord.",
    ],
  },
  {
    key: "lecture",
    icon: BookOpenText,
    label: "Lecture",
    tagline: "Enlightening discourses on Vedic scriptures.",
    title: "Hari Katha",
    img: yatra2,
    body: [
      "Listen to profound spiritual teachings based on the Bhagavad Gita and Srimad Bhagavatam delivered by senior Vaishnavas.",
      "Hearing (Sravanam) is the fundamental step in the practice of Bhakti Yoga.",
    ],
  },
];

function BookButton({ className = "" }: { className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      className={`h-12 rounded-full bg-gradient-primary px-7 text-base font-extrabold text-primary-foreground shadow-glow ${className}`}
    >
      <Link to="/auth">
        Book Your Yatra <ArrowRight className="size-5" />
      </Link>
    </Button>
  );
}

function Landing() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    const timer = setInterval(() => api.scrollNext(), 5000);
    return () => {
      api.off("select", onSelect);
      clearInterval(timer);
    };
  }, [api]);

  return (
    <main className="bg-background text-foreground">
      {/* Hero carousel */}
      <section className="bg-background">
        <Carousel setApi={setApi} opts={{ loop: true }} className="relative">
          <CarouselContent className="ml-0">
            {slides.map((s, i) => (
              <CarouselItem key={i} className="pl-0">
                <img
                  src={s.img}
                  alt={s.alt}
                  width={1920}
                  height={650}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-auto w-full object-contain"
                />

              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 border-border bg-background/80 text-foreground hover:bg-accent sm:left-6" />
          <CarouselNext className="right-2 border-border bg-background/80 text-foreground hover:bg-accent sm:right-6" />
          <div className="flex justify-center gap-2 py-4">
            {slides.map((s, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => api?.scrollTo(i)}
                className={`h-2 rounded-full transition-all ${current === i ? "w-7 bg-primary" : "w-2 bg-border"}`}
              />
            ))}
          </div>
        </Carousel>
      </section>

      {/* Upcoming yatras CTA */}
      <section className="bg-accent/40 px-4 py-12 text-center sm:py-16">
        <h1 className="mx-auto max-w-3xl text-2xl font-extrabold leading-tight text-primary sm:text-4xl">
          Join us for the Divine Upcoming Yatras!
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Limited Seats Available — Secure Your Spot for the Sacred Dham Yatras!
        </p>
        <div className="mt-7">
          <BookButton className="w-full sm:w-auto" />
        </div>
      </section>

      {/* Past yatra glimpse */}
      <section className="bg-background px-4 py-12 sm:py-16">
        <h2 className="text-center text-xl font-extrabold text-primary sm:text-3xl">Our Past Yatra&apos;s Glimpse</h2>
        <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border shadow-soft">
          <div className="aspect-video w-full">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/JvsRTWg8ojo"
              title="Mayapur Yatra glimpse"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Experience the Divine Moments */}
      <section className="bg-accent/40 px-4 py-12 sm:py-16">
        <h2 className="text-center text-xl font-extrabold text-primary sm:text-3xl">Experience the Divine Moments</h2>

        <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experiences.map((e) => (
            <article
              key={e.key}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <img
                src={e.img}
                alt={e.title}
                width={800}
                height={450}
                loading="lazy"
                className="h-40 w-full object-cover"
              />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                    <e.icon className="size-4" />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">{e.tagline}</p>
                </div>
                <h3 className="mt-2 text-base font-extrabold sm:text-lg">{e.title}</h3>
                {e.body.map((p) => (
                  <p key={p} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Contact Us */}
      <section className="border-t border-border bg-accent/40 px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm font-bold text-primary shadow-soft">
            <Headphones className="size-4" /> Contact Us
          </div>
          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
            Have questions about an upcoming yatra? Reach out to us directly.
          </p>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href="mailto:krishna.con.yatra@gmail.com"
              className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-left shadow-soft transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                <Mail className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</span>
                <span className="block truncate text-sm font-semibold text-foreground">krishna.con.yatra@gmail.com</span>
              </span>
            </a>

            <a
              href="tel:+917020391800"
              className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-left shadow-soft transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                <Phone className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</span>
                <span className="block truncate text-sm font-semibold text-foreground">+91 70203 91800</span>
                <span className="block text-xs text-muted-foreground">Amal Bhakt Das</span>
              </span>
            </a>

            <a
              href="https://wa.me/918796976009"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-left shadow-soft transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                <MessageCircle className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">WhatsApp</span>
                <span className="block truncate text-sm font-semibold text-foreground">+91 87969 76009</span>
                <span className="block text-xs text-muted-foreground">WhatsApp Only</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Krishna Conscious Yatra. Hare Krishna.
      </footer>

      {/* Floating Book Now widget */}
      <Link
        to="/auth"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-3 text-sm font-extrabold text-primary-foreground shadow-glow"
      >
        <CalendarCheck className="size-4" /> Book Now
      </Link>
    </main>
  );
}
