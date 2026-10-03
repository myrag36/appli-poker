# Appli Poker

Application mobile de Texas Hold'em pour jouer entre amis, avec des jetons fictifs uniquement.

## Organisation

- `packages/engine` : moteur du jeu (cartes, évaluation des mains, mises, pots secondaires). Pur TypeScript, sans dépendance, utilisé côté serveur pour que personne ne voie les cartes des autres.
- `apps/mobile` (à venir) : application React Native / Expo.
- `supabase` (à venir) : comptes, tables privées et synchro temps réel.

## Tests du moteur

```sh
cd packages/engine
npm test
```

Nécessite Node 22.6 ou plus récent.
