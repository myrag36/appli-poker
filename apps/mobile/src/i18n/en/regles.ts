// English for the regles part of the app, by French text.
const en: Record<string, string> = {
  // components/Rules.tsx
  'Règles : {game}': 'Rules: {game}',
  'Règles du jeu': 'How to play',
  'Fermer les règles': 'Close the rules',
  Fermer: 'Close',
  'Étape {n}': 'Step {n}',
  'C’est compris !': 'Got it!',

  // Poker
  'Quinte flush royale': 'Royal flush',
  'Quinte flush': 'Straight flush',
  Carré: 'Four of a kind',
  Full: 'Full house',
  'Couleur{main}': 'Flush',
  Quinte: 'Straight',
  Brelan: 'Three of a kind',
  'Double paire': 'Two pair',
  Paire: 'Pair',
  'Carte haute': 'High card',
  'Gagne les jetons des autres avec la meilleure main, ou en les faisant se coucher.':
    "Win everyone's chips with the best hand, or by making them fold.",
  'Deux cartes pour toi': 'Two cards for you',
  'Chacun reçoit 2 cartes cachées. Deux joueurs misent d’office les blindes pour lancer le pot.':
    'Everyone gets 2 hidden cards. Two players post the blinds to start the pot.',
  'Ta main, que toi seul vois': 'Your hand, only you can see it',
  'Un tour de parole': 'A betting round',
  'À ton tour : te coucher, suivre la mise, relancer, ou checker si personne n’a misé.':
    'On your turn: fold, call the bet, raise, or check if nobody has bet.',
  'Le tableau se dévoile': 'The board is revealed',
  'Le flop (3 cartes), puis le turn et la river (1 carte chacun). Un tour de parole après chaque étape.':
    'The flop (3 cards), then the turn and the river (1 card each). A betting round after each one.',
  'Les 5 cartes communes': 'The 5 community cards',
  'L’abattage': 'The showdown',
  'Ta meilleure combinaison de 5 cartes parmi tes 2 et les 5 du milieu gagne le pot.':
    'The best 5-card hand made from your 2 cards and the 5 on the board wins the pot.',
  'Tout le monde se couche ? Tu gagnes le pot sans montrer tes cartes.':
    'Everyone folds? You win the pot without showing your cards.',

  // Blackjack
  'Approche-toi le plus possible de 21 sans dépasser, et bats le croupier.':
    'Get as close to 21 as you can without going over, and beat the dealer.',
  Mise: 'Bet',
  'Chacun mise avant la donne. Tu reçois 2 cartes, le croupier une visible et une cachée.':
    'Everyone bets before the deal. You get 2 cards, the dealer gets one face up and one face down.',
  'Compte tes points': 'Count your points',
  'Les figures valent 10, l’as vaut 1 ou 11 selon ce qui t’arrange.':
    'Face cards are worth 10, an ace is 1 or 11, whichever suits you.',
  '7 ou 17': '7 or 17',
  'Tirer ou rester': 'Hit or stand',
  'Tirer : une carte de plus. Rester : tu t’arrêtes. Doubler : mise ×2 et une seule carte. Séparer : une paire devient deux mains.':
    'Hit: take one more card. Stand: stop there. Double: bet ×2 and take just one card. Split: a pair becomes two hands.',
  'Le croupier joue': 'The dealer plays',
  'Il tire jusqu’à 16 et reste sur 17. S’il dépasse 21, tous ceux encore en jeu gagnent.':
    'The dealer hits up to 16 and stands on 17. If the dealer busts, everyone still in wins.',
  'Les gains': 'Payouts',
  'Gagné : ta mise payée 1 contre 1. Égalité : mise rendue. Blackjack (as + 10 d’entrée) : payé 3 contre 2.':
    'Win: your bet pays 1 to 1. Push: you get your bet back. Blackjack (ace + 10-value card on the deal): pays 3 to 2.',
  'Blackjack !': 'Blackjack!',
  'Contre un 5 ou un 6 du croupier, reste souvent : c’est lui qui risque de sauter.':
    "Against a dealer's 5 or 6, stand more often: the dealer is the one likely to bust.",

  // Président
  Président: 'President',
  'Vide ta main le premier pour devenir Président.': 'Be the first to empty your hand to become President.',
  'L’ordre des cartes': 'Card order',
  'Du plus faible au plus fort : 3, 4, 5… Roi, As, et le 2 tout en haut.':
    'From lowest to highest: 3, 4, 5… King, Ace, and the 2 at the very top.',
  'Faible → Fort': 'Low → High',
  Poser: 'Playing cards',
  'Celui qui mène pose 1 à 4 cartes de même valeur. Les suivants posent autant de cartes, plus fortes, ou passent.':
    'The leader plays 1 to 4 cards of the same rank. The next players play the same number of higher cards, or pass.',
  'Une paire de 8 : il faut une paire plus forte': 'A pair of 8s: you need a higher pair',
  'Ramasser le pli': 'Winning the trick',
  'Quand tout le monde passe, le dernier à avoir joué ramasse et recommence. Un 2 ferme le pli tout de suite.':
    'When everyone passes, the last player to play takes the trick and leads again. A 2 ends the trick right away.',
  'Les titres': 'The titles',
  'Le premier à finir est Président, le dernier Trouduc. À 4 joueurs ou plus, il y a aussi les vices.':
    'The first to finish is President, the last is the Scum (Trouduc). With 4 or more players, there are vice-titles too.',
  'L’échange': 'The swap',
  'Manche suivante : le Trouduc donne ses 2 meilleures cartes au Président, qui lui rend 2 cartes de son choix.':
    'Next round: the Scum gives their 2 best cards to the President, who gives back any 2 cards.',
  'Garde tes 2 pour reprendre la main au bon moment.':
    'Save your 2s to take the lead back at the right time.',

  // Yams
  'Remplis ta grille de 13 cases et fais le plus gros total.':
    'Fill in the 13 boxes of your scorecard and get the highest total.',
  'Trois lancers': 'Three rolls',
  'À ton tour, lance les 5 dés jusqu’à 3 fois. Touche les dés à garder 🔒 et relance les autres.':
    'On your turn, roll the 5 dice up to 3 times. Tap the dice to keep 🔒 and reroll the rest.',
  'Inscris un score': 'Score a box',
  'Choisis une case libre de ta grille. Si rien ne va, tu dois quand même barrer une case pour 0 point.':
    'Pick an empty box on your scorecard. If nothing fits, you still have to cross one out for 0 points.',
  'Le haut de la grille': 'Upper section',
  'De 1 à 6 : la somme des dés de cette valeur. 63 points ou plus en haut = 35 points de bonus.':
    '1 to 6: the sum of the dice showing that number. 63 points or more up top = 35 bonus points.',
  'Case 4 : 12 points': 'Fours box: 12 points',
  'Les combinaisons': 'Combinations',
  'Brelan et Carré : somme des dés. Full : 25. Petite suite : 30. Grande suite : 40. Yams : 50. Chance : la somme.':
    'Three and Four of a kind: sum of the dice. Full house: 25. Small straight: 30. Large straight: 40. Yams: 50. Chance: the sum.',
  'Full : 25': 'Full house: 25',
  'Grande suite : 40': 'Large straight: 40',
  'Yams : 50': 'Yams: 50',
  'Vise le bonus du haut : trois dés de chaque valeur suffisent pour l’avoir.':
    'Go for the upper bonus: three dice of each number is enough to get it.',

  // Belote
  'En équipe avec ton partenaire en face, atteins le score visé avant l’autre équipe.':
    'Team up with the partner sitting across from you and reach the target score before the other team.',
  'La donne': 'The deal',
  '32 cartes. Chacun en reçoit 5, puis une carte est retournée au milieu.':
    '32 cards. Everyone gets 5, then one card is turned face up in the middle.',
  'Prendre ou passer': 'Take or pass',
  '1er tour : prendre à la couleur retournée, ou passer. 2e tour : choisir une autre couleur, ou passer. Le preneur ramasse la retourne.':
    "1st round: take with the turned-up card's suit as trumps, or pass. 2nd round: pick another suit, or pass. The taker picks up the turned-up card.",
  'Jouer les plis': 'Playing tricks',
  'Il faut fournir la couleur demandée. Sinon, couper à l’atout, sauf si ton partenaire est déjà maître.':
    'You must follow suit. If you can’t, play a trump, unless your partner is already winning the trick.',
  'La valeur des cartes': 'Card values',
  'À l’atout : Valet 20, 9 14, As 11, 10 10, Roi 4, Dame 3. Ailleurs : As 11, 10 10, Roi 4, Dame 3, Valet 2.':
    'In trumps: Jack 20, 9 14, Ace 11, 10 10, King 4, Queen 3. Other suits: Ace 11, 10 10, King 4, Queen 3, Jack 2.',
  'Les 4 plus forts atouts (cœur)': 'The 4 highest trumps (hearts)',
  Compter: 'Scoring',
  'Dernier pli : +10. Roi + Dame d’atout : belote-rebelote, +20. Le preneur doit faire plus que la défense, sinon il est dedans.':
    "Last trick: +10. King + Queen of trumps (belote-rebelote): +20. The taker's team must score more than the defenders, or they go set.",
  'Tous les plis pour ton équipe ? C’est un capot : 252 points !':
    'Your team wins every trick? That’s a capot: 252 points!',

  // Puissance 4
  'Puissance 4': 'Connect 4',
  'Aligne 4 jetons de ta couleur avant ton adversaire.':
    'Line up 4 discs of your color before your opponent.',
  'Fais tomber un jeton': 'Drop a disc',
  'À ton tour, touche une colonne : ton jeton tombe tout en bas, sur la première case libre. Rouge et jaune jouent chacun leur tour.':
    'On your turn, tap a column: your disc drops to the lowest free space. Red and yellow take turns.',
  'Les jetons s’empilent': 'Discs stack up',
  'Aligne-en quatre': 'Connect four',
  'Le premier qui aligne 4 jetons gagne la manche : en ligne, en colonne ou en diagonale.':
    'The first to line up 4 discs wins the round: across, up and down, or diagonally.',
  'En ligne': 'Across',
  'En colonne': 'Up and down',
  'En diagonale': 'Diagonally',
  'Bloque l’adversaire': 'Block your opponent',
  'Trois jetons alignés avec une case libre au bout ? Pose ton jeton dessus avant qu’il ne gagne.':
    'Three in a row with a free space at the end? Drop your disc there before they win.',
  'Match nul et manches': 'Draws and rounds',
  'Si la grille est pleine sans alignement, la manche est nulle. On joue autant de manches qu’on veut, celui qui commence change à chaque fois.':
    'If the grid fills up with no line, the round is a draw. Play as many rounds as you like, the first player switches each time.',
  'Joue au centre : la colonne du milieu fait partie du plus grand nombre d’alignements.':
    'Play the center: the middle column is part of the most possible lines.',

  // Rami
  'Vide ta main le premier en posant des combinaisons, et garde le plus petit score.':
    'Be the first to empty your hand by laying down melds, and keep the lowest score.',
  '2 jeux de 52 cartes et 4 jokers. 13 cartes chacun, 14 pour celui qui commence : il ne pioche pas et défausse tout de suite.':
    "2 decks of 52 cards plus 4 jokers. 13 cards each, 14 for the first player, who doesn't draw and discards straight away.",
  'Ton tour': 'Your turn',
  'Pioche une carte, ou prends celle du dessus de la défausse. Pose ce que tu peux, puis défausse une carte pour finir ton tour.':
    'Draw a card, or take the top card of the discard pile. Lay down what you can, then discard a card to end your turn.',
  'Brelan ou carré : même valeur, couleurs toutes différentes. Suite : au moins 3 cartes qui se suivent dans la même couleur. L’as va avant le 2 ou après le roi.':
    'Set: 3 or 4 cards of the same rank, all different suits. Run: at least 3 cards in a row in the same suit. The ace goes before the 2 or after the king.',
  'Suite à cœur': 'Run in hearts',
  'Le joker': 'The joker',
  'Il remplace n’importe quelle carte, un seul par combinaison. Une fois ouvert, échange-le contre la vraie carte pour le récupérer.':
    "It stands in for any card, one per meld. Once you've opened, swap it for the real card to take it back.",
  'Le joker fait le 6 ♣': 'The joker is the 6 ♣',
  'Ouvrir à 51': 'Open with 51',
  'Ta première pose doit valoir au moins 51 points (figures 10, as 11, ou 1 dans A-2-3). Ensuite, pose librement et complète les combinaisons de tout le monde.':
    "Your first lay-down must be worth at least 51 points (face cards 10, ace 11, or 1 in A-2-3). After that, lay down freely and add to anyone's melds.",
  '30 + 24 = 54 : j’ouvre !': '30 + 24 = 54: I open!',
  'Fin de manche': 'End of the round',
  'Le premier qui vide sa main gagne la manche. Les autres comptent leurs cartes (joker 20). Pas encore ouvert : 100 points. Tout posé d’un coup : rami sec, pénalités doublées !':
    'The first to empty their hand wins the round. The others count their cards (joker 20). Not opened yet: 100 points. All laid down in one go (rami sec): penalties doubled!',
  'La partie s’arrête quand quelqu’un atteint le score visé : le plus petit score gagne.':
    'The game ends when someone reaches the target score: the lowest score wins.',

  // Uno
  'Sois le premier à poser toutes tes cartes.': 'Be the first to play all your cards.',
  '108 cartes : des chiffres de 0 à 9 en 4 couleurs, des cartes spéciales et des Jokers. Chacun reçoit 7 cartes, une carte est retournée au milieu.':
    '108 cards: numbers 0 to 9 in 4 colors, action cards and Wilds. Everyone gets 7 cards, and one card is turned face up in the middle.',
  'Couleur ou symbole': 'Color or symbol',
  'À ton tour, pose une carte de la même couleur ou du même chiffre (ou symbole) que celle du dessus.':
    'On your turn, play a card that matches the top card by color or number (or symbol).',
  'Même couleur ✓': 'Same color ✓',
  'Même chiffre ✓': 'Same number ✓',
  'Pas de carte ? Pioche': 'No card? Draw',
  'Tu peux toujours piocher une carte. Si elle va, tu peux la poser tout de suite, sinon le tour passe.':
    "You can always draw a card. If it fits, you can play it right away, otherwise it's the next player's turn.",
  'Les cartes spéciales': 'Action cards',
  'Passe : le suivant saute son tour. Inverse : le sens du jeu change. +2 : le suivant pioche 2 cartes et passe son tour.':
    'Skip: the next player misses a turn. Reverse: play changes direction. +2: the next player draws 2 cards and misses a turn.',
  'Passe · Inverse · +2': 'Skip · Reverse · +2',
  'Joker et +4': 'Wild and +4',
  'Le Joker se pose sur tout : tu choisis la couleur. Le +4 aussi, et le suivant pioche 4 cartes, mais seulement si tu n’as aucune carte de la couleur demandée.':
    "A Wild goes on anything: you pick the color. So does a +4, and the next player draws 4 cards, but only if you don't have a card of the current color.",
  'Joker · +4': 'Wild · +4',
  'Uno !': 'Uno!',
  'Quand tu poses ton avant-dernière carte, appuie sur « Uno ! ». Si quelqu’un te prend avant, tu pioches 2 cartes. Et toi aussi, attrape les étourdis !':
    'When you play your second-to-last card, tap "Uno!". If someone catches you first, you draw 2 cards. And catch anyone who forgets!',
  'Les points': 'Points',
  'Le gagnant de la manche marque les cartes restées chez les autres : chiffres à leur valeur, cartes spéciales 20, Jokers et +4 50.':
    "The round winner scores the cards left in everyone else's hands: numbers at face value, action cards 20, Wilds and +4s 50.",
  'Garde tes Jokers pour la fin : ils te sortent de toutes les impasses.':
    'Save your Wilds for the end: they get you out of any jam.',

  // 8 américain
  '8 américain': 'Crazy Eights',
  'Sois le premier à poser toutes tes cartes, avec un jeu classique de 52 cartes.':
    'Be the first to play all your cards, with a standard 52-card deck.',
  'Chacun reçoit 7 cartes, une carte est retournée au milieu. Le reste forme la pioche.':
    'Everyone gets 7 cards, and one card is turned face up in the middle. The rest is the draw pile.',
  'Couleur ou valeur': 'Suit or rank',
  'Pose une carte de la même couleur (cœur, pique…) ou de la même valeur que celle du dessus.':
    'Play a card of the same suit (hearts, spades…) or the same rank as the top card.',
  'Même valeur ✓': 'Same rank ✓',
  'Pioche une carte : si elle va, tu peux la poser tout de suite, sinon le tour passe.':
    "Draw a card: if it fits, you can play it right away, otherwise it's the next player's turn.",
  'Le 8 change la couleur': 'The 8 changes the suit',
  'Le 8 se pose sur n’importe quelle carte, et tu choisis la couleur que le suivant doit jouer.':
    'An 8 can go on any card, and you choose the suit the next player must play.',
  'Les 4 huit, les meilleures cartes': 'The four 8s, the best cards',
  'Le 2 fait piocher 2 cartes au suivant, sauf s’il pose un autre 2 : ça se cumule (+4, +6…). Le Valet fait sauter le tour du suivant. L’As change le sens du jeu (à deux, tu rejoues).':
    'A 2 makes the next player draw 2, unless they play another 2: it stacks (+4, +6…). A Jack skips the next player. An Ace reverses direction (with two players, you go again).',
  '+2 · Passe ton tour · Change de sens': '+2 · Skip · Reverse',
  'Carte !': 'Last card!',
  'Quand tu poses ton avant-dernière carte, appuie sur « Carte ! ». Si quelqu’un te prend avant, tu pioches 2 cartes. Et toi aussi, attrape les étourdis !':
    'When you play your second-to-last card, tap "Last card!". If someone catches you first, you draw 2 cards. And catch anyone who forgets!',
  'Le gagnant de la manche marque les cartes restées chez les autres : 8 = 50, 2, Valet et As = 20, Roi, Dame et 10 = 10, les autres leur valeur.':
    "The round winner scores the cards left in everyone else's hands: 8 = 50, 2, Jack and Ace = 20, King, Queen and 10 = 10, the rest at face value.",
  'Un 8 en fin de partie, c’est la sortie assurée.': 'An 8 at the end of the game is a sure way out.',

  // Tarot
  'Seul contre les trois autres, le preneur doit faire assez de points pour réussir son contrat.':
    'Alone against the other three, the taker must score enough points to make their contract.',
  'Les 78 cartes': 'The 78 cards',
  'Quatre couleurs de 14 cartes (le Cavalier se place entre la Dame et le Valet), 21 atouts qui battent toutes les couleurs, et l’Excuse.':
    'Four suits of 14 cards (the Knight ranks between the Queen and the Jack), 21 trumps that beat every suit, and the Excuse.',
  'Roi, Dame, Cavalier, Valet… et deux atouts': 'King, Queen, Knight, Jack… and two trumps',
  'Les trois bouts': 'The three oudlers',
  'Le Petit (1), le 21 et l’Excuse. Plus le preneur en gagne, moins il lui faut de points : 56 sans bout, 51 avec un, 41 avec deux, 36 avec les trois.':
    'The Petit (trump 1), the 21 and the Excuse. The more of them the taker wins, the fewer points they need: 56 with none, 51 with one, 41 with two, 36 with all three.',
  'Les bouts': 'The oudlers',
  'Les enchères': 'Bidding',
  'Chacun parle une fois : passe, ou plus haut que l’annonce d’avant. Petite (×1), Garde (×2), Garde sans le chien (×4), Garde contre le chien (×6).':
    'Everyone bids once: pass, or bid higher than the last bid. Small (×1), Guard (×2), Guard without the kitty (×4), Guard against the kitty (×6).',
  'Le chien et l’écart': 'The kitty and the discard',
  'En Petite ou en Garde, le preneur montre les 6 cartes du chien, les prend, puis en écarte 6 : jamais de roi ni de bout, et pas d’atout sauf s’il n’a pas le choix.':
    'On a Small or Guard, the taker shows the 6 kitty cards, takes them, then discards 6: never a king or an oudler, and no trumps unless there is no choice.',
  'Fournis la couleur demandée. Sinon, coupe à l’atout. À l’atout, il faut toujours monter si on peut. L’Excuse se joue quand on veut et ne gagne jamais le pli.':
    'Follow suit. If you can’t, play a trump. On trumps, you must always play higher if you can. The Excuse can be played any time and never wins the trick.',
  'Bouts et rois 4,5 · dames 3,5 · cavaliers 2,5 · valets 1,5 · les autres 0,5 (91 en tout). La donne vaut (25 + l’écart au contrat) × le multiplicateur, payé par chaque défenseur.':
    'Oudlers and kings 4.5 · queens 3.5 · knights 2.5 · jacks 1.5 · the rest 0.5 (91 in all). The deal is worth (25 + the gap to the contract) × the multiplier, paid by each defender.',
  '4,5 · 3,5 · 2,5 · 1,5 · 0,5': '4.5 · 3.5 · 2.5 · 1.5 · 0.5',
  'Le Petit au bout : le mener au dernier pli rapporte 10 × le multiplicateur au camp qui le gagne.':
    'Petit au bout: winning the last trick with the Petit earns 10 × the multiplier for that side.',
};
export default en;
