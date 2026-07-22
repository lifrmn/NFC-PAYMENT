package com.nfcpayment.app

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

// MainApplication adalah entry point proses Android sebelum MainActivity dibuat.
// Class ini menyiapkan package native, React Native host, New Architecture, dan lifecycle Expo.
class MainApplication : Application(), ReactApplication {

  // reactNativeHost menyimpan konfigurasi runtime React Native yang digunakan selama aplikasi hidup.
  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        // getPackages mengambil seluruh native package hasil autolinking dari dependency proyek.
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          // Metro memulai bundle JavaScript dari virtual entry Expo, bukan langsung dari App.tsx.
          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          // Developer support hanya aktif pada build DEBUG agar menu developer tidak masuk produksi.
          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          // Nilai build menentukan apakah TurboModules dan renderer arsitektur baru diaktifkan.
          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  // reactHost adalah API host modern yang dibentuk dari applicationContext dan konfigurasi di atas.
  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    // onCreate dijalankan satu kali ketika proses aplikasi Android mulai.
    super.onCreate()
    // releaseLevel membaca level React Native dari BuildConfig; STABLE menjadi fallback jika nilainya tidak dikenal.
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    // loadReactNative menginisialisasi runtime native sebelum Activity meminta tampilan React.
    loadReactNative(this)
    // Dispatcher meneruskan event pembuatan Application ke modul-modul Expo yang terpasang.
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    // Callback ini menerima perubahan konfigurasi perangkat, misalnya orientasi, bahasa, atau mode UI.
    super.onConfigurationChanged(newConfig)
    // Perubahan diteruskan ke modul Expo agar setiap modul dapat menyesuaikan state native-nya.
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
