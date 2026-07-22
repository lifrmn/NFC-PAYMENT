-- MIGRATION D: DUKUNGAN NOMINAL DESIMAL
-- Posisi       : dijalankan setelah a_, b_, dan c_.
-- Prasyarat    : tabel dasar tersedia dan nfc_transactions sudah memiliki
--                idempotencyKey dari migration b_.
-- Hasil akhir  : kolom saldo/nominal terkait menggunakan tipe REAL.
-- Penanganan   : data lama disalin dengan mempertahankan id, relasi, dan timestamp.
--
-- SQLite tidak mendukung ALTER COLUMN untuk mengganti tipe kolom secara langsung.
-- Karena itu setiap tabel mengikuti urutan aman berikut:
-- 1. Buat tabel sementara new_<nama> dengan struktur dan tipe baru.
-- 2. Salin setiap kolom dari tabel lama menggunakan INSERT ... SELECT.
-- 3. Hapus tabel lama setelah penyalinan berhasil.
-- 4. Ubah nama tabel sementara menjadi nama tabel asli.
-- 5. Buat kembali indeks yang dimiliki tabel tersebut.
--
-- Pemeriksaan foreign key dimatikan sementara karena tabel referensi diganti satu
-- per satu. defer_foreign_keys menunda validasi sampai rangkaian operasi selesai.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Ubah total saldo perangkat dari INTEGER menjadi REAL.
-- Kolom selain totalBalance tetap disalin tanpa perubahan.
CREATE TABLE "new_devices" (
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
    "totalBalance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- INSERT ... SELECT menyalin data lama, termasuk primary key, tanpa membuat data baru.
INSERT INTO "new_devices" ("appVersion", "createdAt", "deviceId", "deviceName", "id", "ipAddress", "isOnline", "lastSeen", "osVersion", "platform", "totalBalance", "totalUsers", "updatedAt") SELECT "appVersion", "createdAt", "deviceId", "deviceName", "id", "ipAddress", "isOnline", "lastSeen", "osVersion", "platform", "totalBalance", "totalUsers", "updatedAt" FROM "devices";
DROP TABLE "devices";
ALTER TABLE "new_devices" RENAME TO "devices";
CREATE UNIQUE INDEX "devices_deviceId_key" ON "devices"("deviceId");

-- Ubah saldo kartu NFC dari INTEGER menjadi REAL.
-- Indeks parsial satu kartu aktif tidak dibuat di blok ini; migration e_ akan
-- mengembalikannya setelah seluruh proses rebuild selesai.
CREATE TABLE "new_nfc_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL DEFAULT 'NTag215',
    "frequency" TEXT NOT NULL DEFAULT '13.56MHz',
    "userId" INTEGER,
    "cardStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "balance" REAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_nfc_cards" ("balance", "cardData", "cardId", "cardStatus", "cardType", "createdAt", "expiresAt", "frequency", "id", "isPhysical", "lastUsed", "metadata", "registeredAt", "updatedAt", "userId") SELECT "balance", "cardData", "cardId", "cardStatus", "cardType", "createdAt", "expiresAt", "frequency", "id", "isPhysical", "lastUsed", "metadata", "registeredAt", "updatedAt", "userId" FROM "nfc_cards";
DROP TABLE "nfc_cards";
ALTER TABLE "new_nfc_cards" RENAME TO "nfc_cards";
CREATE UNIQUE INDEX "nfc_cards_cardId_key" ON "nfc_cards"("cardId");
CREATE INDEX "nfc_cards_cardId_idx" ON "nfc_cards"("cardId");
CREATE INDEX "nfc_cards_userId_idx" ON "nfc_cards"("userId");
CREATE INDEX "nfc_cards_cardStatus_idx" ON "nfc_cards"("cardStatus");

-- Ubah nominal serta saldo sebelum/sesudah transaksi NFC menjadi REAL.
-- idempotencyKey dari migration b_ wajib ikut didefinisikan dan disalin agar
-- perlindungan retry top-up tidak hilang ketika tabel dibuat ulang.
CREATE TABLE "new_nfc_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amount" REAL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "location" TEXT,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "fraudScore" REAL,
    "metadata" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nfc_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "nfc_cards" ("cardId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_nfc_transactions" ("amount", "balanceAfter", "balanceBefore", "cardId", "createdAt", "deviceId", "errorMessage", "fraudScore", "id", "idempotencyKey", "ipAddress", "location", "metadata", "status", "transactionType") SELECT "amount", "balanceAfter", "balanceBefore", "cardId", "createdAt", "deviceId", "errorMessage", "fraudScore", "id", "idempotencyKey", "ipAddress", "location", "metadata", "status", "transactionType" FROM "nfc_transactions";
DROP TABLE "nfc_transactions";
ALTER TABLE "new_nfc_transactions" RENAME TO "nfc_transactions";
CREATE UNIQUE INDEX "nfc_transactions_idempotencyKey_key" ON "nfc_transactions"("idempotencyKey");
CREATE INDEX "nfc_transactions_cardId_idx" ON "nfc_transactions"("cardId");
CREATE INDEX "nfc_transactions_createdAt_idx" ON "nfc_transactions"("createdAt");

-- Ubah nominal transfer antarpengguna dari INTEGER menjadi REAL.
CREATE TABLE "new_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
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
INSERT INTO "new_transactions" ("amount", "createdAt", "description", "deviceId", "fraudDecision", "fraudReasons", "fraudRiskLevel", "fraudRiskScore", "id", "idempotencyKey", "ipAddress", "receiverId", "senderId", "status", "type", "updatedAt") SELECT "amount", "createdAt", "description", "deviceId", "fraudDecision", "fraudReasons", "fraudRiskLevel", "fraudRiskScore", "id", "idempotencyKey", "ipAddress", "receiverId", "senderId", "status", "type", "updatedAt" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");
CREATE INDEX "transactions_senderId_idx" ON "transactions"("senderId");
CREATE INDEX "transactions_receiverId_idx" ON "transactions"("receiverId");
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- Ubah saldo utama pengguna dari INTEGER menjadi REAL.
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("balance", "createdAt", "deviceId", "id", "isActive", "name", "password", "updatedAt", "username") SELECT "balance", "createdAt", "deviceId", "id", "isActive", "name", "password", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- Aktifkan kembali pemeriksaan foreign key setelah seluruh tabel selesai diganti.
-- Tahap ini harus berada paling akhir agar SQLite kembali menegakkan relasi normal.
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
