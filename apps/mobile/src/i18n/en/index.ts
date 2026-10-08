// English texts, by French text. Each part of the app has its own file.
import accueil from './accueil';
import boutique from './boutique';
import poker from './poker';
import regles from './regles';
import cartes1 from './cartes1';
import cartes2 from './cartes2';
import cartes3 from './cartes3';
import divers from './divers';

export const EN: Record<string, string> = {
  ...accueil,
  ...boutique,
  ...poker,
  ...regles,
  ...cartes1,
  ...cartes2,
  ...cartes3,
  ...divers,
};
