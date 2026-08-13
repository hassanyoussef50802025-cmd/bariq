import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import BackgroundFetch from './BackgroundService';

// تسجيل مهمة الخلفية للإشعارات
AppRegistry.registerHeadlessTask('BariqBackgroundTask', () => BackgroundFetch);

AppRegistry.registerComponent(appName, () => App);
