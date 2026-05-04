# 📦 PANDUAN PERINTAH NPM - Aplikasi NFC Payment

Daftar lengkap semua perintah npm yang tersedia untuk menjalankan dan mengelola aplikasi.

---

## 🚀 PERINTAH UTAMA (PALING SERING DIPAKAI)

### **1. Install Dependencies**

**Install semua dependencies (Backend + Frontend + Admin):**
```powershell
npm run setup
```
✅ Jalankan ini pertama kali setelah clone project!

**Install dependencies per folder:**
```powershell
# Frontend/Mobile App
npm install

# Backend
cd backend

npm install
# Admin Dashboard
cd admin
npm install
```

---

### **2. Setup Database**

**Setup database lengkap (generate + push schema):**
```powershell
npm run db:setup
```

**Atau manual step-by-step:**
```powershell
cd backend

# Generate Prisma Client
npx prisma generate

# Push schema ke database
npx prisma db push
```

---

### **3. Menjalankan Aplikasi**

#### **🖥️ Backend Server**
```powershell
# Dari folder root
npm run backend

# Atau dari folder backend
cd backend
npm start
```
✅ Backend akan jalan di: http://localhost:4000

**Development mode (auto-restart):**
```powershell
cd backend
npm run dev
```

---

#### **📱 Mobile App (Expo)**
```powershell
# Dari folder root
npm start

# Atau pilihan lain
expo start
```

**Jalankan langsung di emulator/device:**
```powershell
# Android
npm run android

# iOS (Mac only)
npm run ios

# Web browser
npm run web
```

---

#### **🎨 Admin Dashboard**
```powershell
# Dari folder root
npm run admin

# Atau dari folder admin
cd admin
npm start
```
✅ Admin akan jalan di: http://localhost:3001

---

#### **🚀 Jalankan Semua Sekaligus**
```powershell
npm run dev:all
```
⚠️ **Catatan:** Ngrok harus dijalankan manual di terminal terpisah!

---

## 🏗️ BUILD & DEPLOYMENT

### **Build APK untuk Android**

**Preview build (testing):**
```powershell
npm run build:preview

# Atau dengan eas langsung
eas build --platform android --profile preview
```

**Production build:**
```powershell
npm run build:android

# Atau
eas build --platform android
```

**iOS build:**
```powershell
npm run build:ios

# Atau
eas build --platform ios
```

---

### **Submit ke Store**

```powershell
# Android (Google Play)
npm run submit:android

# iOS (App Store)
npm run submit:ios
```

---

## 🗃️ DATABASE MANAGEMENT

### **Prisma Commands**

**Generate Prisma Client:**
```powershell
cd backend
npm run db:generate

# Atau
npx prisma generate
```

**Push schema ke database:**
```powershell
cd backend
npm run db:push

# Atau
npx prisma db push
```

**Create migration:**
```powershell
cd backend
npm run db:migrate

# Atau
npx prisma migrate dev
```

**Open Prisma Studio (GUI Database):**
```powershell
cd backend
npm run db:studio

# Atau
npx prisma studio
```
✅ Prisma Studio akan buka di: http://localhost:5555

**Seed database (populate data awal):**
```powershell
cd backend
npm run db:seed
```

---

## 🧹 CLEANING & MAINTENANCE

### **Clear Cache**

**Clear Expo cache:**
```powershell
npm run clean:cache

# Atau
expo r -c
```

**Clear semua node_modules:**
```powershell
npm run clean:deps
```

**Clean all (cache + dependencies) dan reinstall:**
```powershell
npm run clean
```
⚠️ Ini akan hapus semua node_modules dan reinstall!

---

## 🧪 TESTING & DEBUGGING

### **Network Testing**

```powershell
npm run test:network
```
Ini akan show IP address Anda untuk testing koneksi.

---

### **Check Utilities**

**Cek saldo user:**
```powershell
cd backend
node check_balance.js
```

**Cek users di database:**
```powershell
cd backend
node check-users.js
```

**Simulasi transaksi:**
```powershell
cd backend
node simulasi-step-by-step.js
```

---

## 📋 REFERENSI LENGKAP SCRIPTS

### **Root Package.json Scripts**

| Command | Deskripsi |
|---------|-----------|
| `npm start` | Jalankan Expo dev server |
| `npm run android` | Jalankan di Android device/emulator |
| `npm run ios` | Jalankan di iOS (Mac only) |
| `npm run web` | Jalankan di web browser |
| `npm run build:android` | Build APK Android |
| `npm run build:ios` | Build iOS app |
| `npm run build:preview` | Build preview APK |
| `npm run setup` | Install semua dependencies |
| `npm run backend` | Jalankan backend server |
| `npm run admin` | Jalankan admin dashboard |
| `npm run dev:all` | Jalankan backend + admin + expo |
| `npm run db:setup` | Setup database lengkap |
| `npm run clean` | Clean cache + reinstall |
| `npm run clean:cache` | Clear Expo cache |
| `npm run clean:deps` | Hapus semua node_modules |

---

### **Backend Package.json Scripts**

| Command | Deskripsi |
|---------|-----------|
| `npm start` | Jalankan backend server |
| `npm run dev` | Development mode (nodemon) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema ke DB |
| `npm run db:migrate` | Create migration |
| `npm run db:studio` | Buka Prisma Studio |
| `npm run db:seed` | Populate data awal |

---

## 🎯 WORKFLOW DEVELOPMENT LENGKAP

### **Setup Pertama Kali (Sekali Saja)**

```powershell
# 1. Clone/Download project
cd "C:\Users\ASUS\skripku jadi"

# 2. Install semua dependencies
npm run setup

# 3. Setup database
npm run db:setup

# 4. Verify installation
cd backend
npm start
```
Jika backend jalan tanpa error, setup berhasil! ✅

---

### **Daily Development Workflow**

**Setiap kali mau coding/testing:**

```powershell
# Terminal 1: Backend
cd "C:\Users\ASUS\skripku jadi\backend"
npm run dev
# atau: npm start

# Terminal 2: Ngrok (wajib untuk mobile app)
ngrok http 4000
# Copy URL ngrok

# Terminal 3: Update configuration.ts dengan URL ngrok
# File: src/utils/configuration.ts
# export const API_URL = 'https://xxxx.ngrok-free.app';

# Terminal 4: Mobile App
cd "C:\Users\ASUS\skripku jadi"
npm start
# Scan QR code dengan Expo Go

# Terminal 5: Admin (opsional)
cd "C:\Users\ASUS\skripku jadi\admin"
npm start
# Buka http://localhost:3001
```

---

### **Build APK untuk Testing**

```powershell
# 1. Pastikan backend & ngrok running
# 2. Update configuration.ts dengan URL ngrok
# 3. Build APK
npm run build:preview

# 4. Tunggu 10-20 menit
# 5. Download APK dari link yang diberikan
# 6. Transfer ke HP dan install
```

---

## 🐛 TROUBLESHOOTING COMMANDS

### **Problem: Authentication Error (403/401 Invalid Token)**

**Gejala:**
```
ERROR ❌ API Request failed: API Error 403: {"error":"Invalid token"}
WARN 🚪 Authentication error, logging out...
```

**Penyebab:**
- Token JWT expired (lebih dari 7 hari)
- JWT_SECRET berubah di backend
- Session expired atau sudah logout

**Solusi Quick Fix:**
```powershell
# Mobile app sudah dikonfigurasi pakai x-app-key header
# yang akan bypass JWT check untuk development

# 1. Restart backend
cd backend
npm start

# 2. Clear app data dan login ulang
# Di mobile app: Logout → Clear cache → Login lagi
```

**Solusi Permanent:**
```powershell
# 1. Cek JWT_SECRET di backend/.env sama dengan yang di auth.js
# 2. Pastikan APP_SECRET di backend/.env = 'NFC2025SecureApp'
# 3. Restart backend
cd backend
npm start

# 4. Clear app cache dan rebuild
expo start -c

# Atau rebuild APK
npm run build:preview
```

---

### **Problem: Port 4000 already in use**

**Cari proses yang pakai port:**
```powershell
netstat -ano | findstr :4000
```

**Kill proses:**
```powershell
taskkill /PID [nomor_PID] /F

# Contoh:
taskkill /PID 12345 /F
```

---

### **Problem: Database error**

**Reset database:**
```powershell
cd backend
npx prisma generate
npx prisma db push
npm start
```

**Reset migration (danger!):**
```powershell
cd backend
npx prisma migrate reset
# Ini akan hapus semua data!
```

---

### **Problem: Node modules error**

**Reinstall dependencies:**
```powershell
# Hapus node_modules
npm run clean:deps

# Atau manual
rm -rf node_modules
rm -rf backend/node_modules
rm -rf admin/node_modules

# Reinstall
npm run setup
```

---

### **Problem: Expo cache error**

**Clear cache:**
```powershell
npm run clean:cache

# Atau
expo r -c

# Atau hapus manual
rm -rf .expo
rm -rf node_modules/.cache
```

---

### **Problem: Prisma client not generated**

```powershell
cd backend
npx prisma generate
```

---

## 🔧 ADVANCED COMMANDS

### **Prisma Advanced**

**Reset database (delete all data):**
```powershell
cd backend
npx prisma migrate reset
```
⚠️ **WARNING:** Ini akan hapus semua data!

**Format schema.prisma:**
```powershell
cd backend
npx prisma format
```

**Validate schema:**
```powershell
cd backend
npx prisma validate
```

**Deploy migrations (production):**
```powershell
cd backend
npx prisma migrate deploy
```

---

### **EAS Build Advanced**

**Check build status:**
```powershell
eas build:list
```

**Download APK:**
```powershell
eas build:download --platform android
```

**Configure EAS:**
```powershell
eas build:configure
```

---

### **Update Dependencies**

**Check outdated packages:**
```powershell
npm outdated
```

**Update all packages:**
```powershell
npm update
```

**Update specific package:**
```powershell
npm update package-name
```

---

## 📱 EXPO SPECIFIC COMMANDS

### **Expo Commands**

```powershell
# Start dev server
expo start

# Start with clear cache
expo start -c

# Start on specific platform
expo start --android
expo start --ios
expo start --web

# Run on device
expo run:android
expo run:ios

# Install Expo CLI globally
npm install -g expo-cli

# Update Expo
expo upgrade

# Doctor (check setup)
expo-doctor
```

---

## 🎨 DEVELOPMENT SHORTCUTS

### **Quick Commands**

```powershell
# Backend development
cd backend && npm run dev

# Frontend development
npm start

# Admin development
cd admin && npm start

# Database GUI
cd backend && npx prisma studio

# Check database
cd backend && node check-users.js

# Simulasi transaksi
cd backend && node simulasi-step-by-step.js
```

---

## 📚 USEFUL ONE-LINERS

```powershell
# Full setup from scratch
npm run setup && npm run db:setup && cd backend && npm start

# Reset everything and start fresh
npm run clean && npm run setup && npm run db:setup

# Quick restart backend
cd backend && npx prisma generate && npm start

# Build and check
npm run build:preview && eas build:list

# Monitor backend logs
cd backend && npm run dev
```

---

## 🎯 COMMAND CHEATSHEET

### **Most Used Commands**

```bash
# Setup (once)
npm run setup                    # Install all dependencies
npm run db:setup                 # Setup database

# Development (daily)
cd backend && npm start          # Start backend
ngrok http 4000                  # Start ngrok
npm start                        # Start mobile app
cd admin && npm start            # Start admin (optional)

# Database
cd backend && npx prisma studio  # Open DB GUI
cd backend && npx prisma db push # Update DB schema

# Build
npm run build:preview            # Build APK

# Clean
npm run clean:cache              # Clear cache
npm run clean                    # Clean & reinstall
```

---

## 💡 PRO TIPS

### **1. Aliases untuk PowerShell**

Tambahkan ke PowerShell profile untuk shortcut:

```powershell
# Edit profile
notepad $PROFILE

# Tambahkan aliases ini:
function backend { cd "C:\Users\ASUS\skripku jadi\backend"; npm start }
function frontend { cd "C:\Users\ASUS\skripku jadi"; npm start }
function admin { cd "C:\Users\ASUS\skripku jadi\admin"; npm start }
function dbgui { cd "C:\Users\ASUS\skripku jadi\backend"; npx prisma studio }

# Save dan reload:
. $PROFILE
```

Sekarang tinggal ketik: `backend`, `frontend`, `admin`, atau `dbgui` ✨

---

### **2. Batch File untuk Windows**

Buat file `start-backend.bat`:
```batch
@echo off
cd "C:\Users\ASUS\skripku jadi\backend"
npm start
pause
```

Buat file `start-app.bat`:
```batch
@echo off
cd "C:\Users\ASUS\skripku jadi"
npm start
pause
```

Double-click file .bat untuk instant start! 🚀

---

### **3. Development with Nodemon**

```powershell
cd backend
npm run dev
```
Backend akan auto-restart saat ada perubahan code! 🔄

---

## 📞 NEED HELP?

Jika ada error atau pertanyaan:
1. **[TUTORIAL-LENGKAP.md](TUTORIAL-LENGKAP.md)** - Tutorial lengkap
2. **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Quick reference
3. **[CONNECTION-GUIDE.md](CONNECTION-GUIDE.md)** - Connection issues
4. **[BUG-FIXES-CHECKLIST.md](BUG-FIXES-CHECKLIST.md)** - Common bugs

---

## ✅ QUICK CHECKLIST

Sebelum mulai development, pastikan:
- [ ] Node.js installed (`node --version`)
- [ ] PostgreSQL installed & running
- [ ] Ngrok installed
- [ ] Dependencies installed (`npm run setup`)
- [ ] Database setup (`npm run db:setup`)
- [ ] Backend running (`cd backend && npm start`)
- [ ] Ngrok running (`ngrok http 4000`)
- [ ] Configuration updated (`src/utils/configuration.ts`)

---

**Happy Coding! 🚀**

**Last Updated:** Mei 2026
