import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';

const FIREBASE_URL = "https://bariq-ce6b4-default-rtdb.firebaseio.com";
const FIREBASE_KEY = "AIzaSyDhEo61jzd-npwhhw-Vf1R8fLWttJbJib8";

const BackgroundFetch = async (taskData) => {
  try {
    const myId = await AsyncStorage.getItem('my_id');
    if (!myId) return;

    const savedSeen = await AsyncStorage.getItem('seen_keys');
    const seenKeys = new Set(savedSeen ? JSON.parse(savedSeen) : []);

    const savedNames = await AsyncStorage.getItem('contact_names');
    const names = savedNames ? JSON.parse(savedNames) : {};

    const r = await fetch(
      `${FIREBASE_URL}/messages/${myId}.json?auth=${FIREBASE_KEY}`
    );
    const data = await r.json();
    if (!data || typeof data !== 'object') return;

    await notifee.createChannel({
      id: 'bariq_messages',
      name: 'رسائل بارق',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    const savedP = await AsyncStorage.getItem('pending');
    const allP = savedP ? JSON.parse(savedP) : {};
    let changed = false;

    for (const [key, msg] of Object.entries(data)) {
      if (!seenKeys.has(key) && msg && typeof msg === 'object') {
        seenKeys.add(key);
        const sid = msg.from || '';
        if (!allP[sid]) allP[sid] = [];
        allP[sid].push({key, msg});
        changed = true;

        const senderName = names[sid] || `رقم ${sid}`;
        const body = msg.type === 'file'
          ? `📎 ${msg.filename || 'ملف'}`
          : (msg.text || '');

        await notifee.displayNotification({
          title: `رسالة من ${senderName}`,
          body,
          android: {
            channelId: 'bariq_messages',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            smallIcon: 'ic_launcher',
            pressAction: { id: 'default' },
          },
        });
      }
    }

    if (changed) {
      await AsyncStorage.setItem('pending', JSON.stringify(allP));
      await AsyncStorage.setItem(
        'seen_keys',
        JSON.stringify([...seenKeys].slice(-500))
      );
    }
  } catch (e) {}
};

export default BackgroundFetch;
