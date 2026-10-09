// Bataille navale (Battleship): against the robot and at an online table.
export default {
  'Bataille navale': 'Battleship',
  '⚓ Bataille navale': '⚓ Battleship',
  'Cache ta flotte, tire à l’aveugle et coule tous les navires adverses.':
    'Hide your fleet, fire blind and sink every enemy ship.',
  'Une grille de 10 × 10, 5 navires à couler': 'A 10 × 10 grid, 5 ships to sink',
  'Il tire un peu au hasard et oublie parfois tes navires touchés.':
    'Fires a bit at random and sometimes forgets the ships it hit.',
  'Il quadrille la mer et achève les navires qu’il touche.':
    'Sweeps the sea in a pattern and finishes off the ships it hits.',
  'Il calcule où ta flotte peut encore se cacher. Bonne chance !':
    'Works out where your fleet can still hide. Good luck!',
  'Tu places ta flotte, puis vous tirez chacun votre tour. Tu tires le premier.':
    'Place your fleet, then you take turns firing. You fire first.',

  // Ships
  'Porte-avions': 'Carrier',
  Croiseur: 'Cruiser',
  'Contre-torpilleur': 'Destroyer',
  'Sous-marin': 'Submarine',
  Torpilleur: 'Patrol boat',

  // Rules
  'Coule les 5 navires de ton adversaire avant qu’il ne coule les tiens.':
    'Sink your opponent’s 5 ships before they sink yours.',
  'Place ta flotte': 'Place your fleet',
  'Chacun cache 5 navires sur sa grille de 10 × 10 : porte-avions (5 cases), croiseur (4), contre-torpilleur (3), sous-marin (3) et torpilleur (2). À l’horizontale ou à la verticale, sans chevauchement.':
    'Each player hides 5 ships on their 10 × 10 grid: carrier (5 cells), cruiser (4), destroyer (3), submarine (3) and patrol boat (2). Horizontal or vertical, never overlapping.',
  'Un porte-avions et un torpilleur': 'A carrier and a patrol boat',
  'Tire chacun ton tour': 'Take turns firing',
  'Touche une case de la grille adverse. « À l’eau » si elle est vide, « Touché » si un navire s’y trouve.':
    'Tap a cell of the enemy grid. “Miss” if it is empty, “Hit” if a ship is there.',
  'À l’eau': 'Miss',
  Touché: 'Hit',
  'Coulé !': 'Sunk!',
  'Quand toutes les cases d’un navire sont touchées, il coule et apparaît en rouge.':
    'When every cell of a ship is hit, it sinks and shows up in red.',
  Coulé: 'Sunk',
  Victoire: 'Victory',
  'Le premier qui coule toute la flotte adverse gagne la partie.':
    'The first to sink the whole enemy fleet wins the game.',
  'Après un touché, tire autour : le navire continue en ligne droite.':
    'After a hit, fire around it: the ship goes on in a straight line.',

  // Placement
  Placement: 'Deployment',
  '🎲 Au hasard': '🎲 Random',
  '↻ Pivoter (—)': '↻ Rotate (—)',
  '↻ Pivoter (|)': '↻ Rotate (|)',
  'Ta flotte est prête. Touche un navire pour le déplacer.': 'Your fleet is ready. Tap a ship to move it.',
  'Touche la grille pour poser ton {ship}.': 'Tap the grid to place your {ship}.',
  'Choisis un navire à placer.': 'Pick a ship to place.',
  'Poser en {c}': 'Place at {c}',
  'Prêt, au combat !': 'Ready, to battle!',
  'Place encore {n} navire': 'Place {n} more ship',
  'Place encore {n} navires': 'Place {n} more ships',

  // Battle
  '🔥 Coulé ! Un navire de {n} cases par le fond.': '🔥 Sunk! A {n}-cell ship goes down.',
  '💥 Touché en {c} !': '💥 Hit at {c}!',
  '🌊 À l’eau en {c}.': '🌊 Miss at {c}.',
  '🔥 {name} coule ton navire de {n} cases !': '🔥 {name} sinks your {n}-cell ship!',
  '💥 {name} te touche en {c} !': '💥 {name} hits you at {c}!',
  '🌊 {name} tire en {c} : à l’eau.': '🌊 {name} fires at {c}: miss.',
  '⚓ Que la bataille commence !': '⚓ Let the battle begin!',
  'Tirer en {c}': 'Fire at {c}',
  '🚢 Ta flotte': '🚢 Your fleet',
  '🎯 Flotte de {name}': '🎯 {name}’s fleet',
  'Voir la grille adverse': 'Show the enemy grid',
  'Voir ma flotte': 'Show my fleet',
  'Ta flotte': 'Your fleet',
  'Flotte de {name}': '{name}’s fleet',
  '↔ Touche pour viser': '↔ Tap to aim',
  '↔ Touche pour voir ta flotte': '↔ Tap to see your fleet',
  '{n} navire à flot': '{n} ship afloat',
  '{n} navires à flot': '{n} ships afloat',
  '🏆 Tu as coulé toute la flotte !': '🏆 You sank the whole fleet!',
  '{name} a coulé toute ta flotte…': '{name} sank your whole fleet…',
  '🤖 {name} vise…': '🤖 {name} is aiming…',
  '{name} vise…': '{name} is aiming…',
  'À toi de tirer !': 'Your turn to fire!',
  'Le robot prépare son tir…': 'The robot is getting ready to fire…',
  'Touche une case de la grille adverse pour tirer.': 'Tap a cell of the enemy grid to fire.',
  'Attends ton tour.': 'Wait for your turn.',

  // Results
  'Victoire ! Tu as coulé toute la flotte.': 'Victory! You sank the whole fleet.',
  '{name} remporte la bataille': '{name} wins the battle',
  '🏆 {name} gagne la bataille !': '🏆 {name} wins the battle!',
  '{n} tir': '{n} shot',
  '{n} tirs': '{n} shots',
  '{n} % de précision': '{n}% accuracy',

  // Online
  '⏳ En attente de la flotte de {name}…': '⏳ Waiting for {name}’s fleet…',
  'Ta flotte est prête.': 'Your fleet is ready.',
  'Flotte invalide': 'Invalid fleet',
  'Les bateaux doivent tenir sur la grille sans se chevaucher':
    'Ships must fit on the grid without overlapping',
  'Les flottes sont déjà placées': 'The fleets are already placed',
  'Ta flotte est déjà placée': 'Your fleet is already placed',
  'Les flottes ne sont pas encore placées': 'The fleets are not placed yet',
  'Tu as déjà tiré sur cette case': 'You already fired at this cell',
  'Case inconnue': 'Unknown cell',

  // Achievement
  Amiral: 'Admiral',
  'Gagne une partie de bataille navale': 'Win a game of Battleship',
};
