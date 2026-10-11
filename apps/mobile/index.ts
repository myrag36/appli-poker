import { registerRootComponent } from 'expo';

import { decorReady } from './src/components/Backdrop';
import { langReady } from './src/i18n';
import { registerServiceWorker } from './src/pwa';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
// The app's modules are only run once the language's texts are there, as some of them translate
// texts when they load, and the theme's scenery, so that it shows with the first screen.
Promise.all([langReady, decorReady]).then(() => registerRootComponent(require('./App').default));

// On the website: lets the app be installed on the home screen and open offline.
registerServiceWorker();
