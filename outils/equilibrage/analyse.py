import json, sys, statistics as st
from collections import defaultdict
runs = json.load(open(sys.argv[1]))
par = defaultdict(list)
for r in runs: par[r["cfg"]].append(r)
def med(xs): return round(st.median(xs), 1) if xs else None
for cfg, rs in par.items():
    print(f"\n=== {cfg} ({len(rs)} parties)")
    fins = [r["t"] for r in rs]
    vict = sum(r["fin"] == "victoire" for r in rs)
    print(f"victoires {vict}/{len(rs)} · survie médiane {med(fins)} s · min {min(fins)} · max {max(fins)}")
    print("min | niveau | vivants | PV | dégâts/s | PV entrants/s | ρ | subis/min | vivants %")
    for m in range(1, 11):
        k = str(m * 60); vivant = [r for r in rs if k in r["niveaux"]]
        if not vivant: break
        def fen(r, cle):  # somme sur la minute écoulée
            return sum(r[cle].get(str(s), 0) for s in range(m * 60 - 59, m * 60 + 1))
        dps = med([fen(r, "dps") / 60 for r in vivant]); ent = med([fen(r, "entrant") / 60 for r in vivant])
        print(f"{m:>3} | {med([r['niveaux'][k] for r in vivant]):>6} | {med([r['vivants'][k] for r in vivant]):>7} | {med([r['hp'][k] for r in vivant]):>3} | {dps:>8} | {ent:>13} | {round(ent / dps, 2) if dps else '-':>4} | {med([fen(r, 'degSubis') for r in vivant]):>9} | {round(100 * len(vivant) / len(rs))}")
    for nom, mini in (("semis", False), ("hors gabarit", True)):
        bs = [b for r in rs for b in r["boss"] if b.get("mini", False) == mini]
        bt = [b["ttk"] for b in bs if b["ttk"] is not None]
        print(f"{nom} : {len(bt)}/{len(bs)} tués · temps médian {med(bt)} s · p25-p75 {sorted(bt)[len(bt)//4] if bt else '-'}-{sorted(bt)[3*len(bt)//4] if bt else '-'}")
    print("évolutions :", sum(len(r["evos"]) for r in rs), "· coffres médian", med([r["coffres"] for r in rs]), "· kills médian", med([r["kills_total"] for r in rs]))
