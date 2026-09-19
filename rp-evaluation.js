/**
 * BloxRP - Google Auth, Kurucu Atama & RP Sonu Yıldızlı XP Modülü (Extension Script)
 * Bu dosya app.js'i bozmadan bağımsız şekilde çalışır.
 */

(function () {
    console.log("⚡ BloxRP RP-Evaluation Modülü Yüklendi.");

    // Yetkili Rütbeleri
    const STAFF_RANKS = ["Kurucu", "RP Yetkilisi", "Stajyer Yetkili"];

    // Global nesne erişimleri
    const getAuth = () => window.auth || (firebase && firebase.auth && firebase.auth());
    const getDb = () => window.db || (firebase && firebase.database && firebase.database());

    // ==========================================
    // 1. GOOGLE LOGIN & İLK GİRENİ KURUCU YAPMA
    // ==========================================

    window.loginWithGoogle = function () {
        const auth = getAuth();
        if (!auth) return alert("Firebase Auth henüz yüklenmedi!");

        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log("Google Girişi Başarılı:", result.user.displayName);
            })
            .catch((err) => {
                alert("Giriş Hatası: " + err.message);
            });
    };

    window.logout = function () {
        const auth = getAuth();
        if (auth) {
            auth.signOut().then(() => location.reload());
        }
    };

    // Auth Dinleyicisi
    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
            const auth = getAuth();
            const db = getDb();

            if (!auth || !db) return;

            auth.onAuthStateChanged((user) => {
                if (user) {
                    handleFounderAndUserInit(user, db);
                }
            });
        }, 500);
    });

    function handleFounderAndUserInit(user, db) {
        const founderRef = db.ref('system/founder_uid');
        const userRef = db.ref('users/' + user.uid);

        founderRef.transaction((currentFounder) => {
            if (currentFounder === null) {
                return user.uid; // İlk giriş yapan kişi Kurucu seçilir
            }
            return currentFounder;
        }, (error, committed, snapshot) => {
            const isFounder = snapshot.val() === user.uid;

            userRef.once('value', (snap) => {
                if (!snap.exists()) {
                    const newUserData = {
                        uid: user.uid,
                        displayName: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL,
                        rank: isFounder ? "Kurucu" : "Er",
                        faction: isFounder ? "Yonetim" : "Asker",
                        xp: 0,
                        level: isFounder ? 100 : 1,
                        isBanned: false,
                        createdAt: Date.now()
                    };
                    userRef.set(newUserData);
                    window.currentUserData = newUserData;
                } else {
                    window.currentUserData = snap.val();
                    if (isFounder && window.currentUserData.rank !== "Kurucu") {
                        userRef.update({ rank: "Kurucu", faction: "Yonetim" });
                        window.currentUserData.rank = "Kurucu";
                    }
                }

                // Global kullanıcı verisini güncelle
                if (typeof window.updateProfileUI === "function") {
                    window.updateProfileUI();
                }
            });
        });
    }

    // ==========================================
    // 2. YETKİLİ RP SONU YILDIZLI PUANLAMA
    // ==========================================

    /**
     * Yetkililerin oyunculara RP sonu yıldız (XP) vermesini sağlar.
     * @param {string} targetUid - Puanlanacak oyuncunun UID'si
     * @param {number} stars - 1 ile 5 arası yıldız
     */
    window.evaluatePlayerRP = function (targetUid, stars) {
        const db = getDb();
        const currentUser = window.currentUserData;

        if (!currentUser) {
            alert("Lütfen önce giriş yapın!");
            return;
        }

        // Yetki Kontrolü
        if (!STAFF_RANKS.includes(currentUser.rank)) {
            alert("Bu işlemi sadece RP Yetkilileri yapabilir!");
            return;
        }

        stars = parseInt(stars);
        if (isNaN(stars) || stars < 1 || stars > 5) {
            alert("Puanlama 1 ile 5 yıldız arasında olmalıdır!");
            return;
        }

        // 1 Yıldız = 20 XP (5 Yıldız = 100 XP)
        const earnedXP = stars * 20;
        const targetUserRef = db.ref('users/' + targetUid);

        targetUserRef.once('value', (snap) => {
            if (!snap.exists()) {
                alert("Oyuncu veritabanında bulunamadı!");
                return;
            }

            const player = snap.val();
            let newXP = (player.xp || 0) + earnedXP;
            let newLevel = player.level || 1;
            let leveledUp = false;

            // Seviye Atlama Hesabı
            let reqXP = newLevel * 100;
            while (newXP >= reqXP) {
                newXP -= reqXP;
                newLevel += 1;
                reqXP = newLevel * 100;
                leveledUp = true;
            }

            // Veritabanını Güncelle
            targetUserRef.update({
                xp: newXP,
                level: newLevel
            }).then(() => {
                alert(`⭐ ${player.displayName} adlı oyuncuya ${stars} Yıldız (${earnedXP} XP) verildi!`);

                // Genel Telsize Sistem Duyurusu Geç
                const systemMsgRef = db.ref('chats/Hepsi').push();
                systemMsgRef.set({
                    senderName: "SYSTEM // RP DENETİM",
                    senderRank: "SİSTEM",
                    message: `📢 [RP SONU PUANLAMA] Yetkili ${currentUser.displayName}, oyuncu ${player.displayName} kullanıcısını RP performansından dolayı ${stars}/5 Yıldız ⭐ ile değerlendirdi (+${earnedXP} XP)!${leveledUp ? ' 🎉 SEVİYE ATLADI!' : ''}`,
                    timestamp: Date.now()
                });
            });
        });
    };

    /**
     * Kullanıcı adıyla arayıp puan vermek isteyen yetkililer için kolaylaştırıcı fonksiyon
     */
    window.evaluatePlayerByName = function (playerName, stars) {
        const db = getDb();
        db.ref('users').once('value', (snap) => {
            let foundUid = null;
            snap.forEach(child => {
                if (child.val().displayName && child.val().displayName.toLowerCase() === playerName.toLowerCase()) {
                    foundUid = child.key;
                }
            });

            if (foundUid) {
                window.evaluatePlayerRP(foundUid, stars);
            } else {
                alert(`"${playerName}" isimli kullanıcı bulunamadı!`);
            }
        });
    };

})();
