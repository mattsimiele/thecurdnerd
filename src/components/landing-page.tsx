"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const resources = [
  {
    name: "The Curd Nerd",
    description: "Shop standards, opening and closing procedures, food handling, and daily reference material.",
    className: "employee-resource-curd",
    href: "",
  },
  {
    name: "The Wedge",
    description: "Service standards, opening and closing procedures, bar references, and day-to-day operating notes.",
    className: "employee-resource-wedge",
    href: "",
  },
];

export function LandingPage() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-intro]", {
        y: 24,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.out",
      });

      gsap.utils.toArray<HTMLElement>("[data-resource]").forEach((card) => {
        gsap.from(card, {
          y: 36,
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: card,
            start: "top 92%",
            end: "top 70%",
            scrub: true,
          },
        });
      });

      gsap.fromTo(
        "[data-food-image]",
        { scale: 0.82, opacity: 0.45 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-food-image]",
            start: "top bottom",
            end: "center 55%",
            scrub: true,
          },
        },
      );

      gsap.to("[data-marquee]", { xPercent: -50, duration: 34, repeat: -1, ease: "none" });
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set("[data-intro], [data-resource], [data-food-image]", { opacity: 1, scale: 1, y: 0 });
    });

    return () => mm.revert();
  }, { scope: root });

  return (
    <main ref={root} className="employee-shell">
      <nav className="employee-nav" aria-label="Employee navigation">
        <Link className="employee-wordmark" href="/">
          <span>The Curd Nerd</span>
          <i aria-hidden="true" />
          <span>The Wedge</span>
        </Link>
        <Link className="manager-link" href="/login">Manager sales</Link>
      </nav>

      <section className="employee-hero">
        <div className="employee-hero-copy">
          <p data-intro className="employee-eyebrow">Employee home</p>
          <h1 data-intro>What do you need for today?</h1>
          <p data-intro className="employee-intro">
            Find the operating information for your location. Choose a business below to get started.
          </p>
        </div>
        <figure data-intro className="employee-hero-image">
          <img
            src="https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=1600&q=85"
            alt="A selection of cheese ready for service"
          />
        </figure>
      </section>

      <section className="employee-resources" aria-labelledby="resources-title">
        <header className="employee-section-heading">
          <p>Standard operating procedures</p>
          <h2 id="resources-title">Choose a business.</h2>
        </header>
        <div className="employee-resource-grid">
          {resources.map((resource) => (
            <article data-resource className={`employee-resource ${resource.className}`} key={resource.name}>
              <h3>{resource.name}</h3>
              <p>{resource.description}</p>
              {resource.href ? (
                <a href={resource.href}>Open SOPs <span aria-hidden="true">↗</span></a>
              ) : (
                <span className="resource-pending">SOP link coming soon</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="employee-photo-band" aria-label="From the counter">
        <div data-food-image className="employee-photo-frame">
          <img
            src="https://images.unsplash.com/photo-1573812461383-e5f8b759d12e?auto=format&fit=crop&w=2000&q=85"
            alt="An abundant cheese and charcuterie board"
          />
        </div>
      </section>

      <section className="employee-marquee" aria-hidden="true">
        <div data-marquee className="employee-marquee-track">
          {[0, 1].map((set) => (
            <div className="employee-marquee-set" key={set}>
              <span>Good food</span><i />
              <span>Clear standards</span><i />
              <span>Warm service</span><i />
              <span>Two businesses, one team</span><i />
            </div>
          ))}
        </div>
      </section>

      <footer className="employee-footer">
        <div>
          <strong>The Curd Nerd</strong>
          <span>+</span>
          <strong>The Wedge</strong>
        </div>
        <p>Looking for reporting? <Link href="/login">Open the manager sales dashboard</Link>.</p>
        <p>© {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
