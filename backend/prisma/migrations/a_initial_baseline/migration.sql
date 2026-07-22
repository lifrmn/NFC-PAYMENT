-- MIGRATION A: STRUKTUR AWAL DATABASE
-- Posisi       : harus dijalankan pertama.
-- Prasyarat    : database SQLite kosong; tidak bergantung pada migration lain.
-- Hasil akhir  : seluruh tabel, relasi, dan indeks dasar aplikasi tersedia.
-- Penanganan   : migration ini tidak menambahkan akun atau data contoh.
-- Alasan awalan a_: baseline harus tersedia sebelum ALTER TABLE pada tahap b/c
--                   dan sebelum tabel dibuat ulang pada tahap d.
--
-- Konvensi penting:
-- - PRIMARY KEY AUTOINCREMENT memberi identitas numerik unik pada setiap baris.
-- - NOT NULL mewajibkan nilai; kolom tanpa NOT NULL boleh bernilai NULL.
-- - DEFAULT menyediakan nilai awal ketika aplikasi tidak mengirim nilai.
-- - FOREIGN KEY menjaga referensi antartabel agar tidak menunjuk data yang salah.
-- - CREATE UNIQUE INDEX mencegah duplikasi; CREATE INDEX mempercepat pencarian.

-- Menyimpan akun pengguna, saldo dompet, perangkat terakhir, dan status akun.
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Menyimpan transfer antarpengguna beserta hasil analisis fraud dan kunci idempotensi.
-- senderId dan receiverId wajib menunjuk pengguna yang masih ada. ON DELETE RESTRICT
-- mencegah pengguna dihapus sebelum histori transaksinya ditangani dengan benar.
CREATE TABLE "transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'transfer',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "description" TEXT,
    "deviceId" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fraudRiskScore" REAL,
    "fraudRiskLevel" TEXT,
    "fraudDecision" TEXT,
    "fraudReasons" TEXT,
    "idempotencyKey" TEXT,
    CONSTRAINT "transactions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Menyimpan peringatan fraud yang perlu ditinjau atau diblokir oleh sistem/admin.
-- Relasi user/transaction dibuat opsional. ON DELETE SET NULL mempertahankan bukti
-- alert walaupun objek yang dirujuk kemudian sudah tidak tersedia.
CREATE TABLE "fraud_alerts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "transactionId" INTEGER,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "riskScore" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "riskFactors" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "idempotencyKey" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fraud_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fraud_alerts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Menyimpan perangkat Android yang pernah terhubung ke aplikasi.
CREATE TABLE "devices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "appVersion" TEXT,
    "osVersion" TEXT,
    "ipAddress" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "totalBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Menyimpan token sesi aktif agar logout dan pemblokiran akun dapat mencabut akses.
-- Token diberi indeks unik di bagian akhir agar satu token tidak dimiliki dua sesi.
CREATE TABLE "user_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Mencatat tindakan admin untuk kebutuhan audit dan penelusuran perubahan.
CREATE TABLE "admin_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Menyimpan pengaturan sistem dalam bentuk pasangan key dan value.
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string'
);

-- Menyimpan kartu NFC, akun terkait kartu, saldo kartu, dan status aktif/blokir.
-- userId boleh NULL untuk kartu yang belum ditautkan. Jika pengguna dihapus, kartu
-- dipertahankan tetapi relasi akunnya dikosongkan melalui ON DELETE SET NULL.
CREATE TABLE "nfc_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL DEFAULT 'NTag215',
    "frequency" TEXT NOT NULL DEFAULT '13.56MHz',
    "userId" INTEGER,
    "cardStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isPhysical" BOOLEAN NOT NULL DEFAULT true,
    "cardData" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "nfc_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Menyimpan riwayat perubahan saldo yang dilakukan melalui kartu NFC.
-- balanceBefore dan balanceAfter menyediakan jejak saldo sebelum/sesudah operasi.
-- ON DELETE RESTRICT mencegah kartu dihapus selama histori ini masih merujuknya.
CREATE TABLE "nfc_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amount" INTEGER,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "location" TEXT,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "fraudScore" REAL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nfc_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "nfc_cards" ("cardId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Indeks unik mencegah duplikasi data penting; indeks biasa mempercepat pencarian.
-- SQLite mengizinkan beberapa nilai NULL pada unique index. Karena itu kunci
-- idempotensi boleh kosong untuk data lama, tetapi tidak boleh berulang jika diisi.
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");
CREATE INDEX "transactions_senderId_idx" ON "transactions"("senderId");
CREATE INDEX "transactions_receiverId_idx" ON "transactions"("receiverId");
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");
CREATE UNIQUE INDEX "fraud_alerts_idempotencyKey_key" ON "fraud_alerts"("idempotencyKey");
CREATE UNIQUE INDEX "devices_deviceId_key" ON "devices"("deviceId");
CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");
CREATE UNIQUE INDEX "nfc_cards_cardId_key" ON "nfc_cards"("cardId");
CREATE INDEX "nfc_cards_cardId_idx" ON "nfc_cards"("cardId");
CREATE INDEX "nfc_cards_userId_idx" ON "nfc_cards"("userId");
CREATE INDEX "nfc_cards_cardStatus_idx" ON "nfc_cards"("cardStatus");
CREATE INDEX "nfc_transactions_cardId_idx" ON "nfc_transactions"("cardId");
CREATE INDEX "nfc_transactions_createdAt_idx" ON "nfc_transactions"("createdAt");

-- Prisma tidak dapat mendefinisikan indeks parsial SQLite ini langsung di schema.prisma.
-- Aturan ini membatasi setiap pengguna hanya memiliki satu kartu berstatus ACTIVE.
-- Kartu tanpa akun terkait dan kartu nonaktif tidak termasuk dalam pemeriksaan unik.
CREATE UNIQUE INDEX "nfc_cards_one_active_per_user_key"
ON "nfc_cards"("userId")
WHERE "userId" IS NOT NULL AND "cardStatus" = 'ACTIVE';