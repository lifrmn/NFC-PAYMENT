-- MIGRATION E: PEMULIHAN ATURAN SATU KARTU AKTIF
-- Posisi       : harus dijalankan setelah d_support_decimal_rupiah_amounts.
-- Prasyarat    : tabel nfc_cards versi REAL sudah selesai dibuat ulang oleh d_.
-- Hasil akhir  : satu userId tidak dapat memiliki dua kartu berstatus ACTIVE.
-- Penanganan   : tidak menambah, menghapus, atau mengubah baris data.
--
-- Migration d_ membuat ulang tabel nfc_cards karena SQLite tidak dapat mengubah
-- tipe kolom secara langsung. Indeks parsial dari baseline tidak otomatis ikut
-- terbawa, sehingga aturan bisnis berikut harus dipasang kembali.
--
-- Penjelasan kondisi indeks:
-- - userId IS NOT NULL: kartu yang belum memiliki akun terkait tidak ikut dibatasi.
-- - cardStatus = 'ACTIVE': hanya kartu aktif yang harus unik per pengguna.
-- - kartu BLOCKED/INACTIVE lama tetap dapat disimpan sebagai histori.
-- - IF NOT EXISTS membuat perintah aman jika indeks sudah tersedia.
CREATE UNIQUE INDEX IF NOT EXISTS "nfc_cards_one_active_per_user_key"
ON "nfc_cards"("userId")
WHERE "userId" IS NOT NULL AND "cardStatus" = 'ACTIVE';