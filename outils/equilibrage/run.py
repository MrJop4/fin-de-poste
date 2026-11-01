"""Lance N parties simulées par configuration et écrit les journaux en JSON.
Usage : python3 run.py <index.html> <sortie.json> <n> [config_json]"""
import json, sys, os, subprocess, time, pathlib
from concurrent.futures import ThreadPoolExecutor
from playwright.sync_api import sync_playwright

src, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
configs = json.loads(sys.argv[4]) if len(sys.argv) > 4 else [{"nom": "base"}]
ici = pathlib.Path(__file__).parent
jeu = pathlib.Path(src).read_text()
harness = (ici / "harness.js").read_text()
assert "\ndemo();" in jeu
jeu = jeu.replace("const vibrer =", "let vibrer =")
page_txt = jeu.replace("\ndemo();", "\n" + harness + "\n//demo();", 1)
dossier = pathlib.Path(src).parent
(dossier / "sim.html").write_text(page_txt)

def lot(cfgs):
    res = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.set_default_timeout(0)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8766/sim.html")
        pg.wait_for_timeout(300)
        for c in cfgs:
            t = time.time()
            r = pg.evaluate("o => SIM(o)", c)
            r["cfg"] = c["nom"]; r["duree_sim"] = round(time.time() - t, 1)
            if errs: r["erreurs"] = errs[:3]
            res.append(r)
            print(c["nom"], r["fin"], r["t"], "niv", r["niveau"], "boss", r["boss"], f'{r["duree_sim"]}s', flush=True)
        b.close()
    return res

taches = [c for c in configs for _ in range(n)]
moities = [taches[0::2], taches[1::2]]
with ThreadPoolExecutor(2) as ex:
    tout = sum(ex.map(lot, moities), [])
pathlib.Path(out).write_text(json.dumps(tout))
(dossier / "sim.html").unlink()
