/**
 * BloxRP - Firebase Realtime Database & Auth Bağlantı Modülü
 * Bu dosya referans içindir. Asıl config app.js içinde hardcoded'dır
 * ve uygulama açılışında otomatik bağlanır.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAlSiONrQgPMaO9zsoo25UVeaSap0e2xm0",
  authDomain: "bloxrp-51423.firebaseapp.com",
  databaseURL: "https://bloxrp-51423-default-rtdb.firebaseio.com",
  projectId: "bloxrp-51423",
  storageBucket: "bloxrp-51423.firebasestorage.app",
  appId: "1:398726018775:android:b933141cd1d03610176292"
};

// Not: app.js kendi APP.firebaseConfig değerini kullanır.
// Bu dosya sadece yedek / dokümantasyon amaçlıdır.
if (typeof firebase !== "undefined" && !firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.database();
  } catch (e) {
    console.warn("firebase-config.js init skipped:", e.message);
  }
}
