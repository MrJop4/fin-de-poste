/* Simulateur accéléré de Fin de Poste : injecté dans une copie du jeu, il joue des parties sans affichage
   avec un bot qui fuit les colis, esquive les transpalettes et choisit ses cartes comme un joueur moyen. */
window.SIM = function (opts) {
  opts = opts || {};
  SAVE.test = true; SAVE.lieux = Object.keys(LIEUX); SAVE.amelioTest = opts.amelio || {}; SAVE.perso = opts.perso || "preparateur"; SAVE.lieu = opts.lieu || "quai";
  W = opts.W || 1000; H = opts.H || 640;
  if (opts.chefPv) for (const c of Object.values(CHEFS)) c.pv = opts.chefPv;
  const log = { chef: null, morts: null, niveaux: {}, vivants: {}, hp: {}, kills: {}, dps: {}, entrant: {}, boss: [], evos: [], choix: [], coffres: 0, argent: 0, degSubis: {} };
  let degats = 0, entrant = 0, subis = 0, fini = null;
  const _blesser = blesser; blesser = function (e, d, kx, ky) { const h0 = e.hp; if (!e.decor) degats += Math.min(e.hp, d * S.p.deg); const r = _blesser(e, d, kx, ky); if (e.chef) log.chef.deg += h0 - Math.max(0, e.hp); return r };
  const _sc = spawnChef; spawnChef = function () { _sc(); log.chef = { t0: S.t, pv: S.chefE.max, deg: 0 } };
  const _spawn = spawn; spawn = function (type, elite) { _spawn(type, elite); const e = S.ennemis[S.ennemis.length - 1]; entrant += e.hp; if (e.boss) log.boss.push({ t0: S.t, e, nb: 1 }) };
  if (typeof spawnMini === "function") { const _sm = spawnMini; spawnMini = function () { _sm(); log.boss.push({ t0: S.t, e: S.ennemis[S.ennemis.length - 1], mini: true }) } }
  majHud = () => { }; majArmes = () => { }; annonce = () => { }; vibrer = () => { };
  const policy = (o) => {
    const nbA = Object.keys(S.armes).length;
    let s = Math.random() * (opts.bruit ?? 12);
    if (o.kind === "arme") s += (S.armes[o.id] ? 50 + o.l : 40) - (opts.armes && !opts.armes.includes(o.id) ? 200 : 0);
    else if (o.kind === "objet") {
      const lie = Object.keys(S.armes).some(id => EVOS[id].avec === o.id);
      s += (lie && !S.objets[o.id] ? 60 : 0) + (({ meule: 30, huile: 30, cire: 24, soupe: 18, bottes: 16, boussole: 12, genoux: 20, ceinture: 10 })[o.id] || 10);
    } else if (o.kind === "bonus") s += ({ pausecafe: S.p.hp < S.p.max * .5 ? 70 : 5, balai: 25, alarme: 20, speed: 15, prime: 8 })[o.id] || 5;
    else s += 1;
    return s;
  };
  ouvrirChoix = function () {
    offres = tirer(3); const best = offres.reduce((a, b) => policy(b) > policy(a) ? b : a);
    appliquer(best); log.choix.push([Math.round(S.t), best.kind, best.id, best.l]);
    if (S.p.xp >= S.p.next) gagnerXp(0);
  };
  ouvrirCoffre = function (gros) {
    const p = S.p; p.hp = gros ? p.max : Math.min(p.max, p.hp + 30); log.coffres++;
    const id = (gros || opts.evoPartout) ? evoPrete() : null;
    if (id) { S.armes[id] = EVO; log.evos.push([Math.round(S.t), id]); return }
    offres = tirer(3); appliquer(offres.reduce((a, b) => policy(b) > policy(a) ? b : a));
  };
  mortJoueur = function () { fini = "mort" };
  finir = function (g) { fini = g ? "victoire" : "mort" };
  nouvellePartie(); enJeu = false;
  for (let i = 0; i < niv("vip"); i++) { const pool = offresPossibles(); if (pool.length) appliquer(pool[Math.floor(Math.random() * pool.length)]) }
  JOY.actif = true; JOY.ox = 0; JOY.oy = 0;
  if (opts.immortel) { S.p.max = S.p.hp = 1e7; S.p.regen = 1e6 }   // pour mesurer seulement le rythme des cartes
  const dt = opts.dt || 1 / 30, maxT = opts.maxT || VICTOIRE + 240;
  let prochain = 1, hpPrec = S.p.hp;
  let reflexe = 0;
  while (!fini && S.t < maxT) {
    if ((reflexe -= dt) > 0) { const hp0 = S.p.hp; maj(dt); if (S.p.hp < hp0) subis += hp0 - S.p.hp; suivi(); continue }
    reflexe = opts.reaction || 0;
    // bot : fuite pondérée, un peu de rotation pour ne pas se faire coincer, va chercher étiquettes et coffres quand c'est calme
    const p = S.p; let vx = 0, vy = 0, danger = 0;
    for (const e of S.ennemis) {
      if (e.decor) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d > (opts.fuite || 170) + e.r) continue;
      const w = (e.boss ? 4 : e.elite ? 2 : 1) * Math.pow((opts.fuite || 170) * .35 / Math.max(15, d - e.r), 2);
      vx += dx / d * w; vy += dy / d * w; danger += w;
      vx += -dy / d * w * .45; vy += dx / d * w * .45;
    }
    for (const tp of S.transpas) {
      const h = tp.ax === "h", ecart = h ? p.y - tp.y : p.x - tp.x;
      if (Math.abs(ecart) < TP_LARG + 50) { const s = (ecart >= 0 ? 1 : -1) * 30; if (h) vy += s; else vx += s; danger += 30 }
    }
    if (danger < 1.5) {
      let cible = null, md = 420;
      for (const g of S.gemmes) { const d = Math.hypot(g.x - p.x, g.y - p.y); const dd = g.coffre ? d * .3 : g.argent ? d * .7 : d; if (dd < md) { md = dd; cible = g } }
      for (const e of S.ennemis) if (e.decor) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < md) { md = d; cible = e } }
      if (cible) { const d = Math.hypot(cible.x - p.x, cible.y - p.y) || 1; vx += (cible.x - p.x) / d * 1.5; vy += (cible.y - p.y) / d * 1.5 }
      else { let m = null, md = 1e9; for (const e of S.ennemis) { if (e.decor) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < md) { md = d; m = e } }
        if (m && md > 120) { vx += (m.x - p.x) / md; vy += (m.y - p.y) / md } }
      vx += -p.x / 4000; vy += -p.y / 4000;
    }
    if (opts.immobile != null && S.t > opts.immobile) { vx = 0; vy = 0 }
    if (opts.sansTranspa) S.transpaT = 1e9;
    const n = Math.hypot(vx, vy);
    if (n > .05) { JOY.x = vx / n * 60; JOY.y = vy / n * 60 } else { JOY.x = 0; JOY.y = 0 }
    if (S.ev) { const ev = S.ev; const d = Math.hypot(p.x - ev.cx, p.y - ev.cy); if (d > ev.r * .7) { JOY.x += (ev.cx - p.x) / d * 40; JOY.y += (ev.cy - p.y) / d * 40 } }
    const hp0 = p.hp;
    maj(dt);
    if (p.hp < hp0) subis += hp0 - p.hp;
    suivi();
  }
  function suivi() {
    for (const b of log.boss) if (b.t1 == null && b.e.hp <= 0) b.t1 = S.t;
    if (S.t >= prochain) {
      const k = prochain;
      log.niveaux[k] = S.p.niv; log.vivants[k] = S.ennemis.filter(e => !e.decor).length; log.hp[k] = Math.round(S.p.hp); log.kills[k] = S.kills;
      log.dps[k] = Math.round(degats); log.entrant[k] = Math.round(entrant); log.degSubis[k] = Math.round(subis);
      if (k === 595) log.armes595 = Object.assign({}, S.armes);   // juste avant le boss final
      degats = 0; entrant = 0; subis = 0; prochain++;
    }
  }
  if (log.chef) { const c = log.chef, e = S.chefE; c.duree = Math.round(S.t - c.t0); c.mort = e.hp <= 0; c.ttk = c.mort ? Math.round((log.chef.t1 || S.t) - c.t0) : null; c.dps = Math.round(c.deg / Math.max(1, S.t - c.t0)); c.pv = Math.round(c.pv); c.deg = Math.round(c.deg) }
  log.fin = fini || "temps"; log.t = Math.round(S.t); log.niveau = S.p.niv; log.kills_total = S.kills; log.argent = S.argent;
  log.armes = Object.assign({}, S.armes); log.objets = Object.assign({}, S.objets);
  log.boss = log.boss.map(b => ({ mini: !!b.mini, t0: Math.round(b.t0), ttk: b.t1 != null ? Math.round(b.t1 - b.t0) : null }));
  return log;
};
