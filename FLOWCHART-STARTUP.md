# 🎬 FLOWCHART - Urutan Menjalankan Aplikasi

Diagram visual untuk memahami urutan startup aplikasi NFC Payment.

---

## 📊 DIAGRAM STARTUP SEQUENCE

```
┌─────────────────────────────────────────────────────────────┐
│                    MULAI SETUP PERTAMA KALI                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │  Install Node.js    │
                  │  Install PostgreSQL │
                  │  Install Ngrok      │
                  └──────────┬──────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │   Setup Database    │
                  │  cd backend         │
                  │  npm install        │
                  │  npx prisma generate│
                  │  npx prisma db push │
                  └──────────┬──────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │         SETUP SELESAI!                     │
        │  (Hanya sekali, tidak perlu diulang)       │
        └───────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│              SETIAP KALI MAU JALANKAN APLIKASI                │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Terminal 1: Backend Server   │
        │  cd backend                   │
        │  npm start                    │
        │  ✅ Listen on port 4000       │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Terminal 2: Ngrok Tunnel     │
        │  ngrok http 4000              │
        │  ✅ Copy URL ngrok            │
        │  https://xxxx.ngrok-free.app  │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Update Configuration         │
        │  File: configuration.ts       │
        │  API_URL = [URL ngrok]        │
        │  ✅ Save file                 │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Terminal 3: Mobile App       │
        │  npm start                    │
        │  ✅ Scan QR dengan Expo Go    │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  (Opsional) Terminal 4:       │
        │  Admin Dashboard              │
        │  cd admin                     │
        │  npm start                    │
        │  ✅ Buka http://localhost:3001│
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   ✅ APLIKASI SIAP DIPAKAI!   │
        └───────────────────────────────┘
```

---

## 🔄 FLOW PENGGUNAAN APLIKASI

```
┌────────────────────────────────────────────────────────────────┐
│                     USER OPENS MOBILE APP                       │
└────────────────────────────┬───────────────────────────────────┘
                             │
                ┌────────────┴───────────┐
                │                        │
                ▼                        ▼
        ┌───────────────┐        ┌───────────────┐
        │  NEW USER?    │        │  EXISTING?    │
        │  → REGISTER   │        │  → LOGIN      │
        └───────┬───────┘        └───────┬───────┘
                │                        │
                └────────────┬───────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   DASHBOARD     │
                    │  (Main Screen)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌──────────────┐
│ REGISTER      │    │  MY CARDS     │    │ MAKE PAYMENT │
│ NFC CARD      │    │  (View Cards) │    │  (Pay)       │
└───────┬───────┘    └───────┬───────┘    └──────┬───────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌──────────────┐
│ Scan NFC      │    │ View Balance  │    │ Scan NFC     │
│ Enter Amount  │    │ View History  │    │ Enter Amount │
│ Submit        │    │               │    │ Confirm      │
└───────┬───────┘    └───────────────┘    └──────┬───────┘
        │                                         │
        │                                         ▼
        │                                 ┌───────────────┐
        │                                 │ FRAUD CHECK   │
        │                                 │ (Backend AI)  │
        │                                 └───────┬───────┘
        │                                         │
        │                                         ▼
        │                                 ┌───────────────┐
        │                                 │ Update Balance│
        │                                 │ Save to DB    │
        │                                 └───────┬───────┘
        │                                         │
        └─────────────────────┬───────────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │   SUCCESS!    │
                      │ Card Registered│
                      │ or Payment OK │
                      └───────────────┘
```

---

## 🔍 DATA FLOW DIAGRAM

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  MOBILE APP  │ ◄─────► │   NGROK      │ ◄─────► │   BACKEND    │
│  (Frontend)  │   HTTP  │   TUNNEL     │   HTTP  │   SERVER     │
│              │ Requests│              │ Requests│              │
└──────────────┘         └──────────────┘         └──────┬───────┘
       ▲                                                  │
       │                                                  │
       │ Scan NFC                                         │ SQL
       │                                                  ▼
       │                                          ┌──────────────┐
┌──────┴───────┐                                 │  POSTGRESQL  │
│  NFC CARD    │                                 │   DATABASE   │
│  (Hardware)  │                                 │              │
└──────────────┘                                 └──────────────┘

                            ┌─────────────────┐
                            │ ADMIN DASHBOARD │
                            │  (Web Browser)  │
                            └────────┬────────┘
                                     │ HTTP
                                     ▼
                            ┌─────────────────┐
                            │  ADMIN SERVER   │
                            │   Port 3001     │
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  SAME DATABASE  │
                            │   (Shared)      │
                            └─────────────────┘
```

---

## 🌐 NETWORK ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  NGROK CLOUD   │
                    │  ngrok-free.app│
                    └────────┬───────┘
                             │
                             │ Tunnel
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                   LOCAL MACHINE (Your PC)                       │
│                            │                                    │
│                            ▼                                    │
│               ┌────────────────────┐                            │
│               │  NGROK CLIENT      │                            │
│               │  Port Forwarder    │                            │
│               └─────────┬──────────┘                            │
│                         │                                       │
│                         ▼                                       │
│               ┌────────────────────┐                            │
│               │  BACKEND SERVER    │                            │
│               │  localhost:4000    │                            │
│               └─────────┬──────────┘                            │
│                         │                                       │
│                         ▼                                       │
│               ┌────────────────────┐                            │
│               │   DATABASE         │                            │
│               │   PostgreSQL       │                            │
│               │   localhost:5432   │                            │
│               └────────────────────┘                            │
│                                                                 │
│               ┌────────────────────┐                            │
│               │  ADMIN DASHBOARD   │                            │
│               │  localhost:3001    │                            │
│               └────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                             │ WiFi/4G
                             │
                    ┌────────┴───────┐
                    │  MOBILE APP    │
                    │  (Android/iOS) │
                    └────────────────┘
```

---

## 🔐 AUTHENTICATION FLOW

```
┌──────────────┐
│  USER LOGIN  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ POST /api/auth/login │
│ Email + Password     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Backend:             │
│ 1. Cek user di DB    │
│ 2. Verify password   │
│    (bcrypt compare)  │
└──────┬───────────────┘
       │
       ├─── ❌ Invalid ──► Error Response
       │
       ▼ ✅ Valid
┌──────────────────────┐
│ Generate JWT Token   │
│ (jsonwebtoken)       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Return Token to App  │
│ Store in AsyncStorage│
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ All API Requests:    │
│ Header: Authorization│
│ Bearer [token]       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Middleware:          │
│ Verify JWT Token     │
│ Attach user to req   │
└──────┬───────────────┘
       │
       ├─── ❌ Invalid ──► 401 Unauthorized
       │
       ▼ ✅ Valid
┌──────────────────────┐
│ Process Request      │
│ Access Protected API │
└──────────────────────┘
```

---

## 💳 NFC PAYMENT FLOW

```
┌────────────────┐
│  Tap NFC Card  │
└────────┬───────┘
         │
         ▼
┌────────────────────┐
│  Read NFC Tag ID   │
│  (react-native-nfc)│
└────────┬───────────┘
         │
         ▼
┌────────────────────────┐
│  User Input Amount     │
│  Confirm Transaction   │
└────────┬───────────────┘
         │
         ▼
┌─────────────────────────────┐
│  POST /api/transactions     │
│  {                          │
│    nfcCardId: "xxx",        │
│    amount: 50000,           │
│    type: "PAYMENT"          │
│  }                          │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Backend: Fraud Detection   │
│  1. Get user history        │
│  2. Calculate Z-Score       │
│  3. Risk assessment         │
└────────┬────────────────────┘
         │
         ├──── ⚠️ HIGH RISK ──► Block Transaction
         │
         ▼ ✅ SAFE
┌─────────────────────────────┐
│  Process Transaction        │
│  1. Check balance           │
│  2. Deduct amount           │
│  3. Save to database        │
│  4. Update card balance     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Return Success Response    │
│  {                          │
│    status: "success",       │
│    newBalance: 450000,      │
│    transaction: {...}       │
│  }                          │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Update UI                  │
│  Show success message       │
│  Refresh balance            │
└─────────────────────────────┘
```

---

## 📱 APP SCREENS HIERARCHY

```
┌─────────────────────────────────────────┐
│           APP.TSX (Root)                │
│  Navigation Container                   │
└───────────────────┬─────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ AUTH STACK    │       │  MAIN STACK   │
│ (Not Logged)  │       │  (Logged In)  │
└───────┬───────┘       └───────┬───────┘
        │                       │
        ├─► LoginScreen         ├─► DashboardScreen
        └─► RegisterScreen      ├─► MyCardsScreen
                                ├─► NFCScreen (Scan)
                                ├─► RegisterCardScreen
                                └─► (More screens...)
```

---

## 🗂️ BACKEND API STRUCTURE

```
/api
├── /auth
│   ├── POST /register      (Register new user)
│   └── POST /login         (Login user)
│
├── /users
│   ├── GET  /profile       (Get user profile)
│   └── PUT  /profile       (Update profile)
│
├── /nfcCards
│   ├── POST   /register    (Register NFC card)
│   ├── GET    /my-cards    (Get user cards)
│   ├── GET    /:id         (Get card detail)
│   └── DELETE /:id         (Remove card)
│
├── /transactions
│   ├── POST /create        (Create transaction)
│   ├── GET  /history       (Get transaction history)
│   └── GET  /:id           (Get transaction detail)
│
├── /devices
│   └── POST /register      (Register device)
│
├── /fraud
│   └── POST /analyze       (Analyze transaction)
│
└── /admin
    ├── GET  /users         (List all users)
    ├── GET  /transactions  (List all transactions)
    ├── GET  /cards         (List all cards)
    └── GET  /stats         (Get statistics)
```

---

## 📦 FOLDER STRUCTURE

```
skripku jadi/
│
├── src/                        (Mobile App Source)
│   ├── screens/                (UI Screens)
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── NFCScreen.tsx
│   │   └── ...
│   ├── components/             (Reusable Components)
│   ├── hooks/                  (Custom React Hooks)
│   └── utils/                  (Utility Functions)
│       ├── apiService.ts       (API calls)
│       ├── configuration.ts    (Config)
│       └── nfc.ts              (NFC utilities)
│
├── backend/                    (Backend Server)
│   ├── server.js               (Main server)
│   ├── routes/                 (API Routes)
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── nfcCards.js
│   │   └── transactions.js
│   ├── middleware/             (Middlewares)
│   │   ├── auth.js
│   │   └── errorHandler.js
│   └── prisma/                 (Database)
│       └── schema.prisma       (DB Schema)
│
└── admin/                      (Admin Dashboard)
    ├── simple-admin.js         (Admin Server)
    └── simple-dashboard.html   (Admin UI)
```

---

## 🎓 UNTUK SKRIPSI

Gunakan diagram-diagram di atas untuk:
- **Bab 3:** Diagram alir sistem
- **Bab 3:** Arsitektur aplikasi
- **Bab 3:** Flowchart algoritma
- **Bab 4:** Implementasi sistem
- **Presentasi:** Visual aids

---

## 📚 REFERENSI

Untuk penjelasan lebih detail:
- **[TUTORIAL-LENGKAP.md](TUTORIAL-LENGKAP.md)** - Step-by-step lengkap
- **[PANDUAN-LENGKAP-SISTEM.md](PANDUAN-LENGKAP-SISTEM.md)** - Dokumentasi sistem
- **[PENJELASAN-FILE-BY-FILE.md](PENJELASAN-FILE-BY-FILE.md)** - Penjelasan code

---

**Dibuat untuk mempermudah pemahaman sistem 🚀**
