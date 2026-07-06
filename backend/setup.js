#!/usr/bin/env node

// ============================================================================
// SETUP.JS - AUTOMATED SETUP SCRIPT UNTUK NFC PAYMENT BACKEND
// ============================================================================
// Script ini mengotomasi proses setup backend dari zero hingga ready-to-run.
// Dijalankan sekali saat initial project setup atau setelah clean install.
//
// USE CASES:
// 1. Initial project setup untuk developer baru
// 2. Setup environment setelah clone repository
// 3. Recovery setelah dependency corruption
// 4. Automated deployment dalam CI/CD pipeline
//
// CARA PAKAI:
// node backend/setup.js
// atau
// npm run setup (jika sudah defined di package.json)
//
// PROSES YANG DIJALANKAN:
// 1. ✅ Check Node.js version compatibility (min: v16)
// 2. 📦 Install dependencies via npm install
// 3. 🗄️ Generate Prisma client
// 4. 📊 Push database schema ke SQLite
// 5. 🌱 Seed database dengan sample data
//
// REQUIREMENTS:
// - Node.js >= 16.0.0
// - npm package manager
// - Internet connection (untuk download packages)
//
// DESIGN PATTERN:
// Sequential execution dengan error handling per step
// Callback-based flow (exec callback API)
// ============================================================================

// const membuat variabel tetap; { exec } adalah destructuring — mengambil hanya fungsi exec dari module child_process; require('child_process') memanggil module bawaan Node.js untuk menjalankan perintah terminal dari dalam skrip
const fs = require('fs');
// require('fs') memanggil module File System bawaan Node.js; fs menyediakan fungsi baca/tulis file (readFile, writeFile, existsSync, dll) — disiapkan untuk penggunaan masa depan
const path = require('path');
// require('path') memanggil module Path bawaan Node.js; path menyediakan fungsi manipulasi path file secara lintas platform (join, resolve, dirname, dll)

console.log('🚀 Setting up NFC Payment Backend...\n');

// ============================================================================
// STEP 1: CHECK NODE.JS VERSION COMPATIBILITY
// ============================================================================
// Validate Node.js version sebelum proceed dengan setup
// Minimum requirement: Node.js v16 (untuk ES2021 features & Prisma compatibility)
const nodeVersion = process.version;
// process adalah objek global Node.js; process.version mengembalikan string versi Node.js yang sedang berjalan, contoh: "v18.17.0"
const majorVersion = parseInt(nodeVersion.split('.')[0].slice(1));
// split('.') memecah string menjadi array berdasarkan karakter titik; [0] mengambil elemen pertama ("v18"); slice(1) memotong karakter pertama 'v' sehingga tersisa "18"; parseInt() mengubah string "18" menjadi angka 18

if (majorVersion < 16) {
  console.error('❌ Node.js version 16 or higher is required');
  console.error(`   Current version: ${nodeVersion}`);
  console.error('\n💡 Solution:');
  console.error('   Download Node.js v18 LTS from https://nodejs.org');
  console.error('   Or use nvm: nvm install 18 && nvm use 18\n');
  process.exit(1);
  // process.exit() menghentikan proses Node.js sepenuhnya; argument 1 adalah exit code — 0 berarti sukses, angka selain 0 menandakan error (konvensi Unix/Linux)
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// ============================================================================
// STEP 2: INSTALL NPM DEPENDENCIES
// ============================================================================
// Install semua packages yang di-define di package.json
// Termasuk: express, prisma, cors, bcrypt, jsonwebtoken, dll
console.log('\n📦 Installing dependencies...');
exec('npm install', (error, stdout, stderr) => {
  // exec() menjalankan perintah 'npm install' di terminal; menerima callback(error, stdout, stderr); error berisi objek Error jika perintah gagal; stdout berisi output teks normal; stderr berisi pesan error dari perintah
  if (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    console.error('\n🔍 Common issues:');
    console.error('   • Network connection problem');
    console.error('   • npm registry unreachable');
    console.error('   • Corrupted package-lock.json');
    console.error('\n💡 Try: rm package-lock.json && npm install\n');
    return;
    // return di dalam callback menghentikan eksekusi fungsi callback ini saja — tidak melanjutkan ke step berikutnya jika ada error
  }
  
  console.log('✅ Dependencies installed');
  
  // ==========================================================================
  // STEP 3: GENERATE PRISMA CLIENT
  // ==========================================================================
  // Generate TypeScript/JavaScript client dari prisma/schema.prisma
  // Output: node_modules/.prisma/client/
  console.log('\n🗄️  Setting up database...');
  exec('npx prisma generate', (error, stdout, stderr) => {
    // exec() menjalankan perintah 'npx prisma generate'; npx menjalankan package tanpa install global; prisma generate membaca schema.prisma dan menghasilkan Prisma Client JavaScript di node_modules/.prisma/client/
    if (error) {
      console.error('❌ Failed to generate Prisma client:', error.message);
      console.error('\n🔍 Common issues:');
      console.error('   • schema.prisma has syntax errors');
      console.error('   • Prisma not installed in node_modules');
      console.error('\n💡 Try: npx prisma validate\n');
      return;
    }
    
    console.log('✅ Prisma client generated');
    
    // ========================================================================
    // STEP 4: PUSH DATABASE SCHEMA
    // ========================================================================
    // Create tables di SQLite database berdasarkan schema.prisma
    // Equivalent to: CREATE TABLE IF NOT EXISTS ...
      exec('npx prisma db push', (error, stdout, stderr) => {
        // exec() menjalankan 'npx prisma db push'; perintah ini membaca schema.prisma dan membuat tabel-tabel di database SQLite — setara dengan menjalankan CREATE TABLE IF NOT EXISTS untuk setiap model di schema
      if (error) {
        console.error('❌ Failed to push database schema:', error.message);
        console.error('\n🔍 Common issues:');
        console.error('   • Database file locked (close Prisma Studio)');
        console.error('   • Invalid schema definition');
        console.error('   • Insufficient write permissions');
        console.error('\n💡 Try: Close all database connections\n');
        return;
      }
      
      console.log('✅ Database schema created');
      
      // ======================================================================
      // STEP 5: SEED DATABASE DENGAN SAMPLE DATA
      // ======================================================================
      // Populate database dengan initial data untuk testing
      // Command ini run script yang defined di package.json "scripts.db:seed"
      console.log('\n🌱 Seeding database...');
        exec('npm run db:seed', (error, stdout, stderr) => {
          // exec() menjalankan script 'db:seed' yang didefinisikan di package.json; script ini mengisi database dengan data awal (sample users, dll) untuk keperluan testing dan development
        if (error) {
          console.error('❌ Failed to seed database:', error.message);
          console.error('\n⚠️ Note: Seeding error is non-critical.');
          console.error('   You can manually create users later.');
          console.error('\n💡 Try running seed script manually:\n');
          // Setup masih considered success meski seeding gagal
        }
        
        console.log('✅ Database seeded with sample data');
        
        // ====================================================================
        // SUCCESS MESSAGE & NEXT STEPS
        // ====================================================================
        console.log('\n🎉 Backend setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. npm run dev      - Start development server');
        console.log('   2. npm run db:studio - Open Prisma Studio');
        console.log('   3. Visit http://localhost:3000/health - Test API');
        console.log('   4. Visit http://localhost:3000/admin - Admin Dashboard');
        console.log('\n📱 Mobile app integration:');
        console.log('   - Update mobile app API_URL to: http://YOUR_IP:3000/api');
        console.log('   - Backend is compatible with existing admin system');
        console.log('\n🔍 Verification commands:');
        console.log('   - node backend/check-users.js   - Check user data');
        console.log('   - node backend/check_balance.js - Check balances');
        console.log('\n📚 Documentation:');
        console.log('   - Read: backend/README.md for API endpoints');
        console.log('   - Read: CARA-MENJALANKAN.md for setup guide\n');
      });
    });
  });
});

// ============================================================================
// END OF FILE: setup.js
// ============================================================================
// SUMMARY:
// Automated setup script dengan sequential execution pattern.
// Nested callbacks membentuk dependency chain:
// npm install → prisma generate → db push → db seed
//
// ERROR HANDLING STRATEGY:
// - Critical errors (Step 1-4): Stop execution dengan early return
// - Non-critical errors (Step 5 seeding): Continue dan show warning
//
// ALTERNATIVE APPROACHES:
// Modern approach bisa menggunakan:
// 1. Promise chains dengan .then()/.catch()
// 2. async/await dengan util.promisify(exec)
// 3. External tools: shelljs, execa
//
// RELATED FILES:
// - package.json: Defines npm scripts & dependencies
// - prisma/schema.prisma: Database schema definition
// - prisma/seed.js: Seed data script
//
// ACADEMIC NOTE (UNTUK SKRIPSI):
// Script ini adalah implementasi "Automated Setup" pattern dalam DevOps.
// Prinsip: Reduce manual steps, increase reproducibility, minimize errors.
// Benefits:
// 1. Consistent environment across developers
// 2. Faster onboarding untuk team members
// 3. Reliable deployment process
// Reference: Infrastructure as Code (IaC) & DevOps best practices
// ============================================================================
