// The illustrated rules of every game, shown by <RulesButton />.
import { Die } from './components/Die';
import { PlayingCard } from './components/PlayingCard';
import { TarotCard } from './components/TarotCard';
import { type GameRules, RuleExample } from './components/Rules';

const Cards = ({ cards, label, width = 34 }: { cards: string[]; label?: string; width?: number }) => (
  <RuleExample label={label}>
    {cards.map((c, i) => (
      <PlayingCard key={`${c}${i}`} card={c} width={width} />
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

const HAND_RANKS_EXAMPLES: { name: string; cards: string[] }[] = [
  { name: 'Quinte flush royale', cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'] },
  { name: 'Quinte flush', cards: ['9h', '8h', '7h', '6h', '5h'] },
  { name: 'Carré', cards: ['Qc', 'Qd', 'Qh', 'Qs', '4d'] },
  { name: 'Full', cards: ['Kh', 'Kd', 'Ks', '7c', '7h'] },
  { name: 'Couleur', cards: ['Ad', 'Jd', '8d', '5d', '2d'] },
  { name: 'Quinte', cards: ['Tc', '9d', '8s', '7h', '6c'] },
  { name: 'Brelan', cards: ['8s', '8h', '8d', 'Kc', '3s'] },
  { name: 'Double paire', cards: ['Jh', 'Jc', '4s', '4d', 'Ah'] },
  { name: 'Paire', cards: ['Ts', 'Th', 'Kd', '6c', '2h'] },
  { name: 'Carte haute', cards: ['Ah', 'Jd', '8c', '5s', '3h'] },
];

export const POKER_RULES: GameRules = {
  game: 'poker',
  title: 'Poker',
  goal: 'Gagne les jetons des autres avec la meilleure main, ou en les faisant se coucher.',
  steps: [
    {
      icon: '🃏',
      title: 'Deux cartes pour toi',
      text: 'Chacun reçoit 2 cartes cachées. Deux joueurs misent d’office les blindes pour lancer le pot.',
      visual: <Cards cards={['Ah', 'Kh']} label="Ta main, que toi seul vois" />,
    },
    {
      icon: '💬',
      title: 'Un tour de parole',
      text: 'À ton tour : te coucher, suivre la mise, relancer, ou checker si personne n’a misé.',
    },
    {
      icon: '🂠',
      title: 'Le tableau se dévoile',
      text: 'Le flop (3 cartes), puis le turn et la river (1 carte chacun). Un tour de parole après chaque étape.',
      visual: <Cards cards={['Qh', 'Jh', '7c', 'Th', '2s']} label="Les 5 cartes communes" width={30} />,
    },
    {
      icon: '🏆',
      title: 'L’abattage',
      text: 'Ta meilleure combinaison de 5 cartes parmi tes 2 et les 5 du milieu gagne le pot.',
      visual: (
        <>
          {HAND_RANKS_EXAMPLES.map((r, i) => (
            <Cards key={r.name} cards={r.cards} label={`${i + 1}. ${r.name}`} width={22} />
          ))}
        </>
      ),
    },
  ],
  tip: 'Tout le monde se couche ? Tu gagnes le pot sans montrer tes cartes.',
};

export const BLACKJACK_RULES: GameRules = {
  game: 'blackjack',
  title: 'Blackjack',
  goal: 'Approche-toi le plus possible de 21 sans dépasser, et bats le croupier.',
  steps: [
    {
      icon: '🪙',
      title: 'Mise',
      text: 'Chacun mise avant la donne. Tu reçois 2 cartes, le croupier une visible et une cachée.',
    },
    {
      icon: '🔢',
      title: 'Compte tes points',
      text: 'Les figures valent 10, l’as vaut 1 ou 11 selon ce qui t’arrange.',
      visual: <Cards cards={['As', '6d']} label="7 ou 17" />,
    },
    {
      icon: '✋',
      title: 'Tirer ou rester',
      text: 'Tirer : une carte de plus. Rester : tu t’arrêtes. Doubler : mise ×2 et une seule carte. Séparer : une paire devient deux mains.',
    },
    {
      icon: '🎩',
      title: 'Le croupier joue',
      text: 'Il tire jusqu’à 16 et reste sur 17. S’il dépasse 21, tous ceux encore en jeu gagnent.',
    },
    {
      icon: '💰',
      title: 'Les gains',
      text: 'Gagné : ta mise payée 1 contre 1. Égalité : mise rendue. Blackjack (as + 10 d’entrée) : payé 3 contre 2.',
      visual: <Cards cards={['Ac', 'Kd']} label="Blackjack !" />,
    },
  ],
  tip: 'Contre un 5 ou un 6 du croupier, reste souvent : c’est lui qui risque de sauter.',
};

export const PRESIDENT_RULES: GameRules = {
  game: 'president',
  title: 'Président',
  goal: 'Vide ta main le premier pour devenir Président.',
  steps: [
    {
      icon: '📈',
      title: 'L’ordre des cartes',
      text: 'Du plus faible au plus fort : 3, 4, 5… Roi, As, et le 2 tout en haut.',
      visual: <Cards cards={['3c', '7d', 'Jh', 'As', '2s']} label="Faible → Fort" />,
    },
    {
      icon: '🃏',
      title: 'Poser',
      text: 'Celui qui mène pose 1 à 4 cartes de même valeur. Les suivants posent autant de cartes, plus fortes, ou passent.',
      visual: <Cards cards={['8h', '8c']} label="Une paire de 8 : il faut une paire plus forte" />,
    },
    {
      icon: '🔁',
      title: 'Ramasser le pli',
      text: 'Quand tout le monde passe, le dernier à avoir joué ramasse et recommence. Un 2 ferme le pli tout de suite.',
    },
    {
      icon: '👑',
      title: 'Les titres',
      text: 'Le premier à finir est Président, le dernier Trouduc. À 4 joueurs ou plus, il y a aussi les vices.',
    },
    {
      icon: '🔄',
      title: 'L’échange',
      text: 'Manche suivante : le Trouduc donne ses 2 meilleures cartes au Président, qui lui rend 2 cartes de son choix.',
    },
  ],
  tip: 'Garde tes 2 pour reprendre la main au bon moment.',
};

export const YAMS_RULES: GameRules = {
  game: 'yams',
  title: 'Yams',
  goal: 'Remplis ta grille de 13 cases et fais le plus gros total.',
  steps: [
    {
      icon: '🎲',
      title: 'Trois lancers',
      text: 'À ton tour, lance les 5 dés jusqu’à 3 fois. Touche les dés à garder 🔒 et relance les autres.',
    },
    {
      icon: '✍️',
      title: 'Inscris un score',
      text: 'Choisis une case libre de ta grille. Si rien ne va, tu dois quand même barrer une case pour 0 point.',
    },
    {
      icon: '⬆️',
      title: 'Le haut de la grille',
      text: 'De 1 à 6 : la somme des dés de cette valeur. 63 points ou plus en haut = 35 points de bonus.',
      visual: <Dice values={[4, 4, 4, 2, 6]} label="Case 4 : 12 points" />,
    },
    {
      icon: '⬇️',
      title: 'Les combinaisons',
      text: 'Brelan et Carré : somme des dés. Full : 25. Petite suite : 30. Grande suite : 40. Yams : 50. Chance : la somme.',
      visual: (
        <>
          <Dice values={[3, 3, 3, 5, 5]} label="Full : 25" />
          <Dice values={[2, 3, 4, 5, 6]} label="Grande suite : 40" />
          <Dice values={[6, 6, 6, 6, 6]} label="Yams : 50" />
        </>
      ),
    },
  ],
  tip: 'Vise le bonus du haut : trois dés de chaque valeur suffisent pour l’avoir.',
};

export const BELOTE_RULES: GameRules = {
  game: 'belote',
  title: 'Belote',
  goal: 'En équipe avec ton partenaire en face, atteins le score visé avant l’autre équipe.',
  steps: [
    {
      icon: '🃏',
      title: 'La donne',
      text: '32 cartes. Chacun en reçoit 5, puis une carte est retournée au milieu.',
    },
    {
      icon: '🙋',
      title: 'Prendre ou passer',
      text: '1er tour : prendre à la couleur retournée, ou passer. 2e tour : choisir une autre couleur, ou passer. Le preneur ramasse la retourne.',
    },
    {
      icon: '♠️',
      title: 'Jouer les plis',
      text: 'Il faut fournir la couleur demandée. Sinon, couper à l’atout, sauf si ton partenaire est déjà maître.',
    },
    {
      icon: '⭐',
      title: 'La valeur des cartes',
      text: 'À l’atout : Valet 20, 9 14, As 11, 10 10, Roi 4, Dame 3. Ailleurs : As 11, 10 10, Roi 4, Dame 3, Valet 2.',
      visual: <Cards cards={['Jh', '9h', 'Ah', 'Th']} label="Les 4 plus forts atouts (cœur)" />,
    },
    {
      icon: '🏁',
      title: 'Compter',
      text: 'Dernier pli : +10. Roi + Dame d’atout : belote-rebelote, +20. Le preneur doit faire plus que la défense, sinon il est dedans.',
    },
  ],
  tip: 'Tous les plis pour ton équipe ? C’est un capot : 252 points !',
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
  goal: 'Seul contre les trois autres, le preneur doit faire assez de points pour réussir son contrat.',
  steps: [
    {
      icon: '🃏',
      title: 'Les 78 cartes',
      text: 'Quatre couleurs de 14 cartes (le Cavalier se place entre la Dame et le Valet), 21 atouts qui battent toutes les couleurs, et l’Excuse.',
      visual: (
        <TarotCards
          cards={['Rh', 'Dh', 'Ch', 'Vh', '7t', '15t']}
          label="Roi, Dame, Cavalier, Valet… et deux atouts"
          width={30}
        />
      ),
    },
    {
      icon: '⭐',
      title: 'Les trois bouts',
      text: 'Le Petit (1), le 21 et l’Excuse. Plus le preneur en gagne, moins il lui faut de points : 56 sans bout, 51 avec un, 41 avec deux, 36 avec les trois.',
      visual: <TarotCards cards={['1t', '21t', 'EX']} label="Les bouts" />,
    },
    {
      icon: '🙋',
      title: 'Les enchères',
      text: 'Chacun parle une fois : passe, ou plus haut que l’annonce d’avant. Petite (×1), Garde (×2), Garde sans le chien (×4), Garde contre le chien (×6).',
    },
    {
      icon: '🐕',
      title: 'Le chien et l’écart',
      text: 'En Petite ou en Garde, le preneur montre les 6 cartes du chien, les prend, puis en écarte 6 : jamais de roi ni de bout, et pas d’atout sauf s’il n’a pas le choix.',
    },
    {
      icon: '♠️',
      title: 'Jouer les plis',
      text: 'Fournis la couleur demandée. Sinon, coupe à l’atout. À l’atout, il faut toujours monter si on peut. L’Excuse se joue quand on veut et ne gagne jamais le pli.',
    },
    {
      icon: '🔢',
      title: 'Compter',
      text: 'Bouts et rois 4,5 · dames 3,5 · cavaliers 2,5 · valets 1,5 · les autres 0,5 (91 en tout). La donne vaut (25 + l’écart au contrat) × le multiplicateur, payé par chaque défenseur.',
      visual: (
        <TarotCards cards={['Rs', 'Ds', 'Cs', 'Vs', '9s']} label="4,5 · 3,5 · 2,5 · 1,5 · 0,5" width={30} />
      ),
    },
  ],
  tip: 'Le Petit au bout : le mener au dernier pli rapporte 10 × le multiplicateur au camp qui le gagne.',
};
