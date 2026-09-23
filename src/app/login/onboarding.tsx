"use client";

import { useRouter } from "next/navigation";

// Collage tiles: 6 abstract placeholder panels standing in for product
// photography (watch, earbuds, sunglasses, etc). Each tile is pure CSS/SVG
// so there's nothing to license — swap the `art` node in any tile for a
// real <Image src="/images/..." /> product photo when you have assets.
const tiles: { className: string; art: React.ReactNode }[] = [
  {
    className: "col-span-2 row-span-2 bg-gradient-to-br from-teal-800 to-teal-600",
    art: (
      <svg viewBox="0 0 64 64" className="h-16 w-16 text-teal-200/70">
        <rect x="20" y="8" width="24" height="40" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="32" cy="28" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    className: "bg-gradient-to-br from-stone-700 to-stone-500",
    art: (
      <svg viewBox="0 0 64 64" className="h-10 w-10 text-stone-200/70">
        <circle cx="18" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="46" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="28" y1="32" x2="36" y2="32" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    className: "bg-gradient-to-br from-emerald-800 to-emerald-500",
    art: (
      <svg viewBox="0 0 64 64" className="h-10 w-10 text-emerald-100/70">
        <rect x="10" y="20" width="44" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="30" x2="54" y2="30" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    className: "col-span-2 bg-gradient-to-br from-zinc-800 to-zinc-600",
    art: (
      <svg viewBox="0 0 64 64" className="h-8 w-20 text-zinc-200/70">
        <circle cx="18" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="46" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="26" y1="26" x2="38" y2="26" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-gray-200 shadow-xl">
          {/* Collage */}
          <div className="grid grid-cols-3 grid-rows-2 gap-1 aspect-[3/4] p-1 bg-white">
            {tiles.map((tile, i) => (
              <div
                key={i}
                className={`relative flex items-center justify-center rounded-xl ${tile.className}`}
              >
                {tile.art}
              </div>
            ))}
          </div>

          {/* Copy + CTA */}
          <div className="px-8 pb-10 pt-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Dashboard Multichannel
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Pantau seluruh channel, penjualan, dan profit bisnis kamu dari satu tempat.
            </p>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-6 w-full rounded-full bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              Next
            </button>
          </div>

          <div className="absolute bottom-3 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  );
}