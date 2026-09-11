"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { NumberField } from "./ui";

/* ------------------------------------------------------------------ */
/* Commune autocomplete (free official French geo API — no key, CORS ok) */
/* ------------------------------------------------------------------ */

type Commune = {
  nom: string;
  code: string;
  codesPostaux?: string[];
  departement?: { code: string; nom: string };
};
type Place = { city: string; postalCode: string; department?: string; codeInsee: string };

async function searchCommunes(query: string): Promise<Commune[]> {
  const q = query.trim();
  const byPostal = /^\d{5}$/.test(q);
  const params = byPostal
    ? `codePostal=${q}`
    : `nom=${encodeURIComponent(q)}&boost=population`;
  const url = `https://geo.api.gouv.fr/communes?${params}&fields=nom,code,codesPostaux,departement&limit=8`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

function CommuneAutocomplete({ onSelect }: { onSelect: (p: Place | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Commune[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (picked) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setResults(await searchCommunes(q).catch(() => []));
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [query, picked]);

  const byPostal = /^\d{5}$/.test(query.trim());
  const options = results.flatMap((c) => {
    const cp = byPostal ? query.trim() : c.codesPostaux?.[0];
    return cp
      ? [{ city: c.nom, postalCode: cp, department: c.departement?.nom, codeInsee: c.code, key: `${c.code}-${cp}` }]
      : [];
  });

  const choose = (o: Place & { key: string }) => {
    setQuery(`${o.city} (${o.postalCode})`);
    setPicked(true);
    setOpen(false);
    onSelect({ city: o.city, postalCode: o.postalCode, department: o.department, codeInsee: o.codeInsee });
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(false);
          onSelect(null);
        }}
        onFocus={() => options.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Ville ou code postal"
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
      />
      {open && options.length > 0 && (
        <ul className="thin-scroll absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {options.map((o) => (
            <li key={o.key}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className="block w-full px-3 py-1.5 text-left text-[13px] text-ink transition hover:bg-navy-50"
              >
                {o.city} <span className="text-faint">({o.postalCode})</span>
                {o.department && <span className="text-muted"> · {o.department}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manual entry form                                                   */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] font-medium text-muted">{label}</div>
      {children}
    </label>
  );
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition ${
        active
          ? "border-navy-400 bg-navy-50 text-navy-700"
          : "border-line bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function ManualEntryForm({ onSuccess }: { onSuccess: () => void }) {
  const { applyManualEntry } = useApp();
  const [type, setType] = useState<"Appartement" | "Maison">("Appartement");
  const [price, setPrice] = useState(0);
  const [feesIncluded, setFeesIncluded] = useState(true);
  const [surface, setSurface] = useState(0);
  const [rooms, setRooms] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);

  const valid = price > 0 && surface > 0 && !!place;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !place) return;
    applyManualEntry({
      type,
      price,
      feesIncluded,
      surface,
      rooms: rooms || undefined,
      city: place.city,
      postalCode: place.postalCode,
      department: place.department,
      codeInsee: place.codeInsee,
    });
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[14px] border border-line bg-white p-5 text-left">
      <Field label="Type de bien">
        <div className="flex gap-2">
          <Seg active={type === "Appartement"} onClick={() => setType("Appartement")}>
            Appartement
          </Seg>
          <Seg active={type === "Maison"} onClick={() => setType("Maison")}>
            Maison
          </Seg>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Prix" value={price} step={1000} suffix="€" onChange={(v) => setPrice(Math.max(0, v))} />
        <NumberField label="Surface" value={surface} step={1} suffix="m²" onChange={(v) => setSurface(Math.max(0, v))} />
      </div>

      <Field label="Prix affiché">
        <div className="flex gap-2">
          <Seg active={feesIncluded} onClick={() => setFeesIncluded(true)}>
            Frais d&apos;agence inclus
          </Seg>
          <Seg active={!feesIncluded} onClick={() => setFeesIncluded(false)}>
            Hors honoraires
          </Seg>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Localisation">
          <CommuneAutocomplete onSelect={setPlace} />
        </Field>
        <NumberField label="Pièces (optionnel)" value={rooms} step={1} suffix="" onChange={(v) => setRooms(Math.max(0, v))} />
      </div>

      <button
        type="submit"
        disabled={!valid}
        className="w-full rounded-lg bg-navy-700 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Analyser
      </button>
      {!feesIncluded && price > 0 && (
        <p className="text-[11.5px] text-faint">
          Frais d&apos;agence estimés à {Math.round(price * 0.05).toLocaleString("fr-FR")} € (5 %),
          ajustables dans « Hypothèses ».
        </p>
      )}
    </form>
  );
}
