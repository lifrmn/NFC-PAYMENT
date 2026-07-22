-- MIGRATION B: IDEMPOTENSI TOP-UP ADMIN
-- Posisi       : dijalankan setelah a_initial_baseline.
-- Prasyarat    : tabel nfc_transactions sudah dibuat oleh migration a_.
-- Hasil akhir  : setiap request top-up dapat memiliki identitas retry yang unik.
-- Penanganan   : kolom nullable menjaga seluruh histori lama tetap valid.
--
-- Contoh alur:
-- 1. Admin mengirim top-up dengan idempotencyKey "topup:abc".
-- 2. Backend menyimpan perubahan saldo dan key tersebut.
-- 3. Jika request diulang dengan key yang sama, unique index menolak catatan kedua.
-- 4. Backend membaca transaksi pertama sehingga saldo tidak ditambahkan dua kali.
ALTER TABLE "nfc_transactions" ADD COLUMN "idempotencyKey" TEXT;

-- Nilai NULL boleh muncul lebih dari sekali untuk histori lama. Nilai key yang
-- benar-benar diisi harus unik di seluruh tabel.
CREATE UNIQUE INDEX "nfc_transactions_idempotencyKey_key"
ON "nfc_transactions"("idempotencyKey");