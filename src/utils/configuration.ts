// Pilih base URL backend dari environment Expo agar alamat deployment tidak di-hardcode ke source.
// EXPO_PUBLIC_API_BASE dipertahankan sebagai nama fallback untuk konfigurasi build lama.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE;
// 10.0.2.2 mengarah ke localhost komputer host dari Android Emulator saat development.
const developmentFallback = 'http://10.0.2.2:4000';

// Build production wajib memakai endpoint HTTPS eksplisit; fallback HTTP hanya sah dalam mode development.
if (!__DEV__ && (!configuredApiUrl || !configuredApiUrl.startsWith('https://'))) {
	throw new Error('EXPO_PUBLIC_API_URL wajib menggunakan HTTPS untuk build production');
}

export const API_URL = configuredApiUrl || developmentFallback;
// apiService menambahkan path endpoint pada base URL terpilih untuk seluruh request mobile.
