/* Compteur de joueurs de Fin de Poste (03/11/2026, demandé par Mr Jop).
   Chaque téléphone a un numéro anonyme tiré au hasard (rien de personnel). Le jeu envoie « debut » quand une partie
   commence et « fin » quand elle se termine (lieu, gagnée ou pas). On garde une fiche par joueur dans Netlify Blobs.
   GET /api/compteur rend le total : joueurs différents, parties, victoires, par lieu et par jour. */
import { getStore } from "@netlify/blobs";

const LIEUX = ["quai", "frigo", "stockage", "parking", "promo", "atelier", "chargement", "incendie"];
const ID_OK = /^[a-z0-9-]{8,40}$/;

const jourParis = (d = new Date()) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(d); // AAAA-MM-JJ

export function nouvelleFiche(maintenant) {
  return { premier: maintenant, dernier: maintenant, parties: 0, finies: 0, victoires: 0, test: 0, lieux: {}, jours: {} };
}

/* applique un événement à la fiche d'un joueur (fonction pure, testée à part) */
export function appliquer(fiche, ev, maintenant = new Date()) {
  const f = fiche || nouvelleFiche(maintenant.toISOString());
  f.dernier = maintenant.toISOString();
  const jour = jourParis(maintenant);
  const lieu = LIEUX.includes(ev.lieu) ? ev.lieu : "quai";
  const L = f.lieux[lieu] || (f.lieux[lieu] = { parties: 0, victoires: 0 });
  if (ev.type === "debut") {
    f.parties++; L.parties++;
    f.jours[jour] = (f.jours[jour] || 0) + 1;
    if (ev.test) f.test++;
  } else if (ev.type === "fin") {
    f.finies++;
    if (ev.gagne) { f.victoires++; L.victoires++; }
  }
  // on ne garde que les 120 derniers jours d'activité par joueur
  const js = Object.keys(f.jours).sort();
  while (js.length > 120) delete f.jours[js.shift()];
  return f;
}

/* additionne toutes les fiches (fonction pure, testée à part) */
export function totaliser(fiches, maintenant = new Date()) {
  const auj = jourParis(maintenant);
  const il7 = jourParis(new Date(maintenant.getTime() - 6 * 864e5));
  const T = { joueurs: fiches.length, actifsAuj: 0, actifs7j: 0, parties: 0, victoires: 0, finies: 0, test: 0, lieux: {}, jours: {}, maj: maintenant.toISOString() };
  for (const f of fiches) {
    T.parties += f.parties || 0; T.victoires += f.victoires || 0; T.finies += f.finies || 0; T.test += f.test || 0;
    for (const [k, v] of Object.entries(f.lieux || {})) {
      const L = T.lieux[k] || (T.lieux[k] = { parties: 0, victoires: 0, joueurs: 0 });
      L.parties += v.parties || 0; L.victoires += v.victoires || 0; if (v.parties) L.joueurs++;
    }
    let aAuj = false, a7 = false;
    for (const [j, n] of Object.entries(f.jours || {})) {
      const D = T.jours[j] || (T.jours[j] = { parties: 0, joueurs: 0 });
      D.parties += n; D.joueurs++;
      if (j === auj) aAuj = true;
      if (j >= il7) a7 = true;
    }
    if (aAuj) T.actifsAuj++;
    if (a7) T.actifs7j++;
  }
  return T;
}

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async (req) => {
  const store = getStore({ name: "compteur-joueurs", consistency: "strong" });
  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "j/" });
    const fiches = (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean);
    return json(totaliser(fiches));
  }
  if (req.method !== "POST") return json({ ok: false }, 405);
  let ev;
  try { ev = JSON.parse(await req.text()); } catch { return json({ ok: false }, 400); }
  if (!ev || !ID_OK.test(String(ev.id || "")) || !["debut", "fin"].includes(ev.type)) return json({ ok: false }, 400);
  const cle = "j/" + ev.id;
  const fiche = await store.get(cle, { type: "json" });
  await store.setJSON(cle, appliquer(fiche, ev));
  return json({ ok: true });
};

export const config = { path: "/api/compteur" };
