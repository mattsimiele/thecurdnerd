"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const chapters = [
  { title: "Sales, without the spreadsheet chase", body: "Square revenue, refunds, discounts, and product mix arrive in one shared daily view." },
  { title: "The story behind the top line", body: "Connect revenue to accounting categories, expenses, and margin signals from QuickBooks." },
  { title: "Hospitality you can actually measure", body: "Bring covers, pacing, and reservation patterns alongside sales when OpenTable access is available." },
];

export function LandingPage() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-hero-word]", { yPercent: 110, opacity: 0, duration: 1.1, stagger: 0.08, ease: "power4.out" });
      gsap.to("[data-marquee]", { xPercent: -50, duration: 24, repeat: -1, ease: "none" });
      gsap.utils.toArray<HTMLElement>("[data-stack-card]").forEach((card, index) => {
        gsap.fromTo(card, { scale: 0.92, opacity: 0.35 }, {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: card, start: "top 85%", end: "top 35%", scrub: true },
        });
        if (index < chapters.length - 1) {
          ScrollTrigger.create({ trigger: card, start: "top 18%", end: "+=65%", pin: true, pinSpacing: false });
        }
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal-word]").forEach((word) => {
        gsap.fromTo(word, { opacity: 0.12 }, { opacity: 1, scrollTrigger: { trigger: word, start: "top 88%", end: "top 58%", scrub: true } });
      });
    });
    mm.add("(prefers-reduced-motion: reduce)", () => gsap.set("[data-hero-word], [data-stack-card], [data-reveal-word]", { opacity: 1, scale: 1, yPercent: 0 }));
    return () => mm.revert();
  }, { scope: root });

  return (
    <main ref={root} className="site-shell">
      <nav className="nav-wrap" aria-label="Main navigation">
        <Link className="wordmark" href="/">THE CURD NERD<span>DATA HOUSE</span></Link>
        <div className="nav-links"><a href="#platform">Platform</a><a href="#story">The view</a></div>
        <Link className="button button-light button-small" href="/login">Manager sign in</Link>
      </nav>

      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <h1 className="hero-title" aria-label="Know the business before the day gets busy">
            <span className="clip"><span data-hero-word>Know the business</span></span>
            <span className="clip"><span data-hero-word>before it gets busy.</span></span>
          </h1>
          <p>One calm, decisive view across sales, accounting, and hospitality for both of your businesses.</p>
          <div className="hero-actions">
            <Link className="button button-light" href="/login">Open manager portal</Link>
            <a className="button button-ghost" href="#platform">See how it works</a>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img src="https://picsum.photos/seed/cheese-cellar-hospitality/1920/1080" alt="A warmly lit hospitality counter" />
        </div>
      </section>

      <section className="marquee" aria-label="Connected data sources">
        <div data-marquee className="marquee-track">
          {[0, 1].map((set) => <div className="marquee-set" key={set}><span>SQUARE</span><i /><span>QUICKBOOKS</span><i /><span>OPENTABLE</span><i /><span>TWO BUSINESSES</span><i /></div>)}
        </div>
      </section>

      <section id="platform" className="platform-section">
        <header className="section-heading"><p>Clarity, daily</p><h2>A dashboard that answers the next question.</h2></header>
        <div className="bento-grid">
          <article className="bento bento-wide"><div><span>Live pulse</span><h3>Revenue and pace, in plain sight.</h3><p>Today against plan, last week, and last year with the reasons for movement close at hand.</p></div><div className="mini-chart"><i style={{ height: "42%" }} /><i style={{ height: "58%" }} /><i style={{ height: "51%" }} /><i style={{ height: "76%" }} /><i style={{ height: "88%" }} /><i style={{ height: "72%" }} /><i style={{ height: "94%" }} /></div></article>
          <article className="bento bento-image"><img src="https://picsum.photos/seed/artisan-cheese-counter/1200/1200" alt="Artisan food counter" /><div><span>Two operations</span><h3>Separate when useful. Together when needed.</h3></div></article>
          <article className="bento"><span>Margin</span><strong>63.8%</strong><p>Accounting context beside operational performance.</p></article>
          <article className="bento bento-dark"><span>Manager brief</span><h3>Three signals deserve your attention today.</h3><div className="signal"><i /> Labor pacing above target</div><div className="signal positive"><i /> Average check trending up</div></article>
          <article className="bento"><span>Guest demand</span><strong>184</strong><p>Projected covers, pacing, cancellations, and no-shows.</p></article>
        </div>
      </section>

      <section id="story" className="story-section">
        <div className="story-intro"><p>Connected thinking</p><h2>{"A number alone rarely helps. Context turns it into a decision.".split(" ").map((word, i) => <span data-reveal-word key={i}>{word}{" "}</span>)}</h2></div>
        <div className="stack-wrap">{chapters.map((chapter, index) => <article data-stack-card className={`stack-card stack-${index + 1}`} key={chapter.title}><span>0{index + 1}</span><div><h3>{chapter.title}</h3><p>{chapter.body}</p></div></article>)}</div>
      </section>

      <section className="closing">
        <p>Built for the people running the floor.</p>
        <h2>Less reporting.<br />More knowing.</h2>
        <Link className="button button-dark" href="/login">Enter the dashboard</Link>
      </section>
      <footer><Link className="wordmark wordmark-dark" href="/">THE CURD NERD<span>DATA HOUSE</span></Link><p>Private operations intelligence</p><p>© {new Date().getFullYear()}</p></footer>
    </main>
  );
}
