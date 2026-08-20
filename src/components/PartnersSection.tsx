"use client";

/** Sponsored partner offers, shown at the bottom of every dashboard tab. */
const PARTNERS = [
  {
    brand: "GMF",
    name: "Fonctionnaire ?",
    tagline: "Assurance dès 12,24 €/mois",
    color: "bg-[#1b3a8f]",
    href: "#",
  },
  {
    brand: "MH",
    name: "Assurance emprunteur",
    tagline: "Économisez jusqu'à 15 000 €",
    color: "bg-[#e2001a]",
    href: "#",
  },
  {
    brand: "CM",
    name: "Crédit Mutuel",
    tagline: "Demandez votre simulation de crédit immo",
    color: "bg-[#d5001c]",
    href: "#",
  },
];

export function PartnersSection() {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-[15px] font-semibold text-ink">
        Nos partenaires à votre service
      </h3>
      <div className="space-y-2">
        {PARTNERS.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3.5 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-navy-300 hover:bg-navy-50/40"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.color} text-[11px] font-bold tracking-tight text-white`}
            >
              {p.brand}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-ink">{p.name}</div>
              <div className="text-[12px] text-muted">{p.tagline}</div>
            </div>
            <span className="shrink-0 text-[16px] text-faint transition group-hover:translate-x-0.5 group-hover:text-navy-500">
              →
            </span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] text-faint">Publicité — offres de nos partenaires.</p>
    </section>
  );
}
