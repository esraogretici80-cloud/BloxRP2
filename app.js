/* BloxRP Tactical Radio & RP Console - PARÇA 1 */
(() => {
"use strict";

const APP = {
  version: "2.1.0",
  storageKey: "bloxrp.firebase.config.v1",
  profileKey: "bloxrp.local.profile.v2",
  soundKey: "bloxrp.sound.enabled",
  demoKey: "bloxrp.demo.data.v1",
  channels: ["Hepsi","Asker","Tetik","Yonetim"],
  colors: { Hepsi:"#00f0ff", Asker:"#00ff88", Tetik:"#ff0055", Yonetim:"#ffd700" },
  ranks: {
    Asker: ["Er","Onbaşı","Çavuş","Astsubay","Teğmen","Yüzbaşı","Binbaşı","Albay","General","Orgeneral"],
    Tetik: ["Gözcü","Sokak Elemanı","Çete Üyesi","Tetikçi","Kıdemli Tetikçi","Saha Operatörü","Suikastçı","Gölge İnfazcı","Kontrat Uzmanı","Yeraltı Lideri","Baron / Lonca Başbuğu"],
    Yonetim: ["Stajyer Yetkili","RP Yetkilisi","Kurucu"]
  },
  // Hardcoded Firebase config - otomatik bağlanır, kurulum ekranı gerekmez
  firebaseConfig: {
    apiKey: "AIzaSyAlSiONrQgPMaO9zsoo25UVeaSap0e2xm0",
    authDomain: "bloxrp-51423.firebaseapp.com",
    databaseURL: "https://bloxrp-51423-default-rtdb.firebaseio.com",
    projectId: "bloxrp-51423",
    storageBucket: "bloxrp-51423.firebasestorage.app",
    appId: "1:398726018775:android:b933141cd1d03610176292"
  }
};

const state = {
  firebase:false, demo:false, app:null, auth:null, db:null, uid:null,
  channel:"Hepsi", messages:[], listeners:[], presenceRef:null,
  profile:null, banned:null, timer:null, timerInterval:null, sound:true, audio:null, rankTab:"Asker",
  admin:false, initialized:false, authReady:false, googleListener:false
};

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const now = () => Date.now();
const initials = name => {
  const s = String(name || "Telsiz Operatörü").trim().split(/\s+/).slice(0,2);
  return s.map(x => x[0]?.toUpperCase() || "").join("") || "TO";
};
const channelLabel = c => c === "Yonetim" ? "Yönetim" : c;
const rankFor = (faction, level) => {
  const arr = APP.ranks[faction] || APP.ranks.Asker;
  return arr[Math.min(Math.max((level || 1) - 1, 0), arr.length - 1)];
};
const xpThreshold = level => Math.max(1, Number(level || 1)) * 100;

function toast(message, type="") {
  const host = $("toastHost");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function setBoot(text) { const el = $("bootStatus"); if (el) el.textContent = text; }

function bootLog(msg) {
  const el = $("bootDebug");
  if (!el) return;
  const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  el.innerHTML += `<div>[${time}] ${esc(String(msg))}</div>`;
}

function hideBootScreen() {
  const boot = $("bootScreen");
  if (boot) boot.style.display = "none";
}

function openModal(id) { 
  const el = $(id); 
  if (el) { el.classList.remove("hidden"); el.setAttribute("aria-hidden","false"); }
}

function closeModal(id) { 
  const el = $(id); 
  if (el) { el.classList.add("hidden"); el.setAttribute("aria-hidden","true"); }
}

function loadLocalProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(APP.profileKey) || "null"); } catch {}
  if (!p) {
    p = { displayName:"Telsiz Operatörü", faction:"Asker", xp:0, level:1, messages:0, customRank:null, createdAt:now() };
    localStorage.setItem(APP.profileKey, JSON.stringify(p));
  }
  p.faction = APP.ranks[p.faction] ? p.faction : "Asker";
  p.level = Math.max(1, Number(p.level || 1));
  p.xp = Math.max(0, Number(p.xp || 0));
  p.messages = Math.max(0, Number(p.messages || 0));
  return p;
}

function saveLocalProfile() { localStorage.setItem(APP.profileKey, JSON.stringify(state.profile)); }

function normalizeProfile(data) {
  const p = data || {};
  return {
    displayName: String(p.displayName || "Telsiz Operatörü").slice(0,32),
    email: String(p.email || "").slice(0,120),
    photoURL: String(p.photoURL || "").slice(0,600),
    faction: APP.ranks[p.faction] ? p.faction : "Asker",
    xp: Math.max(0, Number(p.xp || 0)),
    level: Math.max(1, Number(p.level || 1)),
    messages: Math.max(0, Number(p.messages || 0)),
    customRank: p.customRank || null,
    admin: p.admin === true,
    createdAt: Number(p.createdAt || now())
  };
}

function applyAvatar(id, url, fallback) {
  const el=$(id); if(!el) return;
  if(url) {
    el.style.backgroundImage=`url("${String(url).replace(/"/g,"%22")}")`;
    el.classList.add("has-photo");
    el.innerHTML="";
  } else {
    el.style.backgroundImage="";
    el.classList.remove("has-photo");
    el.innerHTML=`<span>${esc(fallback || "TO")}</span>`;
  }
}

function renderProfile() {
  const p = state.profile || loadLocalProfile();
  const threshold = xpThreshold(p.level);
  const pct = Math.min(100, Math.round((p.xp / threshold) * 100));
  const rank = p.customRank || rankFor(p.faction,p.level);
  const init = initials(p.displayName);
  
  if ($("profileName")) $("profileName").textContent = p.displayName;
  if ($("profileFaction")) $("profileFaction").textContent = channelLabel(p.faction).toUpperCase();
  if ($("profileRank")) $("profileRank").textContent = rank;
  if ($("profileLevel")) $("profileLevel").textContent = "Seviye " + p.level;
  if ($("xpLabel")) $("xpLabel").textContent = `${p.xp} / ${threshold} XP`;
  if ($("xpPercent")) $("xpPercent").textContent = pct + "%";
  if ($("xpFill")) $("xpFill").style.width = pct + "%";
  if ($("messageCount")) $("messageCount").textContent = p.messages;
  if ($("headerInitials")) $("headerInitials").textContent = init;
  if ($("profileInitials")) $("profileInitials").textContent = init;
  
  applyAvatar("profileAvatar", p.photoURL, init);
  applyAvatar("profileBtn", p.photoURL, init);
  applyAvatar("modalAvatar", p.photoURL, init);
  
  if ($("uidShort")) $("uidShort").textContent = state.uid ? state.uid.slice(0,7) : "LOCAL";
  if ($("modalInitials")) $("modalInitials").textContent = init;
  if ($("modalName")) $("modalName").textContent = p.displayName;
  if ($("modalUid")) $("modalUid").textContent = state.uid || "demo-local";
  if ($("modalFaction")) $("modalFaction").textContent = channelLabel(p.faction);
  if ($("modalRank")) $("modalRank").textContent = rank;
  if ($("modalLevel")) $("modalLevel").textContent = p.level;
  if ($("modalXP")) $("modalXP").textContent = p.xp;
  if ($("modalMessages")) $("modalMessages").textContent = p.messages;
  if ($("adminAccessText")) {
    $("adminAccessText").textContent = p.admin ? "Yetkili profil algılandı." : "Yönetim yetkisi gereklidir.";
    $("adminAccessText").style.color = p.admin ? "var(--green)" : "var(--muted)";
  }
  state.admin = !!p.admin;
}

function addXP(amount=15) {
  let levelUps = 0;
  state.profile.xp += amount;
  state.profile.messages += 1;
  while (state.profile.xp >= xpThreshold(state.profile.level)) {
    state.profile.xp -= xpThreshold(state.profile.level);
    state.profile.level += 1;
    levelUps++;
  }
  saveLocalProfile();
  renderProfile();
  if (levelUps) {
    beep("level");
    toast(`Seviye atladın! Yeni seviye: ${state.profile.level}`, "good");
  }
}

function audioContext() {
  if (!state.audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    state.audio = new AC();
  }
  if (state.audio.state === "suspended") state.audio.resume().catch(()=>{});
  return state.audio;
}

function beep(kind="message") {
  if (!state.sound) return;
  const ctx = audioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "level" ? "triangle" : "square";
    osc.frequency.value = kind === "level" ? 660 : 740;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === "level" ? .12 : .045, ctx.currentTime + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + (kind === "level" ? .45 : .12));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    const duration = kind === "level" ? .48 : .14;
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch{} }, duration * 1000 + 50);

    if (kind === "level") setTimeout(() => {
      const c = audioContext(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type="triangle"; o.frequency.value=990; g.gain.setValueAtTime(.0001,c.currentTime);
      g.gain.exponentialRampToValueAtTime(.1,c.currentTime+.01); g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.3);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+.32);
      setTimeout(() => { try { o.disconnect(); g.disconnect(); } catch{} }, 350);
    },130);
  } catch(e) {}
}

function formatTime(ts) {
  try { return new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date(ts)); }
  catch { return "--:--"; }
}

function messageHTML(m) {
  const mine = m.uid && m.uid === state.uid;
  const name = esc(m.displayName || "Operatör");
  const rank = esc(m.rank || "Er");
  const text = esc(m.text || "");
  const init = esc(initials(m.displayName));
  return `<article class="msg ${mine ? "mine":""}" data-id="${esc(m.id || "")}">
    <div class="msg-avatar">${init}</div>
    <div class="bubble">
      <div class="msg-meta"><span class="msg-name">${name}</span><span class="msg-rank">${rank}</span><span class="msg-time">${formatTime(m.createdAt || now())}</span></div>
      <div class="msg-text">${text}</div>
    </div>
  </article>`;
}

function renderMessages() {
  const box = $("chatViewport");
  if (!box) return;
  const oldAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 100;
  const list = state.messages.slice(-150);
  if ($("channelCount")) $("channelCount").textContent = list.length;
  if (!list.length) {
    box.innerHTML = `<div class="empty-chat"><strong>${channelLabel(state.channel)} frekansı sessiz.</strong>İlk telsiz mesajını gönder.</div>`;
    return;
  }
  box.innerHTML = list.map(messageHTML).join("");
  if (oldAtBottom || list.some(x => x.uid === state.uid)) box.scrollTop = box.scrollHeight;
}

function demoMessages(channel) {
  const key = APP.demoKey + "." + channel;
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function saveDemoMessages(channel, arr) {
  localStorage.setItem(APP.demoKey + "." + channel, JSON.stringify(arr.slice(-150)));
}

function stopListeners() {
  state.listeners.forEach(fn => { try { fn(); } catch {} });
  state.listeners = [];
}
/* BloxRP Tactical Radio & RP Console - PARÇA 2 */
function listenChannel(channel) {
  stopListeners();
  state.messages = [];
  if ($("channelTitle")) $("channelTitle").textContent = channelLabel(channel);
  if (state.demo) {
    state.messages = demoMessages(channel);
    renderMessages();
    return;
  }
  if (!state.db) return;
  const ref = state.db.ref("chats/" + channel).limitToLast(150);
  const cb = snap => {
    const arr = [];
    snap.forEach(child => arr.push({id:child.key,...(child.val() || {})}));
    arr.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    state.messages = arr;
    renderMessages();
  };
  ref.on("value", cb);
  state.listeners.push(() => ref.off("value", cb));
}

function switchChannel(channel) {
  if (!APP.channels.includes(channel)) return;
  state.channel = channel;
  document.querySelectorAll(".channel").forEach(b => b.classList.toggle("active", b.dataset.channel === channel));
  listenChannel(channel);
  if (channel === "Yonetim") {
    if ($("adminDrawer")) $("adminDrawer").classList.add("open");
    refreshAdmin();
  }
}

function getBannedState(data) {
  if (!data || !data[state.uid]) return null;
  const b = data[state.uid];
  if (!b) return null;
  if (b.expiresAt && Number(b.expiresAt) > 0 && Number(b.expiresAt) <= now()) return null;
  return b;
}

function canSend() {
  if (state.banned) {
    toast(`RP iletişiminiz kısıtlı. ${state.banned.reason ? "Sebep: " + state.banned.reason : ""}`.trim(), "bad");
    return false;
  }
  return true;
}

async function sendMessage() {
  const input = $("messageInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  if (!state.uid || !state.auth?.currentUser) { toast("Önce Google hesabınla giriş yapmalısın.","bad"); openModal("loginModal"); return; }
  if (!canSend()) return;
  if (state.channel === "Yonetim" && !state.admin) {
    toast("Yönetim frekansına mesaj göndermek için yetki gerekir.","bad"); return;
  }
  if (text.length > 600) return;
  const p = state.profile;
  const msg = {
    uid: state.uid || "demo-local",
    displayName: p.displayName,
    faction: p.faction,
    rank: p.customRank || rankFor(p.faction,p.level),
    text,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  };
  input.value = "";
  beep("message");
  if (state.demo) {
    msg.createdAt = now();
    msg.id = "local-" + now();
    const arr = demoMessages(state.channel); arr.push(msg); saveDemoMessages(state.channel,arr);
    state.messages = arr.slice(-150); renderMessages(); addXP(15); return;
  }
  try {
    await state.db.ref("chats/" + state.channel).push(msg);
    await grantMessageXP();
  } catch (err) {
    toast("Mesaj gönderilemedi: " + readableError(err), "bad");
  }
}

async function grantMessageXP() {
  if (!state.firebase || !state.db || !state.uid) { addXP(15); return; }
  const ref = state.db.ref("users/" + state.uid);
  try {
    await ref.transaction(current => {
      const p = normalizeProfile(current);
      let xp = p.xp + 15, level = p.level, messages = p.messages + 1;
      while (xp >= xpThreshold(level)) { xp -= xpThreshold(level); level++; }
      return {...p,xp,level,messages,updatedAt:firebase.database.ServerValue.TIMESTAMP};
    });
  } catch(e) {
    addXP(15);
  }
}

async function loadProfile() {
  if (state.demo || !state.db || !state.uid) { state.profile = loadLocalProfile(); renderProfile(); return; }
  try {
    const snap = await state.db.ref("users/" + state.uid).once("value");
    if (!snap.exists()) {
      state.profile = loadLocalProfile();
      state.profile.admin = false;
      await state.db.ref("users/" + state.uid).set({
        ...state.profile, createdAt:firebase.database.ServerValue.TIMESTAMP, updatedAt:firebase.database.ServerValue.TIMESTAMP
      });
    } else {
      state.profile = normalizeProfile(snap.val());
      saveLocalProfile();
    }
  } catch(err) {
    state.profile = loadLocalProfile();
    toast("Profil okunamadı; yerel profil kullanılıyor.","bad");
  }
  renderProfile();
}

function listenSystem() {
  if (state.demo || !state.db) {
    if ($("connectionPill")) { $("connectionPill").classList.add("online"); $("connectionPill").querySelector("span").textContent="DEMO"; }
    if ($("dbStatus")) $("dbStatus").textContent="Demo"; 
    if ($("rpState")) $("rpState").textContent="RP DEMO";
    return;
  }
  const connected = state.db.ref(".info/connected");
  const cb = snap => {
    const on = snap.val() === true;
    if ($("connectionPill")) {
      $("connectionPill").classList.toggle("online",on);
      $("connectionPill").querySelector("span").textContent = on ? "ONLINE" : "OFFLINE";
    }
    if ($("dbStatus")) $("dbStatus").textContent = on ? "Bağlı" : "Kesildi";
  };
  connected.on("value",cb);
  state.listeners.push(()=>connected.off("value",cb));

  const timerRef = state.db.ref("system/rp_timer");
  const timerCb = snap => { state.timer = snap.val() || null; renderTimer(); };
  timerRef.on("value",timerCb); state.listeners.push(()=>timerRef.off("value",timerCb));

  const banRef = state.db.ref("system/banned_users");
  const banCb = snap => { state.banned = getBannedState(snap.val() || {}); renderBan(); };
  banRef.on("value",banCb); state.listeners.push(()=>banRef.off("value",banCb));

  const profileRef = state.db.ref("users/" + state.uid);
  const profileCb = snap => { if (snap.exists()) { state.profile = normalizeProfile(snap.val()); saveLocalProfile(); renderProfile(); } };
  profileRef.on("value",profileCb); state.listeners.push(()=>profileRef.off("value",profileCb));

  const presenceRef = state.db.ref("presence");
  const presenceCb = snap => { let n=0; snap.forEach(c=>{if(c.val()?.online)n++}); if ($("onlineCount")) $("onlineCount").textContent=n; };
  presenceRef.on("value",presenceCb); state.listeners.push(()=>presenceRef.off("value",presenceCb));
}

function renderBan() {
  const banned = !!state.banned;
  if ($("banStatus")) {
    $("banStatus").textContent = banned ? "Kısıtlı" : "Aktif";
    $("banStatus").style.color = banned ? "var(--danger)" : "var(--green)";
  }
  if ($("modalBan")) $("modalBan").textContent = banned ? "RP Ban/Mute" : "Temiz";
  if ($("messageInput")) {
    $("messageInput").disabled = banned;
    $("messageInput").placeholder = banned ? "RP iletişiminiz kısıtlandı..." : "Telsiz mesajını yaz...";
  }
}

function renderTimer() {
  clearInterval(state.timerInterval);
  const t = state.timer;
  if (!t || !t.endsAt || t.endsAt <= now()) {
    if ($("rpTimer")) $("rpTimer").textContent="00:00:00"; 
    if ($("rpState")) $("rpState").textContent="RP BEKLEMEDE";
    if ($("rpEventName")) $("rpEventName").textContent=t?.eventName || "Genel Devriye"; 
    return;
  }
  if ($("rpState")) $("rpState").textContent="RP AKTİF";
  if ($("rpEventName")) $("rpEventName").textContent=t.eventName || "Genel Devriye";
  
  const tick = () => {
    const remain=Math.max(0,Number(t.endsAt)-now());
    const s=Math.floor(remain/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    if ($("rpTimer")) $("rpTimer").textContent=[h,m,sec].map(v=>String(v).padStart(2,"0")).join(":");
    if (remain<=0) { 
      if ($("rpState")) $("rpState").textContent="RP SÜRESİ DOLDU"; 
      clearInterval(state.timerInterval); 
    }
  };
  tick(); 
  state.timerInterval = setInterval(tick, 1000);
}

function renderRanks(faction=state.rankTab) {
  state.rankTab=faction;
  const arr=APP.ranks[faction];
  if ($("rankList")) $("rankList").innerHTML=arr.map((r,i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,"0")}</span><span class="rank-name">${esc(r)}</span><span class="rank-xp">LV ${i+1}</span></div>`).join("");
  document.querySelectorAll(".rank-tab").forEach(x=>x.classList.toggle("active",x.dataset.rankTab===faction));
}

function populateRankSelect() {
  const faction=$("rankFaction")?.value || "Asker";
  if ($("rankSelect")) $("rankSelect").innerHTML=APP.ranks[faction].map((r,i)=>`<option value="${esc(r)}">${i+1}. ${esc(r)}</option>`).join("");
}

function logAdmin(text,type="") {
  const host = $("adminLog");
  if (!host) return;
  const row=document.createElement("div"); row.className="log-"+type; row.textContent=`[${new Date().toLocaleTimeString("tr-TR")}] ${text}`;
  host.prepend(row);
}

function refreshAdmin() {
  const content = $("adminContent");
  if (!content) return;
  if (!state.admin) {
    content.style.opacity=".45";
    content.style.pointerEvents="none";
    logAdmin("Yetki yok. Firebase Rules gerçek yetki kontrolünü yapmalıdır.","warn");
  } else {
    content.style.opacity="1"; content.style.pointerEvents="auto";
  }
}

function requireAdmin() {
  if (!state.admin) { toast("Bu işlem için Kurucu / yetkili hesabı gerekir.","bad"); return false; }
  return true;
}

async function setGlobalTimer() {
  if (!requireAdmin()) return;
  const minutes=Math.max(0,Number($("adminTimerMinutes")?.value||0));
  const eventName=String($("adminEventName")?.value||"Genel Devriye").trim().slice(0,80);
  const payload={eventName,durationMinutes:minutes,startedAt:firebase.database.ServerValue.TIMESTAMP,endsAt:now()+minutes*60000,updatedBy:state.uid};
  try {
    if (state.demo) localStorage.setItem("bloxrp.demo.timer",JSON.stringify({...payload,startedAt:now()}));
    else await state.db.ref("system/rp_timer").set(payload);
    state.timer=payload; renderTimer(); logAdmin(`RP timer güncellendi: ${eventName} / ${minutes} dk`,"ok"); toast("Global RP timer güncellendi.","good");
  } catch(e){logAdmin(readableError(e),"danger");toast(readableError(e),"bad")}
}

async function assignRank() {
  if (!requireAdmin()) return;
  const uid=$("rankTargetUid")?.value.trim(), faction=$("rankFaction")?.value, rank=$("rankSelect")?.value;
  if (!uid) { toast("UID girilmelidir.","bad"); return; }
  try {
    if (state.demo) {
      if (uid===state.uid) { state.profile.customRank=rank; state.profile.faction=faction; saveLocalProfile(); renderProfile(); }
    } else await state.db.ref("users/"+uid).update({faction,customRank:rank,updatedAt:firebase.database.ServerValue.TIMESTAMP});
    logAdmin(`${uid} → ${faction} / ${rank}`,"ok"); toast("Rütbe atandı.","good");
  } catch(e){logAdmin(readableError(e),"danger");toast(readableError(e),"bad")}
}

async function toggleBan(remove=false) {
  if (!requireAdmin()) return;
  const uid=$("banTargetUid")?.value.trim(); if(!uid){toast("UID girilmelidir.","bad");return}
  try {
    if (state.demo) {
      state.banned=remove?null:{uid,reason:$("banReason")?.value.trim(),expiresAt:Number($("banMinutes")?.value||0)?now()+Number($("banMinutes")?.value)*60000:0};
      renderBan();
    } else if (remove) {
      await state.db.ref("system/banned_users/"+uid).remove();
    } else {
      const minutes=Math.max(0,Number($("banMinutes")?.value||0));
      await state.db.ref("system/banned_users/"+uid).set({
        uid,reason:String($("banReason")?.value||"RP kural ihlali").slice(0,180),
        bannedBy:state.uid,bannedAt:firebase.database.ServerValue.TIMESTAMP,
        expiresAt:minutes ? now()+minutes*60000 : 0
      });
    }
    logAdmin(remove?`${uid} ban kaldırıldı`:`${uid} RP ban/mute uygulandı`,"ok");
    toast(remove?"Ban kaldırıldı.":"RP ban/mute uygulandı.","good");
  } catch(e){logAdmin(readableError(e),"danger");toast(readableError(e),"bad")}
}

function readableError(err) {
  const code=err?.code||"";
  const map={
    "PERMISSION_DENIED":"Firebase Rules izin vermedi.",
    "auth/operation-not-allowed":"Firebase Authentication içinde Google girişini etkinleştir.",
    "auth/unauthorized-domain":"Bu alan adı Firebase Authentication > Ayarlar > Yetkili alan adlarına eklenmeli.",
    "auth/popup-blocked":"Google giriş penceresi tarayıcı tarafından engellendi. Tekrar dene.",
    "auth/popup-closed-by-user":"Google giriş penceresi kapatıldı.",
    "auth/invalid-api-key":"Firebase API key geçersiz.",
    "database/permission-denied":"Realtime Database yetkisi reddedildi."
  };
  return map[code] || err?.message || "Bilinmeyen hata";
}
/* BloxRP Tactical Radio & RP Console - PARÇA 3 */
async function initFirebase(config) {
  try {
    if (!window.firebase) throw new Error("Firebase SDK yüklenemedi. Sayfayı yenile.");
    const cfg = config || APP.firebaseConfig;
    if (!cfg || !cfg.apiKey || !cfg.databaseURL) throw new Error("Firebase yapılandırması eksik.");

    // Zaten doğru proje ile başlatıldıysa yeniden başlatma
    if (firebase.apps.length) {
      const existing = firebase.app();
      const opts = existing.options || {};
      if (opts.projectId === cfg.projectId && opts.apiKey === cfg.apiKey) {
        state.app = existing;
        state.auth = firebase.auth();
        state.db = firebase.database();
        state.firebase = true;
        state.demo = false;
      } else {
        await Promise.all(firebase.apps.map(a => a.delete().catch(()=>{})));
        state.app = firebase.initializeApp(cfg);
        state.auth = firebase.auth();
        state.db = firebase.database();
        state.firebase = true;
        state.demo = false;
      }
    } else {
      state.app = firebase.initializeApp(cfg);
      state.auth = firebase.auth();
      state.db = firebase.database();
      state.firebase = true;
      state.demo = false;
    }

    state.authReady = false;
    localStorage.setItem(APP.storageKey, JSON.stringify(cfg));

    if (!state.googleListener) {
      state.googleListener = true;
      state.auth.onAuthStateChanged(async user => {
        if (!user) {
          state.uid = null;
          state.authReady = true;
          setBoot("Google hesabı bekleniyor...");
          showLoginGate();
          return;
        }
        await completeGoogleSession(user);
      });
    }

    setBoot("Firebase hazır. Google hesabı bekleniyor...");
    // Auth state henüz gelmezse kısa süre sonra login kapısını aç
    setTimeout(() => {
      if (!state.authReady && !state.uid) {
        state.authReady = true;
        setBoot("Google hesabı bekleniyor...");
        showLoginGate();
      }
    }, 2500);
    return true;
  } catch(err) {
    console.error("initFirebase error:", err);
    setBoot("Bağlantı başarısız: " + (err.message || "bilinmeyen hata"));
    state.firebase = false;
    throw err;
  }
}

function showLoginGate() {
  const name=$("loginAccountName"); if(name) name.textContent="Google hesabınla giriş yap";
  const email=$("loginAccountEmail"); if(email) email.textContent="Aynı Firebase ağına güvenli şekilde bağlan.";
  const btn=$("googleLoginBtn"); if(btn) { btn.disabled=false; btn.innerHTML='<span class="google-g">G</span> Google ile giriş yap'; }
  openModal("loginModal");
  hideBootScreen();
}

async function signInWithGoogle() {
  const btn = $("googleLoginBtn");
  const errBox = $("loginError");

  if (errBox) {
    errBox.classList.add("hidden");
    errBox.textContent = "";
  }

  if (!state.auth) {
    // Auth henüz yoksa bir kez daha init dene
    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Firebase bağlanıyor...';
      }
      await waitForFirebase(6000);
      await initFirebase(APP.firebaseConfig);
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="google-g">G</span> Google ile giriş yap';
      }
      const msg = "Firebase henüz hazır değil: " + readableError(e);
      toast(msg, "bad");
      if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove("hidden");
      }
      return;
    }
  }

  if (!state.auth) {
    const msg = "Firebase Auth başlatılamadı. Sayfayı yenile veya Demo moda geç.";
    toast(msg, "bad");
    if (errBox) {
      errBox.textContent = msg;
      errBox.classList.remove("hidden");
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="google-g">G</span> Google ile giriş yap';
    }
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Google bağlantısı açılıyor...';
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    // WebView / APK ortamlarında popup genellikle çalışmaz, önce redirect dene
    const isWebView = /wv|WebView|Android.*Version\/[\d.]+.*Chrome\/[.0-9]* Mobile/i.test(navigator.userAgent) ||
                      (window.navigator.standalone === false && /iPhone|iPod|iPad/.test(navigator.userAgent));

    if (isWebView) {
      await state.auth.signInWithRedirect(provider);
    } else {
      try {
        await state.auth.signInWithPopup(provider);
      } catch (err) {
        if (err?.code === "auth/popup-blocked" ||
            err?.code === "auth/operation-not-supported-in-this-environment" ||
            err?.code === "auth/cancelled-popup-request") {
          await state.auth.signInWithRedirect(provider);
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="google-g">G</span> Google ile giriş yap';
    }
    const msg = readableError(err);
    toast(msg, "bad");
    if (errBox) {
      errBox.textContent = msg;
      errBox.classList.remove("hidden");
    }
  }
}

async function completeGoogleSession(user) {
  try {
    state.uid=user.uid; state.firebase=true; state.demo=false; state.authReady=true;
    const googleProfile={
      displayName: user.displayName || "Google Operatörü",
      email: user.email || "",
      photoURL: user.photoURL || "",
      faction: state.profile?.faction || "Asker",
      xp: state.profile?.xp || 0, level: state.profile?.level || 1,
      messages: state.profile?.messages || 0, customRank: state.profile?.customRank || null,
      admin: state.profile?.admin === true, createdAt: state.profile?.createdAt || now()
    };

    let isFounder = false;
    try {
      const founderRef = state.db.ref("system/founder_uid");
      const res = await founderRef.transaction(curr => curr || user.uid);
      if (res && res.snapshot && res.snapshot.val() === user.uid) {
        isFounder = true;
      }
    } catch {}

    const userRef = state.db.ref("users/" + state.uid);
    const existing = await userRef.once("value");
    if(existing.exists()) {
      const current = normalizeProfile(existing.val());
      state.profile = {...current, displayName: googleProfile.displayName, email: googleProfile.email, photoURL: googleProfile.photoURL};
      if (isFounder) { state.profile.admin = true; state.profile.customRank = "Kurucu"; state.profile.faction = "Yonetim"; }
      await userRef.update({
        displayName: state.profile.displayName,
        email: state.profile.email,
        photoURL: state.profile.photoURL,
        ...(isFounder ? { admin: true, customRank: "Kurucu", faction: "Yonetim" } : {}),
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
    } else {
      if (isFounder) { googleProfile.admin = true; googleProfile.customRank = "Kurucu"; googleProfile.faction = "Yonetim"; }
      state.profile = normalizeProfile(googleProfile);
      await userRef.set({...state.profile, createdAt: firebase.database.ServerValue.TIMESTAMP, updatedAt: firebase.database.ServerValue.TIMESTAMP});
    }

    saveLocalProfile(); renderProfile();
    stopListeners();
    listenSystem(); listenChannel(state.channel); setupPresence();
    state.initialized=true;
    closeModal("loginModal");
    hideBootScreen();
    const greeting=(user.displayName||"Operatör").split(" ")[0];
    toast(`Hoş geldin ${greeting}! BloxRP ağına bağlandın.`,"good");
  } catch(err) {
    toast("Google hesabı bağlandı fakat profil açılamadı: "+readableError(err),"bad");
    const e=$("loginError"); if(e){e.textContent=readableError(err);e.classList.remove("hidden");}
    hideBootScreen();
  }
}

async function signOutGoogle() {
  try {
    stopListeners();
    if(state.presenceRef) await state.presenceRef.set({uid:state.uid,online:false,lastSeen:now()}).catch(()=>{});
    await state.auth.signOut();
    state.uid=null; state.initialized=false; state.profile=loadLocalProfile(); renderProfile();
    showLoginGate();
    toast("Google hesabından çıkış yapıldı.");
  } catch(err) { toast(readableError(err),"bad"); }
}

function setupPresence() {
  if (!state.db || !state.uid) return;
  const ref=state.db.ref("presence/"+state.uid);
  state.presenceRef=ref;
  ref.set({uid:state.uid,online:true,lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});
  ref.onDisconnect().set({uid:state.uid,online:false,lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});
}

function enterDemo() {
  state.demo=true; state.firebase=false; state.uid="demo-"+cryptoRandom();
  state.profile=loadLocalProfile(); renderProfile(); listenSystem(); listenChannel(state.channel);
  const savedTimer=localStorage.getItem("bloxrp.demo.timer");
  if(savedTimer){try{state.timer=JSON.parse(savedTimer);renderTimer()}catch{}}
  state.initialized=true; hideBootScreen();
  toast("Yerel Demo Modu aktif. Gerçek çoklu kullanıcı için Firebase yapılandır.","");
}

function cryptoRandom() {
  try { return crypto.randomUUID().slice(0,12); } catch { return Math.random().toString(36).slice(2,14); }
}

function bindUI() {
  document.querySelectorAll(".channel").forEach(b=>b.addEventListener("click",()=>switchChannel(b.dataset.channel)));
  document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{
    const a=b.dataset.action;
    if(a==="rank"){renderRanks();openModal("rankModal")}
    if(a==="profile")openModal("profileModal");
    if(a==="sound"){state.sound=!state.sound;localStorage.setItem(APP.soundKey,String(state.sound));renderSound();if(state.sound)beep()}
    if(a==="setup")openModal("setupModal");
  }));

  if ($("messageForm")) {
    $("messageForm").addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
  }
  
  if ($("beepBtn")) $("beepBtn").addEventListener("click",()=>beep("message"));
  if ($("soundBtn")) $("soundBtn").addEventListener("click",()=>{state.sound=!state.sound;localStorage.setItem(APP.soundKey,String(state.sound));renderSound();if(state.sound)beep()});
  if ($("rankBtn")) $("rankBtn").addEventListener("click",()=>{renderRanks();openModal("rankModal")});
  if ($("profileBtn")) $("profileBtn").addEventListener("click",()=>openModal("profileModal"));
  if ($("googleLoginBtn")) $("googleLoginBtn").addEventListener("click",signInWithGoogle);
  if ($("googleLogoutBtn")) $("googleLogoutBtn").addEventListener("click",signOutGoogle);
  if ($("closeAdmin")) $("closeAdmin").addEventListener("click",()=>{if ($("adminDrawer")) $("adminDrawer").classList.remove("open")});
  
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  document.querySelectorAll(".rank-tab").forEach(b=>b.addEventListener("click",()=>renderRanks(b.dataset.rankTab)));
  
  if ($("rankFaction")) $("rankFaction").addEventListener("change",populateRankSelect);
  if ($("setTimerBtn")) $("setTimerBtn").addEventListener("click",setGlobalTimer);
  if ($("assignRankBtn")) $("assignRankBtn").addEventListener("click",assignRank);
  if ($("banBtn")) $("banBtn").addEventListener("click",()=>toggleBan(false));
  if ($("unbanBtn")) $("unbanBtn").addEventListener("click",()=>toggleBan(true));
  if ($("refreshBtn")) $("refreshBtn").addEventListener("click",()=>{listenChannel(state.channel);toast("Frekans yenilendi.")});
  if ($("clearLocalBtn")) $("clearLocalBtn").addEventListener("click",()=>{
    if(!state.demo){toast("Canlı Firebase mesajları istemci tarafından silinemez.","bad");return}
    saveDemoMessages(state.channel,[]); state.messages=[]; renderMessages();
  });
  if ($("firebaseSetupForm")) {
    $("firebaseSetupForm").addEventListener("submit",async e=>{
      e.preventDefault(); if ($("setupError")) $("setupError").classList.add("hidden");
      const fd=new FormData(e.target), config=Object.fromEntries(fd.entries());
      Object.keys(config).forEach(k=>{if(!config[k])delete config[k]});
      try{await initFirebase(config)}catch(err){if ($("setupError")) { $("setupError").textContent=readableError(err);$("setupError").classList.remove("hidden");}}
    });
  }
  if ($("useDemoMode")) $("useDemoMode").addEventListener("click",()=>{enterDemo();closeModal("setupModal")});
  if ($("useDemoFromLogin")) $("useDemoFromLogin").addEventListener("click",()=>{enterDemo();closeModal("loginModal")});
  
  window.addEventListener("click",e=>{if(e.target.classList.contains("modal"))e.target.classList.add("hidden")});
  window.addEventListener("beforeunload",()=>{if(state.presenceRef)state.presenceRef.set({uid:state.uid,online:false,lastSeen:now()}).catch(()=>{})});
}

function renderSound() {
  if ($("soundStatus")) $("soundStatus").textContent=state.sound?"Açık":"Kapalı";
  if ($("soundBtn")) $("soundBtn").textContent=state.sound?"🔊":"🔇";
}

function waitForFirebase(maxMs = 8000) {
  return new Promise((resolve, reject) => {
    if (window.firebase && window.firebase.apps) {
      bootLog("SDK zaten hazır");
      return resolve();
    }
    const start = Date.now();
    let lastLog = 0;
    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      if (window.firebase && window.firebase.apps) {
        clearInterval(t);
        bootLog("SDK bulundu (" + elapsed + "ms)");
        resolve();
      } else if (elapsed > maxMs) {
        clearInterval(t);
        bootLog("SDK zaman aşımı");
        reject(new Error("Firebase SDK yüklenemedi (vendor dosyaları eksik veya bozuk olabilir)."));
      } else if (elapsed - lastLog >= 1500) {
        lastLog = elapsed;
        bootLog("Hâlâ bekleniyor... " + Math.round(elapsed/1000) + "s  (firebase=" + (typeof window.firebase) + ")");
      }
    }, 100);
  });
}

function forceShowLogin(message) {
  // Boot ekranını her durumda kapat ve login kapısını aç
  hideBootScreen();
  showLoginGate();
  if (message && $("loginError")) {
    $("loginError").textContent = message;
    $("loginError").classList.remove("hidden");
  }
}

async function boot() {
  state.sound = localStorage.getItem(APP.soundKey) !== "false";
  renderSound();
  renderRanks();
  populateRankSelect();
  bindUI();
  state.profile = loadLocalProfile();
  renderProfile();
  renderBan();

  // Boot ekranındaki "Login ekranına geç" butonu
  const forceBtn = $("bootForceLogin");
  if (forceBtn) {
    forceBtn.style.display = "block";
    forceBtn.onclick = () => forceShowLogin("Manuel olarak login ekranına geçildi.");
  }

  setBoot("Firebase bağlantısı hazırlanıyor...");
  bootLog("Boot başladı");
  bootLog("firebase var mı? " + (typeof window.firebase !== "undefined" ? "EVET" : "HAYIR"));
  bootLog("UA: " + (navigator.userAgent || "").slice(0, 80));

  // Güvenlik ağı: 5 saniye içinde hiçbir şey olmazsa login ekranını zorla aç
  const safetyTimer = setTimeout(() => {
    if (!state.authReady && !state.uid) {
      bootLog("Safety timeout → login zorla açılıyor");
      forceShowLogin("Bağlantı uzun sürdü. Google ile tekrar dene veya Demo moda geç.");
    }
  }, 5000);

  try {
    bootLog("SDK bekleniyor...");
    await waitForFirebase(8000);
    bootLog("SDK yüklendi ✓");
    setBoot("BloxRP Firebase ağına bağlanılıyor...");
    bootLog("initFirebase başlıyor...");
    await initFirebase(APP.firebaseConfig);
    bootLog("initFirebase tamam ✓");
    clearTimeout(safetyTimer);
  } catch (e) {
    clearTimeout(safetyTimer);
    console.error("Boot Firebase error:", e);
    const msg = readableError(e);
    bootLog("HATA: " + msg);
    toast("Firebase: " + msg, "bad");
    setBoot("Bağlantı hatası");
    // 1.5 sn bekleyip login göster (kullanıcı logu okusun)
    setTimeout(() => {
      forceShowLogin(msg + " — Aşağıdan Demo moda geçebilirsin.");
    }, 1500);
  }
}

// DOM hazır olmasa bile çalışsın
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
})();


