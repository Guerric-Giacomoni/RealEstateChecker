"use client";

import { useEffect, useMemo, useState } from "react";
import type { DvfRow } from "@/lib/types";

type Filters = {
  cp: string;
  dept: string;
  type: string;
  priceMin: string;
  priceMax: string;
  surfaceMin: string;
  surfaceMax: string;
  roomsMin: string;
};

const EMPTY: Filters = {
  cp: "",
  dept: "",
  type: "",
  priceMin: "",
  priceMax: "",
  surfaceMin: "",
  surfaceMax: "",
  roomsMin: "",
};

const fr = (n: number) => n.toLocaleString("fr-FR");

const COLS: { key: string; label: string; sort?: string; align?: "right" }[] = [
  { key: "adresse", label: "Adresse" },
  { key: "cp", label: "Code postal" },
  { key: "type", label: "Type" },
  { key: "price", label: "Prix", sort: "price", align: "right" },
  { key: "surface", label: "Surface", sort: "surface", align: "right" },
  { key: "priceM2", label: "€/m²", sort: "price_m2", align: "right" },
  { key: "rooms", label: "Pièces", sort: "rooms", align: "right" },
  { key: "month", label: "Mois 2025", sort: "month", align: "right" },
];

export default function DvfExplorer() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState("price");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [rows, setRows] = useState<DvfRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    p.set("sort", sort);
    p.set("order", order);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [filters, sort, order, page, limit]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dvf/search?${query}`);
        const data = await res.json();
        if (!cancelled) {
          setRows(data.rows ?? []);
          setTotal(data.total ?? 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const set = (k: keyof Filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(0);
  };
  const toggleSort = (col?: string) => {
    if (!col) return;
    if (sort === col) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setOrder("desc");
    }
    setPage(0);
  };

  const pages = Math.ceil(total / limit);

  const input =
    "w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-4">
          <h1 className="text-[18px] font-semibold text-ink">Explorateur DVF 2025</h1>
          <p className="text-[12.5px] text-muted">
            Ventes réelles (Appartement / Maison) — France entière. Filtrez et triez la base.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-6">
        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-4 lg:grid-cols-8">
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Code postal</div>
            <input className={input} value={filters.cp} onChange={(e) => set("cp", e.target.value)} placeholder="75009" />
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Département</div>
            <input className={input} value={filters.dept} onChange={(e) => set("dept", e.target.value)} placeholder="75" />
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Type</div>
            <select className={input} value={filters.type} onChange={(e) => set("type", e.target.value)}>
              <option value="">Tous</option>
              <option value="Appartement">Appartement</option>
              <option value="Maison">Maison</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Pièces min</div>
            <input className={input} value={filters.roomsMin} onChange={(e) => set("roomsMin", e.target.value)} inputMode="numeric" placeholder="—" />
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Prix min</div>
            <input className={input} value={filters.priceMin} onChange={(e) => set("priceMin", e.target.value)} inputMode="numeric" placeholder="€" />
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Prix max</div>
            <input className={input} value={filters.priceMax} onChange={(e) => set("priceMax", e.target.value)} inputMode="numeric" placeholder="€" />
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Surface min</div>
            <input className={input} value={filters.surfaceMin} onChange={(e) => set("surfaceMin", e.target.value)} inputMode="numeric" placeholder="m²" />
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] text-muted">Surface max</div>
            <input className={input} value={filters.surfaceMax} onChange={(e) => set("surfaceMax", e.target.value)} inputMode="numeric" placeholder="m²" />
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>
            {loading ? "Chargement…" : `${fr(total)} ventes`}
            {total > 0 && ` · page ${page + 1}/${Math.max(pages, 1)}`}
          </span>
          <button
            onClick={() => {
              setFilters(EMPTY);
              setPage(0);
            }}
            className="rounded-lg border border-line px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Réinitialiser
          </button>
        </div>

        {/* Table */}
        <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.sort)}
                    className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-faint ${
                      c.align === "right" ? "text-right" : "text-left"
                    } ${c.sort ? "cursor-pointer select-none hover:text-navy-600" : ""}`}
                  >
                    {c.label}
                    {c.sort === sort ? (order === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60 transition hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-slate-600">
                    <span className="block max-w-[260px] truncate">
                      {[r.adresse, r.ville].filter(Boolean).join(", ") || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.cp}</td>
                  <td className="px-3 py-2 text-slate-600">{r.type}</td>
                  <td className="px-3 py-2 text-right font-semibold text-ink">{fr(r.price)} €</td>
                  <td className="px-3 py-2 text-right">{r.surface} m²</td>
                  <td className="px-3 py-2 text-right">{fr(r.priceM2)} €</td>
                  <td className="px-3 py-2 text-right">{r.rooms ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{String(r.month).padStart(2, "0")}/2025</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-3 py-8 text-center text-muted">
                    Aucune vente pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-[12.5px] text-muted">
            Page {page + 1} / {Math.max(pages, 1)}
          </span>
          <button
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      </main>
    </div>
  );
}
