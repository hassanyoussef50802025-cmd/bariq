import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ScrollView, KeyboardAvoidingView,
  Platform, I18nManager, ActivityIndicator, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// دعم العربية RTL
I18nManager.forceRTL(true);

// ==================== إعدادات Firebase ====================
const FIREBASE_URL = "https://bariq-ce6b4-default-rtdb.firebaseio.com";
const FIREBASE_KEY = "AIzaSyDhEo61jzd-npwhhw-Vf1R8fLWttJbJib8";
const ADMIN_ID = "53710624";

// ==================== الألوان ====================
const C = {
  bg: '#F0F4FF',
  chatBg: '#FFFFFF',
  myMsg: '#D2D2D2',
  otherMsg: '#F5EBD2',
  headerBg: '#FFFFFF',
  headerBorder: '#FFD700',
  btnSend: '#4CAF50',
  btnEmoji: '#2196F3',
  btnFile: '#9E9E9E',
  btnCancel: '#F44336',
  barBg: '#1565C0',
  text: '#191919',
  white: '#FFFFFF',
};

// ==================== دوال مساعدة ====================
const generateId = () => Math.random().toString().slice(2, 10).padStart(8, '0');

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
};

const statusLabel = (s) => s === 'read' ? ' ✓✓✓' : s === 'received' ? ' ✓✓' : ' ✓';
const statusText = (s) => s === 'read' ? 'مقروءة' : s === 'received' ? 'مستلمة' : 'مرسلة';

// ==================== دوال Firebase ====================
const fbSend = async (toId, payload) => {
  try {
    const r = await fetch(`${FIREBASE_URL}/messages/${toId}.json?auth=${FIREBASE_KEY}`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    return d.name || null;
  } catch { return null; }
};

const fbGet = async (uid) => {
  try {
    const r = await fetch(`${FIREBASE_URL}/messages/${uid}.json?auth=${FIREBASE_KEY}`);
    const d = await r.json();
    return (d && typeof d === 'object') ? d : {};
  } catch { return {}; }
};

const fbDel = async (uid, key) => {
  try {
    await fetch(`${FIREBASE_URL}/messages/${uid}/${key}.json?auth=${FIREBASE_KEY}`, {method:'DELETE'});
  } catch {}
};

const notifyStatus = async (toId, key, status, fromId) => {
  try {
    await fetch(`${FIREBASE_URL}/status/${toId}/${key}.json?auth=${FIREBASE_KEY}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({status, from: fromId})
    });
  } catch {}
};

const getMsgStatus = async (uid, key) => {
  try {
    const r = await fetch(`${FIREBASE_URL}/status/${uid}/${key}.json?auth=${FIREBASE_KEY}`);
    const d = await r.json();
    return (d && d.status) ? d.status : '';
  } catch { return ''; }
};

// ==================== شاشة الترحيب ====================
const WelcomeScreen = ({ onLogin }) => {
  const [inputId, setInputId] = useState('');

  const createAccount = async () => {
    const newId = generateId();
    await AsyncStorage.setItem('my_id', newId);
    await AsyncStorage.setItem('contacts', JSON.stringify({}));
    Alert.alert('تم إنشاء حسابك', `رقمك الجديد:\n${newId}\n\nاحتفظ بهذا الرقم!`, [
      {text: 'انطلق!', onPress: () => onLogin(newId)}
    ]);
  };

  const login = async () => {
    if (inputId.length === 8 && /^\d+$/.test(inputId)) {
      await AsyncStorage.setItem('my_id', inputId);
      const contacts = await AsyncStorage.getItem('contacts');
      if (!contacts) await AsyncStorage.setItem('contacts', JSON.stringify({}));
      onLogin(inputId);
    } else {
      Alert.alert('خطأ', 'الرقم يجب أن يكون 8 أرقام');
    }
  };

  return (
    <SafeAreaView style={[styles.flex1, {backgroundColor: C.bg}]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={styles.welcomeContainer}>
          <Text style={styles.appTitle}>بارق</Text>
          <Text style={styles.appSubtitle}>تطبيق المراسلة الآمن</Text>

          <TouchableOpacity style={[styles.btn, {backgroundColor: C.btnSend}]} onPress={createAccount}>
            <Text style={styles.btnText}>إنشاء رقم جديد</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>أو أدخل رقمك الموجود:</Text>

          <TextInput
            style={styles.input}
            placeholder="8 أرقام"
            keyboardType="numeric"
            maxLength={8}
            value={inputId}
            onChangeText={setInputId}
            textAlign="center"
          />

          <TouchableOpacity style={[styles.btn, {backgroundColor: C.btnEmoji}]} onPress={login}>
            <Text style={styles.btnText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==================== شاشة الرئيسية ====================
const HomeScreen = ({ myId, onOpenChat }) => {
  const [contacts, setContacts] = useState({});
  const [newContact, setNewContact] = useState('');
  const [pending, setPending] = useState({});
  const listenerRef = useRef(null);

  useEffect(() => {
    loadContacts();
    startListener();
    return () => { if (listenerRef.current) clearInterval(listenerRef.current); };
  }, []);

  const loadContacts = async () => {
    const c = await AsyncStorage.getItem('contacts');
    setContacts(c ? JSON.parse(c) : {});
    const p = await AsyncStorage.getItem('pending');
    setPending(p ? JSON.parse(p) : {});
  };

  const startListener = () => {
    const seen = new Set();
    listenerRef.current = setInterval(async () => {
      const incoming = await fbGet(myId);
      const newPending = {};
      for (const [key, msg] of Object.entries(incoming)) {
        if (!seen.has(key) && msg && typeof msg === 'object') {
          seen.add(key);
          const sid = msg.from || '';
          if (!newPending[sid]) newPending[sid] = [];
          newPending[sid].push({key, msg});
        }
      }
      if (Object.keys(newPending).length > 0) {
        const savedP = await AsyncStorage.getItem('pending');
        const allP = savedP ? JSON.parse(savedP) : {};
        for (const [sid, msgs] of Object.entries(newPending)) {
          if (!allP[sid]) allP[sid] = [];
          allP[sid].push(...msgs);
        }
        await AsyncStorage.setItem('pending', JSON.stringify(allP));
        setPending({...allP});
      }
    }, 5000);
  };

  const addContact = async () => {
    if (newContact.length === 8 && /^\d+$/.test(newContact)) {
      if (newContact === myId) { Alert.alert('تنبيه', 'لا يمكنك إضافة رقمك الخاص'); return; }
      const updated = {...contacts, [newContact]: newContact};
      setContacts(updated);
      await AsyncStorage.setItem('contacts', JSON.stringify(updated));
      setNewContact('');
    } else {
      Alert.alert('خطأ', 'الرقم يجب أن يكون 8 أرقام');
    }
  };

  const deleteContact = async (cid) => {
    const updated = {...contacts};
    delete updated[cid];
    setContacts(updated);
    await AsyncStorage.setItem('contacts', JSON.stringify(updated));
  };

  const openChat = async (cid, cname) => {
    const p = pending[cid] || [];
    const newP = {...pending};
    delete newP[cid];
    setPending(newP);
    await AsyncStorage.setItem('pending', JSON.stringify(newP));
    onOpenChat(cid, cname, p);
  };

  const allContacts = Object.entries(contacts);

  return (
    <SafeAreaView style={[styles.flex1, {backgroundColor: C.bg}]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>بارق  |  رقمك: {myId}</Text>
      </View>

      <View style={styles.addContactRow}>
        <TextInput
          style={[styles.input, {flex:1, marginBottom:0, marginLeft:8}]}
          placeholder="أضف رقم جهة اتصال"
          keyboardType="numeric"
          maxLength={8}
          value={newContact}
          onChangeText={setNewContact}
          textAlign="right"
        />
        <TouchableOpacity style={[styles.smallBtn, {backgroundColor: C.btnSend}]} onPress={addContact}>
          <Text style={styles.btnText}>إضافة</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={allContacts}
        keyExtractor={([cid]) => cid}
        renderItem={({item: [cid, cname]}) => {
          const pCount = (pending[cid] || []).length;
          return (
            <View style={styles.contactRow}>
              <Text style={styles.contactName}>
                {cname} - {cid}{pCount > 0 ? `  🔔 ${pCount}` : ''}
              </Text>
              <TouchableOpacity style={[styles.smallBtn, {backgroundColor: C.btnSend}]} onPress={() => openChat(cid, cname)}>
                <Text style={styles.btnText}>فتح</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, {backgroundColor: C.btnCancel}]} onPress={() => deleteContact(cid)}>
                <Text style={styles.btnText}>X</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>لا توجد جهات اتصال\nأضف رقماً للبدء</Text>}
      />
    </SafeAreaView>
  );
};

// ==================== شاشة المحادثة ====================
const ChatScreen = ({ myId, contactId, contactName, pendingMsgs, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const seenKeys = useRef(new Set());
  const listenerRef = useRef(null);

  useEffect(() => {
    loadMessages();
    return () => { if (listenerRef.current) clearInterval(listenerRef.current); };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messages]);

  const loadMessages = async () => {
    const key = [myId, contactId].sort().join('_');
    const saved = await AsyncStorage.getItem('chat_' + key);
    const msgs = saved ? JSON.parse(saved) : [];
    setMessages(msgs);
    msgs.forEach(m => { if (m.key) seenKeys.current.add(m.key); });

    // معالجة الرسائل المعلقة
    if (pendingMsgs && pendingMsgs.length > 0) {
      for (const {key: k, msg} of pendingMsgs) {
        if (!seenKeys.current.has(k)) {
          seenKeys.current.add(k);
          await processIncoming(k, msg, msgs);
        }
      }
    }

    startPolling();
  };

  const saveMessages = async (msgs) => {
    const key = [myId, contactId].sort().join('_');
    const cutoff = Date.now()/1000 - 7*86400;
    const filtered = msgs.filter(m => (m.time || 0) > cutoff);
    await AsyncStorage.setItem('chat_' + key, JSON.stringify(filtered));
    return filtered;
  };

  const processIncoming = async (k, msg, currentMsgs) => {
    await notifyStatus(msg.from || '', k, 'received', myId);
    const lm = {
      from: msg.from || '',
      text: msg.text || '',
      type: msg.type || 'text',
      filename: msg.filename || '',
      time: msg.time || Math.floor(Date.now()/1000),
      key: k,
      replyTo: msg.reply_to || null,
    };
    const updated = [...currentMsgs, lm];
    const filtered = await saveMessages(updated);
    setMessages([...filtered]);
    await fbDel(myId, k);
    return updated;
  };

  const startPolling = () => {
    listenerRef.current = setInterval(async () => {
      const incoming = await fbGet(myId);
      for (const [k, msg] of Object.entries(incoming)) {
        if (!seenKeys.current.has(k) && msg && typeof msg === 'object') {
          if (msg.from === contactId) {
            seenKeys.current.add(k);
            setMessages(prev => {
              processIncoming(k, msg, prev).then(updated => {
                saveMessages(updated);
              });
              return prev;
            });
          }
        }
      }
      // تحديث حالة التسليم
      setMessages(prev => {
        prev.forEach(async (m, i) => {
          if (m.from === myId && m.key && m.deliveryStatus !== 'read') {
            const ns = await getMsgStatus(myId, m.key);
            const order = {sent:0, received:1, read:2};
            if (ns && (order[ns]||0) > (order[m.deliveryStatus||'sent']||0)) {
              prev[i] = {...m, deliveryStatus: ns};
              setMessages([...prev]);
              saveMessages([...prev]);
            }
          }
        });
        return prev;
      });
    }, 3000);
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const now = Math.floor(Date.now()/1000);
    const payload = {from: myId, text: text.trim(), type: 'text', time: now, delivery_status: 'sent'};
    if (replyTo) payload.reply_to = replyTo;
    const lm = {from: myId, text: text.trim(), type: 'text', time: now, deliveryStatus: 'sent', key: '', replyTo};
    const updated = [...messages, lm];
    setMessages(updated);
    await saveMessages(updated);
    setText('');
    setReplyTo(null);
    const key = await fbSend(contactId, payload);
    if (key) {
      updated[updated.length-1].key = key;
      setMessages([...updated]);
      await saveMessages(updated);
    }
    setLoading(false);
  };

  const renderBubble = ({item, index}) => {
    const isMine = item.from === myId;
    const sender = isMine ? 'أنت' : contactName;
    const time = formatTime(item.time);
    const body = item.type === 'file' ? `ملف: ${item.filename}` : item.text;

    return (
      <TouchableOpacity
        onLongPress={() => showOptions(index)}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
          <View style={[styles.bubble, {backgroundColor: isMine ? C.myMsg : C.otherMsg}]}>
            {item.replyTo && <Text style={styles.replyText}>رد على: {String(item.replyTo).slice(0,30)}</Text>}
            <Text style={styles.bubbleSender}>{sender}:</Text>
            <Text style={styles.bubbleText}>{body}</Text>
            <Text style={styles.bubbleMeta}>
              {time}{isMine ? statusLabel(item.deliveryStatus||'sent') + ' ' + statusText(item.deliveryStatus||'sent') : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const showOptions = (idx) => {
    const msg = messages[idx];
    const opts = [
      {text: 'الرد', onPress: () => setReplyTo(msg.text || msg.filename)},
      {text: 'حذف', onPress: () => deleteMsg(idx)},
      {text: 'إلغاء', style: 'cancel'},
    ];
    if (msg.from === myId) opts.splice(2, 0, {text: 'تعديل', onPress: () => editMsg(idx)});
    Alert.alert('خيارات الرسالة', '', opts);
  };

  const deleteMsg = async (idx) => {
    const updated = messages.filter((_, i) => i !== idx);
    setMessages(updated);
    await saveMessages(updated);
  };

  const editMsg = (idx) => {
    Alert.prompt('تعديل الرسالة', '', async (newText) => {
      if (newText) {
        const updated = [...messages];
        updated[idx] = {...updated[idx], text: newText + ' (معدل)'};
        setMessages(updated);
        await saveMessages(updated);
      }
    }, 'plain-text', messages[idx].text);
  };

  return (
    <SafeAreaView style={[styles.flex1, {backgroundColor: C.bg}]}>
      <View style={[styles.header, {borderBottomWidth: 3, borderBottomColor: C.headerBorder}]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.headerText}>المحادثة مع: {contactName}</Text>
      </View>

      <FlatList
        ref={scrollRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderBubble}
        style={{backgroundColor: C.chatBg}}
        contentContainerStyle={{padding: 8}}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({animated: true})}
      />

      {replyTo && (
        <View style={styles.replyBar}>
          <Text style={styles.replyBarText}>رد على: {String(replyTo).slice(0,40)}</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={styles.replyBarClose}>✗</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.msgInput}
            placeholder="اكتب رسالتك..."
            value={text}
            onChangeText={setText}
            multiline
            textAlign="right"
            onSubmitEditing={sendMessage}
          />
        </View>
        <View style={styles.btnBar}>
          <TouchableOpacity style={[styles.barBtn, {backgroundColor: C.btnSend}]} onPress={sendMessage}>
            {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.barBtnText}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.barBtn, {backgroundColor: C.btnCancel}]} onPress={() => setReplyTo(null)}>
            <Text style={styles.barBtnText}>✗</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==================== التطبيق الرئيسي ====================
export default function App() {
  const [myId, setMyId] = useState(null);
  const [screen, setScreen] = useState('loading');
  const [chatInfo, setChatInfo] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('my_id').then(id => {
      setMyId(id);
      setScreen(id ? 'home' : 'welcome');
    });
  }, []);

  const handleLogin = (id) => { setMyId(id); setScreen('home'); };

  const openChat = (cid, cname, pendingMsgs) => {
    setChatInfo({cid, cname, pendingMsgs});
    setScreen('chat');
  };

  if (screen === 'loading') {
    return <View style={[styles.flex1, styles.center]}><ActivityIndicator size="large" color={C.barBg}/></View>;
  }
  if (screen === 'welcome') return <WelcomeScreen onLogin={handleLogin}/>;
  if (screen === 'chat' && chatInfo) {
    return <ChatScreen myId={myId} contactId={chatInfo.cid} contactName={chatInfo.cname}
             pendingMsgs={chatInfo.pendingMsgs} onBack={() => setScreen('home')}/>;
  }
  return <HomeScreen myId={myId} onOpenChat={openChat}/>;
}

// ==================== الأنماط ====================
const styles = StyleSheet.create({
  flex1: {flex: 1},
  center: {justifyContent:'center', alignItems:'center'},
  welcomeContainer: {flexGrow:1, justifyContent:'center', padding:30, gap:15},
  appTitle: {fontSize:42, fontWeight:'bold', textAlign:'center', color:C.text},
  appSubtitle: {fontSize:18, textAlign:'center', color:C.text},
  btn: {padding:15, borderRadius:10, alignItems:'center'},
  btnText: {color:C.white, fontSize:16, fontWeight:'bold'},
  orText: {textAlign:'center', color:C.text, fontSize:16},
  input: {borderWidth:1, borderColor:'#ccc', borderRadius:8, padding:10, fontSize:16,
    backgroundColor:C.white, marginBottom:10},
  header: {backgroundColor:C.headerBg, padding:12, flexDirection:'row', alignItems:'center'},
  headerText: {fontSize:16, fontWeight:'bold', color:C.text, flex:1, textAlign:'right'},
  addContactRow: {flexDirection:'row', padding:8, gap:8, alignItems:'center'},
  smallBtn: {padding:8, borderRadius:8, minWidth:60, alignItems:'center'},
  contactRow: {flexDirection:'row', alignItems:'center', backgroundColor:C.white,
    margin:4, padding:10, borderRadius:10, gap:6},
  contactName: {flex:1, fontSize:14, color:C.text, textAlign:'right'},
  emptyText: {textAlign:'center', color:C.text, fontSize:16, padding:40},
  bubbleRow: {marginVertical:3, flexDirection:'row'},
  bubbleRowRight: {justifyContent:'flex-end'},
  bubbleRowLeft: {justifyContent:'flex-start'},
  bubble: {maxWidth:'75%', padding:10, borderRadius:12},
  bubbleSender: {fontSize:12, fontWeight:'bold', color:C.text, textAlign:'right'},
  bubbleText: {fontSize:14, color:C.text, textAlign:'right'},
  bubbleMeta: {fontSize:11, color:'#666', textAlign:'right', marginTop:3},
  replyText: {fontSize:12, color:'#0064C8', borderLeftWidth:3, borderLeftColor:'#0064C8',
    paddingLeft:6, marginBottom:4, textAlign:'right'},
  replyBar: {flexDirection:'row', backgroundColor:'#E3F2FD', padding:8, alignItems:'center'},
  replyBarText: {flex:1, color:'#0064C8', textAlign:'right'},
  replyBarClose: {fontSize:18, color:C.btnCancel, paddingHorizontal:8},
  inputRow: {backgroundColor:C.white, padding:8, borderTopWidth:1, borderTopColor:'#eee'},
  msgInput: {backgroundColor:C.white, borderRadius:8, padding:10, fontSize:16, minHeight:44, maxHeight:100},
  btnBar: {flexDirection:'row', backgroundColor:C.barBg, padding:8, gap:10, justifyContent:'center'},
  barBtn: {padding:12, borderRadius:8, minWidth:60, alignItems:'center'},
  barBtnText: {color:C.white, fontSize:20, fontWeight:'bold'},
  backBtn: {paddingRight:10},
  backBtnText: {fontSize:20, color:C.btnEmoji},
});
