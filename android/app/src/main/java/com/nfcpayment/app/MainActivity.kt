package com.nfcpayment.app
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  // MainActivity adalah Activity Android utama yang menjadi wadah tampilan React Native.
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }

  // getMainComponentName mengembalikan nama komponen root yang didaftarkan dari JavaScript.
  // React Native memakai nama "main" ini untuk memilih komponen pertama yang dirender ke Activity.
  override fun getMainComponentName(): String = "main"

  // createReactActivityDelegate membuat penghubung antara lifecycle Activity Android dan React Native.
  // ReactActivityDelegateWrapper menambahkan integrasi Expo, sedangkan fabricEnabled mengikuti
  // konfigurasi New Architecture agar renderer Fabric aktif hanya ketika build mengaktifkannya.
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  // invokeDefaultOnBackPressed menyamakan perilaku tombol Back pada berbagai versi Android.
  // Android 11 atau lebih lama memindahkan root Activity ke background; Activity non-root tetap
  // ditutup oleh implementasi bawaan. Android 12 ke atas memakai perilaku Back bawaan sistem.
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
