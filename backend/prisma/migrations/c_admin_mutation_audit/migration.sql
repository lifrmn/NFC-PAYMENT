-- MIGRATION C: DETAIL AUDIT PENANGANAN FRAUD
-- Posisi       : dijalankan setelah a_initial_baseline.
-- Prasyarat    : tabel fraud_alerts sudah dibuat oleh migration a_.
-- Hasil akhir  : proses review admin memiliki waktu dan catatan yang dapat diaudit.
-- Penanganan   : semua kolom nullable agar alert lama tidak memerlukan data buatan.
--
-- Siklus umum alert:
-- NEW -> REVIEWED mengisi reviewedAt dan dapat menyimpan adminNote.
-- REVIEWED -> RESOLVED mengisi resolvedAt dan dapat memperbarui adminNote.

-- reviewedAt mencatat kapan alert pertama kali diperiksa oleh admin.
ALTER TABLE "fraud_alerts" ADD COLUMN "reviewedAt" DATETIME;

-- resolvedAt mencatat kapan penanganan alert dinyatakan selesai.
ALTER TABLE "fraud_alerts" ADD COLUMN "resolvedAt" DATETIME;

-- adminNote menyimpan catatan pemeriksaan atau alasan keputusan admin.
ALTER TABLE "fraud_alerts" ADD COLUMN "adminNote" TEXT;