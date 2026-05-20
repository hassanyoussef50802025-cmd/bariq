# -*- coding: utf-8 -*-
import os
import sys

APP_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, APP_DIR)

from kivy.app import App
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.textinput import TextInput
from kivy.uix.popup import Popup
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.widget import Widget
from kivy.graphics import Color, RoundedRectangle, Rectangle
from kivy.core.window import Window
from kivy.clock import Clock
from kivy.metrics import dp, sp
from kivy.utils import get_color_from_hex
from kivy.core.clipboard import Clipboard
import random, string, json, threading, time, base64, re, requests

FIREBASE_URL = "https://bariq-ce6b4-default-rtdb.firebaseio.com"
FIREBASE_KEY = "AIzaSyDhEo61jzd-npwhhw-Vf1R8fLWttJbJib8"
ADMIN_ID = "53710624"

try:
    from android.storage import app_storage_path
    APP_DIR = app_storage_path()
except:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_FILE = os.path.join(APP_DIR, 'data.json')
MESSAGES_DIR = os.path.join(APP_DIR, 'messages')
FILES_DIR = os.path.join(APP_DIR, 'files')
PENDING_FILE = os.path.join(APP_DIR, 'pending.json')

for d in [MESSAGES_DIR, FILES_DIR]:
    os.makedirs(d, exist_ok=True)

C_BG = get_color_from_hex('#F0F4FF')
C_CHAT_BG = get_color_from_hex('#FFFFFF')
C_MY_MSG = get_color_from_hex('#D2D2D2')
C_OTHER_MSG = get_color_from_hex('#F5EBD2')
C_HEADER_BG = get_color_from_hex('#FFFFFF')
C_HEADER_BOR = get_color_from_hex('#FFD700')
C_BTN_SEND = get_color_from_hex('#4CAF50')
C_BTN_EMOJI = get_color_from_hex('#2196F3')
C_BTN_FILE = get_color_from_hex('#9E9E9E')
C_BTN_CANCEL = get_color_from_hex('#F44336')
C_BAR_BG = get_color_from_hex('#1565C0')
C_TEXT = get_color_from_hex('#191919')
C_WHITE = get_color_from_hex('#FFFFFF')

def generate_id(): return ''.join(random.choices(string.digits, k=8))
def format_time(ts):
    try: return time.strftime("%H:%M", time.localtime(ts))
    except: return ""
def status_label(s): return " vvv" if s=="read" else (" vv" if s=="received" else " v")
def status_text(s): return "مقروءة" if s=="read" else ("مستلمة" if s=="received" else "مرسلة")

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE,'r',encoding='utf-8') as f: return json.load(f)
    return {"my_id":None,"contacts":{},"blocked":[]}

def save_data(d):
    with open(DATA_FILE,'w',encoding='utf-8') as f: json.dump(d,f,ensure_ascii=False,indent=2)

def load_pending():
    if os.path.exists(PENDING_FILE):
        with open(PENDING_FILE,'r',encoding='utf-8') as f: return json.load(f)
    return {}

def save_pending(p):
    with open(PENDING_FILE,'w',encoding='utf-8') as f: json.dump(p,f,ensure_ascii=False,indent=2)

def get_chat_file(a,b):
    ids=sorted([a,b]); return os.path.join(MESSAGES_DIR,ids[0]+"_"+ids[1]+".json")

def load_chat(a,b):
    f=get_chat_file(a,b)
    if os.path.exists(f):
        with open(f,'r',encoding='utf-8') as fp: return json.load(fp)
    return []

def save_chat(a,b,msgs):
    f=get_chat_file(a,b); cut=int(time.time())-(7*86400)
    msgs=[m for m in msgs if m.get("time",0)>cut]
    with open(f,'w',encoding='utf-8') as fp: json.dump(msgs,fp,ensure_ascii=False,indent=2)

def fb_send(to,pay):
    try:
        r=requests.post(FIREBASE_URL+"/messages/"+to+".json?auth="+FIREBASE_KEY,json=pay,timeout=15)
        if r.status_code==200: return r.json().get("name")
    except: pass
    return None

def fb_get(uid):
    try:
        r=requests.get(FIREBASE_URL+"/messages/"+uid+".json?auth="+FIREBASE_KEY,timeout=10)
        if r.status_code==200 and r.text!="null":
            d=r.json()
            if d and isinstance(d,dict): return d
    except: pass
    return {}

def fb_del(uid,key):
    try: requests.delete(FIREBASE_URL+"/messages/"+uid+"/"+key+".json?auth="+FIREBASE_KEY,timeout=10)
    except: pass

def fb_clear():
    try:
        r=requests.delete(FIREBASE_URL+"/messages.json?auth="+FIREBASE_KEY,timeout=15)
        return r.status_code==200
    except: return False

def notify_status(to,key,status,frm):
    try: requests.put(FIREBASE_URL+"/status/"+to+"/"+key+".json?auth="+FIREBASE_KEY,json={"status":status,"from":frm},timeout=10)
    except: pass

def get_msg_status(uid,key):
    try:
        r=requests.get(FIREBASE_URL+"/status/"+uid+"/"+key+".json?auth="+FIREBASE_KEY,timeout=5)
        if r.status_code==200 and r.text!="null":
            d=r.json()
            if d and isinstance(d,dict): return d.get("status","")
    except: pass
    return ""

class BariqApp(App):
    def build(self):
        self.data=load_data()
        Window.clearcolor=C_BG
        sm=ScreenManager()
        sm.add_widget(WelcomeScreen(name='welcome'))
        sm.add_widget(HomeScreen(name='home'))
        sm.current='home' if self.data.get('my_id') else 'welcome'
        return sm

class WelcomeScreen(Screen):
    def __init__(self,**kw):
        super().__init__(**kw)
        root=BoxLayout(orientation='vertical',padding=dp(30),spacing=dp(20))
        with root.canvas.before:
            Color(*C_BG); self._bg=Rectangle(pos=root.pos,size=root.size)
        root.bind(pos=lambda i,v:setattr(self._bg,'pos',v),size=lambda i,v:setattr(self._bg,'size',v))
        root.add_widget(Label(text='بارق',font_size=sp(42),bold=True,color=C_TEXT,size_hint_y=None,height=dp(80)))
        root.add_widget(Label(text='تطبيق المراسلة الآمن',font_size=sp(18),color=C_TEXT,size_hint_y=None,height=dp(40)))
        root.add_widget(Widget())
        b1=Button(text='إنشاء رقم جديد',font_size=sp(18),size_hint=(1,None),height=dp(55),background_color=C_BTN_SEND,background_normal='')
        b1.bind(on_press=self.create_account); root.add_widget(b1)
        root.add_widget(Label(text='أو أدخل رقمك:',font_size=sp(16),color=C_TEXT,size_hint_y=None,height=dp(35)))
        self.entry=TextInput(hint_text='8 أرقام',font_size=sp(18),size_hint=(1,None),height=dp(50),halign='center',multiline=False,input_filter='int')
        root.add_widget(self.entry)
        b2=Button(text='تسجيل الدخول',font_size=sp(18),size_hint=(1,None),height=dp(55),background_color=C_BTN_EMOJI,background_normal='')
        b2.bind(on_press=self.login); root.add_widget(b2)
        root.add_widget(Widget()); self.add_widget(root)

    def create_account(self,*a):
        nid=generate_id(); d=load_data(); d['my_id']=nid; save_data(d)
        c=BoxLayout(orientation='vertical',padding=dp(20),spacing=dp(10))
        c.add_widget(Label(text='رقمك الجديد:',font_size=sp(16),color=C_TEXT))
        c.add_widget(Label(text=nid,font_size=sp(36),bold=True,color=C_TEXT))
        pop=Popup(title='تم إنشاء حسابك',content=c,size_hint=(0.85,0.45))
        bc=Button(text='نسخ',size_hint=(1,None),height=dp(45),background_color=C_BTN_SEND,background_normal='')
        bc.bind(on_press=lambda x:Clipboard.copy(nid)); c.add_widget(bc)
        bo=Button(text='انطلق!',size_hint=(1,None),height=dp(45),background_color=C_BTN_EMOJI,background_normal='')
        def go(x): pop.dismiss(); App.get_running_app().data=load_data(); self.manager.transition=SlideTransition(direction='left'); self.manager.current='home'
        bo.bind(on_press=go); c.add_widget(bo); pop.open()

    def login(self,*a):
        e=self.entry.text.strip()
        if len(e)==8 and e.isdigit():
            d=load_data(); d['my_id']=e; save_data(d); App.get_running_app().data=d
            self.manager.transition=SlideTransition(direction='left'); self.manager.current='home'
        else: Popup(title='خطأ',content=Label(text='8 أرقام مطلوبة',color=C_TEXT),size_hint=(0.8,0.3)).open()

class HomeScreen(Screen):
    def __init__(self,**kw):
        super().__init__(**kw); self.pending_msgs={}; self.bg_listener=None

    def on_enter(self):
        self.data=App.get_running_app().data; self._load_pending(); self.build_ui(); self._start_listener()

    def _load_pending(self):
        for sid,msgs in load_pending().items():
            if msgs:
                r=[]
                for m in msgs:
                    if isinstance(m,dict) and 'key' in m and 'msg' in m: r.append((m['key'],m['msg']))
                    elif isinstance(m,(list,tuple)) and len(m)==2: r.append((m[0],m[1]))
                if r: self.pending_msgs[sid]=r

    def _save_pending(self):
        save_pending({s:[{'key':k,'msg':m} for k,m in msgs] for s,msgs in self.pending_msgs.items() if msgs})

    def build_ui(self):
        self.clear_widgets()
        root=BoxLayout(orientation='vertical')
        with root.canvas.before:
            Color(*C_BG); self._bg=Rectangle(pos=root.pos,size=root.size)
        root.bind(pos=lambda i,v:setattr(self._bg,'pos',v),size=lambda i,v:setattr(self._bg,'size',v))
        hdr=BoxLayout(size_hint_y=None,height=dp(58),padding=[dp(12),dp(8)])
        with hdr.canvas.before: Color(*C_HEADER_BG[:3],1); Rectangle(pos=hdr.pos,size=hdr.size)
        hdr.add_widget(Label(text='بارق | رقمك: '+self.data.get('my_id',''),font_size=sp(16),bold=True,color=C_TEXT,halign='right'))
        root.add_widget(hdr)
        ab=BoxLayout(size_hint_y=None,height=dp(52),padding=[dp(8),dp(4)],spacing=dp(6))
        self.entry_c=TextInput(hint_text='أضف رقم جهة اتصال',font_size=sp(15),multiline=False,input_filter='int',halign='right',size_hint_x=0.72)
        ba=Button(text='إضافة',font_size=sp(15),size_hint_x=0.28,background_color=C_BTN_SEND,background_normal='')
        ba.bind(on_press=self.add_contact); ab.add_widget(self.entry_c); ab.add_widget(ba); root.add_widget(ab)
        sv=ScrollView(size_hint=(1,1))
        self.cl=GridLayout(cols=1,size_hint_y=None,spacing=dp(3),padding=[dp(6),dp(4)])
        self.cl.bind(minimum_height=self.cl.setter('height')); self._populate(); sv.add_widget(self.cl); root.add_widget(sv)
        if self.data.get('my_id')==ADMIN_ID:
            adm=BoxLayout(size_hint_y=None,height=dp(44),padding=[dp(8),dp(4)],spacing=dp(5))
            bi=Button(text='معلومات الخادم',font_size=sp(13),background_color=C_BTN_EMOJI,background_normal='')
            bi.bind(on_press=self.server_info)
            bc=Button(text='تنظيف الخادم',font_size=sp(13),background_color=C_BTN_CANCEL,background_normal='')
            bc.bind(on_press=self.clean_server); adm.add_widget(bi); adm.add_widget(bc); root.add_widget(adm)
        self.add_widget(root)

    def _populate(self):
        self.cl.clear_widgets(); contacts=self.data.get('contacts',{})
        all_ids=list(contacts.items())
        for sid,msgs in self.pending_msgs.items():
            if sid not in contacts and msgs: all_ids.append((sid,'مجهول: '+sid))
        if not all_ids:
            self.cl.add_widget(Label(text='لا توجد جهات اتصال\nأضف رقماً للبدء',font_size=sp(16),color=C_TEXT,size_hint_y=None,height=dp(80),halign='center')); return
        for cid,cname in all_ids:
            p=len(self.pending_msgs.get(cid,[])); lbl=cname+' - '+cid+('  🔔 '+str(p) if p>0 else '')
            row=BoxLayout(size_hint_y=None,height=dp(52),padding=[dp(5),dp(3)],spacing=dp(5))
            with row.canvas.before:
                Color(*C_WHITE); rr=RoundedRectangle(pos=row.pos,size=row.size,radius=[dp(10)])
            row.bind(pos=lambda i,v,r=rr:setattr(r,'pos',v),size=lambda i,v,r=rr:setattr(r,'size',v))
            row.add_widget(Label(text=lbl,font_size=sp(14),color=C_TEXT,halign='right',size_hint_x=0.72))
            bo=Button(text='فتح',font_size=sp(13),size_hint_x=0.18,background_color=C_BTN_SEND,background_normal='')
            bo.bind(on_press=lambda x,ci=cid,cn=cname:self.open_chat(ci,cn))
            bd=Button(text='X',font_size=sp(13),size_hint_x=0.1,background_color=C_BTN_CANCEL,background_normal='')
            bd.bind(on_press=lambda x,ci=cid:self.delete_contact(ci))
            row.add_widget(bo); row.add_widget(bd); self.cl.add_widget(row)

    def add_contact(self,*a):
        cid=self.entry_c.text.strip()
        if len(cid)==8 and cid.isdigit():
            if cid==self.data['my_id']: Popup(title='تنبيه',content=Label(text='لا يمكنك إضافة رقمك',color=C_TEXT),size_hint=(0.8,0.28)).open(); return
            self.data['contacts'][cid]=cid; save_data(self.data); self.entry_c.text=''; self._populate()
        else: Popup(title='خطأ',content=Label(text='الرقم يجب أن يكون 8 أرقام',color=C_TEXT),size_hint=(0.8,0.28)).open()

    def delete_contact(self,cid):
        if cid in self.data.get('contacts',{}): del self.data['contacts'][cid]; save_data(self.data); self._populate()

    def open_chat(self,cid,cname):
        pending=self.pending_msgs.pop(cid,[]); self._save_pending()
        sname='chat_'+cid
        if not self.manager.has_screen(sname):
            cs=ChatScreen(name=sname,contact_id=cid,contact_name=cname,my_id=self.data['my_id'],pending_msgs=pending,home_screen=self)
            self.manager.add_widget(cs)
        self.manager.transition=SlideTransition(direction='left'); self.manager.current=sname

    def on_chat_closed(self,cid):
        sname='chat_'+cid
        if self.manager.has_screen(sname): self.manager.remove_widget(self.manager.get_screen(sname))
        self._populate()

    def _start_listener(self):
        if self.bg_listener: self.bg_listener['running']=False
        listener={'running':True}; self.bg_listener=listener
        def listen():
            seen=set()
            while listener['running']:
                try:
                    incoming=fb_get(self.data['my_id']); nbs={}; blocked=self.data.get('blocked',[])
                    for key,msg in incoming.items():
                        if key not in seen and isinstance(msg,dict):
                            sid=msg.get('from','')
                            if sid in blocked: threading.Thread(target=fb_del,args=(self.data['my_id'],key),daemon=True).start(); seen.add(key); continue
                            seen.add(key); nbs.setdefault(sid,[]).append((key,msg))
                    if nbs: Clock.schedule_once(lambda dt,n=nbs:self._on_msg(n),0)
                except: pass
                time.sleep(5)
        threading.Thread(target=listen,daemon=True).start()

    def _on_msg(self,nbs):
        contacts=self.data.get('contacts',{}); changed=False
        for sid,msgs in nbs.items():
            sname='chat_'+sid
            if self.manager.has_screen(sname):
                cs=self.manager.get_screen(sname)
                for key,msg in msgs: cs.process_incoming(key,msg)
            else:
                self.pending_msgs.setdefault(sid,[])
                for key,msg in msgs:
                    if not any(k==key for k,_ in self.pending_msgs[sid]): self.pending_msgs[sid].append((key,msg))
                self._save_pending(); sn=contacts.get(sid,'رقم '+sid); cnt=len(self.pending_msgs[sid])
                p=Popup(title='رسالة جديدة',content=Label(text='وصلتك '+str(cnt)+' رسالة من '+sn,color=C_TEXT,font_size=sp(15)),size_hint=(0.82,0.22),auto_dismiss=True)
                p.open(); Clock.schedule_once(lambda dt:p.dismiss(),3); changed=True
        if changed: self._populate()

    def server_info(self,*a):
        def gi():
            try:
                r=requests.get(FIREBASE_URL+"/messages.json?auth="+FIREBASE_KEY,timeout=15)
                if r.status_code==200 and r.text!='null':
                    d=r.json(); total=sum(len(v) for v in d.values() if isinstance(v,dict))
                    mb=len(r.content)/1024/1024; msg='الرسائل: '+str(total)+'\nالحجم: '+'%.2f'%mb+' MB'
                else: msg='الخادم فارغ'
            except: msg='تعذر الاتصال'
            Clock.schedule_once(lambda dt:Popup(title='معلومات الخادم',content=Label(text=msg,color=C_TEXT,font_size=sp(14)),size_hint=(0.85,0.4)).open(),0)
        threading.Thread(target=gi,daemon=True).start()

    def clean_server(self,*a):
        def dc():
            ok=fb_clear(); msg='تم تنظيف الخادم' if ok else 'حدث خطأ'
            Clock.schedule_once(lambda dt:Popup(title='تنظيف',content=Label(text=msg,color=C_TEXT),size_hint=(0.75,0.25)).open(),0)
        threading.Thread(target=dc,daemon=True).start()

class ChatScreen(Screen):
    def __init__(self,contact_id,contact_name,my_id,pending_msgs=None,home_screen=None,**kw):
        super().__init__(**kw); self.contact_id=contact_id; self.contact_name=contact_name
        self.my_id=my_id; self.home_screen=home_screen; self.messages=load_chat(my_id,contact_id)
        self.reply_to=None; self.running=True; self.seen_keys=set(); self._lock=threading.Lock()
        self.build_ui()
        if pending_msgs:
            for key,msg in pending_msgs:
                if key not in self.seen_keys: self.seen_keys.add(key); Clock.schedule_once(lambda dt,k=key,m=msg:self._do_process(k,m),0.3)
        threading.Thread(target=self.poll_messages,daemon=True).start()
        threading.Thread(target=self.poll_status,daemon=True).start()

    def build_ui(self):
        root=BoxLayout(orientation='vertical')
        with root.canvas.before: Color(*C_BG); self._bg=Rectangle(pos=root.pos,size=root.size)
        root.bind(pos=lambda i,v:setattr(self._bg,'pos',v),size=lambda i,v:setattr(self._bg,'size',v))
        hdr=BoxLayout(size_hint_y=None,height=dp(65),padding=[dp(8),dp(6)],spacing=dp(6))
        with hdr.canvas.before:
            Color(*C_HEADER_BOR[:3],1); self._hbor=RoundedRectangle(pos=hdr.pos,size=hdr.size,radius=[dp(0)])
        hdr.bind(pos=lambda i,v:setattr(self._hbor,'pos',v),size=lambda i,v:setattr(self._hbor,'size',v))
        with hdr.canvas.before:
            Color(*C_HEADER_BG[:3],1); self._hbg=Rectangle(pos=(hdr.x+2,hdr.y+2),size=(hdr.width-4,hdr.height-4))
        hdr.bind(pos=lambda i,v:setattr(self._hbg,'pos',(v[0]+2,v[1]+2)),size=lambda i,v:setattr(self._hbg,'size',(v[0]-4,v[1]-4)))
        bb=Button(text='◀',font_size=sp(20),size_hint=(None,1),width=dp(44),background_color=C_BTN_EMOJI,background_normal='')
        bb.bind(on_press=self.go_back); hdr.add_widget(bb)
        hdr.add_widget(Label(text='المحادثة مع: '+self.contact_name,font_size=sp(16),bold=True,color=C_TEXT,halign='right'))
        root.add_widget(hdr)
        self.chat_scroll=ScrollView(size_hint=(1,1),do_scroll_x=False)
        with self.chat_scroll.canvas.before: Color(*C_CHAT_BG[:3],1); self._cbg=Rectangle(pos=self.chat_scroll.pos,size=self.chat_scroll.size)
        self.chat_scroll.bind(pos=lambda i,v:setattr(self._cbg,'pos',v),size=lambda i,v:setattr(self._cbg,'size',v))
        self.bubbles=GridLayout(cols=1,size_hint_y=None,spacing=dp(4),padding=[dp(6),dp(8)])
        self.bubbles.bind(minimum_height=self.bubbles.setter('height')); self.chat_scroll.add_widget(self.bubbles); root.add_widget(self.chat_scroll)
        self.reply_lbl=Label(text='',font_size=sp(13),color=get_color_from_hex('#0064C8'),size_hint_y=None,height=0,halign='right')
        root.add_widget(self.reply_lbl)
        ib=BoxLayout(size_hint_y=None,height=dp(52),padding=[dp(8),dp(5)],spacing=dp(5))
        with ib.canvas.before: Color(*C_WHITE[:3],1); Rectangle(pos=ib.pos,size=ib.size)
        self.entry=TextInput(hint_text='اكتب رسالتك...',font_size=sp(16),multiline=False,halign='right',size_hint_x=1)
        self.entry.bind(on_text_validate=self.send_message); ib.add_widget(self.entry); root.add_widget(ib)
        bar=BoxLayout(size_hint_y=None,height=dp(58),padding=[dp(10),dp(6)],spacing=dp(10))
        with bar.canvas.before: Color(*C_BAR_BG[:3],1); self._bbg=Rectangle(pos=bar.pos,size=bar.size)
        bar.bind(pos=lambda i,v:setattr(self._bbg,'pos',v),size=lambda i,v:setattr(self._bbg,'size',v))
        for txt,col,hdl in [('✓',C_BTN_SEND,self.send_message),('💙',C_BTN_EMOJI,self.open_emoji),('📎',C_BTN_FILE,self.send_file),('✗',C_BTN_CANCEL,self.cancel_reply)]:
            b=Button(text=txt,font_size=sp(24),background_color=col,background_normal=''); b.bind(on_press=hdl); bar.add_widget(b)
        root.add_widget(bar); self.add_widget(root); self._rebuild()

    def _rebuild(self):
        self.bubbles.clear_widgets()
        for i,msg in enumerate(self.messages): self._add_bubble(msg,i)
        Clock.schedule_once(self._scroll_bottom,0.1)

    def _add_bubble(self,msg,idx):
        is_mine=msg.get('from')==self.my_id; sender='أنت' if is_mine else self.contact_name
        t=format_time(msg.get('time',0)); body='ملف: '+msg.get('filename','') if msg.get('type')=='file' else msg.get('text','')
        rp='رد: '+str(msg['reply_to'])[:20]+'\n' if msg.get('reply_to') else ''
        tail=('\n'+t) if t else ''
        if is_mine: tail+='  '+status_label(msg.get('delivery_status','sent'))+' '+status_text(msg.get('delivery_status','sent'))
        full=rp+sender+': '+body+tail
        outer=BoxLayout(orientation='horizontal',size_hint_y=None,height=dp(10))
        if is_mine: outer.add_widget(Widget(size_hint_x=0.15))
        bubble=BoxLayout(orientation='vertical',size_hint=(None,None),padding=[dp(10),dp(8)])
        bg=C_MY_MSG if is_mine else C_OTHER_MSG
        lbl=Label(text=full,font_size=sp(14),color=C_TEXT,halign='right',valign='top',text_size=(Window.width*0.68,None),size_hint=(None,None))
        lbl.bind(texture_size=lbl.setter('size'))
        with bubble.canvas.before: Color(*bg); self._br=RoundedRectangle(pos=bubble.pos,size=bubble.size,radius=[dp(12)])
        def upd(inst,val,br=self._br):
            br.pos=inst.pos; br.size=inst.size; bubble.width=lbl.texture_size[0]+dp(20)
            bubble.height=lbl.texture_size[1]+dp(16); outer.height=bubble.height+dp(8)
        bubble.bind(pos=upd,size=upd); lbl.bind(texture_size=lambda i,v:upd(bubble,v))
        bubble.add_widget(lbl); outer.add_widget(bubble)
        if not is_mine: outer.add_widget(Widget(size_hint_x=0.15))
        wrap=BoxLayout(orientation='vertical',size_hint_y=None,height=dp(70),padding=[dp(4),dp(4)])
        wrap.bind(on_touch_down=lambda inst,touch,i=idx:self._on_touch(inst,touch,i))
        wrap.add_widget(outer); self.bubbles.add_widget(wrap)

    def _on_touch(self,inst,touch,idx):
        if inst.collide_point(*touch.pos) and touch.is_double_tap: self._show_ctx(idx)
        return False

    def _scroll_bottom(self,*a): self.chat_scroll.scroll_y=0

    def _show_ctx(self,idx):
        if idx<0 or idx>=len(self.messages): return
        msg=self.messages[idx]; content=GridLayout(cols=1,spacing=dp(5),padding=dp(10),size_hint_y=None)
        content.bind(minimum_height=content.setter('height')); pop=Popup(title='خيارات الرسالة',content=content,size_hint=(0.85,0.55))
        opts=[('الرد',lambda x:self._do_reply(idx,pop)),('حذف',lambda x:self._do_delete(idx,pop)),('نسخ',lambda x:self._do_copy(idx,pop)),('توجيه',lambda x:self._do_forward(idx,pop))]
        if msg.get('from')==self.my_id: opts.append(('تعديل',lambda x:self._do_edit(idx,pop)))
        for lbl,h in opts:
            b=Button(text=lbl,font_size=sp(15),size_hint_y=None,height=dp(44),background_color=C_BTN_EMOJI,background_normal=''); b.bind(on_press=h); content.add_widget(b)
        bc=Button(text='إغلاق',font_size=sp(15),size_hint_y=None,height=dp(44),background_color=C_BTN_CANCEL,background_normal=''); bc.bind(on_press=pop.dismiss); content.add_widget(bc); pop.open()

    def _do_reply(self,idx,pop):
        pop.dismiss(); msg=self.messages[idx]
        self.reply_to='ملف: '+msg.get('filename','') if msg.get('type')=='file' else msg.get('text','')
        self.reply_lbl.text='رد على: '+str(self.reply_to)[:40]; self.reply_lbl.height=dp(28)

    def _do_delete(self,idx,pop):
        pop.dismiss()
        if idx<len(self.messages): self.messages.pop(idx); save_chat(self.my_id,self.contact_id,self.messages); self._rebuild()

    def _do_copy(self,idx,pop):
        pop.dismiss()
        if idx<len(self.messages):
            msg=self.messages[idx]; Clipboard.copy(msg.get('filename','') if msg.get('type')=='file' else msg.get('text',''))

    def _do_forward(self,idx,pop):
        pop.dismiss()
        if idx>=len(self.messages): return
        msg=self.messages[idx]; contacts=load_data().get('contacts',{})
        if not contacts: return
        content=GridLayout(cols=1,spacing=dp(5),padding=dp(10),size_hint_y=None); content.bind(minimum_height=content.setter('height'))
        fp=Popup(title='توجيه إلى:',content=ScrollView(size_hint=(1,1)),size_hint=(0.85,0.6)); fp.content.add_widget(content)
        for cid,cname in contacts.items():
            b=Button(text=cname+' - '+cid,font_size=sp(14),size_hint_y=None,height=dp(44),background_color=C_BTN_SEND,background_normal='')
            def fwd(x,ti=cid): fp.dismiss(); threading.Thread(target=fb_send,args=(ti,{'from':self.my_id,'text':'محولة: '+msg.get('text',msg.get('filename','')),'type':'text','time':int(time.time())}),daemon=True).start()
            b.bind(on_press=fwd); content.add_widget(b)
        fp.open()

    def _do_edit(self,idx,pop):
        pop.dismiss()
        if idx>=len(self.messages): return
        msg=self.messages[idx]; content=BoxLayout(orientation='vertical',padding=dp(12),spacing=dp(8))
        entry=TextInput(text=msg.get('text',''),font_size=sp(15),halign='right',multiline=True,size_hint_y=None,height=dp(90)); content.add_widget(entry)
        ep=Popup(title='تعديل',content=content,size_hint=(0.9,0.42))
        def save_e(x):
            nt=entry.text.strip()
            if nt: self.messages[idx]['text']=nt+' (معدل)'; save_chat(self.my_id,self.contact_id,self.messages); self._rebuild()
            ep.dismiss()
        bk=Button(text='حفظ',size_hint_y=None,height=dp(44),background_color=C_BTN_SEND,background_normal=''); bk.bind(on_press=save_e); content.add_widget(bk); ep.open()

    def cancel_reply(self,*a): self.reply_to=None; self.reply_lbl.text=''; self.reply_lbl.height=0

    def send_message(self,*a):
        txt=self.entry.text.strip()
        if not txt: return
        now=int(time.time()); pay={'from':self.my_id,'text':txt,'type':'text','time':now,'delivery_status':'sent'}
        if self.reply_to: pay['reply_to']=self.reply_to
        lm={'from':self.my_id,'text':txt,'type':'text','time':now,'delivery_status':'sent','key':''}
        if self.reply_to: lm['reply_to']=self.reply_to
        idx=len(self.messages); self.messages.append(lm); save_chat(self.my_id,self.contact_id,self.messages)
        self._add_bubble(lm,idx); Clock.schedule_once(self._scroll_bottom,0.1); self.entry.text=''; self.cancel_reply()
        def sat(): key=fb_send(self.contact_id,pay);
        if key: Clock.schedule_once(lambda dt:self._upd_key(idx,key),0)
        threading.Thread(target=sat,daemon=True).start()

    def _upd_key(self,idx,key):
        if idx<len(self.messages): self.messages[idx]['key']=key; save_chat(self.my_id,self.contact_id,self.messages)

    def send_file(self,*a):
        try: from plyer import filechooser; filechooser.open_file(on_selection=self._on_file)
        except: Popup(title='تنبيه',content=Label(text='ارسال الملفات يتطلب أندرويد',color=C_TEXT,font_size=sp(14)),size_hint=(0.85,0.3)).open()

    def _on_file(self,sel):
        if not sel: return
        fp=sel[0]; fn=os.path.basename(fp)
        if os.path.getsize(fp)>5*1024*1024: Popup(title='خطأ',content=Label(text='الملف كبير جداً',color=C_TEXT),size_hint=(0.8,0.28)).open(); return
        with open(fp,'rb') as f: fd=base64.b64encode(f.read()).decode()
        now=int(time.time()); pay={'from':self.my_id,'type':'file','filename':fn,'data':fd,'time':now,'delivery_status':'sent'}
        lm={'from':self.my_id,'type':'file','filename':fn,'time':now,'delivery_status':'sent','key':''}
        idx=len(self.messages); self.messages.append(lm); save_chat(self.my_id,self.contact_id,self.messages)
        self._add_bubble(lm,idx); Clock.schedule_once(self._scroll_bottom,0.1)
        def sat(): key=fb_send(self.contact_id,pay);
        if key: Clock.schedule_once(lambda dt:self._upd_key(idx,key),0)
        threading.Thread(target=sat,daemon=True).start()

    def open_emoji(self,*a):
        EMOJIS=[('😀','مبتسم'),('😂','ضحك'),('😍','محب'),('😢','حزين'),('😮','مندهش'),('😎','مثير'),('❤️','قلب'),('👍','إعجاب'),('👎','عدم إعجاب'),('🙏','دعاء'),('🎉','احتفال'),('🔥','نار'),('✅','صح'),('❌','خطأ'),('⭐','نجمة'),('😊','بسمة'),('😴','نائم'),('🤔','يفكر'),('🌹','وردة'),('💪','قوة')]
        content=GridLayout(cols=5,spacing=dp(4),padding=dp(8),size_hint_y=None); content.bind(minimum_height=content.setter('height'))
        sv=ScrollView(size_hint=(1,1)); sv.add_widget(content); pop=Popup(title='اختر رمزاً',content=sv,size_hint=(0.88,0.6))
        for em,_ in EMOJIS:
            b=Button(text=em,font_size=sp(26),size_hint_y=None,height=dp(52),background_color=C_WHITE,background_normal='',color=C_TEXT)
            def ins(x,e=em): self.entry.text+=e; pop.dismiss()
            b.bind(on_press=ins); content.add_widget(b)
        pop.open()

    def process_incoming(self,key,msg):
        with self._lock:
            if key in self.seen_keys: return
            self.seen_keys.add(key)
        Clock.schedule_once(lambda dt:self._do_process(key,msg),0)

    def _do_process(self,key,msg):
        mtype=msg.get('type','text'); sid=msg.get('from','')
        threading.Thread(target=notify_status,args=(sid,key,'received',self.my_id),daemon=True).start()
        if mtype=='file':
            fn=msg.get('filename','ملف')
            try:
                with open(os.path.join(FILES_DIR,fn),'wb') as f: f.write(base64.b64decode(msg.get('data','')))
            except: pass
            lm={'from':sid,'type':'file','filename':fn,'time':msg.get('time',int(time.time())),'key':key}
        else:
            lm={'from':sid,'text':msg.get('text',''),'type':'text','time':msg.get('time',int(time.time())),'key':key}
            if msg.get('reply_to'): lm['reply_to']=msg['reply_to']
        self.messages.append(lm); save_chat(self.my_id,self.contact_id,self.messages)
        self._add_bubble(lm,len(self.messages)-1); Clock.schedule_once(self._scroll_bottom,0.1)
        threading.Thread(target=fb_del,args=(self.my_id,key),daemon=True).start()

    def poll_messages(self):
        d=load_data()
        while self.running:
            try:
                inc=fb_get(self.my_id)
                for key,msg in inc.items():
                    if key not in self.seen_keys and isinstance(msg,dict):
                        sid=msg.get('from','')
                        if sid in d.get('blocked',[]):
                            threading.Thread(target=fb_del,args=(self.my_id,key),daemon=True).start()
                            with self._lock: self.seen_keys.add(key); continue
                        if sid==self.contact_id: self.process_incoming(key,msg)
            except: pass
            time.sleep(3)

    def poll_status(self):
        while self.running:
            try:
                upd=False
                for i,msg in enumerate(self.messages):
                    if msg.get('from')==self.my_id and msg.get('key'):
                        cur=msg.get('delivery_status','sent')
                        if cur=='read': continue
                        ns=get_msg_status(self.my_id,msg['key'])
                        if not ns: continue
                        if {'sent':0,'received':1,'read':2}.get(ns,-1)>{'sent':0,'received':1,'read':2}.get(cur,0):
                            self.messages[i]['delivery_status']=ns; save_chat(self.my_id,self.contact_id,self.messages); upd=True
                if upd: Clock.schedule_once(lambda dt:self._rebuild(),0)
            except: pass
            time.sleep(8)

    def go_back(self,*a):
        self.running=False
        if self.home_screen: self.home_screen.on_chat_closed(self.contact_id)
        self.manager.transition=SlideTransition(direction='right'); self.manager.current='home'

if __name__=='__main__': BariqApp().run()
