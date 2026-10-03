# Appli Poker

Application mobile de Texas Hold'em pour jouer entre amis, avec des jetons fictifs uniquement.

## Organisation

- `packages/engine` : moteur du jeu (cartes, évaluation des mains, mises, pots secondaires). Pur TypeScript, sans dépendance, utilisé côté serveur pour que personne ne voie les cartes des autres.
- `apps/mobile` : application React Native / Expo. Pour l'instant on joue sur un seul téléphone qu'on se passe.
- `supabase` (à venir) : comptes, tables privées et synchro temps réel.

## Lancer l'application

1. Installe l'app **Expo Go** sur ton téléphone (App Store ou Play Store).
2. Sur ton ordinateur, avec Node 22 ou plus récent :

   ```sh
   npm install
   npm run mobile
   ```

3. Scanne le QR code affiché avec l'appareil photo (iPhone) ou avec Expo Go (Android).

## Tests du moteur

```sh
cd packages/engine
npm test
```

Nécessite Node 22.6 ou plus récent.
