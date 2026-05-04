# 🔐 TROUBLESHOOTING AUTHENTICATION ERRORS

Panduan lengkap untuk mengatasi masalah authentication (Error 401/403) pada aplikasi NFC Payment.

---

## 📋 GEJALA ERROR

Jika Anda melihat error seperti ini di console:

```bash
ERROR  ❌ API Request failed: API Error 403: {"error":"Invalid token"}
ERROR  ❌ getUserTransactions error, returning empty array
WARN   🚪 Authentication error, logging out...
LOG    🚪 User logged out, session cleared
```

**Artinya:** JWT Token Anda tidak valid atau sudah expired.

---

## 🔍 PENYEBAB MASALAH

### **1. Token Expired (Paling Umum)**
- JWT Token valid selama **7 hari** dari saat login
- Setelah 7 hari, token otomatis expired
- Backend akan reject semua request dengan token expired

### **2. JWT_SECRET Berubah**
- Jika backend di-restart dengan JWT_SECRET berbeda
- Token yang sudah di-generate dengan secret lama tidak bisa di-verify

### **3. Session Dihapus dari Database**
- User logout dari device lain
- Admin menghapus session
- Database di-reset

### **4. User Account Dihapus/Diblokir**
- User account sudah tidak ada di database
- User di-block oleh admin

---

## ✅ SOLUSI LENGKAP

### **SOLUSI 1: Quick Fix (TERCEPAT)** ⚡

Aplikasi sudah dikonfigurasi dengan **App Secret Key** yang akan bypass JWT check untuk development mode.

**Langkah:**

1. **Restart Backend Server**
   ```powershell
   cd backend
   npm start
   ```
   Tunggu sampai muncul: `✅ Backend ready on http://localhost:4000`

2. **Pastikan Ngrok Running**
   ```powershell
   ngrok http 4000
   ```
   Copy URL ngrok

3. **Clear App Cache & Login Ulang**
   - Buka aplikasi mobile
   - Logout jika masih login
   - Close app completely
   - Buka lagi dan login

**✅ Seharusnya sudah fix!**

---

### **SOLUSI 2: Reset Authentication (JIKA SOLUSI 1 GAGAL)**

**Langkah:**

1. **Cek Backend Configuration**
   ```powershell
   # Buka file backend/.env
   notepad backend\.env
   ```
   
   **Pastikan ada:**
   ```env
   JWT_SECRET=nfc-payment-jwt-secret-2025-ultra-secure-key-change-in-production
   APP_SECRET=NFC2025SecureApp
   ```

2. **Cek Frontend Configuration**
   ```powershell
   # Buka file src/utils/configuration.ts
   notepad src\utils\configuration.ts
   ```
   
   **Pastikan ada:**
   ```typescript
   export const APP_SECRET = 'NFC2025SecureApp';
   ```

3. **Restart Backend**
   ```powershell
   cd backend
   npm start
   ```

4. **Clear Expo Cache**
   ```powershell
   expo start -c
   ```

5. **Login Ulang di Mobile App**

---

### **SOLUSI 3: Reset Database Session (TERAKHIR)**

Jika semua solusi di atas gagal, reset semua session di database:

```powershell
# 1. Buka Prisma Studio
cd backend
npx prisma studio

# 2. Di browser yang terbuka:
#    - Buka tabel "UserSession"
#    - Delete semua records (atau yang expired)
#    - Save

# 3. Restart backend
npm start

# 4. Login ulang di mobile app
```

---

## 🛠️ VERIFIKASI SOLUSI

### **Test 1: Health Check Backend**

Buka browser, akses:
```
https://your-ngrok-url.ngrok-free.dev/api/health
```

**Response yang benar:**
```json
{
  "status": "OK",
  "database": "connected",
  "timestamp": "2026-05-04T10:30:00.000Z",
  "version": "2.0.0"
}
```

✅ Jika dapat response seperti ini, backend berjalan dengan baik.

---

### **Test 2: Login Test**

1. Buka aplikasi mobile
2. Logout (jika masih login)
3. Login dengan kredensial:
   ```
   Email: test@example.com
   Password: password123
   ```

**Log yang benar di console:**
```
📱 API Call: POST https://your-ngrok-url/api/auth/login
📥 Response: 200
🔑 New token saved
✅ Login successful
```

✅ Jika berhasil login, authentication sudah fix!

---

### **Test 3: Get User Data**

Setelah login, coba akses dashboard:

**Log yang benar:**
```
📱 API Call: GET https://your-ngrok-url/api/users/[id]/public
📥 Response: 200
✅ Balance synced from backend for user [id]: 500000
```

✅ Jika bisa ambil data user, semuanya sudah bekerja!

---

## 🔄 CARA MENCEGAH ERROR INI

### **1. Gunakan App Secret Header (Development)**

File `src/utils/apiService.ts` sudah dikonfigurasi dengan:
```typescript
headers: {
  'x-app-key': APP_SECRET, // Bypass JWT check
  ...
}
```

Ini akan bypass JWT verification untuk development mode.

---

### **2. Implement Auto-Refresh Token (Production)**

Untuk production, implement auto-refresh token:

```typescript
// Di apiService.ts, tambahkan method:
async refreshToken() {
  try {
    const response = await this.post('/api/auth/refresh');
    this.token = response.token;
    await AsyncStorage.setItem('token', response.token);
    return true;
  } catch (error) {
    return false;
  }
}

// Di makeRequest(), sebelum throw error 401:
if (response.status === 401) {
  // Try refresh token
  const refreshed = await this.refreshToken();
  if (refreshed) {
    // Retry original request
    return await this.makeRequest(endpoint, options);
  }
  // If refresh failed, logout
  await this.logout();
}
```

---

### **3. Extend Token Expiration (Jika Perlu)**

Di `backend/routes/auth.js`, ubah token expiration:

```javascript
// Saat ini: 7 hari
const token = jwt.sign(
  { userId: user.id, username: user.username },
  jwtSecret,
  { expiresIn: '7d' } // Ubah ke '30d' untuk 30 hari
);
```

---

## 📊 FLOW AUTHENTICATION

```
┌─────────────────┐
│ User Login      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Backend Generate Token  │
│ - JWT signed with       │
│   JWT_SECRET            │
│ - Expires in 7 days     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Save to Database        │
│ - UserSession table     │
│ - token, expiresAt      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Return to Mobile App    │
│ - Token saved in        │
│   AsyncStorage          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Every API Request:      │
│ - Send Authorization:   │
│   Bearer <token>        │
│ - Also send x-app-key   │
│   (for dev mode)        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Backend Middleware:     │
│ 1. Check x-app-key      │
│    → bypass if match    │
│ 2. Verify JWT token     │
│ 3. Check session in DB  │
│ 4. Attach user to req   │
└────────┬────────────────┘
         │
         ├─── ✅ Valid → Process Request
         │
         └─── ❌ Invalid → Return 401/403
```

---

## 📝 CHECKLIST DEBUG

Jika masih error setelah semua solusi, ikuti checklist ini:

- [ ] Backend server running tanpa error
- [ ] Ngrok tunnel active dan URL di `configuration.ts` sudah benar
- [ ] `JWT_SECRET` di `backend/.env` tidak berubah
- [ ] `APP_SECRET` di `backend/.env` = 'NFC2025SecureApp'
- [ ] `APP_SECRET` di `src/utils/configuration.ts` = 'NFC2025SecureApp'
- [ ] Database accessible (test dengan Prisma Studio)
- [ ] UserSession table tidak kosong
- [ ] Mobile app sudah logout dan login ulang
- [ ] Expo cache sudah di-clear (`expo start -c`)

---

## 🆘 MASIH ERROR?

Jika masih error setelah semua langkah:

1. **Cek Backend Logs**
   ```powershell
   cd backend
   npm run dev
   # Lihat log detail saat login/request gagal
   ```

2. **Cek Frontend Logs**
   ```powershell
   # Di terminal Expo, lihat semua log
   # Cari log yang dimulai dengan ❌ atau ERROR
   ```

3. **Test Manual dengan Postman/Thunder Client**
   ```
   POST https://your-ngrok-url/api/auth/login
   Headers:
     Content-Type: application/json
     x-app-key: NFC2025SecureApp
   Body:
     {
       "username": "testuser",
       "password": "password123"
     }
   ```

4. **Reset Everything**
   ```powershell
   # Nuclear option: reset semua
   npm run clean
   npm run setup
   npm run db:setup
   cd backend
   npm start
   ```

---

## 📚 DOKUMENTASI TERKAIT

- **[NPM-COMMANDS-GUIDE.md](NPM-COMMANDS-GUIDE.md)** - Semua perintah npm
- **[TUTORIAL-LENGKAP.md](TUTORIAL-LENGKAP.md)** - Tutorial lengkap
- **[CONNECTION-GUIDE.md](CONNECTION-GUIDE.md)** - Connection troubleshooting
- **[BUG-FIXES-CHECKLIST.md](BUG-FIXES-CHECKLIST.md)** - Daftar bug fixes

---

## 🎯 KESIMPULAN

**Error 403/401 Invalid Token** adalah masalah yang umum terjadi dan mudah diperbaiki:

1. **Quick Fix:** Restart backend + clear app cache + login ulang ✅
2. **Prevention:** App sudah dikonfigurasi dengan `x-app-key` header untuk bypass JWT check di development mode
3. **Production:** Implement auto-refresh token mechanism

**Untuk development, solusi quick fix sudah cukup!** 🚀

---

**Last Updated:** Mei 2026
**Author:** NFC Payment Team
