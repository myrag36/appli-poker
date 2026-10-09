// The illustrated rules of every game, shown by <RulesButton />.
import { View } from 'react-native';
import { Die } from './components/Die';
import { PlayingCard } from './components/PlayingCard';
import { UnoCard } from './components/UnoCard';
import { TarotCard } from './components/TarotCard';
import { type GameRules, RuleExample } from './components/Rules';
import { Token } from './components/Token';
import { t } from './i18n';

const Cards = ({ cards, label, width = 34 }: { cards: string[]; label?: string; width?: number }) => (
  <RuleExample label={label}>
    {cards.map((c, i) => (
      <PlayingCard key={`${c}${i}`} card={c} width={width} />
    ))}
  </RuleExample>
);

const UnoCards = ({ cards, label, width = 34 }: { cards: string[]; label?: string; width?: number }) => (
  <RuleExample label={label}>
    {cards.map((c, i) => (
      <UnoCard key={`${c}${i}`} card={c} width={width} />
    ))}
  </RuleExample>
);

const Dice = ({ values, label }: { values: number[]; label?: string }) => (
  <RuleExample label={label}>
    {values.map((v, i) => (
      <Die key={i} value={v} size={30} />
    ))}
  </RuleExample>
);

/**
 * A small Puissance 4 board, drawn from rows of text (top row first): '.' empty, 'r' red, 'y' yellow;
 * capitals are the winning tokens, circled in white.
 */
const MiniBoard = ({ rows, label }: { rows: string[]; label?: string }) => (
  <RuleExample label={label}>
    <View style={{ padding: 3, borderRadius: 6, backgroundColor: '#1f5fd1', gap: 2 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 2 }}>
          {row.split('').map((ch, c) =>
            ch === '.' ? (
              <View key={c} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#0b1d4a' }} />
            ) : (
              <View
                key={c}
                style={{
                  borderRadius: 9,
                  borderWidth: 1.5,
                  borderColor: ch === ch.toUpperCase() ? '#ffffff' : 'transparent',
                  margin: -1.5,
                }}
              >
                <Token player={ch.toLowerCase() === 'r' ? 0 : 1} size={16} />
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  </RuleExample>
);

const HAND_RANKS_EXAMPLES: { name: string; cards: string[] }[] = [
  { name: t('Quinte flush royale'), cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'] },
  { name: t('Quinte flush'), cards: ['9h', '8h', '7h', '6h', '5h'] },
  { name: t('Carré'), cards: ['Qc', 'Qd', 'Qh', 'Qs', '4d'] },
  { name: t('Full'), cards: ['Kh', 'Kd', 'Ks', '7c', '7h'] },
  { name: t('Couleur{main}', { main: '' }), cards: ['Ad', 'Jd', '8d', '5d', '2d'] },
  { name: t('Quinte'), cards: ['Tc', '9d', '8s', '7h', '6c'] },
  { name: t('Brelan'), cards: ['8s', '8h', '8d', 'Kc', '3s'] },
  { name: t('Double paire'), cards: ['Jh', 'Jc', '4s', '4d', 'Ah'] },
  { name: t('Paire'), cards: ['Ts', 'Th', 'Kd', '6c', '2h'] },
  { name: t('Carte haute'), cards: ['Ah', 'Jd', '8c', '5s', '3h'] },
];

export const POKER_RULES: GameRules = {
  game: 'poker',
  title: 'Poker',
  goal: t('Gagne les jetons des autres avec la meilleure main, ou en les faisant se coucher.'),
  steps: [
    {
      icon: '🃏',
      title: t('Deux cartes pour toi'),
      text: t('Chacun reçoit 2 cartes cachées. Deux joueurs misent d’office les blindes pour lancer le pot.'),
      visual: <Cards cards={['Ah', 'Kh']} label={t('Ta main, que toi seul vois')} />,
    },
    {
      icon: '💬',
      title: t('Un tour de parole'),
      text: t('À ton tour : te coucher, suivre la mise, relancer, ou checker si personne n’a misé.'),
    },
    {
      icon: '🂠',
      title: t('Le tableau se dévoile'),
      text: t(
        'Le flop (3 cartes), puis le turn et la river (1 carte chacun). Un tour de parole après chaque étape.',
      ),
      visual: <Cards cards={['Qh', 'Jh', '7c', 'Th', '2s']} label={t('Les 5 cartes communes')} width={30} />,
    },
    {
      icon: '🏆',
      title: t('L’abattage'),
      text: t('Ta meilleure combinaison de 5 cartes parmi tes 2 et les 5 du milieu gagne le pot.'),
      visual: (
        <>
          {HAND_RANKS_EXAMPLES.map((r, i) => (
            <Cards key={r.name} cards={r.cards} label={`${i + 1}. ${r.name}`} width={22} />
          ))}
        </>
      ),
    },
  ],
  tip: t('Tout le monde se couche ? Tu gagnes le pot sans montrer tes cartes.'),
};

export const BLACKJACK_RULES: GameRules = {
  game: 'blackjack',
  title: 'Blackjack',
  goal: t('Approche-toi le plus possible de 21 sans dépasser, et bats le croupier.'),
  steps: [
    {
      icon: '🪙',
      title: t('Mise'),
      text: t('Chacun mise avant la donne. Tu reçois 2 cartes, le croupier une visible et une cachée.'),
    },
    {
      icon: '🔢',
      title: t('Compte tes points'),
      text: t('Les figures valent 10, l’as vaut 1 ou 11 selon ce qui t’arrange.'),
      visual: <Cards cards={['As', '6d']} label={t('7 ou 17')} />,
    },
    {
      icon: '✋',
      title: t('Tirer ou rester'),
      text: t(
        'Tirer : une carte de plus. Rester : tu t’arrêtes. Doubler : mise ×2 et une seule carte. Séparer : une paire devient deux mains.',
      ),
    },
    {
      icon: '🎩',
      title: t('Le croupier joue'),
      text: t('Il tire jusqu’à 16 et reste sur 17. S’il dépasse 21, tous ceux encore en jeu gagnent.'),
    },
    {
      icon: '💰',
      title: t('Les gains'),
      text: t(
        'Gagné : ta mise payée 1 contre 1. Égalité : mise rendue. Blackjack (as + 10 d’entrée) : payé 3 contre 2.',
      ),
      visual: <Cards cards={['Ac', 'Kd']} label={t('Blackjack !')} />,
    },
  ],
  tip: t('Contre un 5 ou un 6 du croupier, reste souvent : c’est lui qui risque de sauter.'),
};

export const PRESIDENT_RULES: GameRules = {
  game: 'president',
  title: t('Président'),
  goal: t('Vide ta main le premier pour devenir Président.'),
  steps: [
    {
      icon: '📈',
      title: t('L’ordre des cartes'),
      text: t('Du plus faible au plus fort : 3, 4, 5… Roi, As, et le 2 tout en haut.'),
      visual: <Cards cards={['3c', '7d', 'Jh', 'As', '2s']} label={t('Faible → Fort')} />,
    },
    {
      icon: '🃏',
      title: t('Poser'),
      text: t(
        'Celui qui mène pose 1 à 4 cartes de même valeur. Les suivants posent autant de cartes, plus fortes, ou passent.',
      ),
      visual: <Cards cards={['8h', '8c']} label={t('Une paire de 8 : il faut une paire plus forte')} />,
    },
    {
      icon: '🔁',
      title: t('Ramasser le pli'),
      text: t(
        'Quand tout le monde passe, le dernier à avoir joué ramasse et recommence. Un 2 ferme le pli tout de suite.',
      ),
    },
    {
      icon: '👑',
      title: t('Les titres'),
      text: t(
        'Le premier à finir est Président, le dernier Trouduc. À 4 joueurs ou plus, il y a aussi les vices.',
      ),
    },
    {
      icon: '🔄',
      title: t('L’échange'),
      text: t(
        'Manche suivante : le Trouduc donne ses 2 meilleures cartes au Président, qui lui rend 2 cartes de son choix.',
      ),
    },
  ],
  tip: t('Garde tes 2 pour reprendre la main au bon moment.'),
};

export const YAMS_RULES: GameRules = {
  game: 'yams',
  title: 'Yams',
  goal: t('Remplis ta grille de 13 cases et fais le plus gros total.'),
  steps: [
    {
      icon: '🎲',
      title: t('Trois lancers'),
      text: t(
        'À ton tour, lance les 5 dés jusqu’à 3 fois. Touche les dés à garder 🔒 et relance les autres.',
      ),
    },
    {
      icon: '✍️',
      title: t('Inscris un score'),
      text: t(
        'Choisis une case libre de ta grille. Si rien ne va, tu dois quand même barrer une case pour 0 point.',
      ),
    },
    {
      icon: '⬆️',
      title: t('Le haut de la grille'),
      text: t('De 1 à 6 : la somme des dés de cette valeur. 63 points ou plus en haut = 35 points de bonus.'),
      visual: <Dice values={[4, 4, 4, 2, 6]} label={t('Case 4 : 12 points')} />,
    },
    {
      icon: '⬇️',
      title: t('Les combinaisons'),
      text: t(
        'Brelan et Carré : somme des dés. Full : 25. Petite suite : 30. Grande suite : 40. Yams : 50. Chance : la somme.',
      ),
      visual: (
        <>
          <Dice values={[3, 3, 3, 5, 5]} label={t('Full : 25')} />
          <Dice values={[2, 3, 4, 5, 6]} label={t('Grande suite : 40')} />
          <Dice values={[6, 6, 6, 6, 6]} label={t('Yams : 50')} />
        </>
      ),
    },
  ],
  tip: t('Vise le bonus du haut : trois dés de chaque valeur suffisent pour l’avoir.'),
};

export const BELOTE_RULES: GameRules = {
  game: 'belote',
  title: 'Belote',
  goal: t('En équipe avec ton partenaire en face, atteins le score visé avant l’autre équipe.'),
  steps: [
    {
      icon: '🃏',
      title: t('La donne'),
      text: t('32 cartes. Chacun en reçoit 5, puis une carte est retournée au milieu.'),
    },
    {
      icon: '🙋',
      title: t('Prendre ou passer'),
      text: t(
        '1er tour : prendre à la couleur retournée, ou passer. 2e tour : choisir une autre couleur, ou passer. Le preneur ramasse la retourne.',
      ),
    },
    {
      icon: '♠️',
      title: t('Jouer les plis'),
      text: t(
        'Il faut fournir la couleur demandée. Sinon, couper à l’atout, sauf si ton partenaire est déjà maître.',
      ),
    },
    {
      icon: '⭐',
      title: t('La valeur des cartes'),
      text: t(
        'À l’atout : Valet 20, 9 14, As 11, 10 10, Roi 4, Dame 3. Ailleurs : As 11, 10 10, Roi 4, Dame 3, Valet 2.',
      ),
      visual: <Cards cards={['Jh', '9h', 'Ah', 'Th']} label={t('Les 4 plus forts atouts (cœur)')} />,
    },
    {
      icon: '🏁',
      title: t('Compter'),
      text: t(
        'Dernier pli : +10. Roi + Dame d’atout : belote-rebelote, +20. Le preneur doit faire plus que la défense, sinon il est dedans.',
      ),
    },
  ],
  tip: t('Tous les plis pour ton équipe ? C’est un capot : 252 points !'),
};

export const PUISSANCE4_RULES: GameRules = {
  game: 'puissance4',
  title: t('Puissance 4'),
  goal: t('Aligne 4 jetons de ta couleur avant ton adversaire.'),
  steps: [
    {
      icon: '⬇️',
      title: t('Fais tomber un jeton'),
      text: t(
        'À ton tour, touche une colonne : ton jeton tombe tout en bas, sur la première case libre. Rouge et jaune jouent chacun leur tour.',
      ),
      visual: (
        <MiniBoard rows={['.......', '.......', '...y...', '..rr...']} label={t('Les jetons s’empilent')} />
      ),
    },
    {
      icon: '🏆',
      title: t('Aligne-en quatre'),
      text: t('Le premier qui aligne 4 jetons gagne la manche : en ligne, en colonne ou en diagonale.'),
      visual: (
        <>
          <MiniBoard rows={['.......', '.......', '.......', 'RRRRyy.']} label={t('En ligne')} />
          <MiniBoard rows={['...Y...', '...Y...', '..rY...', '.rrYr..']} label={t('En colonne')} />
          <MiniBoard rows={['....R..', '...Ry..', '..Ryy..', '.Ryyr..']} label={t('En diagonale')} />
        </>
      ),
    },
    {
      icon: '🛡️',
      title: t('Bloque l’adversaire'),
      text: t(
        'Trois jetons alignés avec une case libre au bout ? Pose ton jeton dessus avant qu’il ne gagne.',
      ),
    },
    {
      icon: '🤝',
      title: t('Match nul et manches'),
      text: t(
        'Si la grille est pleine sans alignement, la manche est nulle. On joue autant de manches qu’on veut, celui qui commence change à chaque fois.',
      ),
    },
  ],
  tip: t('Joue au centre : la colonne du milieu fait partie du plus grand nombre d’alignements.'),
};
export const RAMI_RULES: GameRules = {
  game: 'rami',
  title: 'Rami',
  goal: t('Vide ta main le premier en posant des combinaisons, et garde le plus petit score.'),
  steps: [
    {
      icon: '🃏',
      title: t('La donne'),
      text: t(
        '2 jeux de 52 cartes et 4 jokers. 13 cartes chacun, 14 pour celui qui commence : il ne pioche pas et défausse tout de suite.',
      ),
    },
    {
      icon: '🔁',
      title: t('Ton tour'),
      text: t(
        'Pioche une carte, ou prends celle du dessus de la défausse. Pose ce que tu peux, puis défausse une carte pour finir ton tour.',
      ),
    },
    {
      icon: '🧩',
      title: t('Les combinaisons'),
      text: t(
        'Brelan ou carré : même valeur, couleurs toutes différentes. Suite : au moins 3 cartes qui se suivent dans la même couleur. L’as va avant le 2 ou après le roi.',
      ),
      visual: (
        <>
          <Cards cards={['8s', '8h', '8d']} label={t('Brelan')} />
          <Cards cards={['Th', 'Jh', 'Qh', 'Kh']} label={t('Suite à cœur')} />
        </>
      ),
    },
    {
      icon: '🤡',
      title: t('Le joker'),
      text: t(
        'Il remplace n’importe quelle carte, un seul par combinaison. Une fois ouvert, échange-le contre la vraie carte pour le récupérer.',
      ),
      visual: <Cards cards={['5c', 'Xr', '7c']} label={t('Le joker fait le 6 ♣')} />,
    },
    {
      icon: '🔓',
      title: t('Ouvrir à 51'),
      text: t(
        'Ta première pose doit valoir au moins 51 points (figures 10, as 11, ou 1 dans A-2-3). Ensuite, pose librement et complète les combinaisons de tout le monde.',
      ),
      visual: (
        <Cards
          cards={['Ks', 'Kh', 'Kd', '7d', '8d', '9d']}
          label={t('30 + 24 = 54 : j’ouvre !')}
          width={30}
        />
      ),
    },
    {
      icon: '🏁',
      title: t('Fin de manche'),
      text: t(
        'Le premier qui vide sa main gagne la manche. Les autres comptent leurs cartes (joker 20). Pas encore ouvert : 100 points. Tout posé d’un coup : rami sec, pénalités doublées !',
      ),
    },
  ],
  tip: t('La partie s’arrête quand quelqu’un atteint le score visé : le plus petit score gagne.'),
};

export const UNO_RULES: GameRules = {
  game: 'uno',
  title: 'Uno',
  goal: t('Sois le premier à poser toutes tes cartes.'),
  steps: [
    {
      icon: '🃏',
      title: t('La donne'),
      text: t(
        '108 cartes : des chiffres de 0 à 9 en 4 couleurs, des cartes spéciales et des Jokers. Chacun reçoit 7 cartes, une carte est retournée au milieu.',
      ),
    },
    {
      icon: '🎨',
      title: t('Couleur ou symbole'),
      text: t(
        'À ton tour, pose une carte de la même couleur ou du même chiffre (ou symbole) que celle du dessus.',
      ),
      visual: (
        <>
          <UnoCards cards={['r7a', 'r2a']} label={t('Même couleur ✓')} />
          <UnoCards cards={['r7a', 'b7a']} label={t('Même chiffre ✓')} />
        </>
      ),
    },
    {
      icon: '🎴',
      title: t('Pas de carte ? Pioche'),
      text: t(
        'Tu peux toujours piocher une carte. Si elle va, tu peux la poser tout de suite, sinon le tour passe.',
      ),
    },
    {
      icon: '⚡',
      title: t('Les cartes spéciales'),
      text: t(
        'Passe : le suivant saute son tour. Inverse : le sens du jeu change. +2 : le suivant pioche 2 cartes et passe son tour.',
      ),
      visual: <UnoCards cards={['gSa', 'yRa', 'bDa']} label={t('Passe · Inverse · +2')} />,
    },
    {
      icon: '🌈',
      title: t('Joker et +4'),
      text: t(
        'Le Joker se pose sur tout : tu choisis la couleur. Le +4 aussi, et le suivant pioche 4 cartes, mais seulement si tu n’as aucune carte de la couleur demandée.',
      ),
      visual: <UnoCards cards={['wWa', 'wFa']} label={t('Joker · +4')} />,
    },
    {
      icon: '📣',
      title: t('Uno !'),
      text: t(
        'Quand tu poses ton avant-dernière carte, appuie sur « Uno ! ». Si quelqu’un te prend avant, tu pioches 2 cartes. Et toi aussi, attrape les étourdis !',
      ),
    },
    {
      icon: '🏆',
      title: t('Les points'),
      text: t(
        'Le gagnant de la manche marque les cartes restées chez les autres : chiffres à leur valeur, cartes spéciales 20, Jokers et +4 50.',
      ),
    },
  ],
  tip: t('Garde tes Jokers pour la fin : ils te sortent de toutes les impasses.'),
};

export const HUIT_RULES: GameRules = {
  game: 'huit',
  title: t('8 américain'),
  goal: t('Sois le premier à poser toutes tes cartes, avec un jeu classique de 52 cartes.'),
  steps: [
    {
      icon: '🃏',
      title: t('La donne'),
      text: t('Chacun reçoit 7 cartes, une carte est retournée au milieu. Le reste forme la pioche.'),
    },
    {
      icon: '♥️',
      title: t('Couleur ou valeur'),
      text: t('Pose une carte de la même couleur (cœur, pique…) ou de la même valeur que celle du dessus.'),
      visual: (
        <>
          <Cards cards={['9h', '3h']} label={t('Même couleur ✓')} />
          <Cards cards={['9h', '9s']} label={t('Même valeur ✓')} />
        </>
      ),
    },
    {
      icon: '🎴',
      title: t('Pas de carte ? Pioche'),
      text: t('Pioche une carte : si elle va, tu peux la poser tout de suite, sinon le tour passe.'),
    },
    {
      icon: '8️⃣',
      title: t('Le 8 change la couleur'),
      text: t('Le 8 se pose sur n’importe quelle carte, et tu choisis la couleur que le suivant doit jouer.'),
      visual: <Cards cards={['8s', '8h', '8d', '8c']} label={t('Les 4 huit, les meilleures cartes')} />,
    },
    {
      icon: '⚡',
      title: t('Les cartes spéciales'),
      text: t(
        'Le 2 fait piocher 2 cartes au suivant, sauf s’il pose un autre 2 : ça se cumule (+4, +6…). Le Valet fait sauter le tour du suivant. L’As change le sens du jeu (à deux, tu rejoues).',
      ),
      visual: <Cards cards={['2c', 'Jd', 'Ah']} label={t('+2 · Passe ton tour · Change de sens')} />,
    },
    {
      icon: '📣',
      title: t('Carte !'),
      text: t(
        'Quand tu poses ton avant-dernière carte, appuie sur « Carte ! ». Si quelqu’un te prend avant, tu pioches 2 cartes. Et toi aussi, attrape les étourdis !',
      ),
    },
    {
      icon: '🏆',
      title: t('Les points'),
      text: t(
        'Le gagnant de la manche marque les cartes restées chez les autres : 8 = 50, 2, Valet et As = 20, Roi, Dame et 10 = 10, les autres leur valeur.',
      ),
    },
  ],
  tip: t('Un 8 en fin de partie, c’est la sortie assurée.'),
};

const TarotCards = ({ cards, label, width = 34 }: { cards: string[]; label?: string; width?: number }) => (
  <RuleExample label={label}>
    {cards.map((c) => (
      <TarotCard key={c} card={c} width={width} />
    ))}
  </RuleExample>
);

export const TAROT_RULES: GameRules = {
  game: 'tarot',
  title: 'Tarot',
  goal: t('Seul contre les trois autres, le preneur doit faire assez de points pour réussir son contrat.'),
  steps: [
    {
      icon: '🃏',
      title: t('Les 78 cartes'),
      text: t(
        'Quatre couleurs de 14 cartes (le Cavalier se place entre la Dame et le Valet), 21 atouts qui battent toutes les couleurs, et l’Excuse.',
      ),
      visual: (
        <TarotCards
          cards={['Rh', 'Dh', 'Ch', 'Vh', '7t', '15t']}
          label={t('Roi, Dame, Cavalier, Valet… et deux atouts')}
          width={30}
        />
      ),
    },
    {
      icon: '⭐',
      title: t('Les trois bouts'),
      text: t(
        'Le Petit (1), le 21 et l’Excuse. Plus le preneur en gagne, moins il lui faut de points : 56 sans bout, 51 avec un, 41 avec deux, 36 avec les trois.',
      ),
      visual: <TarotCards cards={['1t', '21t', 'EX']} label={t('Les bouts')} />,
    },
    {
      icon: '🙋',
      title: t('Les enchères'),
      text: t(
        'Chacun parle une fois : passe, ou plus haut que l’annonce d’avant. Petite (×1), Garde (×2), Garde sans le chien (×4), Garde contre le chien (×6).',
      ),
    },
    {
      icon: '🐕',
      title: t('Le chien et l’écart'),
      text: t(
        'En Petite ou en Garde, le preneur montre les 6 cartes du chien, les prend, puis en écarte 6 : jamais de roi ni de bout, et pas d’atout sauf s’il n’a pas le choix.',
      ),
    },
    {
      icon: '♠️',
      title: t('Jouer les plis'),
      text: t(
        'Fournis la couleur demandée. Sinon, coupe à l’atout. À l’atout, il faut toujours monter si on peut. L’Excuse se joue quand on veut et ne gagne jamais le pli.',
      ),
    },
    {
      icon: '🔢',
      title: t('Compter'),
      text: t(
        'Bouts et rois 4,5 · dames 3,5 · cavaliers 2,5 · valets 1,5 · les autres 0,5 (91 en tout). La donne vaut (25 + l’écart au contrat) × le multiplicateur, payé par chaque défenseur.',
      ),
      visual: (
        <TarotCards
          cards={['Rs', 'Ds', 'Cs', 'Vs', '9s']}
          label={t('4,5 · 3,5 · 2,5 · 1,5 · 0,5')}
          width={30}
        />
      ),
    },
  ],
  tip: t('Le Petit au bout : le mener au dernier pli rapporte 10 × le multiplicateur au camp qui le gagne.'),
};

export const PERUDO_RULES: GameRules = {
  game: 'perudo',
  title: 'Perudo',
  goal: t('Sois le dernier à avoir encore des dés sous ton gobelet.'),
  steps: [
    {
      icon: '🎲',
      title: t('Des dés cachés'),
      text: t('Chacun lance ses 5 dés sous son gobelet et ne regarde que les siens.'),
    },
    {
      icon: '🗣️',
      title: t('Les enchères'),
      text: t(
        'À ton tour, annonce combien de dés d’une face il y a sur toute la table, par exemple « trois 4 ». Le suivant doit monter : plus de dés, ou autant d’une face plus forte.',
      ),
      visual: <Dice values={[4, 4, 4]} label={t('« Trois 4 »')} />,
    },
    {
      icon: '⭐',
      title: t('Les Pacos'),
      text: t(
        'Les 1, les Pacos, comptent pour toutes les faces. Passer aux Pacos divise le nombre par deux (arrondi au-dessus) ; en revenir le double, plus un.',
      ),
      visual: <Dice values={[1, 1, 5, 5]} label={t('Quatre 5 avec les Pacos')} />,
    },
    {
      icon: '🙅',
      title: t('Dudo !'),
      text: t(
        'Tu ne crois pas l’enchère d’avant ? Crie « Dudo ! » : tout le monde montre ses dés. S’il y en a moins qu’annoncé, celui qui a annoncé perd un dé ; sinon c’est toi.',
      ),
    },
    {
      icon: '🎯',
      title: t('Calza'),
      text: t(
        'Si l’option est choisie, tu peux dire que l’enchère est pile juste. Gagné, tu récupères un dé ; raté, tu en perds un. Pas de Calza à deux joueurs.',
      ),
    },
    {
      icon: '🔁',
      title: t('Manche suivante'),
      text: t('Celui qui a perdu un dé ouvre la manche suivante. Sans dé, on est éliminé.'),
    },
  ],
  tip: t('Compte tes dés : en moyenne, un tiers des dés cachés vont avec la face annoncée, Pacos compris.'),
};
