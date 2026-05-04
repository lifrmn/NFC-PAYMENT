# 💳 Sistem Pembayaran Digital dengan NFC

Aplikasi pembayaran digital menggunakan teknologi NFC (Near Field Communication) dengan deteksi fraud berbasis AI.

---

## 🚀 MULAI DI SINI!

### ⚡ Quick Start (3 Langkah)

Untuk menjalankan aplikasi, ikuti 3 langkah mudah ini:

1. **[TUTORIAL-LENGKAP.md](TUTORIAL-LENGKAP.md)** ⭐ **← BACA INI DULU!**
   - Tutorial lengkap dari awal sampai akhir
   - Step-by-step super detail
   - Perfect untuk pemula

2. **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** ⚡
   - Panduan cepat untuk daily use
   - 3 langkah: Backend → Ngrok → App

3. **[NPM-COMMANDS-GUIDE.md](NPM-COMMANDS-GUIDE.md)** 📦
   - Daftar lengkap semua perintah npm
   - Reference untuk semua scripts
   - Troubleshooting commands

4. **[FLOWCHART-STARTUP.md](FLOWCHART-STARTUP.md)** 📊
   - Visual diagram alur sistem
   - Untuk pemahaman arsitektur

---

## 📋 Tentang Sistem

### ✨ Fitur Utama

- ✅ **Autentikasi User** - Register & Login dengan JWT
- ✅ **Manajemen Kartu NFC** - Register dan kelola kartu
- ✅ **Pembayaran NFC** - Tap & pay dengan kartu NFC
- ✅ **Deteksi Fraud AI** - Z-Score based fraud detection
- ✅ **Admin Dashboard** - Monitor & kelola sistem
- ✅ **Real-time Updates** - WebSocket untuk update langsung
- ✅ **Riwayat Transaksi** - Tracking lengkap semua transaksi

### 🛠️ Teknologi yang Digunakan

**Frontend (Mobile App):**
- React Native + Expo
- React Navigation
- React Native NFC Manager
- React Native Paper (UI)
- AsyncStorage

**Backend:**
- Node.js + Express
- Prisma ORM
- PostgreSQL Database
- JWT Authentication
- bcrypt untuk password hashing
- Socket.IO untuk real-time

**Tools:**
- Ngrok (untuk tunneling)
- EAS Build (untuk APK)

---

## 📱 Tampilan Aplikasi

```
┌─────────────────────┐
│   LOGIN SCREEN      │  ──►  Register/Login
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   DASHBOARD         │  ──►  Main menu
│  - Register Card    │
│  - My Cards         │
│  - Make Payment     │
│  - History          │
└─────────────────────┘
          │
          ├──► Register Card  ──►  Scan NFC + Set Balance
          │
          ├──► My Cards       ──►  View Cards & Balance
          │
          └──► Make Payment   ──►  Scan NFC + Enter Amount
                                   ──► Fraud Check
                                   ──► Process Payment
```

---

## 🏗️ Arsitektur Sistem

```
┌──────────────┐         ┌──────────┐         ┌─────────────┐
│  Mobile App  │ ◄─────► │  Ngrok   │ ◄─────► │   Backend   │
│  (Frontend)  │  HTTPS  │  Tunnel  │  HTTP   │   Server    │
└──────────────┘         └──────────┘         └──────┬──────┘
      ▲                                              │
      │ Scan NFC                                     │
      │                                              ▼
┌──────────────┐                            ┌─────────────┐
│  NFC Card    │                            │  PostgreSQL │
│  (Physical)  │                            │  Database   │
└──────────────┘                            └─────────────┘
```

---

## 📚 Dokumentasi Lengkap

### 🎯 Tutorial & Setup

- **[TUTORIAL-LENGKAP.md](TUTORIAL-LENGKAP.md)** - Tutorial lengkap step-by-step ⭐
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Quick reference 3 langkah ⚡
- **[NPM-COMMANDS-GUIDE.md](NPM-COMMANDS-GUIDE.md)** - Daftar lengkap perintah npm 📦
- **[FLOWCHART-STARTUP.md](FLOWCHART-STARTUP.md)** - Diagram alur sistem 📊
- **[TUTORIAL-MENJALANKAN-SISTEM.md](TUTORIAL-MENJALANKAN-SISTEM.md)** - Tutorial alternatif
- **[QUICK-START.md](QUICK-START.md)** - Quick start guide
- **[CARA-MENJALANKAN.md](CARA-MENJALANKAN.md)** - Cara menjalankan

### 📖 Dokumentasi Sistem

- **[PANDUAN-LENGKAP-SISTEM.md](PANDUAN-LENGKAP-SISTEM.md)** - Dokumentasi lengkap sistem
- **[PENJELASAN-FILE-BY-FILE.md](PENJELASAN-FILE-BY-FILE.md)** - Penjelasan setiap file
- **[INDEX-DOKUMENTASI.md](INDEX-DOKUMENTASI.md)** - Index semua dokumentasi
- **[TUTORIAL-ADMIN-DASHBOARD.md](TUTORIAL-ADMIN-DASHBOARD.md)** - Admin dashboard guide

### 🔧 Setup & Configuration

- **[SETUP-NGROK.md](SETUP-NGROK.md)** - Setup Ngrok tunnel
- **[CONNECTION-GUIDE.md](CONNECTION-GUIDE.md)** - Connection troubleshooting
- **[CHECKLIST-SETUP.md](CHECKLIST-SETUP.md)** - Setup checklist

### 💳 NFC & Payment

- **[NFC-CARD-INTEGRATION.md](NFC-CARD-INTEGRATION.md)** - Integrasi NFC
- **[PAYMENT-FLOW-UPDATE.md](PAYMENT-FLOW-UPDATE.md)** - Payment flow
- **[ADMIN-GUIDE-NFC.md](ADMIN-GUIDE-NFC.md)** - Admin NFC guide

### 🧪 Testing & Status

- **[TESTING-REPORT.md](TESTING-REPORT.md)** - Hasil testing
- **[BUG-FIXES-CHECKLIST.md](BUG-FIXES-CHECKLIST.md)** - Bug fixes
- **[SYSTEM_STATUS.md](SYSTEM_STATUS.md)** - Status sistem
- **[IMPLEMENTATION-COMPLETE.md](IMPLEMENTATION-COMPLETE.md)** - Implementation status

### 🎓 Untuk Skripsi

- **[BAB-1-SKRIPSI.md](BAB-1-SKRIPSI.md)** - Bab 1 (Pendahuluan)
- **[LATAR-BELAKANG-LENGKAP.md](LATAR-BELAKANG-LENGKAP.md)** - Latar belakang
- **[LANDASAN-TEORI-SIGMOID.md](LANDASAN-TEORI-SIGMOID.md)** - Landasan teori
- **[LITERATUR-REKOMENDASI.md](LITERATUR-REKOMENDASI.md)** - Referensi
- **[SKRIPSI-REFERENCE.md](SKRIPSI-REFERENCE.md)** - Reference skripsi

---

## ⚙️ Perintah Berguna

### Setup Pertama Kali

```powershell
# Install dependencies semua folder
npm run setup

# Setup database
npm run db:setup
```

### Menjalankan Aplikasi

```powershell
# Backend (Terminal 1)
cd backend
npm start

# Ngrok (Terminal 2)
ngrok http 4000

# Mobile App (Terminal 3)
npm start

# Admin Dashboard (Terminal 4 - opsional)
cd admin
npm start
```

### Build APK

```powershell
# Build preview APK
npm run build:preview

# Atau dengan EAS
eas build --platform android --profile preview
```

### Database Management

```powershell
# Generate Prisma client
cd backend
npx prisma generate

# Push schema ke database
npx prisma db push

# Migrate database
npx prisma migrate dev

# Buka Prisma Studio (GUI)
npx prisma studio
```

---

## 🐛 Troubleshooting

### Backend tidak bisa diakses
- Pastikan backend running (Terminal 1)
- Pastikan ngrok running (Terminal 2)
- Cek URL ngrok sudah benar di `configuration.ts`

### Database error
```powershell
cd backend
npx prisma generate
npx prisma db push
npm start
```

### Port 4000 already in use
```powershell
netstat -ano | findstr :4000
taskkill /PID [PID] /F
npm start
```

### NFC tidak terdeteksi
- Aktifkan NFC di settings HP
- Pastikan HP support NFC
- Restart aplikasi

---

## 📊 Struktur Folder

```
skripku jadi/
│
├── src/                        Mobile app source code
│   ├── screens/                UI screens
│   ├── components/             Reusable components
│   ├── hooks/                  Custom hooks
│   └── utils/                  Utilities & API
│
├── backend/                    Backend server
│   ├── server.js               Main server file
│   ├── routes/                 API routes
│   ├── middleware/             Middlewares
│   └── prisma/                 Database & schema
│
├── admin/                      Admin dashboard
│   ├── simple-admin.js         Admin server
│   └── simple-dashboard.html   Admin UI
│
└── *.md                        Dokumentasi lengkap
```

---

## 👥 User Roles

### Regular User
- Register & login
- Register NFC cards
- Make payments
- View transaction history
- Manage cards

### Admin
- Monitor all transactions
- Manage users
- View statistics
- Fraud monitoring
- System management

---

## 🔒 Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Input validation
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS protection
- ✅ Fraud detection AI

---

## 📈 Fraud Detection

Sistem menggunakan **Z-Score Analysis** untuk deteksi fraud:

```
Z-Score = (Amount - Average) / Standard Deviation

Risk Level:
- |Z| < 1.5σ  : LOW (Allow)
- 1.5 ≤ |Z| < 2.5 : MEDIUM (Warn)
- |Z| ≥ 2.5σ  : HIGH (Block)
```

---

## 🎯 Testing Checklist

- ✅ User registration & login
- ✅ NFC card registration
- ✅ Balance checking
- ✅ Payment processing
- ✅ Transaction history
- ✅ Fraud detection
- ✅ Admin dashboard
- ✅ Real-time updates

---

## 📱 Requirements

**Software:**
- Node.js v16+
- PostgreSQL 15+
- Ngrok (free account)
- Expo CLI
- Android Studio (untuk emulator)

**Hardware:**
- Android phone dengan NFC
- Minimal 2 kartu NFC
- PC/Laptop untuk development

---

## 🚦 Status Project

```
✅ Backend Server       - READY
✅ Database Schema      - READY
✅ Authentication       - READY
✅ NFC Integration      - READY
✅ Payment System       - READY
✅ Fraud Detection      - READY
✅ Admin Dashboard      - READY
✅ Mobile App           - READY
✅ Testing              - COMPLETE
✅ Documentation        - COMPLETE
```

---

## 🎓 Untuk Skripsi

Dokumentasi ini dibuat untuk mendukung penulisan skripsi tentang:
- Sistem pembayaran digital
- Teknologi NFC
- Deteksi fraud dengan AI
- Keamanan aplikasi mobile

**Lihat folder dokumentasi untuk referensi skripsi lengkap!**

---

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Baca **[TUTORIAL-LENGKAP.md](TUTORIAL-LENGKAP.md)**
2. Cek **[BUG-FIXES-CHECKLIST.md](BUG-FIXES-CHECKLIST.md)**
3. Lihat **[CONNECTION-GUIDE.md](CONNECTION-GUIDE.md)**

---

## 📄 License

MIT License - Free to use for educational purposes

---

## 🎉 Happy Coding!

Semoga aplikasi ini bermanfaat untuk skripsi Anda! 🚀

**Dibuat dengan ❤️ menggunakan React Native & Node.js**

---

**Last Updated:** Mei 2026
