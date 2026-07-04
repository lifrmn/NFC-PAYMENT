// ============================================================================
// CHECK_BALANCE.JS - UTILITY SCRIPT UNTUK INSPECT USER BALANCES
// ============================================================================
// Script ini digunakan untuk monitoring balance semua user di database.
// Berguna untuk verifikasi setelah transaksi atau troubleshooting.
//
// USE CASES:
// 1. Verify balance after payment transaction
// 2. Check balance consistency across users
// 3. Monitor account status (active/inactive)
// 4. Audit trail untuk financial reporting
// 5. Debug balance-related bugs
//
// CARA PAKAI:
// node backend/check_balance.js
//
// OUTPUT:
// Menampilkan semua user dengan informasi:
// - Username
// - Current balance (dalam rupiah)
// - Account status (active/inactive)
// - Created date
//
// NOTES:
// Balance adalah data sensitif, jangan run script ini di production
// tanpa proper security measures (log sanitization, access control)
// ============================================================================

const { PrismaClient } = require('@prisma/client'); // Prisma ORM untuk database access

// ============================================================================
// FUNCTION: checkBalances
// ============================================================================
// Main function untuk query dan display balance semua user
//
// FLOW:
// 1. Query semua user dari database
// 2. Loop dan display info setiap user
// 3. Display summary statistics
//
// RETURN: void (exit via normal completion atau error)
// ============================================================================
async function checkBalances() {
    const prisma = new PrismaClient(); // const membuat variabel tetap; new PrismaClient() membuat instance baru koneksi Prisma ke database
    
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // ====================================================================
        // STEP 1: QUERY SEMUA USER
        // ====================================================================
        console.log('=== Checking Database Users ===\n'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        const users = await prisma.user.findMany(); // const users: menyimpan semua data user dari database; await menunggu query selesai
        
        // ====================================================================
        // STEP 2: DISPLAY SETIAP USER DENGAN DETAIL
        // ====================================================================
        // Variabel untuk calculate summary statistics
        let totalBalance = 0; // let membuat variabel yang bisa diubah; accumulator untuk total saldo seluruh user
        let activeUsers = 0; // let membuat variabel yang bisa diubah; counter user yang masih aktif
        
        users.forEach(user => { // forEach iterasi setiap user dalam array untuk ditampilkan ke console
            // Display user information
            console.log(`User: ${user.username}`); // template literal ${} menyisipkan username ke string log
            console.log(`Balance: Rp ${user.balance.toLocaleString('id-ID')}`); // .toLocaleString('id-ID') memformat angka saldo dengan titik ribuan Indonesia
            console.log(`Active: ${user.isActive ? '\u2705 Yes' : '\u274c No'}`); // ternary operator: jika isActive=true tampilkan centang hijau, jika false tampilkan silang merah
            console.log(`Created: ${new Date(user.createdAt).toLocaleString('id-ID')}`); // new Date() membuat objek tanggal; toLocaleString format tanggal Indonesia
            console.log('-------------------'); // garis pemisah antar user untuk keterbacaan
            
            // Accumulate statistics
            totalBalance += user.balance; // += menambahkan saldo user ke akumulator totalBalance
            if (user.isActive) activeUsers++; // if memeriksa kondisi; ++ menambah 1 ke counter activeUsers jika user aktif
        });
        
        // ====================================================================
        // STEP 3: DISPLAY SUMMARY STATISTICS
        // ====================================================================
        console.log(`\n\ud83d\udcca SUMMARY:`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        console.log(`Total users: ${users.length}`); // .length mengembalikan jumlah elemen array users
        console.log(`Active users: ${activeUsers}`); // jumlah user yang masih aktif
        console.log(`Inactive users: ${users.length - activeUsers}`); // jumlah user yang tidak aktif (total - aktif)
        console.log(`Total balance in system: Rp ${totalBalance.toLocaleString('id-ID')}`); // total saldo seluruh user dalam sistem
        
        // Calculate average balance
        if (users.length > 0) { // guard: hindari pembagian dengan nol jika tidak ada user
            const avgBalance = totalBalance / users.length; // rata-rata saldo = total saldo dibagi jumlah user
            console.log(`Average balance per user: Rp ${avgBalance.toLocaleString('id-ID')}`); // tampilkan rata-rata saldo
        }
        
        console.log(`\n\ud83d\udca1 Tip: Run 'node backend/check-users.js' untuk cek user relations\n`); // tip untuk perintah debug lainnya
        
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
        // ====================================================================
        // ERROR HANDLING
        // ====================================================================
        console.error('\u274c Error checking balances:', error.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        console.error('\n\ud83d\udd0d Possible causes:'); // log daftar kemungkinan penyebab error
        console.error('   \u2022 Database connection failed'); // kemungkinan: koneksi database gagal
        console.error('   \u2022 User table does not exist'); // kemungkinan: tabel user belum dibuat
        console.error('   \u2022 Database migration not completed'); // kemungkinan: migrasi belum dijalankan
        console.error('   \u2022 Insufficient permissions\n'); // kemungkinan: tidak ada izin akses database
        console.error('\ud83d\udca1 Solutions:'); // log solusi yang bisa dicoba
        console.error('   1. Run: npx prisma generate'); // solusi 1: regenerasi Prisma client
        console.error('   2. Run: npx prisma db push'); // solusi 2: push schema ke database
        console.error('   3. Check .env database configuration\n'); // solusi 3: cek konfigurasi .env
        process.exit(1); // process.exit(1) menghentikan proses Node.js dengan exit code 1 yang menandakan error
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
        // ====================================================================
        // CLEANUP - DISCONNECT PRISMA CLIENT
        // ====================================================================
        await prisma.$disconnect(); // await prisma.$disconnect() menutup koneksi ke database; penting untuk mencegah process Node.js tetap berjalan
    }
}

// ============================================================================
// EXECUTION - RUN THE CHECK FUNCTION
// ============================================================================
checkBalances(); // memanggil fungsi utama checkBalances() untuk menjalankan script

// ============================================================================
// END OF FILE: check_balance.js
// ============================================================================
// SUMMARY:
// Script utility untuk monitoring user balances dan system financial status.
// Penting untuk audit trail dan troubleshooting.
//
// SECURITY CONSIDERATIONS:
// ⚠️ Balance adalah data sensitif - jangan expose di production logs
// ⚠️ Implementasi access control jika di-deploy ke server
// ⚠️ Consider adding role-based access (admin only)
//
// RELATED FILES:
// - check-users.js: Check user data dengan relations
// - sync-card-balance.js: Sync balance user ke cards
// - backend/routes/transactions.js: Production transaction logic
//
// ACADEMIC NOTE (UNTUK SKRIPSI):
// Script ini adalah implementasi "Financial Audit Tool" untuk monitoring
// system financial integrity. Dalam payment systems, balance monitoring
// adalah critical component untuk:
// 1. Detect anomalies (negative balance, suspicious changes)
// 2. Verify transaction correctness
// 3. Comply with financial regulations
// Reference: Financial Systems - Audit & Compliance requirements
// ============================================================================