# Appli Poker

Application mobile de Texas Hold'em pour jouer entre amis, avec des jetons fictifs uniquement.

## Organisation

- `packages/engine` : moteur du jeu (cartes, évaluation des mains, mises, pots secondaires). Pur TypeScript, sans dépendance, utilisé côté serveur pour que personne ne voie les cartes des autres.
- `apps/mobile` : application React Native / Expo. On peut jouer en ligne (chacun sur son téléphone, table privée avec un code) ou sur un seul téléphone qu'on se passe.
- `supabase` : base de données (tables, joueurs, cartes privées protégées par la sécurité ligne par ligne) et serveur de jeu `poker` (fonction Supabase qui distribue les cartes et vérifie chaque action).

## Mise en route de Supabase (une seule fois)

1. Dans Supabase, **Authentication > Sign In / Providers** : active **Allow anonymous sign-ins** et enregistre.
2. Crée un jeton d'accès sur https://supabase.com/dashboard/account/tokens.
3. Sur GitHub, **Settings > Secrets and variables > Actions**, ajoute deux secrets :
   - `SUPABASE_ACCESS_TOKEN` : le jeton de l'étape 2 ;
   - `SUPABASE_DB_PASSWORD` : le mot de passe de la base choisi à la création du projet.

Ensuite, chaque modification de `supabase/` ou du moteur sur `main` est déployée automatiquement par le workflow « Déploiement Supabase ». On peut aussi le lancer à la main depuis l'onglet **Actions**.

## Lancer l'application

1. Installe l'app **Expo Go** sur ton téléphone (App Store ou Play Store).
2. Sur ton ordinateur, avec Node 22 ou plus récent :

   ```sh
   npm install
   npm run mobile
   ```

3. Scanne le QR code affiché avec l'appareil photo (iPhone) ou avec Expo Go (Android).

## Tests

```sh
npm test
```

Nécessite Node 22.6 ou plus récent.
