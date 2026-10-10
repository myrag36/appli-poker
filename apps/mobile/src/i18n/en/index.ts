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
import bataille from './bataille';
import ramiEnLigne from './ramiEnLigne';
import defi from './defi';
import tarotEnLigne from './tarotEnLigne';
import unoEnLigne from './uno-en-ligne';
import revanche from './revanche';
import notifications from './notifications';
import pcAccueil from './pcAccueil';
import pcAutres from './pcAutres';
import plisPc from './plisPc';
import classement from './classement';
import sons from './sons';
import perudo from './perudo';
import ambiances from './ambiances';
import finitions from './finitions';
import messagerie from './messagerie';
import tournoiVendredi from './tournoiVendredi';

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
  ...bataille,
  ...ramiEnLigne,
  ...defi,
  ...tarotEnLigne,
  ...unoEnLigne,
  ...revanche,
  ...notifications,
  ...pcAccueil,
  ...pcAutres,
  ...plisPc,
  ...classement,
  ...sons,
  ...perudo,
  ...ambiances,
  ...finitions,
  ...messagerie,
  ...tournoiVendredi,
};
