-- CreateTable: membuat tabel nfc_cards untuk menyimpan data kartu NFC fisik
CREATE TABLE "nfc_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    -- primary key auto-increment: ID unik kartu yang bertambah otomatis
    "cardId" TEXT NOT NULL,
    -- UID fisik kartu NFC (7 bytes hex, contoh: 04AB12CD78EF90)
    "cardType" TEXT NOT NULL DEFAULT 'NTag215',
    -- tipe kartu NFC; default NTag215 (NXP Semiconductors)
    "frequency" TEXT NOT NULL DEFAULT '13.56MHz',
    -- frekuensi RF kartu; standar NFC adalah 13.56 MHz
    "userId" INTEGER,
    -- foreign key ke tabel users; nullable agar kartu bisa ada sebelum di-link user
    "cardStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    -- status kartu: ACTIVE, BLOCKED, LOST, EXPIRED; default ACTIVE saat pertama didaftarkan
    "balance" REAL NOT NULL DEFAULT 0,
    -- saldo kartu dalam Rupiah; REAL = angka desimal; default 0 saat didaftarkan
    "lastUsed" DATETIME,
    -- waktu terakhir kartu digunakan untuk transaksi; nullable karena kartu baru belum pernah dipakai
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- waktu kartu didaftarkan ke sistem; otomatis diisi saat INSERT
    "expiresAt" DATETIME,
    -- waktu kadaluarsa kartu; nullable karena NTag215 tidak punya expiry hardware
    "isPhysical" BOOLEAN NOT NULL DEFAULT true,
    -- flag apakah ini kartu fisik (NFC tag) atau virtual; default true
    "cardData" TEXT,
    -- data tambahan kartu dalam format JSON atau terenkripsi; nullable
    "metadata" TEXT,
    -- metadata tambahan dalam format JSON; nullable; untuk keperluan debugging
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- waktu record dibuat di database; otomatis diisi
    "updatedAt" DATETIME NOT NULL,
    -- waktu record terakhir diperbarui; otomatis diperbarui oleh Prisma
    CONSTRAINT "nfc_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    -- foreign key constraint: jika user dihapus, userId di kartu di-set NULL (tidak ikut terhapus)
);

-- CreateTable: membuat tabel nfc_transactions untuk log penggunaan kartu NFC
CREATE TABLE "nfc_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    -- primary key auto-increment untuk setiap log tap kartu
    "cardId" TEXT NOT NULL,
    -- UID kartu yang digunakan; foreign key ke nfc_cards.cardId
    "transactionType" TEXT NOT NULL,
    -- jenis operasi: TAP, PAYMENT, TOPUP, REGISTER, dll
    "amount" REAL,
    -- nominal transaksi dalam Rupiah; nullable karena TAP analytics tidak punya amount
    "balanceBefore" REAL NOT NULL,
    -- saldo kartu sebelum transaksi (untuk audit trail)
    "balanceAfter" REAL NOT NULL,
    -- saldo kartu setelah transaksi (untuk audit trail)
    "deviceId" TEXT NOT NULL,
    -- ID perangkat Android yang membaca kartu; untuk analytics
    "location" TEXT,
    -- lokasi transaksi; nullable; untuk analytics dan fraud detection
    "ipAddress" TEXT,
    -- IP address device; nullable; untuk audit dan fraud detection
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    -- status operasi: SUCCESS, FAILED, BLOCKED; default SUCCESS
    "errorMessage" TEXT,
    -- pesan error jika status FAILED; nullable
    "fraudScore" REAL,
    -- skor risiko fraud dari Z-Score; nullable karena tidak semua operasi diperiksa
    "metadata" TEXT,
    -- data tambahan dalam format JSON; nullable
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- waktu log dibuat; otomatis diisi
    CONSTRAINT "nfc_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "nfc_cards" ("cardId") ON DELETE RESTRICT ON UPDATE CASCADE
    -- foreign key constraint: mencegah hapus kartu jika masih ada log transaksi
);

-- CreateIndex: membuat index unik untuk cardId agar tidak ada duplikasi UID kartu
CREATE UNIQUE INDEX "nfc_cards_cardId_key" ON "nfc_cards"("cardId");

-- CreateIndex: membuat index pada cardId untuk mempercepat pencarian kartu berdasarkan UID
CREATE INDEX "nfc_cards_cardId_idx" ON "nfc_cards"("cardId");

-- CreateIndex: membuat index pada userId untuk mempercepat query "semua kartu milik user X"
CREATE INDEX "nfc_cards_userId_idx" ON "nfc_cards"("userId");

-- CreateIndex: membuat index pada cardStatus untuk mempercepat filter kartu berdasarkan status
CREATE INDEX "nfc_cards_cardStatus_idx" ON "nfc_cards"("cardStatus");

-- CreateIndex
CREATE INDEX "nfc_transactions_cardId_idx" ON "nfc_transactions"("cardId");

-- CreateIndex
CREATE INDEX "nfc_transactions_createdAt_idx" ON "nfc_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "transactions_senderId_idx" ON "transactions"("senderId");

-- CreateIndex
CREATE INDEX "transactions_receiverId_idx" ON "transactions"("receiverId");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");
