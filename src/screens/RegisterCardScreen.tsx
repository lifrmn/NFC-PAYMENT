// src/screens/RegisterCardScreen.tsx
/* ==================================================================================
 * 📇 SCREEN: RegisterCardScreen
 * ==================================================================================
 * 
 * Purpose:
 * NFC card registration screen untuk link physical NFC card ke user account.
 * User scan NTag215 card, system validate, dan register ke database.
 * 
 * User Flow:
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ DashboardScreen → Tap "📇 Register Card" → RegisterCardScreen      │
 * │                                                                     │
 * │ Registration Flow:                                                  │
 * │ 1. System check NFC supported                                      │
 * │ 2. System check NFC enabled                                        │
 * │ 3. User tap "Scan Kartu NFC" button                                │
 * │ 4. User tap physical NTag215 card ke HP                            │
 * │ 5. System read card UID                                            │
 * │ 6. System check card status (registered or not)                    │
 * │    - If already registered to THIS user: Show info alert           │
 * │    - If already registered to OTHER user: Show error               │
 * │    - If not registered (404): Proceed to register                  │
 * │ 7. System register card: POST /api/nfc-cards/register              │
 * │ 8. Success alert with card info                                    │
 * │ 9. Navigate back to MyCardsScreen (if onSuccess callback)          │
 * └────────────────────────────────────────────────────────────────────┘
 * 
 * Key Features:
 * 
 * 1. NFC Hardware Validation:
 *    - Check device support NFC
 *    - Check NFC enabled in settings
 *    - Show alerts with instructions if disabled
 *    - initializeNFC() on component mount
 * 
 * 2. Duplicate Card Prevention:
 *    - Check card already registered (GET /api/nfc-cards/info/{cardId})
 *    - If registered to THIS user: Show success message (allow re-register)
 *    - If registered to OTHER user: Block registration
 *    - 1 card per user policy enforcement
 * 
 * 3. Card Validation:
 *    - Read physical card UID (NFCService.readPhysicalCard)
 *    - NTag215 card type required (13.56 MHz)
 *    - Handle card read errors gracefully
 * 
 * 4. Registration States:
 *    - 'idle': Initial state
 *    - 'scanning': Reading physical card
 *    - 'registering': Sending to backend
 *    - 'success': Registration succeeded
 *    - 'error': Registration failed
 * 
 * 5. Alert Messages:
 *    - Predefined ALERTS constant dengan consistent messaging
 *    - nfcDisabled: Instructions untuk enable NFC
 *    - nfcNotSupported: Device tidak support NFC
 *    - cardAlreadyRegistered: Card info (status, balance)
 *    - cardAlreadyUsed: Block registration (card owned by other user)
 *    - registerSuccess: Success message dengan card ID
 * 
 * API Endpoints Used:
 * - GET /api/nfc-cards/info/{cardId}: Check card registration status
 * - POST /api/nfc-cards/register: Register new card
 *   Request: { cardId, userId, balance: 0, deviceId }
 *   Response: { success, card: { id, cardId, userId, balance, cardStatus } }
 * 
 * State Management:
 * - nfcSupported: Boolean device support NFC
 * - nfcEnabled: Boolean NFC enabled in settings
 * - loading: Boolean untuk button loading state
 * - scanning: Boolean untuk scan animation
 * - scannedCardId: String last scanned card UID
 * - registrationStatus: Enum registration state
 * 
 * Props:
 * - user: Current user object (id, deviceId)
 * - onBack: Callback untuk navigate back
 * - onSuccess: Optional callback after successful registration
 * 
 * ==================================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NFCService } from '../utils/nfc';
import { apiService } from '../utils/apiService';

/* ==================================================================================
 * CONSTANTS: Alert Messages
 * ==================================================================================
 * Predefined alert messages untuk consistent user feedback.
 * 
 * Messages:
 * - nfcDisabled: Instructions untuk enable NFC di settings
 * - nfcNotSupported: Error message untuk device tanpa NFC
 * - cardAlreadyRegistered: Success message dengan card info
 * - cardAlreadyUsed: Error message untuk duplicate card (owned by other user)
 * - registerSuccess: Success message dengan registration confirmation
 * ==================================================================================
 */
const ALERTS = {
  nfcDisabled: {
    title: '📱 NFC Tidak Aktif',
    message: 'NFC belum diaktifkan di HP Anda. Silakan aktifkan NFC terlebih dahulu:\n\n1. Buka Settings\n2. Pilih Connected devices / Connections\n3. Aktifkan NFC'
  },
  nfcNotSupported: {
    title: '❌ NFC Tidak Didukung',
    message: 'HP Anda tidak mendukung NFC. Kartu fisik hanya dapat digunakan di HP dengan fitur NFC.'
  },
  cardAlreadyRegistered: (cardId: string, status: string, balance: number) => ({
    title: '✅ Kartu Sudah Terdaftar',
    message: `Kartu ini sudah terdaftar untuk akun Anda.\n\nCard ID: ${cardId.slice(0, 12)}...\nStatus: ${status}\nBalance: Rp ${balance.toLocaleString('id-ID')}`
  }),
  cardAlreadyUsed: (cardId: string) => ({
    title: '❌ Kartu Sudah Digunakan',
    message: `Kartu ini sudah terdaftar untuk akun lain.\n\nCard ID: ${cardId.slice(0, 12)}...\n\nGunakan kartu NFC yang belum terdaftar.`
  }),
  registerSuccess: (cardId: string) => ({
    title: '✅ Kartu Berhasil Didaftarkan!',
    message: `Kartu NFC Anda telah terdaftar dan siap digunakan.\n\nCard ID: ${cardId.slice(0, 12)}...\nBalance: Rp 0\n\nAnda dapat top-up saldo melalui admin atau menggunakan kartu untuk transaksi.`
  })
};
/* ==================================================================================
 * TYPE DEFINITIONS
 * ==================================================================================
 * RegisterCardScreenProps:
 * - user: Current user object (id, deviceId for tracking)
 * - onBack: Callback untuk navigate back to previous screen
 * - onSuccess: Optional callback after successful card registration
 *   Called after user taps OK di success alert
 * ==================================================================================
 */interface RegisterCardScreenProps {
  user: any;
  onBack: () => void;
  onSuccess?: () => void;
}

/* ==================================================================================
 * COMPONENT: RegisterCardScreen
 * ==================================================================================
 * NFC card registration screen dengan hardware validation dan duplicate prevention.
 * 
 * PARAMS:
 * @param user - Current user object
 * @param onBack - Navigate back callback
 * @param onSuccess - Optional success callback
 * ==================================================================================
 */
export default function RegisterCardScreen({ user, onBack, onSuccess }: RegisterCardScreenProps) {
  // STATE 1: nfcSupported - Apakah device punya hardware NFC
  // true = device support NFC, false = tidak support (tampilkan error)
  const [nfcSupported, setNfcSupported] = useState(false); // Asumsi awal: tidak support
  
  // STATE 2: nfcEnabled - Apakah NFC sudah diaktifkan di pengaturan device
  // true = aktif, false = tidak aktif (tampilkan instruksi)
  const [nfcEnabled, setNfcEnabled] = useState(false); // Asumsi awal: tidak aktif
  
  // STATE 3: loading - Flag untuk disable tombol saat operasi berlangsung
  // Mencegah user tap tombol berkali-kali
  const [loading, setLoading] = useState(false); // Awalnya tidak loading
  
  // STATE 4: scanning - Flag untuk menampilkan animasi scanning
  // Memberikan feedback visual bahwa sistem sedang membaca kartu
  const [scanning, setScanning] = useState(false); // Awalnya tidak scanning
  
  // STATE 5: scannedCardId - UID kartu terakhir yang berhasil di-scan
  // Disimpan untuk keperluan debugging dan display
  const [scannedCardId, setScannedCardId] = useState<string>(''); // Awalnya kosong
  
  // STATE 6: registrationStatus - Status proses registrasi saat ini
  // Digunakan untuk menentukan UI yang ditampilkan
  // 'idle' = siap scan, 'scanning' = sedang baca kartu, 'registering' = kirim ke backend
  // 'success' = berhasil, 'error' = gagal
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'scanning' | 'registering' | 'success' | 'error'>('idle'); // Awal: idle

  useEffect(() => {
    initializeNFC();
  }, []);

  const initializeNFC = async () => {
    try {
      const supported = await NFCService.initNFC();
      setNfcSupported(supported);

      if (supported) {
        const enabled = await NFCService.checkNFCEnabled();
        setNfcEnabled(enabled);
        if (!enabled) {
          Alert.alert(ALERTS.nfcDisabled.title, ALERTS.nfcDisabled.message, [{ text: 'OK' }]);
        }
      } else {
        Alert.alert(ALERTS.nfcNotSupported.title, ALERTS.nfcNotSupported.message, [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('NFC initialization error:', error);
      setNfcSupported(false);
    }
  };

  const handleScanCard = async () => {
    if (!nfcEnabled) {
      Alert.alert('Error', 'NFC belum aktif. Aktifkan NFC terlebih dahulu.');
      return;
    }

    setScanning(true);
    setRegistrationStatus('scanning');
    setLoading(true);

    try {
      const cardInfo = await NFCService.readPhysicalCard();
      if (!cardInfo) {
        Alert.alert('Error', 'Kartu tidak terdeteksi. Pastikan kartu NTag215 didekatkan dengan benar.');
        setRegistrationStatus('error');
        return;
      }
      setScannedCardId(cardInfo.id);
      await checkAndRegisterCard(cardInfo.id);
    } catch (error: any) {
      console.error('Scan card error:', error);
      Alert.alert('Error', error.message || 'Gagal membaca kartu NFC. Pastikan kartu adalah NTag215 yang valid.');
      setRegistrationStatus('error');
    } finally {
      setScanning(false);
      setLoading(false);
    }
  };

  const checkAndRegisterCard = async (cardId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'User tidak valid. Silakan login ulang.');
      setRegistrationStatus('error');
      setLoading(false);
      return;
    }

    setRegistrationStatus('registering');
    setLoading(true);

    try {
      console.log('🔍 Checking if card is already registered...');
      const checkResponse = await apiService.get(`/api/nfc-cards/info/${cardId}`);
      
      // Card found - sudah terdaftar
      if (checkResponse.success && checkResponse.card) {
        console.log('📋 Card found in database');
        
        if (checkResponse.card.userId === user.id) {
          console.log('✅ Card already registered to current user');
          const alert = ALERTS.cardAlreadyRegistered(cardId, checkResponse.card.cardStatus, checkResponse.card.balance);
          Alert.alert(alert.title, alert.message, [{ text: 'OK', onPress: () => setRegistrationStatus('success') }]);
        } else {
          console.log('❌ Card already registered to another user');
          const alert = ALERTS.cardAlreadyUsed(cardId);
          Alert.alert(alert.title, alert.message, [{ text: 'OK', onPress: () => setRegistrationStatus('error') }]);
        }
        return;
      }
    } catch (error: any) {
      // 404 berarti kartu belum terdaftar - ini adalah EXPECTED behavior untuk kartu baru
      if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('Card not found')) {
        console.log('✅ Card NOT found in database (expected for new cards)');
        console.log('📝 Proceeding with card registration...');
        await registerNewCard(cardId);
        return;
      }
      
      // Error lainnya (network, server error, dll) - ini baru error beneran
      console.error('❌ Unexpected error while checking card:', error);
      Alert.alert('Error', 'Gagal memeriksa status kartu. Silakan coba lagi.');
      setRegistrationStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const registerNewCard = async (cardId: string) => {
    try {
      const response = await apiService.post('/api/nfc-cards/register', {
        cardId, userId: user.id, balance: 0, deviceId: user.deviceId || 'unknown'
      });

      if (response.success) {
        setRegistrationStatus('success');
        const alert = ALERTS.registerSuccess(cardId);
        Alert.alert(alert.title, alert.message, [{ 
          text: 'OK', 
          onPress: () => { 
            console.log('✅ Card registered successfully, navigating to MyCards');
            setRegistrationStatus('idle');
            setScannedCardId('');
            if (onSuccess) {
              onSuccess(); // Navigate to MyCards
            } else {
              onBack(); // Fallback to dashboard
            }
          } 
        }]);
      } else {
        Alert.alert('Error', response.error || 'Gagal mendaftarkan kartu');
        setRegistrationStatus('error');
      }
    } catch (error: any) {
      console.error('Register card error:', error);
      
      // Handle Error 409: User already has a registered card
      if (error.message?.includes('409') || error.message?.includes('already has a registered card')) {
        const existingCardData = error.message.match(/existingCard":\{([^}]+)\}/);
        let existingCardInfo = '';
        
        if (existingCardData) {
          try {
            const cardMatch = error.message.match(/"cardId":"([^"]+)"/);
            const statusMatch = error.message.match(/"cardStatus":"([^"]+)"/);
            const balanceMatch = error.message.match(/"balance":(\d+)/);
            
            if (cardMatch && statusMatch && balanceMatch) {
              const existingCardId = cardMatch[1];
              const status = statusMatch[1];
              const balance = parseInt(balanceMatch[1]);
              existingCardInfo = `\n\n🎴 Kartu Terdaftar:\nCard ID: ${existingCardId.slice(0, 16)}...\nStatus: ${status}\nSaldo: Rp ${balance.toLocaleString('id-ID')}`;
            }
          } catch (parseError) {
            console.error('Failed to parse existing card info:', parseError);
          }
        }
        
        Alert.alert(
          '⚠️ Kartu Sudah Ada', 
          `Anda sudah memiliki kartu NFC terdaftar.\n\nKebijakan: 1 USER = 1 CARD\n\nSetiap user hanya dapat mendaftarkan SATU kartu NFC.${existingCardInfo}\n\nJika ingin mengganti kartu, hubungi admin.`,
          [
            { 
              text: 'Lihat Kartu Saya', 
              onPress: () => { 
                setRegistrationStatus('idle');
                setScannedCardId('');
                if (onSuccess) {
                  onSuccess(); // Ini akan trigger navigasi ke MyCards
                } else {
                  onBack(); // Fallback ke dashboard jika onSuccess tidak ada
                }
              } 
            },
            { text: 'OK', style: 'cancel', onPress: () => onBack() }
          ]
        );
        setRegistrationStatus('error');
        return;
      }
      
      Alert.alert('Error', error.response?.data?.error || error.message || 'Gagal mendaftarkan kartu. Silakan coba lagi.');
      setRegistrationStatus('error');
    }
  };

  const getStatusColor = () => {
    switch (registrationStatus) {
      case 'success': return '#27ae60';
      case 'error': return '#e74c3c';
      case 'scanning': return '#3498db';
      case 'registering': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  const getStatusText = () => {
    switch (registrationStatus) {
      case 'scanning': return '📡 Scanning kartu...';
      case 'registering': return '⏳ Mendaftarkan kartu...';
      case 'success': return '✅ Kartu berhasil didaftarkan!';
      case 'error': return '❌ Gagal, silakan coba lagi';
      default: return '📝 Siap mendaftarkan kartu';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daftarkan Kartu NFC</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Card */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
          <Text style={styles.statusTitle}>{getStatusText()}</Text>
          {scannedCardId && (
            <Text style={styles.cardIdText}>Card ID: {scannedCardId.slice(0, 16)}...</Text>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 Cara Mendaftarkan Kartu:</Text>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Aktifkan NFC di HP{'\n'}<Text style={styles.stepSubtext}>(Settings → Connections → NFC)</Text></Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Siapkan kartu NTag215{'\n'}<Text style={styles.stepSubtext}>(Kartu NFC 13.56MHz)</Text></Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Tekan "Scan Kartu NFC" di bawah</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>Tempelkan kartu di belakang HP{'\n'}<Text style={styles.stepSubtext}>(Bagian tengah belakang HP)</Text></Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>5</Text>
            <Text style={styles.stepText}>Tunggu notifikasi berhasil</Text>
          </View>
        </View>

        {/* Visual Guide */}
        <View style={styles.visualGuide}>
          <Text style={styles.guideTitle}>📱 Posisi Kartu:</Text>
          <View style={styles.phoneIllustration}>
            <View style={styles.phone}>
              <Text style={styles.phoneText}>HP</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardText}>🎴 Kartu NFC</Text>
              <Text style={styles.cardSubtext}>Tempelkan di belakang HP</Text>
            </View>
          </View>
          <Text style={styles.guideHint}>💡 Tahan 1-2 detik sampai terdeteksi</Text>
        </View>

        {/* NFC Status */}
        <View style={styles.nfcStatusCard}>
          <Text style={styles.nfcStatusTitle}>Status NFC:</Text>
          <Text style={[styles.nfcStatusValue, { color: nfcEnabled ? '#27ae60' : '#e74c3c' }]}>
            {nfcSupported 
              ? (nfcEnabled ? '✅ Aktif' : '❌ Tidak Aktif') 
              : '❌ Tidak Didukung'}
          </Text>
          {!nfcEnabled && nfcSupported && (
            <Text style={styles.nfcHint}>Aktifkan NFC di Settings HP Anda</Text>
          )}
        </View>

        {/* Scan Button */}
        <TouchableOpacity
          style={[
            styles.scanButton,
            (!nfcEnabled || loading) && styles.scanButtonDisabled
          ]}
          onPress={handleScanCard}
          disabled={!nfcEnabled || loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.scanButtonText}>  {scanning ? 'Scanning...' : 'Processing...'}</Text>
            </>
          ) : (
            <>
              <Text style={styles.scanButtonText}>🎴 Scan Kartu NFC</Text>
              <Text style={styles.scanButtonSubtext}>Tap untuk mulai scan</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Informasi:</Text>
          <Text style={styles.infoText}>
            • Kartu hanya perlu didaftarkan sekali{'\n'}
            • Satu kartu hanya bisa untuk satu akun{'\n'}
            • Balance awal kartu: Rp 0{'\n'}
            • Top-up dapat dilakukan melalui admin{'\n'}
            • Kartu dapat digunakan untuk semua transaksi
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backText: {
    color: '#3498db',
    fontSize: 16,
    width: 70,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  cardIdText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontFamily: 'monospace',
  },
  instructionsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 30,
    height: 30,
    backgroundColor: '#3498db',
    color: 'white',
    textAlign: 'center',
    lineHeight: 30,
    borderRadius: 15,
    fontWeight: 'bold',
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
  },
  stepSubtext: {
    fontSize: 13,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  visualGuide: {
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  phoneIllustration: {
    alignItems: 'center',
    marginBottom: 15,
  },
  phone: {
    width: 120,
    height: 200,
    backgroundColor: '#34495e',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -30,
    zIndex: 1,
  },
  phoneText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    width: 140,
    padding: 15,
    backgroundColor: '#e91e63',
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 2,
  },
  cardText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardSubtext: {
    color: 'white',
    fontSize: 11,
    marginTop: 5,
  },
  guideHint: {
    fontSize: 13,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  nfcStatusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nfcStatusTitle: {
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '600',
  },
  nfcStatusValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  nfcHint: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 5,
  },
  scanButton: {
    backgroundColor: '#e91e63',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  scanButtonDisabled: {
    backgroundColor: '#95a5a6',
    opacity: 0.6,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scanButtonSubtext: {
    color: 'white',
    fontSize: 13,
    marginTop: 5,
    opacity: 0.9,
  },
  infoCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 20,
  },
});
