// ============================================================================
// SYNC-CARD-BALANCE.JS - UTILITY SCRIPT UNTUK SINKRONISASI BALANCE
// ============================================================================
// Script ini digunakan untuk maintenance dan troubleshooting data consistency
// antara balance user dan balance kartu NFC.
//
// USE CASES:
// 1. Setelah manual update user balance di database
// 2. Fix data inconsistency karena failed transaction
// 3. Recovery setelah database restore
// 4. Testing untuk verify balance synchronization
//
// CARA PAKAI:
// node backend/sync-card-balance.js
//
// DESIGN PRINCIPLE:
// Single Source of Truth: User.balance adalah master data
// NFCCard.balance adalah cache/mirror dari User.balance
// Script ini memastikan mirror selalu sync dengan master
//
// KEAMANAN:
// Script ini READ user balance dan WRITE ke card balance
// Tidak mengubah user balance (one-way sync: user → card)
// ============================================================================

const { PrismaClient } = require('@prisma/client'); // Prisma ORM untuk database access
// Prisma ORM untuk database access
const prisma = new PrismaClient(); // Buat instance Prisma client
// Buat instance Prisma client

// ============================================================================
// FUNCTION: syncCardBalances
// ============================================================================
// Main function untuk sync balance semua kartu dengan balance user-nya
//
// FLOW:
// 1. Query semua kartu yang sudah linked ke user (userId not null)
// 2. Untuk setiap kartu, ambil balance user-nya
// 3. Update card.balance = user.balance
// 4. Log hasil sync untuk monitoring
//
// RETURN: void (exit via process.exit atau normal completion)
// ============================================================================
async function syncCardBalances() {
  console.log('🔄 Syncing card balances with user balances...\n');

  try { // ========================================================================
    // ========================================================================
    // STEP 1: QUERY KARTU YANG PERLU DI-SYNC
    // ========================================================================
    // Ambil semua kartu yang sudah linked ke user (userId not null)
    // Kartu yang belum linked (userId = null) tidak perlu di-sync
    // karena tidak ada user balance sebagai referensi
    const cards = await prisma.nFCCard.findMany({ // const cards: menyimpan semua kartu yang sudah terhubung ke user; await menung...
      // const cards: menyimpan semua kartu yang sudah terhubung ke user; await menunggu query database selesai
      where: {
        userId: { not: null } // Filter: hanya kartu yang punya userId
        // Filter: hanya kartu yang punya userId
        // Kartu dengan userId = null diabaikan (belum linked ke user)
      },
      include: {
        user: { // Include user relation untuk mendapatkan balance user
          // Include user relation untuk mendapatkan balance user
          select: {
            id: true, // User ID untuk logging
            // User ID untuk logging
            username: true, // Username untuk display
            // Username untuk display
            balance: true // Balance user (ini yang jadi referensi sync)
            // Balance user (ini yang jadi referensi sync)
          }
        }
      }
    });

    // ========================================================================
    // STEP 2: VALIDASI - CEK APAKAH ADA KARTU YANG PERLU DI-SYNC
    // ========================================================================
    if (cards.length === 0) { // if memeriksa kondisi; .length === 0 berarti tidak ada kartu yang perlu disync
      // if memeriksa kondisi; .length === 0 berarti tidak ada kartu yang perlu disync
      console.log('⚠️  No cards found with userId'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('   Kemungkinan penyebab:');
      console.log('   • Belum ada kartu yang terdaftar');
      console.log('   • Semua kartu belum di-link ke user');
      console.log('   • Database kosong\n');
      return; // Exit early jika tidak ada kartu yang perlu di-sync
      // Exit early jika tidak ada kartu yang perlu di-sync
    }

    console.log(`📋 Found ${cards.length} card(s) to sync\n`);

    // ========================================================================
    // STEP 3: LOOP SETIAP KARTU DAN SYNC BALANCE-NYA
    // ========================================================================
    // Untuk setiap kartu:
    // 1. Ambil balance lama (dari card.balance)
    // 2. Ambil balance baru (dari user.balance)
    // 3. Update card balance ke database
    // 4. Log perubahan untuk monitoring
    for (const card of cards) { // for...of loop iterasi setiap kartu dalam array; const card adalah objek kartu...
      // for...of loop iterasi setiap kartu dalam array; const card adalah objek kartu saat ini
      if (card.user) { // if memeriksa kondisi; card.user truthy berarti relasi user ditemukan (tidak n...
        // if memeriksa kondisi; card.user truthy berarti relasi user ditemukan (tidak null)
        // ====================================================================
        // STEP 3a: AMBIL BALANCE LAMA DAN BARU
        // ====================================================================
        const oldBalance = card.balance; // Balance kartu saat ini (mungkin outdated)
        // Balance kartu saat ini (mungkin outdated)
        const newBalance = card.user.balance; // Balance user (master data / single source of truth)
        // Balance user (master data / single source of truth)

        // ====================================================================
        // STEP 3b: UPDATE CARD BALANCE KE DATABASE
        // ====================================================================
        // Operation: SET card.balance = user.balance
        // Ini adalah one-way sync: user → card (tidak sebaliknya)
        await prisma.nFCCard.update({ // await menunggu update database; prisma.nFCCard.update() mengeksekusi UPDATE S...
          // await menunggu update database; prisma.nFCCard.update() mengeksekusi UPDATE SQL untuk kartu ini
          where: { id: card.id }, // Target: kartu ini
          // Target: kartu ini
          data: { balance: newBalance } // Update: card balance = user balance
          // Update: card balance = user balance
        });

        // ====================================================================
        // STEP 3c: LOG HASIL SYNC UNTUK MONITORING
        // ====================================================================
        console.log(`✅ Card ${card.cardId.slice(0, 8)}... (User: ${card.user.username})`);
        console.log(`   Old: Rp ${oldBalance.toLocaleString('id-ID')}`);
        console.log(`   New: Rp ${newBalance.toLocaleString('id-ID')}\n`);
        
        // ANALISIS LOG:
        // - Jika Old = New: Balance sudah sync (no change needed)
        // - Jika Old ≠ New: Balance was out of sync (now fixed)
        // - Perbedaan besar (>50%): Possible data corruption, perlu investigate
      }
    }

    // ========================================================================
    // STEP 4: SUCCESS MESSAGE
    // ========================================================================
    console.log('✅ All cards synced successfully!\n');
    console.log('📊 SUMMARY:');
    console.log(`   Total cards processed: ${cards.length}`);
    console.log('   Status: All balances are now synchronized');
    console.log('   Next: Verify in app or run check-users.js\n');

  } catch (error) { // ========================================================================
    // ========================================================================
    // ERROR HANDLING
    // ========================================================================
    // Kemungkinan error:
    // 1. Database connection error (Prisma not connected)
    // 2. Table tidak ada (migration belum run)
    // 3. Permission error (read/write access)
    // 4. Network error (database server down)
    console.error('❌ Error syncing cards:', error.message);
    console.error('\n🔍 Possible causes:');
    console.error('   • Database connection failed');
    console.error('   • NFCCard or User table does not exist');
    console.error('   • Insufficient database permissions');
    console.error('   • Network connectivity issue\n');
    console.error('💡 Solutions:');
    console.error('   1. Check database connection in .env');
    console.error('   2. Run: npx prisma generate');
    console.error('   3. Run: npx prisma db push');
    console.error('   4. Check database server status\n');
    process.exit(1); // Exit dengan error code 1 (indicate failure)
    // Exit dengan error code 1 (indicate failure)
  } finally { // ========================================================================
    // ========================================================================
    // CLEANUP - DISCONNECT PRISMA CLIENT
    // ========================================================================
    // PENTING: Selalu disconnect Prisma client setelah selesai
    // untuk release database connections dan prevent memory leak
    await prisma.$disconnect(); // prisma.$disconnect() menutup koneksi database; penting untuk mencegah proses ...
    // prisma.$disconnect() menutup koneksi database; penting untuk mencegah proses Node.js tetap berjalan
  }
}

// ============================================================================
// EXECUTION - RUN THE SYNC FUNCTION
// ============================================================================
// Script ini auto-execute saat dijalankan dengan: node sync-card-balance.js
// Prisma client akan otomatis connect saat first query
syncCardBalances(); // memanggil fungsi utama syncCardBalances() untuk menjalankan proses sinkronisa...
// memanggil fungsi utama syncCardBalances() untuk menjalankan proses sinkronisasi saldo

// ============================================================================
// END OF FILE: sync-card-balance.js
// ============================================================================
// SUMMARY:
// Script utility untuk maintenance data consistency antara user balance
// dan card balance. Memastikan NFCCard.balance selalu sync dengan User.balance.
//
// TECHNICAL DETAILS:
// - Database: SQLite via Prisma ORM
// - Tables: NFCCard, User
// - Sync direction: User.balance → NFCCard.balance (one-way)
// - Operations: SELECT (read) + UPDATE (write)
//
// WHEN TO USE:
// ✅ After manual database update
// ✅ After failed transaction recovery
// ✅ Before production deployment (health check)
// ✅ Weekly maintenance routine
//
// WHEN NOT TO USE:
// ❌ During active transactions (race condition risk)
// ❌ On production without backup
// ❌ If you want to update user balance (wrong direction!)
//
// RELATED FILES:
// - check-users.js: Verify user data after sync
// - check_balance.js: Check specific user balance
// - backend/routes/nfcCards.js: Production sync logic (automatic)
//
// ACADEMIC NOTE (UNTUK SKRIPSI):
// Script ini adalah implementasi "Data Consistency Maintenance" pattern.
// Dalam sistem distributed/cached, periodic sync diperlukan untuk maintain
// consistency antara master data (User.balance) dan cached data (Card.balance).
// Reference: CAP Theorem (Consistency, Availability, Partition tolerance)
// ============================================================================
