const { getDefaultConfig } = require('expo/metro-config'); // import fungsi getDefaultConfig dari expo/metro-config untuk mendapatkan konfigurasi Metro bundler default Expo
const config = getDefaultConfig(__dirname); // getDefaultConfig(__dirname) mengambil konfigurasi Metro default berdasarkan root direktori proyek (__dirname)

// Add resolver for better dependency handling
config.resolver.unstable_enablePackageExports = true; // mengaktifkan dukungan field 'exports' di package.json; diperlukan untuk modul modern yang menggunakan conditional exports

module.exports = config; // module.exports mengekspor objek config yang telah dimodifikasi sebagai konfigurasi Metro bundler aktif