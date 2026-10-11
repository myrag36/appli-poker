// Tables classées: ranks, the ranked queue, the leaderboard and the season rewards.

const TIERS: Record<string, string> = {
  Bronze: 'Bronze',
  Argent: 'Silver',
  Or: 'Gold',
  Platine: 'Platinum',
  Diamant: 'Diamond',
  Maître: 'Master',
  Légende: 'Legend',
};

const SEASONS: Record<string, string> = {
  'Grand froid': 'Deep Freeze',
  Carnaval: 'Carnival',
  Printemps: 'Spring',
  'Poisson d’avril': 'April Fools',
  'Fête des fleurs': 'Flower Festival',
  'Fête de la musique': 'Music Festival',
  Plage: 'Beach',
  'Étoiles filantes': 'Shooting Stars',
  Rentrée: 'Back to School',
  Halloween: 'Halloween',
  Automne: 'Autumn',
  Noël: 'Christmas',
};

/** The season titles, "Or — Saison Automne": one per tier and month. */
const seasonTitles: Record<string, string> = {};
for (const [tierFr, tierEn] of Object.entries(TIERS)) {
  for (const [seasonFr, seasonEn] of Object.entries(SEASONS)) {
    seasonTitles[`${tierFr} — Saison ${seasonFr}`] = `${tierEn} — ${seasonEn} Season`;
  }
}

export default {
  ...seasonTitles,
  Platine: 'Platinum',
  Diamant: 'Diamond',
  Maître: 'Master',
  Légende: 'Legend',
  'Or classé': 'Ranked Gold',
  'Platine classé': 'Ranked Platinum',
  'Diamant classé': 'Ranked Diamond',
  'Maître classé': 'Ranked Master',
  'Légende classée': 'Ranked Legend',
  'Atteins le rang {name} en tables classées': 'Reach {name} in ranked games',
  'Saison classée': 'Ranked season',
  'Chacun joue contre la banque, pas contre les autres': 'Everyone plays the bank, not each other',

  // Server messages.
  'Les tables classées s’ouvrent au niveau 10': 'Ranked games open at level 10',
  'Ce jeu ne se joue pas en partie classée': 'This game has no ranked games',
  'Pas de robots en partie classée': 'No robots in ranked games',
  'Ce n’est pas une partie classée': 'This is not a ranked game',
  'Tu as quitté cette partie': 'You left this game',
  'Tu as déjà quitté cette partie': 'You already left this game',

  // Ranks.
  'Placement {n}/{total}': 'Placement {n}/{total}',
  'En placement': 'In placement',
  'Niveau {n} requis': 'Level {n} required',
  'Les tables classées s’ouvrent au niveau {n} : des parties contre des joueurs de ton rang, des rangs à gagner dans chaque jeu et des récompenses à chaque fin de saison.':
    'Ranked games open at level {n}: games against players of your rank, a rank to earn in every game and rewards at the end of each season.',
  'Niveau {level} · encore {xp} XP': 'Level {level} · {xp} XP to go',
  'À gagner : des pièces, des coffres, des titres de saison, des bordures et des dos de cartes exclusifs.':
    'Up for grabs: coins, chests, season titles, and exclusive frames and card backs.',
  '🏆 Calcul de ton rang…': '🏆 Updating your rank…',
  'Abandon : compté comme une défaite': 'Forfeit: counted as a loss',
  'Promu {rank} !': 'Promoted to {rank}!',
  'Rétrogradé {rank}': 'Demoted to {rank}',
  'Classé {rank} !': 'Placed in {rank}!',
  'Ton rang s’affiche après {n} parties de placement.': 'Your rank shows after {n} placement games.',
  '🛡️ Bouclier de promotion : pas de rétrogradation cette fois.':
    '🛡️ Promotion shield: no demotion this time.',
  'Tu restes en {rank} : la prochaine défaite à 0 RP te fera descendre.':
    'You stay in {rank}: the next loss at 0 RP will drop you down.',
  'Fin de saison classée': 'Ranked season over',
  'Saison {name}': '{name} season',
  'Meilleur rang : {rank}': 'Best rank: {rank}',
  'Titre « {name} »': 'Title “{name}”',
  '+ une bordure exclusive': '+ an exclusive frame',
  '+ un dos de cartes exclusif': '+ an exclusive card back',
  'Nouvelle saison : tu repars un palier plus bas. Bonne chance !':
    'New season: you start one tier lower. Good luck!',

  // At a ranked table.
  'Quitter la partie classée ?': 'Leave the ranked game?',
  'Partir avant la fin compte comme une défaite : tu perds des RP, et un robot finit la partie à ta place.':
    'Leaving before the end counts as a loss: you lose RP, and a robot finishes the game for you.',
  'Abandonner (défaite)': 'Forfeit (loss)',
  'Rester et jouer': 'Stay and play',
  '🏳️ {name} a abandonné la partie.': '🏳️ {name} forfeited the game.',
  'Ta victoire compte déjà : tu peux finir la partie ou partir.':
    'Your win already counts: finish the game or leave.',

  // Leaderboard.
  '📊 Classement classé': '📊 Ranked leaderboard',
  '🌍 Top 100': '🌍 Top 100',
  'Ma place en {game}': 'My place in {game}',
  '{n}e du classement': 'No. {n} on the leaderboard',
  'Termine tes parties de placement pour apparaître.': 'Finish your placement games to appear.',
  'Aucun ami classé en {game} cette saison.': 'No friend is ranked in {game} this season.',
  'Personne n’est encore classé en {game} cette saison : à toi de jouer !':
    'Nobody is ranked in {game} yet this season: your move!',
  '… et toi, {n}e.': '… and you, No. {n}.',

  // Quick match picker and search.
  '🏆 Partie classée': '🏆 Ranked game',
  'Recherche d’adversaires de ton rang…': 'Looking for opponents of your rank…',
  'Uniquement des joueurs de ton rang, sans robots : la recherche s’élargit doucement.':
    'Only players of your rank, no robots: the search widens slowly.',
  'sans robots': 'no robots',
  'Ton rang {game}': 'Your {game} rank',
  '{rank} : ton départ cette saison': '{rank}: your start this season',
  '📊 Classement': '📊 Leaderboard',
  '🏆 Chercher une partie classée de {game}': '🏆 Find a ranked {game} game',
  'Gagne des RP pour monter de rang. Quitter une partie classée compte comme une défaite.':
    'Win RP to rank up. Leaving a ranked game counts as a loss.',
  'Pas de partie classée au Blackjack : {why}.': 'No ranked Blackjack: {why}.',
  'Plus que {n} j · à la fin, récompenses selon ton meilleur rang, puis on repart un palier plus bas.':
    '{n} d left · then rewards for your best rank, and everyone starts one tier lower.',
  'Rang principal': 'Main rank',
  'Pas encore classé': 'Not ranked yet',
  'Joue {n} parties classées dans un jeu pour y être classé.':
    'Play {n} ranked games in a game to get a rank.',
  '⚡ Normale': '⚡ Casual',
  '🏆 Classée': '🏆 Ranked',
  '🏆 Tables classées': '🏆 Ranked games',
  'Affronte des joueurs de ton rang et grimpe de Bronze à Légende.':
    'Face players of your rank and climb from Bronze to Legend.',
  'Table de {n} joueur': '{n}-player table',
  'Table de {n} joueurs': '{n}-player table',

  // Profile, home and level up.
  'Mes rangs': 'My ranks',
  '🔒 Les tables classées s’ouvrent au niveau {n} : un rang par jeu, de Bronze à Légende.':
    '🔒 Ranked games open at level {n}: a rank in every game, from Bronze to Legend.',
  'Aucune partie classée cette saison.': 'No ranked game this season.',
  '🏆 Tables classées ›': '🏆 Ranked games ›',
  'Tables classées, niveau {n} requis': 'Ranked games, level {n} required',
  'Tables classées : affronte des joueurs de ton rang': 'Ranked games: face players of your rank',
  '🏆 Classées': '🏆 Ranked',
  '🔒 Niv. {n}': '🔒 Lv. {n}',
  '🏆 Tables classées débloquées !': '🏆 Ranked games unlocked!',
  'Affronte des joueurs de ton rang, grimpe de Bronze à Légende et gagne des récompenses à chaque saison.':
    'Face players of your rank, climb from Bronze to Legend and earn rewards every season.',
  'Découvrir les tables classées ›': 'Discover ranked games ›',
} as Record<string, string>;
