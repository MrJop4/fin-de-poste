# Simulateur d'équilibrage

Joue des parties accélérées sans affichage, avec un bot qui fuit les colis, esquive les transpalettes et choisit ses cartes comme un joueur moyen (temps de réaction 0,25 s).

```
cd fin-de-poste && python3 -m http.server 8766 &
python3 outils/equilibrage/run.py index.html resultats.json 14 "$(cat outils/equilibrage/cfg.json)"
python3 outils/equilibrage/analyse.py resultats.json
```

Profils de `cfg.json` : débutant (vestiaire vide), vestiaire moyen, vestiaire au max. Options d'un profil : `perso`, `lieu`, `amelio`, `reaction`, `fuite`, `bruit`, `armes` (outils autorisés), `immobile` (s'arrête de bouger après N s), `sansTranspa`.

Tous les réglages sont dans la constante `EQ` en haut du jeu. Repères visés (bot) : victoire ≈ 35 % débutant, ≈ 80 % vestiaire moyen, ≈ 100 % vestiaire max ; niveau ≈ 12 à 5:00 et ≈ 23 à 10:00 ; semi tué en 40-60 s.
