# Migrasi database

Folder ini menyimpan riwayat perubahan struktur database SQLite. Prisma membaca
migration yang belum diterapkan, menjalankannya secara berurutan, lalu mencatat
nama dan checksum file SQL ke tabel internal `_prisma_migrations`.

## Mengapa memakai awalan a, b, c, d, dan e?

Huruf `a_` sampai `e_` **bukan aturan wajib dari Prisma**. Awalan tersebut dipakai
khusus pada proyek ini karena angka timestamp pada nama folder sudah dihilangkan.
Hurufnya menyediakan urutan alfabetis yang tetap dan mudah dibaca:

```text
a_initial_baseline
	-> b_admin_topup_idempotency
	-> c_admin_mutation_audit
	-> d_support_decimal_rupiah_amounts
	-> e_restore_active_card_uniqueness
```

Urutan tersebut tidak boleh ditukar karena terdapat dependensi berikut:

1. `a_` membuat seluruh tabel dasar yang dibutuhkan migration lain.
2. `b_` mengubah tabel `nfc_transactions` yang baru tersedia setelah `a_`.
3. `c_` mengubah tabel `fraud_alerts` yang baru tersedia setelah `a_`.
4. `d_` membuat ulang beberapa tabel hasil `a_` serta mempertahankan kolom dari `b_`.
5. `e_` mengembalikan indeks parsial yang hilang ketika `d_` membuat ulang tabel `nfc_cards`.

Tanpa awalan tersebut, pengurutan alfabetis berdasarkan nama deskriptif dapat
menempatkan migration lanjutan sebelum baseline. Akibatnya perintah seperti
`ALTER TABLE` dapat gagal karena tabel tujuan belum ada. Awalan lain seperti
`01_` sampai `05_` sebenarnya juga dapat menjaga urutan, tetapi proyek ini memakai
huruf karena nama tanpa angka memang diinginkan.

## Aturan pemeliharaan

- Jangan mengganti nama folder migration yang sudah diterapkan.
- Jangan mengubah perintah SQL migration lama setelah dipakai pada database lain.
- Komentar dokumentasi juga mengubah checksum file; perubahan seperti itu harus
	dikelola bersama metadata database yang sudah menerima migration tersebut.
- Buat folder baru dengan awalan berikutnya, misalnya `f_nama_perubahan`, untuk
	perubahan struktur database selanjutnya.
- Simpan `migration_lock.toml` dan seluruh folder migration di Git.
- Jalankan `npx prisma migrate status` untuk memeriksa kesesuaian database.
- Gunakan `npx prisma migrate deploy` untuk menerapkan migration pada deployment.

## Ringkasan migration

| Migrasi | Tujuan | Penanganan data |
| --- | --- | --- |
| `a_initial_baseline` | Membuat seluruh tabel, relasi, dan indeks awal aplikasi pembayaran NFC. | Hanya membuat struktur; tidak menambahkan data pengguna. |
| `b_admin_topup_idempotency` | Menambahkan kunci idempotensi pada riwayat top-up NFC. | Mempertahankan seluruh data yang sudah ada. |
| `c_admin_mutation_audit` | Menambahkan waktu pemeriksaan, waktu penyelesaian, dan catatan admin pada fraud alert. | Mempertahankan seluruh data yang sudah ada. |
| `d_support_decimal_rupiah_amounts` | Mengubah kolom nominal uang dari SQLite `INTEGER` menjadi `REAL`. | Membuat ulang tabel terkait lalu menyalin seluruh baris lama. |
| `e_restore_active_card_uniqueness` | Mengembalikan aturan satu kartu NFC aktif untuk setiap pengguna. | Hanya membuat indeks; tidak mengubah baris data. |

## Penjelasan setiap tahap

### a_initial_baseline

Migration pertama membangun database kosong menjadi database yang dapat dipakai
aplikasi. Isinya mencakup akun pengguna, transaksi, fraud alert, perangkat, sesi,
audit admin, pengaturan, kartu NFC, dan histori transaksi kartu. Foreign key
menjaga hubungan antarbaris, sedangkan indeks unik mencegah username, token,
identitas kartu, dan kunci idempotensi tersimpan ganda.

### b_admin_topup_idempotency

Migration kedua menambahkan `idempotencyKey` ke `nfc_transactions`. Client dapat
mengirim kunci yang sama ketika mengulang request top-up akibat timeout jaringan.
Indeks unik memastikan satu kunci hanya dapat menghasilkan satu histori top-up,
sehingga retry tidak menambah saldo untuk kedua kalinya.

### c_admin_mutation_audit

Migration ketiga melengkapi siklus penanganan fraud alert. `reviewedAt` mencatat
waktu pemeriksaan pertama, `resolvedAt` mencatat waktu penyelesaian, dan
`adminNote` menyimpan catatan admin. Ketiganya nullable agar data alert lama
tetap valid setelah migration diterapkan.

### d_support_decimal_rupiah_amounts

Migration keempat mengubah kolom nominal dari `INTEGER` menjadi `REAL`. SQLite
tidak menyediakan perubahan tipe kolom secara langsung, sehingga setiap tabel
terkait dibuat ulang dengan nama sementara, diisi dari tabel lama, lalu mengganti
tabel lama. Indeks dan foreign key yang dapat dibuat ulang juga dipasang kembali.

### e_restore_active_card_uniqueness

Migration kelima membuat kembali indeks parsial satu kartu aktif per pengguna.
Indeks ini pernah dibuat oleh baseline, tetapi tidak ikut terbawa ketika migration
`d_` membuat ulang tabel `nfc_cards`. Kondisi `userId IS NOT NULL` mengabaikan kartu
yang belum memiliki akun terkait, sedangkan kondisi `cardStatus = 'ACTIVE'` tetap
mengizinkan penyimpanan histori kartu yang sudah tidak aktif.

## Lokasi database

`DATABASE_URL="file:./dev.db"` diselesaikan relatif terhadap
`backend/prisma/schema.prisma`. Karena itu, database pengembangan tersimpan di
`backend/prisma/dev.db`, bukan di dalam folder `prisma` tambahan.