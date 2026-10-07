import { registerRootComponent } from 'expo';

import App from './App';
import { registerServiceWorker } from './src/pwa';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// On the website: lets the app be installed on the home screen and open offline.
registerServiceWorker();
