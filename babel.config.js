module.exports = function (api) { // module.exports mengekspor fungsi konfigurasi Babel; dipanggil otomatis saat b...
  // module.exports mengekspor fungsi konfigurasi Babel; dipanggil otomatis saat build; api adalah objek Babel dengan utilities konfigurasi
  api.cache(true); // api.cache(true) mengaktifkan cache konfigurasi Babel agar build lebih cepat; ...
  // api.cache(true) mengaktifkan cache konfigurasi Babel agar build lebih cepat; true = selalu cache
  return { // return objek konfigurasi Babel yang berisi presets dan plugins
    // return objek konfigurasi Babel yang berisi presets dan plugins
    presets: [ // presets: array transformasi JavaScript yang diterapkan secara berurutan
    // presets: array transformasi JavaScript yang diterapkan secara berurutan
      'babel-preset-expo' // babel-preset-expo: preset resmi Expo yang menyertakan transformasi React Nati...
      // babel-preset-expo: preset resmi Expo yang menyertakan transformasi React Native, JSX, TypeScript, dan fitur JS modern
    ],
    plugins: [ // plugins: transformasi tambahan yang dijalankan sebelum presets
    // plugins: transformasi tambahan yang dijalankan sebelum presets
      'react-native-reanimated/plugin' // plugin Reanimated: diperlukan untuk animasi React Native Reanimated agar work...
      // plugin Reanimated: diperlukan untuk animasi React Native Reanimated agar worklet berjalan di thread UI terpisah; WAJIB ada di akhir daftar plugins
    ],
    env: { // env: konfigurasi berbeda untuk setiap environment (development/production)
      // env: konfigurasi berbeda untuk setiap environment (development/production)
      production: { // blok konfigurasi khusus environment production
        // blok konfigurasi khusus environment production
        plugins: ['react-native-paper/babel'], // plugin paper: mengoptimalkan bundle size Material Design components dari reac...
        // plugin paper: mengoptimalkan bundle size Material Design components dari react-native-paper saat build production
      },
    },
  };
};
