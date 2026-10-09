// Perudo (Liar's Dice), alone against robots or online.
export default {
  // Home and setup
  'Des dés cachés sous les gobelets : surenchéris, bluffe ou crie « Dudo ! ».':
    'Dice hidden under cups: raise, bluff or call “Dudo!”.',
  'Dés menteurs : bluffe, surenchéris ou crie « Dudo ! »': 'Liar’s dice: bluff, raise or call “Dudo!”',
  'Changer mon avatar': 'Change my avatar',
  Calza: 'Calza',
  'Avec Calza': 'With Calza',
  'Sans Calza': 'No Calza',
  'Annonce que l’enchère est pile juste : gagné, tu récupères un dé ; raté, tu en perds un.':
    'Claim the bid is exactly right: if so, you win a die back; if not, you lose one.',
  'Seulement surenchérir ou crier « Dudo ! ».': 'Only raise or call “Dudo!”.',
  '{n} dé': '{n} die',
  '{n} dés': '{n} dice',
  '(toi)': '(you)',

  // Table
  '🎲 {n} dé en jeu': '🎲 {n} die in play',
  '🎲 {n} dés en jeu': '🎲 {n} dice in play',
  'Nouvelle manche': 'New round',
  'À toi d’ouvrir': 'Your opening bid',
  '{name} ouvre': '{name} opens',
  'Les 1 (Pacos) comptent pour toutes les faces': '1s (Pacos) count as any face',
  'Ton enchère': 'Your bid',
  'Enchère de {name}': '{name}’s bid',
  'Des Pacos (les 1) sur toute la table': 'Pacos (1s) on the whole table',
  'Des {face} sur toute la table, Pacos compris': '{face} on the whole table, Pacos included',
  '{n} × {face}': '{n} × {face}',
  '{n} Paco': '{n} Paco',
  '{n} Pacos': '{n} Pacos',
  'Tes dés · {n} restant': 'Your dice · {n} left',
  'Tes dés · {n} restants': 'Your dice · {n} left',
  'Tu es éliminé': 'You are out',
  '+1 dé': '+1 die',
  '−1 dé': '−1 die',
  'À toi : surenchéris ou crie « Dudo ! »': 'Your turn: raise or call “Dudo!”',
  'À toi d’ouvrir les enchères': 'Your turn to open the bidding',
  'Tu es éliminé : les autres finissent la partie': 'You are out: the others finish the game',
  'Voir la fin tout de suite': 'Skip to the end',

  // Bidding
  Paco: 'Paco',
  Pacos: 'Pacos',
  'Un dé de moins': 'One die fewer',
  'Un dé de plus': 'One die more',
  'tu en as {n}': 'you have {n}',
  Annoncer: 'Bid',
  'Annoncer {bid}': 'Bid {bid}',
  'Dudo ! (menteur)': 'Dudo! (liar)',
  'Calza (pile)': 'Calza (exact)',

  // Reveal
  'Dudo !': 'Dudo!',
  'Calza !': 'Calza!',
  'Tu dis que {bid}, c’est pile juste': 'You say {bid} is exactly right',
  '{caller} dit que {bid}, c’est pile juste': '{caller} says {bid} is exactly right',
  'Tu ne crois pas à {bid} de {bidder}': 'You doubt {bidder}’s {bid}',
  '{caller} ne croit pas à tes {bid}': '{caller} doubts your {bid}',
  '{caller} ne croit pas à {bid} de {bidder}': '{caller} doubts {bidder}’s {bid}',
  'Il y en a {n}': 'There are {n}',
  'Pile juste ! Tu récupères un dé': 'Spot on! You win a die back',
  'Pile juste ! {name} récupère un dé': 'Spot on! {name} wins a die back',
  'Tu perds ton dernier dé…': 'You lose your last die…',
  'Tu perds un dé': 'You lose a die',
  '{name} perd son dernier dé et sort': '{name} loses their last die and is out',
  '{name} perd un dé': '{name} loses a die',
  '🏆 Tu gagnes la partie !': '🏆 You win the game!',
  '🏆 {name} gagne la partie': '🏆 {name} wins the game',

  // Rules
  'Sois le dernier à avoir encore des dés sous ton gobelet.':
    'Be the last player with dice left under your cup.',
  'Des dés cachés': 'Hidden dice',
  'Chacun lance ses 5 dés sous son gobelet et ne regarde que les siens.':
    'Everyone rolls their 5 dice under their cup and looks only at their own.',
  'À ton tour, annonce combien de dés d’une face il y a sur toute la table, par exemple « trois 4 ». Le suivant doit monter : plus de dés, ou autant d’une face plus forte.':
    'On your turn, bid how many dice of one face there are on the whole table, say “three 4s”. The next player must go higher: more dice, or as many of a higher face.',
  '« Trois 4 »': '“Three 4s”',
  'Les Pacos': 'The Pacos',
  'Les 1, les Pacos, comptent pour toutes les faces. Passer aux Pacos divise le nombre par deux (arrondi au-dessus) ; en revenir le double, plus un.':
    'The 1s, called Pacos, count as any face. Switching to Pacos halves the number (rounded up); switching back doubles it, plus one.',
  'Quatre 5 avec les Pacos': 'Four 5s with the Pacos',
  'Tu ne crois pas l’enchère d’avant ? Crie « Dudo ! » : tout le monde montre ses dés. S’il y en a moins qu’annoncé, celui qui a annoncé perd un dé ; sinon c’est toi.':
    'Don’t believe the last bid? Call “Dudo!”: everyone shows their dice. If there are fewer than bid, the bidder loses a die; otherwise you do.',
  'Si l’option est choisie, tu peux dire que l’enchère est pile juste. Gagné, tu récupères un dé ; raté, tu en perds un. Pas de Calza à deux joueurs.':
    'With the option on, you may claim the bid is exactly right. If so, you win a die back; if not, you lose one. No Calza with two players left.',
  'Celui qui a perdu un dé ouvre la manche suivante. Sans dé, on est éliminé.':
    'Whoever lost a die opens the next round. No dice left means you are out.',
  'Compte tes dés : en moyenne, un tiers des dés cachés vont avec la face annoncée, Pacos compris.':
    'Count your dice: on average, a third of the hidden dice match the face bid, Pacos included.',

  // Engine and server messages
  'Le Perudo se joue de 2 à 6 joueurs.': 'Perudo is played with 2 to 6 players.',
  'Enchère inconnue.': 'Unknown bid.',
  'On n’ouvre pas sur les Pacos.': 'You cannot open on Pacos.',
  'Il n’y a pas autant de dés.': 'There are not that many dice.',
  'Il faut monter l’enchère.': 'You must raise the bid.',
  'Il faut d’abord une enchère.': 'There must be a bid first.',
  'Pas de Calza ici.': 'No Calza here.',
  'La manche n’est pas finie.': 'The round is not over.',
  'Option inconnue': 'Unknown option',

  // Achievement
  'Menteur de génie': 'Master liar',
  'Gagne 10 parties de Perudo': 'Win 10 games of Perudo',
};
