'use client';

import { useEffect, useActionState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { joinWaitlist } from '@/app/actions';
import './solar-landing.css';

// ─── Animations (ported from static HTML <script>) ────────────────────────────

function useHeroAnimation() {
  useEffect(() => {
    const viz = document.querySelector('.hero-viz') as HTMLElement | null;
    if (!viz) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      viz.classList.add('play');
      return;
    }

    viz.classList.add('play');

    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            viz.classList.remove('play');
            void viz.offsetWidth; // force reflow to restart animation
            viz.classList.add('play');
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(viz);
    return () => io.disconnect();
  }, []);
}

function useScrollTilt() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    type Target = {
      el: HTMLElement;
      baseY: number;
      rxAmp: number;
      ryAmp: number;
      tyAmp: number;
      isPhone?: boolean;
      isLeft?: boolean;
    };
    type ScrollShot = { container: HTMLElement; img: HTMLImageElement; speed: number; startAt: number };

    const targets: Target[] = [];
    const shots: ScrollShot[] = [];

    document.querySelectorAll<HTMLElement>('.browser').forEach((el) => {
      const reverse = !!el.closest('.feature.reverse');
      const center = !!el.closest('.showstopper');
      const mild = el.classList.contains('browser-mild');
      const baseY = center ? 0 : (reverse ? 4 : -4) * (mild ? 0.4 : 1);
      targets.push({
        el,
        baseY,
        rxAmp: (center ? 7 : 9) * (mild ? 0.45 : 1),
        ryAmp: (center ? 4 : 5) * (mild ? 0.45 : 1),
        tyAmp: (center ? 18 : 28) * (mild ? 0.45 : 1),
      });
    });

    document.querySelectorAll<HTMLElement>('.phone').forEach((el) => {
      const isLeft = el.classList.contains('tilt-l');
      targets.push({ el, baseY: isLeft ? -9 : 7, rxAmp: 10, ryAmp: 6, tyAmp: 26, isPhone: true, isLeft });
    });

    document.querySelectorAll<HTMLElement>('.scroll-shot, .phone-window').forEach((container) => {
      const img = container.querySelector('img') as HTMLImageElement | null;
      if (!img) return;
      const speed = parseFloat(container.dataset.scrollSpeed ?? '') || 1.0;
      const startAtRaw = parseFloat(container.dataset.scrollStart ?? '');
      shots.push({ container, img, speed, startAt: isNaN(startAtRaw) ? 0 : startAtRaw });
    });

    let ticking = false;
    const clamp = (v: number, mn: number, mx: number) => (v < mn ? mn : v > mx ? mx : v);
    const narrow = window.innerWidth < 720;
    const tiltScale = narrow ? 0.3 : 1;

    function update() {
      const vh = window.innerHeight;
      const vc = vh / 2;
      for (const t of targets) {
        const r = t.el.getBoundingClientRect();
        if (r.bottom < -300 || r.top > vh + 300) continue;
        const ec = r.top + r.height / 2;
        const p = clamp((vc - ec) / vh, -0.8, 0.8);
        const rx = (p * t.rxAmp * tiltScale).toFixed(2);
        const ry = (t.baseY * tiltScale + p * t.ryAmp * tiltScale).toFixed(2);
        const ty = (-p * t.tyAmp * tiltScale).toFixed(2);

        if (t.isPhone) {
          const baseYOffset = t.isLeft ? 20 : 0;
          t.el.style.transform = `perspective(900px) translateY(${baseYOffset + parseFloat(ty)}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        } else {
          t.el.style.setProperty('--tx', ty + 'px');
          t.el.style.setProperty('--rx', rx + 'deg');
          t.el.style.setProperty('--ry', ry + 'deg');
        }
      }
      // scroll-shots run in the same RAF pass (matching static HTML architecture)
      for (const s of shots) {
        const r = s.container.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const total = vh + r.height;
        const traveled = vh - r.top;
        let raw = traveled / total;
        if (raw < 0) raw = 0; else if (raw > 1) raw = 1;
        let p = (raw - s.startAt) / ((1 - s.startAt) / s.speed);
        if (p < 0) p = 0; else if (p > 1) p = 1;
        const imgH = s.img.offsetHeight;
        const winH = r.height;
        const scrollable = imgH - winH;
        if (scrollable > 0) {
          s.img.style.setProperty('--scroll-y', (-(p * scrollable)).toFixed(1) + 'px');
        }
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    shots.forEach((s) => {
      if (s.img.complete) return;
      s.img.addEventListener('load', () => requestAnimationFrame(update), { once: true });
    });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
}

function useCalendarTabs() {
  useEffect(() => {
    const stack = document.querySelector('.cal-stack') as HTMLElement | null;
    const tabs = document.querySelectorAll<HTMLElement>('.cal-tab');
    if (!stack || !tabs.length) return;

    const slides = stack.querySelectorAll<HTMLElement>('.cal-slide');

    function show(i: number) {
      slides.forEach((s) => s.classList.toggle('is-active', +(s.dataset.i ?? '') === i));
      tabs.forEach((t) => t.classList.toggle('is-active', +(t.dataset.i ?? '') === i));
    }

    let autoTimer: ReturnType<typeof setInterval> | null = null;
    let userInteracted = false;

    function stopAuto() {
      userInteracted = true;
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
    }

    function startAuto() {
      if (userInteracted || autoTimer) return;
      let i = 0;
      autoTimer = setInterval(() => {
        i = (i + 1) % slides.length;
        show(i);
      }, 2400);
    }

    const clickHandlers: Array<() => void> = [];
    tabs.forEach((t) => {
      const handler = () => {
        show(+(t.dataset.i ?? ''));
        stopAuto();
      };
      clickHandlers.push(handler);
      t.addEventListener('click', handler);
    });

    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) startAuto();
            else {
              if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
            }
          }
        },
        { threshold: 0.4 },
      );
      io.observe(stack);
    }

    return () => {
      tabs.forEach((t, i) => t.removeEventListener('click', clickHandlers[i]));
      if (autoTimer) clearInterval(autoTimer);
      io?.disconnect();
    };
  }, []);
}

function useWordGlow() {
  useEffect(() => {
    const words = document.querySelectorAll<HTMLElement>('.word-sunshine, .word-glow');
    if (!words.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      words.forEach((w) => w.style.setProperty('--p', '1'));
      return;
    }

    let ticking = false;

    function update() {
      const vh = window.innerHeight;
      const start = vh * 0.85;
      const end = vh * 0.55;
      const range = start - end;
      const maxScroll = Math.max(
        0,
        (document.documentElement.scrollHeight || document.body.scrollHeight) - vh,
      );
      const atBottom = window.scrollY >= maxScroll - 2;

      words.forEach((w) => {
        const r = w.getBoundingClientRect();
        let p = (start - r.top) / range;
        if (p < 0) p = 0;
        else if (p > 1) p = 1;
        if (atBottom && r.top < vh && r.bottom > 0 && p < 1) p = 1;
        w.style.setProperty('--p', p.toFixed(3));
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
}

// ─── Waitlist form ────────────────────────────────────────────────────────────

function WaitlistForm() {
  const [state, action, isPending] = useActionState(joinWaitlist, null);

  if (state?.success) {
    return (
      <div className="signup-success">
        <span className="signup-success-icon">✓</span>
        <span>You&rsquo;re on the list — we&rsquo;ll be in touch.</span>
      </div>
    );
  }

  return (
    <form className="signup-form" action={action}>
      <input type="email" name="email" placeholder="you@example.com" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Sending…' : 'Request invite'}
      </button>
    </form>
  );
}

// ─── Browser frame helpers ────────────────────────────────────────────────────

function BrowserFrame({
  url,
  src,
  alt,
  mild,
  scrollSpeed,
  scrollStart,
}: {
  url: string;
  src: string;
  alt: string;
  mild?: boolean;
  scrollSpeed?: number;
  scrollStart?: number;
}) {
  const isScrollShot = scrollSpeed !== undefined;
  return (
    <div className={`browser${mild ? ' browser-mild' : ''}`}>
      <div className="browser-bar">
        <div className="browser-dots"><span /><span /><span /></div>
        <div className="browser-url"><span className="lock">⏿</span>{url}</div>
      </div>
      {isScrollShot ? (
        <div
          className="browser-body scroll-shot"
          data-scroll-speed={scrollSpeed}
          {...(scrollStart !== undefined ? { 'data-scroll-start': scrollStart } : {})}
        >
          {/* plain <img> required so CSS position:absolute takes effect */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} />
        </div>
      ) : (
        <div className="browser-body">
          <Image src={src} alt={alt} width={1200} height={800} style={{ width: '100%', height: 'auto' }} />
        </div>
      )}
    </div>
  );
}

function CalendarBrowser() {
  return (
    <div className="browser">
      <div className="browser-bar">
        <div className="browser-dots"><span /><span /><span /></div>
        <div className="browser-url"><span className="lock">⏿</span>solartracker.app/calendar</div>
        <div className="cal-tabs" role="tablist" aria-label="Calendar metric">
          <button className="cal-tab is-active" data-i="0" type="button" role="tab">Generation</button>
          <button className="cal-tab" data-i="1" type="button" role="tab">Self-consumed</button>
          <button className="cal-tab" data-i="2" type="button" role="tab">Immersion</button>
        </div>
      </div>
      <div className="browser-body cal-stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cal-slide is-active" data-i="0" src="/landing/calendar-generation.png" alt="Yearly calendar — Generation" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cal-slide" data-i="1" src="/landing/calendar-self-consumed.png" alt="Yearly calendar — Self-consumed" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cal-slide" data-i="2" src="/landing/calendar-immersion.png" alt="Yearly calendar — Immersion" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  useHeroAnimation();
  useScrollTilt();
  useCalendarTabs();
  useWordGlow();

  return (
    <div className="solar-landing">

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top">
            <span className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4.5" fill="#facc15"/>
                <g stroke="#facc15" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="12" y1="2" x2="12" y2="4.2"/>
                  <line x1="12" y1="19.8" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="4.2" y2="12"/>
                  <line x1="19.8" y1="12" x2="22" y2="12"/>
                  <line x1="4.6" y1="4.6" x2="6.2" y2="6.2"/>
                  <line x1="17.8" y1="17.8" x2="19.4" y2="19.4"/>
                  <line x1="4.6" y1="19.4" x2="6.2" y2="17.8"/>
                  <line x1="17.8" y1="6.2" x2="19.4" y2="4.6"/>
                </g>
              </svg>
            </span>
            <span className="brand-name">Solar Advisor</span>
          </a>
          <div className="nav-meta">
            <a href="#features">Features</a>
            <a href="#payback">Payback</a>
            <a href="#stats">Stats</a>
            <a href="#tariffs">Tariffs</a>
            <a href="#mobile">Mobile</a>
            <a href="#privacy">Privacy</a>
            <Link className="chip" href="#cta"><span className="chip-dot" />Invite-only beta</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header id="top" className="hero">
        <div className="wrap hero-grid">
          <div className="hero-text">
            <h1 className="headline">Understand what your solar is <em>actually</em> worth.</h1>
            <p className="sub">
              Solar Advisor <strong>imports your live and historical data</strong>, applies your real day, night and peak
              tariff, and tells you the <strong>euro value</strong> of every kilowatt-hour your panels produce —
              onsite, exported, and against your payback.
            </p>
            <div className="ctas">
              <Link className="btn btn-primary" href="#cta">
                Request beta access
                <span className="arrow">→</span>
              </Link>
              <a className="btn btn-ghost" href="#features">See how it works</a>
            </div>
            <div className="hero-fineprint">
              <span>Secure, encrypted data</span>
              <span className="dot" />
              <span>Edit or delete any time</span>
              <span className="dot" />
              <span>Never shared, never sold</span>
            </div>
          </div>

          {/* Hero visual — sun arc chronograph */}
          <div className="hero-viz" aria-hidden="true">
            <svg viewBox="0 0 580 580" preserveAspectRatio="xMidYMid meet">
              <defs>
                <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#facc15" stopOpacity="0.6"/>
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
                </radialGradient>
                <linearGradient id="gen-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity="0.55"/>
                  <stop offset="60%" stopColor="#facc15" stopOpacity="0.18"/>
                  <stop offset="100%" stopColor="#facc15" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="bg-disc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19222f" stopOpacity="0.5"/>
                  <stop offset="100%" stopColor="#0a0f17" stopOpacity="0"/>
                </linearGradient>
              </defs>

              <circle cx="290" cy="420" r="280" fill="url(#bg-disc)" opacity="0.7"/>
              <path d="M 50 420 A 240 240 0 0 1 530 420"
                fill="none" stroke="rgba(138,152,173,0.35)"
                strokeWidth="1.2" strokeDasharray="2 6"/>
              <path className="arc-progress"
                d="M 50 420 A 240 240 0 0 1 530 420"
                fill="none" stroke="#facc15"
                strokeWidth="2.2" strokeLinecap="round"/>

              <g fontFamily="JetBrains Mono, monospace" fontSize="11" fill="#5b6878">
                <line x1="50"  y1="416" x2="50"  y2="430" stroke="#2a3a4f"/>
                <text x="50"  y="448" textAnchor="middle">06</text>
                <line x1="170" y1="270" x2="174" y2="282" stroke="#2a3a4f"/>
                <text x="166" y="262" textAnchor="middle">09</text>
                <line x1="290" y1="180" x2="290" y2="194" stroke="#2a3a4f"/>
                <text x="290" y="170" textAnchor="middle">12</text>
                <line x1="410" y1="270" x2="406" y2="282" stroke="#2a3a4f"/>
                <text x="414" y="262" textAnchor="middle">15</text>
                <line x1="530" y1="416" x2="530" y2="430" stroke="#2a3a4f"/>
                <text x="530" y="448" textAnchor="middle">21</text>
              </g>

              <line x1="20" y1="420" x2="560" y2="420" stroke="rgba(138,152,173,0.18)" strokeWidth="1"/>
              <text x="20" y="438" fontFamily="JetBrains Mono, monospace" fontSize="9.5"
                fill="#5b6878" letterSpacing="2">HORIZON</text>

              <path className="gen-curve-fill"
                d="M 50 420 C 130 420, 160 400, 200 360 C 240 320, 270 260, 290 240 C 310 220, 340 220, 380 260 C 420 300, 470 380, 530 420 L 530 420 L 50 420 Z"
                fill="url(#gen-fill)"/>
              <path className="gen-curve-line"
                d="M 50 420 C 130 420, 160 400, 200 360 C 240 320, 270 260, 290 240 C 310 220, 340 220, 380 260 C 420 300, 470 380, 530 420"
                fill="none" stroke="#facc15" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>

              <g className="sun">
                <circle cx="378" cy="248" r="58" fill="url(#sun-glow)"/>
                <circle cx="378" cy="248" r="18" fill="#facc15"/>
                <circle cx="378" cy="248" r="11" fill="#fef3c7" opacity="0.85"/>
              </g>

              <text x="378" y="335" fontFamily="JetBrains Mono, monospace" fontSize="10"
                fill="#facc15" textAnchor="middle" letterSpacing="2">NOW · 14:32</text>

              <g fontFamily="JetBrains Mono, monospace" fontSize="9.5" fill="#5b6878">
                <text x="200" y="350" textAnchor="middle">1.8 kW</text>
                <text x="290" y="232" textAnchor="middle">5.4 kW</text>
              </g>
            </svg>

            <div className="viz-chip v-now">
              <div className="lbl">Generating</div>
              <div className="val yellow">3.84<span className="u">kW</span></div>
            </div>
            <div className="viz-chip v-saved">
              <div className="lbl">Today&rsquo;s value</div>
              <div className="val green">€2.47</div>
            </div>
            <div className="viz-chip v-cov">
              <div className="lbl">Solar coverage</div>
              <div className="val">87<span className="u">%</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Pillars ── */}
      <section className="pillars" style={{ padding: '36px 0' }}>
        <div className="wrap pillars-inner">
          {[
            { num: '01', title: 'Live from your hub', desc: 'Generation, consumption, import & export — refreshed every minute.' },
            { num: '02', title: 'Tariff-aware', desc: 'Day / night / peak rates applied to every half-hour. Bill, not watts.' },
            { num: '03', title: 'Your whole history', desc: 'Pick any range, from a day to all of it — heatmap, payback, no-solar counterfactual.' },
            { num: '04', title: 'Your data, secured', desc: 'Encrypted in transit and at rest. Edit or delete anything, any time.' },
          ].map(({ num, title, desc }) => (
            <div key={num} className="pillar">
              <div className="num">{num}</div>
              <div className="title">{title}</div>
              <div className="desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature 1 · Live ── */}
      <section id="features">
        <div className="wrap">
          <div className="feature">
            <div className="feature-text">
              <div className="section-eyebrow">Now · Live</div>
              <h3>Every watt, in <span className="word-glow">context</span> &mdash; not just a number on a dial.</h3>
              <p>
                The Live screen shows generation, consumption, import and export
                — refreshed every minute. Underneath each tile, the{' '}
                <em>interpretation</em>: is solar carrying the home right now, or is the grid?
              </p>
              <ul className="feature-bullets">
                <li>Net position, grid draw pressure and current capacity, plain-language<span className="lbl">— so you don&rsquo;t need to interpret the graph yourself.</span></li>
                <li>1-minute, 30-minute or hourly resolution; line or cumulative view.</li>
                <li>Tariff rate shown in the header, so the savings line is always priced correctly.</li>
              </ul>
              <div className="stat-row">
                <div className="stat"><div className="v">€0.21<span style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: 400 }}>/kWh</span></div><div className="l">Night rate now</div></div>
                <div className="stat"><div className="v green">96<span style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: 400 }}>%</span></div><div className="l">Data quality</div></div>
              </div>
            </div>
            <div className="feature-shot">
              <BrowserFrame url="solartracker.app/live" src="/landing/live-full.png" alt="Solar Advisor Live screen" scrollSpeed={1.7} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 2 · Tariff-aware ── */}
      <section style={{ background: 'linear-gradient(to bottom, transparent, rgba(245,158,11,0.025), transparent)' }}>
        <div className="wrap">
          <div className="feature reverse">
            <div className="feature-text">
              <div className="section-eyebrow">Day · Tariff-aware</div>
              <h3>Every half-hour, priced at the <span className="word-glow">rate</span> you were actually on.</h3>
              <p>
                Most solar apps tell you watts. Solar Advisor tells you what those
                watts <em>did to your bill</em>. Tariff changes mid-period? Solar Advisor
                applies the correct rate to each day automatically.
              </p>
              <ul className="feature-bullets">
                <li>Half-hourly cost, self-consumption value and export credit<span className="lbl">— graphed in euros, not kilowatts.</span></li>
                <li>Day story written in plain English: generation strength, grid reliance, export and self-consumption balance.</li>
                <li>Tariff-period value mix shows where your euros came from: day, night, or peak.</li>
              </ul>
              <div className="stat-row">
                <div className="stat"><div className="v">€2.03</div><div className="l">Onsite solar value</div></div>
                <div className="stat"><div className="v green">€1.53</div><div className="l">Export credit</div></div>
                <div className="stat"><div className="v violet">182<span style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: 400 }}>%</span></div><div className="l">Repayment coverage</div></div>
              </div>
            </div>
            <div className="feature-shot">
              <BrowserFrame url="solartracker.app/history" src="/landing/historical-day-full.png" alt="Historical day analysis" mild scrollSpeed={1.7} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Showstopper · Range / Payback ── */}
      <section id="payback" className="showstopper">
        <div className="wrap">
          <div className="showstopper-head">
            <div className="section-eyebrow">Range · Payback</div>
            <h2>Where are you on your <span className="word-glow">ROI</span> journey?</h2>
            <p className="lede">
              Pick any window — a week, a season, all of it. Solar Advisor reconstructs your bill{' '}
              <em>with</em> solar against a no-solar counterfactual, month by month, and ticks the
              recovered portion of your install forward.
            </p>
          </div>
          <BrowserFrame url="solartracker.app/range" src="/landing/range-full.png" alt="Range history and payback tracking" scrollSpeed={1.25} />
          <div className="heatmap-caption">
            <div><strong>Bill reduction (2024):</strong> <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>€702.87</span></div>
            <div><strong>Recovered so far:</strong> <span style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>30%</span></div>
            <div><strong>Approx. payoff:</strong> <span style={{ fontFamily: 'var(--mono)' }}>~Mar 2033</span></div>
          </div>
        </div>
      </section>

      {/* ── Stats · Calendar + Leaderboard ── */}
      <section id="stats">
        <div className="wrap">
          <div className="feature">
            <div className="feature-text">
              <div className="section-eyebrow">Year-at-a-glance · Calendar</div>
              <h3>A year of <span className="word-sunshine">sunshine</span>, on one wall.</h3>
              <p>
                365 bars. One row per month. The best day of the year wears a gold medal —
                it&rsquo;s the kind of view that makes you feel something about your roof.
              </p>
              <ul className="feature-bullets">
                <li>Switch any of 13 metrics: import cost, export credit, coverage, repayment…</li>
                <li>Best day in 2024: 8 July · 20.99 kWh. Annual total: 2,695 kWh.</li>
              </ul>
            </div>
            <div className="feature-shot">
              <CalendarBrowser />
            </div>
          </div>

          <div className="feature reverse" style={{ marginTop: '88px' }}>
            <div className="feature-text">
              <div className="section-eyebrow">All-time · Leaderboard</div>
              <h3>Your roof has <span className="word-glow">personal bests</span>. We keep score.</h3>
              <p>
                We track all your key metrics and maintain a leaderboard so you can see your
                best performing days at a glance.
              </p>
              <ul className="feature-bullets">
                <li>Generation, consumption, self-consumption, coverage, import cost, export credit, net bill — and more.</li>
                <li>Quickly understand what &lsquo;good&rsquo; looks like, then tap any row to open that day&rsquo;s full breakdown.</li>
              </ul>
            </div>
            <div className="feature-shot">
              <BrowserFrame url="solartracker.app/leaderboard" src="/landing/leaderboard-full.png" alt="All-time leaderboard" scrollSpeed={1.5} scrollStart={0.45} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Tariffs ── */}
      <section id="tariffs" style={{ background: 'linear-gradient(to bottom, transparent, rgba(96,165,250,0.03), transparent)', borderTop: '1px solid var(--border)' }}>
        <div className="wrap">
          <div className="feature">
            <div className="feature-text">
              <div className="section-eyebrow">Setup · Tariffs</div>
              <h3>Real tariffs give <span className="word-glow">real ROI</span> estimates.</h3>
              <p>
                Every euro figure on the dashboard runs through your real tariff schedule.
                Solar savings are calculated taking your day, night, peak and weekend rates
                into consideration. Set it once and every kWh, past and future, is priced correctly.
              </p>
              <ul className="feature-bullets">
                <li>A flexible tariff editor captures every nuance of your contract.</li>
                <li>Switched providers? Rates changed mid-contract? Add a new version of your tariffs with start and end dates.</li>
                <li>Made a correction? Your historical data is automatically re-priced.</li>
                <li>Export rates and standing charges included — so net bill comparisons are real, not approximate.</li>
                <li>The further back you can go, the more accurately your ROI is calculated.</li>
              </ul>
            </div>
            <div className="feature-shot">
              <BrowserFrame url="solartracker.app/settings/tariffs" src="/landing/tariff-full.png" alt="Tariff management — day, night and peak rates with weekly schedule" scrollSpeed={1.5} scrollStart={0.45} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Mobile ── */}
      <section id="mobile" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="wrap mobile-row">
          <div className="phones">
            <div className="phone tilt-l phone-secondary">
              <div className="phone-window" data-scroll-speed="1.6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/mobile-live-full.png" alt="Live screen on mobile" />
              </div>
            </div>
            <div className="phone tilt-r">
              <div className="phone-window" data-scroll-speed="1.6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/mobile-range-full.png" alt="Range / Solar Impact Estimate on mobile" />
              </div>
            </div>
          </div>
          <div>
            <div className="section-eyebrow">Anywhere · Mobile</div>
            <h2 style={{ fontSize: 'clamp(30px, 3.4vw, 44px)' }}>Designed for <span className="word-glow">desktop</span> and <span className="word-glow">mobile</span>.</h2>
            <p className="lede">
              Every screen is built mobile-first. Check live generation from the garden, your
              tariff window at the supermarket, or where you are on your payback on the train
              home — without losing a chart, stat or feature along the way.
            </p>
            <ul className="feature-bullets" style={{ marginTop: '28px' }}>
              <li>Same data, same insights<span className="lbl">— no cut-down &lsquo;mobile version&rsquo;.</span></li>
              <li>Live, history, range, calendar and leaderboard all designed to work in one hand.</li>
              <li>Charts re-laid-out for thumb-scrolling, not pinch-to-zoom.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Privacy ── */}
      <section id="privacy" className="privacy">
        <div className="wrap">
          <div className="feature" style={{ marginBottom: '56px' }}>
            <div className="feature-text">
              <div className="section-eyebrow">Trust · Privacy</div>
              <h2>Your data, your control, <span className="word-glow">read-only</span> by design.</h2>
              <p className="lede">
                Solar Advisor is a window into your data. We correlate and combine it to show you real
                insights into your system&rsquo;s performance and ROI. Your data is securely stored and gives
                you full access to edit or delete it whenever you want.
              </p>
            </div>
            <div className="feature-shot">
              <BrowserFrame url="solartracker.app/settings" src="/landing/setup-full.png" alt="Setup overview — Tariffs, Provider, Finance, Location, System and Notifications all in your control." />
              <p className="setup-caption" style={{ textAlign: 'left', marginLeft: 0 }}>
                Every aspect of your setup, in one place — yours to edit, delete or disconnect at any moment.
              </p>
            </div>
          </div>
          <div className="privacy-grid">
            <div className="priv-card">
              <div className="badge">✓</div>
              <h4>Edit or delete, anytime</h4>
              <p>You stay in charge of every byte. One button in your account settings removes your data and every derived insight from our systems — no support ticket needed.</p>
            </div>
            <div className="priv-card">
              <div className="badge">⌫</div>
              <h4>Never shared, never sold</h4>
              <p>No ads, no aggregated insight sales, no third-party analytics on your generation data. It&rsquo;s used to power <em>your</em> dashboard — and nothing else.</p>
            </div>
            <div className="priv-card">
              <div className="badge">⌂</div>
              <h4>Secure infrastructure</h4>
              <p>Encrypted in transit and at rest. Solar Advisor is a window into your data — we look through it to give you better insights, we don&rsquo;t open it for anyone else.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section id="cta" className="final-cta">
        <div className="wrap">
          <div className="section-eyebrow">Beta · Invite-only</div>
          <h2 style={{ marginBottom: '22px' }}>Get real <span className="word-glow">insights</span> into your historical data and <span className="word-glow">return on investment</span>.</h2>
          <p className="lede">
            Sign up below to request access to the beta rollout, gain early access,
            and help shape our vision for your data.
          </p>
          <WaitlistForm />
          <div className="hero-fineprint" style={{ justifyContent: 'center', marginTop: '18px' }}>
            <span>Currently MyEnergi-compatible systems only — more platforms coming soon.</span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer>
        <div className="wrap footer-inner">
          <div>© 2026 Solar Advisor.</div>
          <div className="footer-links">
            <a href="mailto:hello@solaradvisor.app">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
