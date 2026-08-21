import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ScrollView, KeyboardAvoidingView,
  Platform, I18nManager, ActivityIndicator, SafeAreaView,
  Image, Linking, AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Text as RNText } from 'react-native';

I18nManager.forceRTL(true);

const FIREBASE_URL = "https://bariq-ce6b4-default-rtdb.firebaseio.com";
const FIREBASE_KEY = "AIzaSyDhEo61jzd-npwhhw-Vf1R8fLWttJbJib8";
const ADMIN_ID = "53710624";

// ==================== تسجيل الخط ====================
import { Platform as RNPlatform } from 'react-native';
let FONT = 'System';
try {
  const { default: RNFontLoader } = require('react-native-asset');
} catch {}

// نستخدم الخط مباشرة
const FONT_FAMILY = Platform.OS === 'android' ? 'Amiri-Regular' : 'System';

const C = {
  bg: '#F0F4FF',
  myMsg: '#DCF8C6',
  otherMsg: '#FFFFFF',
  headerBg: '#1565C0',
  btnSend: '#4CAF50',
  btnEmoji: '#2196F3',
  btnCancel: '#F44336',
  text: '#191919',
  white: '#FFFFFF',
  gray: '#999',
  linkColor: '#1565C0',
};

const EMOJIS = ['😀','😂','😍','😢','😮','😎','❤️','👍','👎','🙏','🎉','🔥','✅','❌','⭐','😊','😴','🤔','🌹','💪','😅','🤣','😇','🥰','😘','😜','🤩','😭','😱','🤯','💯','🎊','🎈','🌟','💫','⚡','🌈','🎯','🙌'];

const generateId = () => { let id=''; for(let i=0;i<8;i++) id+=Math.floor(Math.random()*10); return id; };
const formatTime = (ts) => { if(!ts) return ''; const d=new Date(ts*1000); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); };
const statusLabel = (s) => s==='read'?'✓✓':s==='received'?'✓✓':'✓';
const statusColor = (s) => s==='read'?'#4FC3F7':'#999';
const isImageFile = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name||'');
const isAudioFile = (name) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(name||'');
const isVideoFile = (name) => /\.(mp4|mkv|avi|mov|webm|3gp)$/i.test(name||'');
const getMimeType = (filename) => { if(!filename) return 'image/jpeg'; const ext=filename.split('.').pop().toLowerCase(); return {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp'}[ext]||'image/jpeg'; };
const extractUrls = (text) => { const r=/(https?:\/\/[^\s]+)/g; return text?text.match(r)||[]:[];};

const fbSend = async (toId, payload) => {
  try {
    const r = await fetch(`${FIREBASE_URL}/messages/${toId}.json?auth=${FIREBASE_KEY}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    });
    const d = await r.json();
    return d.name||null;
  } catch { return null; }
};

const fbGet = async (uid) => {
  try {
    const r = await fetch(`${FIREBASE_URL}/messages/${uid}.json?auth=${FIREBASE_KEY}`);
    const d = await r.json();
    return (d&&typeof d==='object')?d:{};
  } catch { return {}; }
};

const fbDel = async (uid, key) => {
  try { await fetch(`${FIREBASE_URL}/messages/${uid}/${key}.json?auth=${FIREBASE_KEY}`,{method:'DELETE'}); } catch {}
};

const notifyStatus = async (toId, key, status, fromId) => {
  try {
    await fetch(`${FIREBASE_URL}/status/${toId}/${key}.json?auth=${FIREBASE_KEY}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status,from:fromId})
    });
  } catch {}
};

const getMsgStatus = async (uid, key) => {
  try {
    const r = await fetch(`${FIREBASE_URL}/status/${uid}/${key}.json?auth=${FIREBASE_KEY}`);
    const d = await r.json();
    return (d&&d.status)?d.status:'';
  } catch { return ''; }
};

let channelCreated = false;
const setupNotifications = async () => {
  if(channelCreated) return;
  try {
    await notifee.requestPermission();
    await notifee.createChannel({id:'bariq_messages',name:'رسائل بارق',importance:AndroidImportance.HIGH,sound:'default',vibration:true});
    channelCreated = true;
  } catch {}
};

const showNotification = async (title, body) => {
  try {
    await notifee.displayNotification({
      title, body,
      android:{channelId:'bariq_messages',importance:AndroidImportance.HIGH,smallIcon:'ic_launcher',pressAction:{id:'default'}},
    });
  } catch {}
};

// ==================== شاشة الترحيب ====================
const WelcomeScreen = ({onLogin}) => {
  const [inputId, setInputId] = useState('');

  const createAccount = async () => {
    const newId = generateId();
    await AsyncStorage.setItem('my_id', newId);
    await AsyncStorage.setItem('contacts', JSON.stringify({}));
    Alert.alert('تم إنشاء حسابك', `رقمك الجديد:\n${newId}\n\nاحتفظ بهذا الرقم!`, [{text:'انطلق!',onPress:()=>onLogin(newId)}]);
  };

  const login = async () => {
    const trimmed = inputId.trim();
    if(trimmed.length===8&&/^\d+$/.test(trimmed)) {
      await AsyncStorage.setItem('my_id',trimmed);
      const contacts = await AsyncStorage.getItem('contacts');
      if(!contacts) await AsyncStorage.setItem('contacts',JSON.stringify({}));
      onLogin(trimmed);
    } else { Alert.alert('خطأ','الرقم يجب أن يكون 8 أرقام'); }
  };

  return (
    <SafeAreaView style={[styles.flex1,{backgroundColor:C.bg}]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={styles.welcomeContainer}>
          <Image source={require('./logo.png')} style={styles.logo} resizeMode="contain"/>
          <Text style={[styles.appTitle,{fontFamily:FONT_FAMILY}]}>بارق</Text>
          <Text style={[styles.appSubtitle,{fontFamily:FONT_FAMILY}]}>تطبيق المراسلة الآمن</Text>
          <TouchableOpacity style={[styles.btn,{backgroundColor:C.btnSend}]} onPress={createAccount}>
            <Text style={[styles.btnText,{fontFamily:FONT_FAMILY}]}>إنشاء رقم جديد</Text>
          </TouchableOpacity>
          <Text style={[styles.orText,{fontFamily:FONT_FAMILY}]}>أو أدخل رقمك الموجود:</Text>
          <TextInput style={[styles.input,{fontFamily:FONT_FAMILY}]} placeholder="8 أرقام" keyboardType="numeric" maxLength={8} value={inputId} onChangeText={setInputId} textAlign="center"/>
          <TouchableOpacity style={[styles.btn,{backgroundColor:C.btnEmoji}]} onPress={login}>
            <Text style={[styles.btnText,{fontFamily:FONT_FAMILY}]}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==================== شاشة الرئيسية ====================
const HomeScreen = ({myId, onOpenChat}) => {
  const [contacts, setContacts] = useState({});
  const [contactNames, setContactNames] = useState({});
  const [newContact, setNewContact] = useState('');
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const listenerRef = useRef(null);
  const seenKeysRef = useRef(new Set());

  useEffect(() => {
    setupNotifications();
    loadContacts();
    startListener();
    return () => { if(listenerRef.current) clearInterval(listenerRef.current); };
  }, []);

  const loadContacts = async () => {
    const c = await AsyncStorage.getItem('contacts');
    const n = await AsyncStorage.getItem('contact_names');
    const p = await AsyncStorage.getItem('pending');
    const seen = await AsyncStorage.getItem('seen_keys');
    setContacts(c?JSON.parse(c):{});
    setContactNames(n?JSON.parse(n):{});
    setPending(p?JSON.parse(p):{});
    if(seen) JSON.parse(seen).forEach(k=>seenKeysRef.current.add(k));
  };

  const startListener = () => {
    listenerRef.current = setInterval(async () => {
      try {
        const incoming = await fbGet(myId);
        let changed = false;
        const savedP = await AsyncStorage.getItem('pending');
        const allP = savedP?JSON.parse(savedP):{};
        const savedNames = await AsyncStorage.getItem('contact_names');
        const names = savedNames?JSON.parse(savedNames):{};
        for(const [key,msg] of Object.entries(incoming)) {
          if(!seenKeysRef.current.has(key)&&msg&&typeof msg==='object') {
            seenKeysRef.current.add(key);
            const sid = msg.from||'';
            if(!allP[sid]) allP[sid]=[];
            allP[sid].push({key,msg});
            changed = true;
            const senderName = names[sid]||`رقم ${sid}`;
            const body = msg.type==='file'?`📎 ${msg.filename||'ملف'}`:(msg.text||'');
            await showNotification(`رسالة من ${senderName}`,body);
          }
        }
        if(changed) {
          await AsyncStorage.setItem('pending',JSON.stringify(allP));
          await AsyncStorage.setItem('seen_keys',JSON.stringify([...seenKeysRef.current].slice(-500)));
          setPending({...allP});
        }
      } catch {}
    }, 15000);
  };

  const addContact = async () => {
    const cid = newContact.trim();
    if(cid.length===8&&/^\d+$/.test(cid)) {
      if(cid===myId){Alert.alert('تنبيه','لا يمكنك إضافة رقمك الخاص');return;}
      const name = newName.trim()||cid;
      const updatedC = {...contacts,[cid]:cid};
      const updatedN = {...contactNames,[cid]:name};
      setContacts(updatedC); setContactNames(updatedN);
      await AsyncStorage.setItem('contacts',JSON.stringify(updatedC));
      await AsyncStorage.setItem('contact_names',JSON.stringify(updatedN));
      setNewContact(''); setNewName(''); setShowAddForm(false);
    } else { Alert.alert('خطأ','الرقم يجب أن يكون 8 أرقام'); }
  };

  const deleteContact = async (cid) => {
    Alert.alert('حذف','هل تريد حذف جهة الاتصال؟',[
      {text:'إلغاء',style:'cancel'},
      {text:'حذف',style:'destructive',onPress:async()=>{
        const updatedC={...contacts}; const updatedN={...contactNames};
        delete updatedC[cid]; delete updatedN[cid];
        setContacts(updatedC); setContactNames(updatedN);
        await AsyncStorage.setItem('contacts',JSON.stringify(updatedC));
        await AsyncStorage.setItem('contact_names',JSON.stringify(updatedN));
      }}
    ]);
  };

  const openChat = async (cid) => {
    const p = pending[cid]||[];
    const newP = {...pending}; delete newP[cid];
    setPending(newP);
    await AsyncStorage.setItem('pending',JSON.stringify(newP));
    onOpenChat(cid,contactNames[cid]||cid,p);
  };

  return (
    <SafeAreaView style={[styles.flex1,{backgroundColor:C.bg}]}>
      <View style={styles.mainHeader}>
        <Image source={require('./logo.png')} style={styles.headerLogo} resizeMode="contain"/>
        <Text style={[styles.mainHeaderText,{fontFamily:FONT_FAMILY}]}>بارق</Text>
        <TouchableOpacity onPress={()=>setShowAddForm(!showAddForm)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {showAddForm&&(
        <View style={styles.addForm}>
          <TextInput style={[styles.input,{marginBottom:8,fontFamily:FONT_FAMILY}]} placeholder="رقم جهة الاتصال (8 أرقام)" keyboardType="numeric" maxLength={8} value={newContact} onChangeText={setNewContact} textAlign="right"/>
          <TextInput style={[styles.input,{marginBottom:8,fontFamily:FONT_FAMILY}]} placeholder="الاسم (اختياري)" value={newName} onChangeText={setNewName} textAlign="right"/>
          <View style={{flexDirection:'row',gap:8}}>
            <TouchableOpacity style={[styles.btn,{flex:1,backgroundColor:C.btnSend}]} onPress={addContact}>
              <Text style={[styles.btnText,{fontFamily:FONT_FAMILY}]}>إضافة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn,{flex:1,backgroundColor:C.btnCancel}]} onPress={()=>setShowAddForm(false)}>
              <Text style={[styles.btnText,{fontFamily:FONT_FAMILY}]}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={[styles.myIdText,{fontFamily:FONT_FAMILY}]}>رقمك: {myId}</Text>

      <FlatList
        data={Object.entries(contacts)}
        keyExtractor={([cid])=>cid}
        renderItem={({item:[cid]})=>{
          const pCount=(pending[cid]||[]).length;
          const name=contactNames[cid]||cid;
          return (
            <TouchableOpacity style={styles.contactRow} onPress={()=>openChat(cid)} onLongPress={()=>deleteContact(cid)}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{name.charAt(0)}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName,{fontFamily:FONT_FAMILY}]}>{name}</Text>
                <Text style={[styles.contactId,{fontFamily:FONT_FAMILY}]}>{cid}</Text>
              </View>
              {pCount>0&&<View style={styles.badge}><Text style={styles.badgeText}>{pCount}</Text></View>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText,{fontFamily:FONT_FAMILY}]}>لا توجد جهات اتصال</Text>
            <Text style={[styles.emptySubText,{fontFamily:FONT_FAMILY}]}>اضغط + لإضافة جهة اتصال</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// ==================== شاشة المحادثة ====================
const ChatScreen = ({myId,contactId,contactName,pendingMsgs,onBack}) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const seenKeys = useRef(new Set());
  const listenerRef = useRef(null);
  const msgsRef = useRef([]);

  useEffect(()=>{
    loadMessages();
    return ()=>{ if(listenerRef.current) clearInterval(listenerRef.current); };
  },[]);

  useEffect(()=>{
    msgsRef.current=messages;
    if(messages.length>0) setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),150);
  },[messages]);

  const loadMessages = async () => {
    const key=[myId,contactId].sort().join('_');
    const saved=await AsyncStorage.getItem('chat_'+key);
    const msgs=saved?JSON.parse(saved):[];
    msgsRef.current=msgs; setMessages(msgs);
    msgs.forEach(m=>{if(m.key)seenKeys.current.add(m.key);});
    if(pendingMsgs&&pendingMsgs.length>0) {
      let current=[...msgs];
      for(const {key:k,msg} of pendingMsgs) {
        if(!seenKeys.current.has(k)){seenKeys.current.add(k);current=await processIncoming(k,msg,current);}
      }
    }
    startPolling();
  };

  const saveMessages = async (msgs) => {
    const key=[myId,contactId].sort().join('_');
    const cutoff=Date.now()/1000-7*86400;
    const filtered=msgs.filter(m=>(m.time||0)>cutoff);
    await AsyncStorage.setItem('chat_'+key,JSON.stringify(filtered));
    return filtered;
  };

  const processIncoming = async (k,msg,currentMsgs) => {
    await notifyStatus(msg.from||'',k,'received',myId);
    const lm={
      from:msg.from||'',text:msg.text||'',type:msg.type||'text',
      filename:msg.filename||'',fileData:msg.fileData||'',
      mimeType:msg.mimeType||getMimeType(msg.filename),
      time:msg.time||Math.floor(Date.now()/1000),key:k,replyTo:msg.reply_to||null,
    };
    const updated=[...currentMsgs,lm];
    const filtered=await saveMessages(updated);
    setMessages([...filtered]); msgsRef.current=filtered;
    await fbDel(myId,k);
    return updated;
  };

  const startPolling = () => {
    listenerRef.current=setInterval(async()=>{
      try {
        const incoming=await fbGet(myId);
        for(const [k,msg] of Object.entries(incoming)) {
          if(!seenKeys.current.has(k)&&msg&&typeof msg==='object'&&msg.from===contactId) {
            seenKeys.current.add(k);
            await processIncoming(k,msg,msgsRef.current);
          }
        }
        const current=[...msgsRef.current];
        let updated=false;
        for(let i=0;i<current.length;i++) {
          const m=current[i];
          if(m.from===myId&&m.key&&m.deliveryStatus!=='read') {
            const ns=await getMsgStatus(myId,m.key);
            const order={sent:0,received:1,read:2};
            if(ns&&(order[ns]||0)>(order[m.deliveryStatus||'sent']||0)){current[i]={...m,deliveryStatus:ns};updated=true;}
          }
        }
        if(updated){msgsRef.current=current;setMessages([...current]);await saveMessages(current);}
      } catch {}
    },15000);
  };

  const sendMessage = async () => {
    const trimmed=text.trim();
    if(!trimmed||sending) return;
    setSending(true);
    const now=Math.floor(Date.now()/1000);
    const payload={from:myId,text:trimmed,type:'text',time:now,delivery_status:'sent',...(replyTo?{reply_to:replyTo.text||String(replyTo)}:{})};
    const lm={from:myId,text:trimmed,type:'text',time:now,deliveryStatus:'sent',key:'',replyTo:replyTo?(replyTo.text||String(replyTo)):null};
    const updated=[...msgsRef.current,lm];
    msgsRef.current=updated; setMessages([...updated]);
    await saveMessages(updated);
    setText(''); setReplyTo(null); setShowEmoji(false);
    const key=await fbSend(contactId,payload);
    if(key) {
      const newMsgs=[...msgsRef.current];
      const idx=newMsgs.length-1;
      if(newMsgs[idx]){newMsgs[idx]={...newMsgs[idx],key};msgsRef.current=newMsgs;setMessages([...newMsgs]);await saveMessages(newMsgs);}
    }
    setSending(false);
  };

  const pickImage = async () => {
    try {
      const result=await launchImageLibrary({mediaType:'mixed',includeBase64:true,quality:0.7});
      if(result.assets&&result.assets[0]) {
        const asset=result.assets[0];
        const filename=asset.fileName||`image_${Date.now()}.jpg`;
        const mimeType=asset.type||getMimeType(filename);
        const now=Math.floor(Date.now()/1000);
        const payload={from:myId,type:'file',filename,fileData:asset.base64,mimeType,time:now,delivery_status:'sent'};
        const lm={from:myId,type:'file',filename,fileData:asset.base64,mimeType,time:now,deliveryStatus:'sent',key:''};
        const updated=[...msgsRef.current,lm];
        msgsRef.current=updated; setMessages([...updated]);
        await saveMessages(updated);
        const key=await fbSend(contactId,payload);
        if(key){const newMsgs=[...msgsRef.current];const idx=newMsgs.length-1;if(newMsgs[idx]){newMsgs[idx]={...newMsgs[idx],key};msgsRef.current=newMsgs;setMessages([...newMsgs]);await saveMessages(newMsgs);}}
      }
    } catch {Alert.alert('خطأ','تعذر اختيار الملف');}
  };

  const showOptions = (idx) => {
    const msg=messages[idx];
    const opts=[
      {text:'الرد',onPress:()=>setReplyTo(msg)},
      {text:'نسخ',onPress:()=>Alert.alert('تم النسخ',msg.text||msg.filename)},
      {text:'إلغاء',style:'cancel'},
    ];
    if(msg.from===myId) opts.splice(2,0,{text:'حذف',style:'destructive',onPress:async()=>{
      const updated=messages.filter((_,i)=>i!==idx);
      msgsRef.current=updated; setMessages(updated); await saveMessages(updated);
    }});
    Alert.alert('خيارات الرسالة','',opts);
  };

  const renderTextWithLinks = (txt) => {
    if(!txt) return null;
    const urls=extractUrls(txt);
    if(urls.length===0) return <Text style={[styles.bubbleText,{fontFamily:FONT_FAMILY}]}>{txt}</Text>;
    const parts=txt.split(/(https?:\/\/[^\s]+)/g);
    return (
      <Text style={[styles.bubbleText,{fontFamily:FONT_FAMILY}]}>
        {parts.map((part,i)=>urls.includes(part)?<Text key={i} style={styles.linkText} onPress={()=>Linking.openURL(part)}>{part}</Text>:part)}
      </Text>
    );
  };

  const renderBubble = ({item,index}) => {
    const isMine=item.from===myId;
    const time=formatTime(item.time);
    const isImg=isImageFile(item.filename);
    const mime=item.mimeType||getMimeType(item.filename);
    return (
      <TouchableOpacity onLongPress={()=>showOptions(index)} delayLongPress={500} activeOpacity={0.8}>
        <View style={[styles.bubbleRow,isMine?styles.bubbleRowRight:styles.bubbleRowLeft]}>
          <View style={[styles.bubble,{backgroundColor:isMine?C.myMsg:C.otherMsg},!isMine&&styles.bubbleShadow]}>
            {item.replyTo&&<View style={styles.replyPreview}><Text style={[styles.replyPreviewText,{fontFamily:FONT_FAMILY}]} numberOfLines={1}>↩ {String(item.replyTo).slice(0,40)}</Text></View>}
            {item.type==='file'&&isImg&&item.fileData
              ?<Image source={{uri:`data:${mime};base64,${item.fileData}`}} style={styles.msgImage} resizeMode="cover"/>
              :item.type==='file'
                ?<View style={styles.fileContainer}><Text style={styles.fileIcon}>{isAudioFile(item.filename)?'🎵':isVideoFile(item.filename)?'🎬':'📎'}</Text><Text style={[styles.fileName,{fontFamily:FONT_FAMILY}]}>{item.filename}</Text></View>
                :renderTextWithLinks(item.text)
            }
            <View style={styles.bubbleFooter}>
              <Text style={styles.bubbleTime}>{time}</Text>
              {isMine&&<Text style={[styles.statusTick,{color:statusColor(item.deliveryStatus)}]}>{statusLabel(item.deliveryStatus)}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.flex1,{backgroundColor:'#ECE5DD'}]}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>◀</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderAvatar}>
          <Text style={styles.chatHeaderAvatarText}>{contactName.charAt(0)}</Text>
        </View>
        <Text style={[styles.chatHeaderName,{fontFamily:FONT_FAMILY}]}>{contactName}</Text>
      </View>

      <FlatList
        ref={scrollRef}
        data={messages}
        keyExtractor={(_,i)=>i.toString()}
        renderItem={renderBubble}
        contentContainerStyle={{padding:8,paddingBottom:16}}
        onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:false})}
      />

      {replyTo&&(
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={[styles.replyBarLabel,{fontFamily:FONT_FAMILY}]}>رد على:</Text>
            <Text style={[styles.replyBarText,{fontFamily:FONT_FAMILY}]} numberOfLines={1}>{String(replyTo.text||replyTo.filename||'').slice(0,50)}</Text>
          </View>
          <TouchableOpacity onPress={()=>setReplyTo(null)}><Text style={styles.replyBarClose}>✕</Text></TouchableOpacity>
        </View>
      )}

      {showEmoji&&(
        <View style={styles.emojiPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((em,i)=>(
                <TouchableOpacity key={i} onPress={()=>setText(t=>t+em)}>
                  <Text style={styles.emojiItem}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={styles.inputArea}>
          <TouchableOpacity onPress={()=>setShowEmoji(!showEmoji)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>😊</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.msgInput,{fontFamily:FONT_FAMILY}]}
            placeholder="اكتب رسالتك..."
            value={text}
            onChangeText={setText}
            multiline={true}
            textAlign="right"
          />
          <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>📎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn,{backgroundColor:text.trim()?C.btnSend:C.gray}]}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.sendBtnText}>➤</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default function App() {
  const [myId, setMyId] = useState(null);
  const [screen, setScreen] = useState('loading');
  const [chatInfo, setChatInfo] = useState(null);

  useEffect(()=>{
    AsyncStorage.getItem('my_id').then(id=>{setMyId(id);setScreen(id?'home':'welcome');});
  },[]);

  const handleLogin=(id)=>{setMyId(id);setScreen('home');};
  const openChat=(cid,cname,pendingMsgs)=>{setChatInfo({cid,cname,pendingMsgs});setScreen('chat');};

  if(screen==='loading') return <View style={[styles.flex1,styles.center]}><ActivityIndicator size="large" color={C.headerBg}/></View>;
  if(screen==='welcome') return <WelcomeScreen onLogin={handleLogin}/>;
  if(screen==='chat'&&chatInfo) return <ChatScreen myId={myId} contactId={chatInfo.cid} contactName={chatInfo.cname} pendingMsgs={chatInfo.pendingMsgs} onBack={()=>setScreen('home')}/>;
  return <HomeScreen myId={myId} onOpenChat={openChat}/>;
}

const styles = StyleSheet.create({
  flex1:{flex:1},
  center:{justifyContent:'center',alignItems:'center'},
  welcomeContainer:{flexGrow:1,justifyContent:'center',padding:30,alignItems:'center',gap:12},
  logo:{width:120,height:120,marginBottom:10},
  appTitle:{fontSize:42,fontWeight:'bold',color:C.headerBg},
  appSubtitle:{fontSize:16,color:C.gray,marginBottom:10},
  btn:{width:'100%',padding:14,borderRadius:10,alignItems:'center'},
  btnText:{color:C.white,fontSize:16,fontWeight:'bold'},
  orText:{color:C.gray,fontSize:14},
  input:{width:'100%',borderWidth:1,borderColor:'#ddd',borderRadius:10,padding:12,fontSize:16,backgroundColor:C.white},
  mainHeader:{backgroundColor:C.headerBg,flexDirection:'row',alignItems:'center',padding:12,gap:10},
  headerLogo:{width:36,height:36},
  mainHeaderText:{color:C.white,fontSize:20,fontWeight:'bold',flex:1},
  addBtn:{width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  addBtnText:{color:C.white,fontSize:24,fontWeight:'bold'},
  addForm:{backgroundColor:C.white,padding:12,borderBottomWidth:1,borderBottomColor:'#eee'},
  myIdText:{textAlign:'center',color:C.gray,fontSize:12,padding:6,backgroundColor:'#f0f0f0'},
  contactRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.white,paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#f0f0f0',gap:12},
  contactAvatar:{width:48,height:48,borderRadius:24,backgroundColor:C.headerBg,alignItems:'center',justifyContent:'center'},
  contactAvatarText:{color:C.white,fontSize:20,fontWeight:'bold'},
  contactInfo:{flex:1},
  contactName:{fontSize:16,fontWeight:'bold',color:C.text},
  contactId:{fontSize:12,color:C.gray},
  badge:{backgroundColor:C.btnSend,borderRadius:12,minWidth:24,height:24,alignItems:'center',justifyContent:'center',paddingHorizontal:6},
  badgeText:{color:C.white,fontSize:12,fontWeight:'bold'},
  emptyContainer:{alignItems:'center',justifyContent:'center',padding:40},
  emptyText:{fontSize:18,color:C.gray,fontWeight:'bold'},
  emptySubText:{fontSize:14,color:C.gray,marginTop:8},
  chatHeader:{backgroundColor:C.headerBg,flexDirection:'row',alignItems:'center',padding:12,gap:10},
  chatHeaderAvatar:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,255,255,0.3)',alignItems:'center',justifyContent:'center'},
  chatHeaderAvatarText:{color:C.white,fontSize:18,fontWeight:'bold'},
  chatHeaderName:{color:C.white,fontSize:18,fontWeight:'bold',flex:1},
  backBtn:{padding:4},
  backBtnText:{color:C.white,fontSize:22},
  bubbleRow:{marginVertical:2,flexDirection:'row'},
  bubbleRowRight:{justifyContent:'flex-end',paddingLeft:60},
  bubbleRowLeft:{justifyContent:'flex-start',paddingRight:60},
  bubble:{maxWidth:'85%',padding:8,borderRadius:12,paddingBottom:4},
  bubbleShadow:{elevation:1,shadowColor:'#000',shadowOpacity:0.1,shadowRadius:2},
  bubbleText:{fontSize:15,color:C.text,lineHeight:22},
  linkText:{color:C.linkColor,textDecorationLine:'underline'},
  bubbleFooter:{flexDirection:'row',justifyContent:'flex-end',alignItems:'center',gap:4,marginTop:2},
  bubbleTime:{fontSize:11,color:C.gray},
  statusTick:{fontSize:13,fontWeight:'bold'},
  replyPreview:{borderLeftWidth:3,borderLeftColor:C.headerBg,paddingLeft:6,marginBottom:6,backgroundColor:'rgba(0,0,0,0.05)',borderRadius:4,padding:4},
  replyPreviewText:{fontSize:12,color:C.headerBg},
  msgImage:{width:200,height:200,borderRadius:8,marginBottom:4},
  fileContainer:{flexDirection:'row',alignItems:'center',gap:8,padding:4},
  fileIcon:{fontSize:24},
  fileName:{fontSize:13,color:C.text,flex:1},
  replyBar:{flexDirection:'row',backgroundColor:'#E3F2FD',padding:10,alignItems:'center',borderTopWidth:1,borderTopColor:'#ddd'},
  replyBarContent:{flex:1},
  replyBarLabel:{fontSize:12,color:C.headerBg,fontWeight:'bold'},
  replyBarText:{fontSize:13,color:C.text},
  replyBarClose:{fontSize:20,color:C.btnCancel,paddingHorizontal:10},
  emojiPanel:{backgroundColor:C.white,borderTopWidth:1,borderTopColor:'#eee',padding:8,height:80},
  emojiGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  emojiItem:{fontSize:28,padding:4},
  inputArea:{flexDirection:'row',alignItems:'flex-end',backgroundColor:C.white,padding:8,gap:6,borderTopWidth:1,borderTopColor:'#eee'},
  iconBtn:{padding:8},
  iconBtnText:{fontSize:24},
  msgInput:{flex:1,backgroundColor:'#f5f5f5',borderRadius:20,paddingHorizontal:14,paddingVertical:8,fontSize:15,maxHeight:120,minHeight:44},
  sendBtn:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
  sendBtnText:{color:C.white,fontSize:20},
  gray:{color:C.gray},
});
