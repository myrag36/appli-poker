// English texts, by French text. Each part of the app has its own file.
import accueil from './accueil';
import boutique from './boutique';
import poker from './poker';
import regles from './regles';
import cartes1 from './cartes1';
import cartes2 from './cartes2';
import cartes3 from './cartes3';
import divers from './divers';
import tutoriel from './tutoriel';
import puissance4 from './puissance4';
import ramiEnLigne from './ramiEnLigne';
import defi from './defi';
import tarotEnLigne from './tarotEnLigne';
import unoEnLigne from './uno-en-ligne';

export const EN: Record<string, string> = {
  ...accueil,
  ...boutique,
  ...poker,
  ...regles,
  ...cartes1,
  ...cartes2,
  ...cartes3,
  ...divers,
  ...tutoriel,
  ...puissance4,
  ...ramiEnLigne,
  ...defi,
  ...tarotEnLigne,
  ...unoEnLigne,
};
