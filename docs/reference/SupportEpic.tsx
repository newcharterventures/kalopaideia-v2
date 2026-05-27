'use client';

/**
 * SupportEpic — Reader-funded contribution CTA
 *
 * Drop-in component for any NCV site (Kalopaideia, Reading Mansion, etc.).
 * Mirrors The Guardian's "epic" pattern: monthly tiers + one-time, mission framing,
 * optional progress bar for fundraising campaigns.
 *
 * Aesthetic: NCV editorial dark theme — black, amber accent, Playfair Display
 * for serif headings, Bebas Neue for tracked-out labels. Assumes Tailwind is
 * configured and both fonts are loaded (via next/font or @import in globals.css).
 *
 * For-profit LLC compliance: uses "support" / "patron" / "contribute" language
 * everywhere. Disclosure footer makes the for-profit status explicit so no
 * supporter mistakes this for a charitable donation.
 */

import { useState } from 'react';

type Tier = {
  amount: number;       // dollars, integer
  label: string;        // e.g. "Reader", "Scholar", "Patron"
  paymentLink: string;  // Stripe Payment Link URL
  highlighted?: boolean; // visually emphasized as the recommended tier
};

export type SupportEpicProps = {
  siteName: string;
  mission: string;
  oneTimeLink: string;
  monthlyTiers: [Tier, Tier, Tier];
  campaign?: {
    goal: number;
    raised: number;
    label?: string; // e.g. "supporters this month"
  };
  className?: string;
};

export default function SupportEpic({
  siteName,
  mission,
  oneTimeLink,
  monthlyTiers,
  campaign,
  className = '',
}: SupportEpicProps) {
  const [mode, setMode] = useState<'monthly' | 'oneTime'>('monthly');

  const open = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const pct = campaign
    ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100))
    : 0;

  return (
    <section
      className={`relative bg-neutral-950 text-stone-200 border-y border-amber-600/20 ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 0%, rgba(217, 119, 6, 0.06) 0%, transparent 50%)',
      }}
    >
      {/* Decorative top rule */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      <div className="max-w-2xl mx-auto px-6 py-14 md:py-16">
        {/* Eyebrow */}
        <p
          className="text-amber-500/90 text-xs mb-4"
          style={{
            fontFamily: '"Bebas Neue", sans-serif',
            letterSpacing: '0.25em',
          }}
        >
          A NOTE FROM {siteName.toUpperCase()}
        </p>

        {/* Mission statement — the emotional anchor */}
        <h2
          className="text-stone-50 text-3xl md:text-4xl leading-[1.15] mb-8"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {mission}
        </h2>

        {/* Optional campaign progress bar */}
        {campaign && (
          <div className="mb-8">
            <div className="flex justify-between items-baseline mb-2">
              <span
                className="text-stone-400 text-xs"
                style={{
                  fontFamily: '"Bebas Neue", sans-serif',
                  letterSpacing: '0.2em',
                }}
              >
                {campaign.raised.toLocaleString()} {campaign.label ?? 'PATRONS'}
              </span>
              <span
                className="text-amber-500 text-xs"
                style={{
                  fontFamily: '"Bebas Neue", sans-serif',
                  letterSpacing: '0.2em',
                }}
              >
                GOAL — {campaign.goal.toLocaleString()}
              </span>
            </div>
            <div className="h-[3px] bg-stone-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex border-b border-stone-800 mb-6">
          {(['monthly', 'oneTime'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-3 text-sm transition-colors duration-200 -mb-px border-b-2 ${
                mode === m
                  ? 'text-amber-400 border-amber-500'
                  : 'text-stone-500 border-transparent hover:text-stone-300'
              }`}
              style={{
                fontFamily: '"Bebas Neue", sans-serif',
                letterSpacing: '0.2em',
              }}
            >
              {m === 'monthly' ? 'MONTHLY' : 'ONE TIME'}
            </button>
          ))}
        </div>

        {/* Tier grid */}
        {mode === 'monthly' ? (
          <div className="grid grid-cols-3 gap-3">
            {monthlyTiers.map((tier) => (
              <button
                key={tier.amount}
                onClick={() => open(tier.paymentLink)}
                className={`relative px-3 py-6 text-left transition-all duration-200 border ${
                  tier.highlighted
                    ? 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                    : 'border-stone-800 hover:border-amber-500/60 hover:bg-amber-500/5'
                }`}
              >
                {tier.highlighted && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black px-2 py-0.5 text-[10px] whitespace-nowrap"
                    style={{
                      fontFamily: '"Bebas Neue", sans-serif',
                      letterSpacing: '0.18em',
                    }}
                  >
                    MOST COMMON
                  </span>
                )}
                <div
                  className={`text-3xl mb-1 ${
                    tier.highlighted ? 'text-amber-300' : 'text-stone-100'
                  }`}
                  style={{
                    fontFamily: '"Playfair Display", Georgia, serif',
                  }}
                >
                  ${tier.amount}
                </div>
                <div
                  className="text-stone-500 text-[11px]"
                  style={{
                    fontFamily: '"Bebas Neue", sans-serif',
                    letterSpacing: '0.18em',
                  }}
                >
                  PER MONTH
                </div>
                <div
                  className="text-stone-300 text-sm mt-2"
                  style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                >
                  {tier.label}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => open(oneTimeLink)}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 transition-colors duration-150"
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              letterSpacing: '0.22em',
            }}
          >
            CONTRIBUTE ANY AMOUNT →
          </button>
        )}

        {/* Disclosure — for-profit LLC compliance */}
        <p className="text-stone-500 text-[11px] leading-relaxed mt-8">
          {siteName} is published by New Charter Ventures LLC, an independent
          for-profit company. Contributions are voluntary and not
          tax-deductible. Payments are processed securely by Stripe; cancel any
          recurring support anytime from your receipt email.
        </p>
      </div>
    </section>
  );
}

/* ---------- Example usage ----------

import SupportEpic from '@/components/SupportEpic';

<SupportEpic
  siteName="Kalopaideia"
  mission="Keep the classical canon free, open, and read aloud — in the languages it was written in."
  oneTimeLink="https://buy.stripe.com/XXXXXX"
  monthlyTiers={[
    { amount: 5,  label: 'Reader',  paymentLink: 'https://buy.stripe.com/AAA' },
    { amount: 10, label: 'Scholar', paymentLink: 'https://buy.stripe.com/BBB', highlighted: true },
    { amount: 25, label: 'Patron',  paymentLink: 'https://buy.stripe.com/CCC' },
  ]}
  campaign={{ goal: 500, raised: 142, label: 'PATRONS THIS MONTH' }}
/>

------------------------------------- */
