"""
Build data/dvf-2025.sqlite from the geo-dvf full.csv (whole-France DVF, 2025).

Source: https://files.data.gouv.fr/geo-dvf/latest/csv/2025/full.csv (~616 MB)
Output: a lean, indexed SQLite (~29 MB) the app queries for "Ventes comparables".

Keeps only clean, comparable sales:
  - nature_mutation = 'Vente', type_local in Appartement/Maison
  - valid price + surface, sane €/m² (200–30 000)
  - single-dwelling mutations only, so valeur_fonciere ÷ surface is a real €/m²
Keyed on postal code (arrondissement-precise for Paris/Lyon/Marseille).

Usage:  python scripts/build-dvf.py path/to/full.csv
Needs:  pip install duckdb
"""
import os
import sqlite3
import sys

import duckdb

CSV = sys.argv[1] if len(sys.argv) > 1 else "full.csv"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "dvf-2025.sqlite")
OUT = os.path.abspath(OUT)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
if os.path.exists(OUT):
    os.remove(OUT)

con = duckdb.connect()
con.execute("INSTALL sqlite; LOAD sqlite;")
con.execute(f"ATTACH '{OUT}' AS s (TYPE sqlite);")
con.execute(
    f"""
    create table s.sales as
    with base as (
        select code_postal as cp,
               case when type_local = 'Appartement' then 'A' else 'M' end as type,
               cast(valeur_fonciere as double) as price,
               cast(surface_reelle_bati as double) as surface,
               try_cast(nombre_pieces_principales as integer) as rooms,
               cast(strftime(date_mutation, '%m') as integer) as month,
               nullif(trim(concat_ws(' ', adresse_numero, adresse_suffixe, adresse_nom_voie)), '') as adresse,
               nom_commune as ville,
               id_mutation
        from read_csv('{CSV}', quote='"', escape='"', ignore_errors=true)
        where nature_mutation = 'Vente'
          and type_local in ('Appartement', 'Maison')
          and valeur_fonciere > 0 and surface_reelle_bati > 0
          and code_postal is not null
    ),
    single as (select id_mutation from base group by id_mutation having count(*) = 1)
    select cp, type,
           cast(b.price as integer) as price,
           cast(b.surface as integer) as surface,
           rooms, month, adresse, ville
    from base b join single s using (id_mutation)
    where b.price / b.surface between 200 and 30000
    """
)
con.close()

con = sqlite3.connect(OUT)
con.execute("create index idx_cp on sales(cp, type)")
con.commit()
con.execute("vacuum")
con.commit()
rows = con.execute("select count(*) from sales").fetchone()[0]
con.close()
print(f"built {OUT} — {rows:,} rows, {os.path.getsize(OUT) / 1024 / 1024:.1f} MB")
