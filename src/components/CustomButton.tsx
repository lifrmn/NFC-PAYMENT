// src/components/CustomButton.tsx
// ==================================================================================
// 🎨 CUSTOM BUTTON COMPONENT - REUSABLE BUTTON WITH VARIANTS
//
// ==================================================================================
//
// Tujuan Component:
// Component ini adalah reusable button dengan berbagai variant dan size.
// Digunakan di seluruh aplikasi untuk consistency UI dan reduce code duplication.
//
// Fitur:
// 1. Variants: Primary (biru), Secondary (hijau), Link (transparan/tanpa background)
// 2. Sizes: Small, Medium, Large (padding dan font size berbeda)
// 3. States: Normal, Disabled, Loading (dengan spinner)
// 4. Accessibility: accessibilityRole, accessibilityLabel, hitSlop
// 5. Error Handling: Try-catch untuk prevent app crash jika onPress error
// 6. Debug Logging: Console logs untuk track interaksi button
//
// Props:
// - title: string - Teks yang ditampilkan di button
// - onPress: () => void - Function yang dipanggil saat button di-tap
// - style: ViewStyle (opsional) - Custom style untuk override default
// - textStyle: TextStyle (opsional) - Custom text style
// - disabled: boolean (opsional) - Disable button (gray out, tidak bisa di-tap)
// - loading: boolean (opsional) - Tampilkan loading spinner sebagai ganti text
// - variant: 'primary' | 'secondary' | 'link' (default: 'primary')
// - size: 'small' | 'medium' | 'large' (default: 'medium')
//
// Contoh Penggunaan:
// ```tsx
// // Primary button (default)
// <CustomButton title="Login" onPress={handleLogin} />
//
// // Secondary button dengan loading state
// <CustomButton
//   title="Register"
//   onPress={handleRegister}
//   variant="secondary"
//   loading={isRegistering}
// />
//
// // Link button (tanpa background, untuk aksi sekunder)
// <CustomButton
//   title="Lupa Password?"
//   onPress={handleForgotPassword}
//   variant="link"
//   size="small"
// />
//
// // Disabled button
// <CustomButton
//   title="Submit"
//   onPress={handleSubmit}
//   disabled={!isFormValid}
// />
// ```
//
// ==================================================================================

import React from 'react';
import {
  TouchableOpacity,  // Pressable component dengan opacity animation
  Text,              // Text display component
  StyleSheet,        // Style definition utility
  ViewStyle,         // TypeScript type untuk View styling
  TextStyle,         // TypeScript type untuk Text styling
  ActivityIndicator, // Loading spinner component
} from 'react-native';

// ==================================================================================
// INTERFACE: CustomButtonProps
// ==================================================================================
// TypeScript interface untuk define props yang diterima component.
//
// Interface Benefits:
// - Type Safety: Error jika pass wrong prop type
// - Autocomplete: IDE suggest available props
// - Documentation: Self-documenting code
// ==================================================================================
interface CustomButtonProps {
  title: string;                      // Button text (REQUIRED)
  onPress: () => void;                // Callback function saat button di-tap (REQUIRED)
  style?: ViewStyle;                  // Custom container style (optional)
  textStyle?: TextStyle;              // Custom text style (optional)
  disabled?: boolean;                 // Disable button (default: false)
  loading?: boolean;                  // Show loading spinner (default: false)
  variant?: 'primary' | 'secondary' | 'link';  // Button variant (default: 'primary')
  size?: 'small' | 'medium' | 'large';         // Button size (default: 'medium')
}

// ==================================================================================
// COMPONENT: CustomButton
// ==================================================================================
// Functional component menggunakan React hooks pattern.
// Export default untuk simplicity (import tanpa curly braces).
// ==================================================================================
export default function CustomButton({
  // Destructure props dengan default values untuk prop yang opsional
  title,               // Wajib: text yang ditampilkan di button
  onPress,             // Wajib: callback saat button di-tap
  style,               // Opsional: custom style container
  textStyle,           // Opsional: custom style text
  disabled = false,    // Opsional: default false (button aktif)
  loading = false,     // Opsional: default false (tidak loading)
  variant = 'primary', // Opsional: default biru (primary)
  size = 'medium',     // Opsional: default medium size
}: CustomButtonProps) {
  
  // ================================================================================
  // HANDLER: handlePress()
  // ================================================================================
  // TUJUAN:
  // Wrapper untuk onPress callback dengan error handling dan logging.
  //
  // FLOW:
  // 1. Check apakah button disabled atau loading
  // 2. Jika tidak, call onPress callback
  // 3. Wrap dalam try-catch untuk prevent app crash
  // 4. Log success/error untuk debugging
  //
  // KENAPA PERLU WRAPPER?
  // - Error Handling: onPress bisa throw error, kita catch untuk prevent crash
  // - Debugging: Log semua button interactions untuk troubleshooting
  // - Validation: Ensure onPress hanya dipanggil jika button active
  // ================================================================================
  const handlePress = () => {
    // Log untuk debugging: track setiap kali button di-tap
    console.log('🔘 CustomButton pressed:', title, 'disabled:', disabled, 'loading:', loading);
    
    // Validasi: button hanya bisa di-press jika tidak disabled, tidak loading, dan punya callback
    // Triple check untuk keamanan: disabled, loading, dan onPress defined
    if (!disabled && !loading && onPress) {
      try {
        // Panggil callback yang diberikan oleh parent component
        onPress(); // Execute function
        
        // Log sukses untuk memastikan callback berhasil dipanggil
        console.log('✅ CustomButton onPress called successfully for:', title);
        
      } catch (error) {
        // Tangkap error untuk mencegah app crash
        // Error bisa terjadi jika onPress throw exception
        console.error('❌ CustomButton onPress error for:', title, error);
      }
    } else {
      // Log mengapa button tidak merespons (untuk debugging)
      // Membantu troubleshoot masalah "button tidak berfungsi"
      console.log('⚠️ CustomButton press blocked - disabled:', disabled, 'loading:', loading, 'onPress:', !!onPress);
    }
  };

  // ================================================================================
  // STYLE COMPOSITION
  // ================================================================================
  // TUJUAN:
  // Combine multiple styles berdasarkan props (variant, size, disabled).
  //
  // STYLE STRATEGY:
  // - Base Style: Always applied (baseButton)
  // - Variant Style: primaryButton, secondaryButton, atau linkButton
  // - Size Style: smallButton, mediumButton, atau largeButton
  // - State Style: disabledButton jika disabled = true
  // - Custom Style: style prop (override any defaults)
  //
  // ARRAY OF STYLES:
  // React Native merges styles dari kiri ke kanan.
  // Style di kanan override style di kiri jika ada conflict.
  // ================================================================================
  // Gabungkan style berdasarkan props yang diberikan
  // Array style akan di-merge dari kiri ke kanan (kanan override kiri)
  const buttonStyle = [
    styles.baseButton,                   // Style dasar: border radius, shadow
    styles[`${variant}Button`],          // Style variant: warna background
    styles[`${size}Button`],             // Style size: padding
    disabled && styles.disabledButton,   // Style disabled: abu-abu jika disabled
    style,                               // Custom style dari parent (prioritas tertinggi)
  ];

  // Gabungkan style text dengan pola yang sama
  const buttonTextStyle = [
    styles.baseText,                     // Style dasar text: font weight, align
    styles[`${variant}Text`],            // Warna text sesuai variant
    styles[`${size}Text`],               // Ukuran font sesuai size
    disabled && styles.disabledText,     // Warna text abu-abu jika disabled
    textStyle,                           // Custom text style dari parent (prioritas tertinggi)
  ];

  // ================================================================================
  // RENDER
  // ================================================================================
  // Render TouchableOpacity dengan conditional content (loading spinner atau text).
  // ================================================================================
  return (
    <TouchableOpacity
      // STEP 1: Apply combined styles
      style={buttonStyle}
      
      // STEP 2: Attach press handler
      onPress={handlePress}
      
      // STEP 3: Disable touch jika button disabled atau loading
      // disabled prop prevent onPress from firing
      disabled={disabled || loading}
      
      // STEP 4: Set opacity animation (0.7 = 70% opacity saat pressed)
      // Memberikan visual feedback ke user bahwa button di-tap
      activeOpacity={0.7}
      
      // STEP 5: Increase touch target area (accessibility)
      // hitSlop membuat area touch lebih besar dari visual button
      // Bagus untuk usability (easier to tap, especially untuk small buttons)
      // 15 pixels extra di semua sisi
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      
      // STEP 6: Accessibility props (for screen readers)
      // accessibilityRole: Tell screen reader this is a button
      // accessibilityLabel: Text yang dibaca oleh screen reader
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {/* STEP 7: Conditional rendering - loading spinner OR text */}
      {loading ? (
        // Show loading spinner jika loading = true
        <ActivityIndicator 
          // Spinner color: white untuk primary/secondary, blue untuk link
          color={variant === 'link' ? '#3498db' : 'white'} 
          size="small"  // Size: 'small' atau 'large'
        />
      ) : (
        // Show button text jika tidak loading
        <Text style={buttonTextStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

// ==================================================================================
// STYLES - STYLING DEFINITIONS DENGAN STYLESHEET API
// ==================================================================================
//
// StyleSheet.create() Benefits:
// 1. Performance: Styles di-optimize oleh React Native
// 2. Validation: Error jika style invalid
// 3. Autocomplete: IDE dapat suggest valid style properties
//
// Style Organization:
// - Base Styles: Applied to all buttons
// - Variant Styles: primaryButton, secondaryButton, linkButton
// - Size Styles: smallButton, mediumButton, largeButton
// - State Styles: disabledButton, disabledText
// - Text Styles: Corresponding text styles untuk each variant/size
//
// ==================================================================================
const styles = StyleSheet.create({
  // ================================================================================
  // BASE BUTTON STYLE - APPLIED TO ALL BUTTONS
  // ================================================================================
  baseButton: {
    borderRadius: 12,                    // Rounded corners (modern design)
    alignItems: 'center',                // Center content horizontally
    justifyContent: 'center',            // Center content vertically
    
    // Shadow properties (iOS style shadow)
    shadowColor: '#000',                 // Black shadow
    shadowOffset: {
      width: 0,                          // Horizontal offset
      height: 2,                         // Vertical offset (shadow below button)
    },
    shadowOpacity: 0.25,                 // 25% opacity (subtle shadow)
    shadowRadius: 3.84,                  // Blur radius (soft shadow)
    
    // Elevation (Android style shadow)
    elevation: 5,                        // Higher = more shadow
  },
  
  // ================================================================================
  // VARIANT STYLES - DIFFERENT BUTTON TYPES
  // ================================================================================
  
  // Primary Button: Blue background (main actions)
  // Use case: Login, Submit, Confirm
  primaryButton: {
    backgroundColor: '#3498db',          // Blue color (Flat UI color palette)
  },
  
  // Secondary Button: Green background (secondary actions)
  // Use case: Register, Save, Add
  secondaryButton: {
    backgroundColor: '#27ae60',          // Green color (success/positive)
  },
  
  // Link Button: Transparent background (tertiary actions)
  // Use case: Cancel, Back, Forgot Password
  linkButton: {
    backgroundColor: 'transparent',      // No background
    shadowOpacity: 0,                    // No shadow
    elevation: 0,                        // No elevation
    paddingVertical: 12,                 // Less padding (text-like appearance)
    paddingHorizontal: 16,
  },
  
  // ================================================================================
  // SIZE STYLES - DIFFERENT BUTTON SIZES
  // ================================================================================
  
  // Small Button: Less padding, compact appearance
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  
  // Medium Button: Default size, balanced appearance
  mediumButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  
  // Large Button: More padding, prominent appearance
  largeButton: {
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  
  // ================================================================================
  // STATE STYLES - DISABLED STATE
  // ================================================================================
  
  // Disabled Button: Gray background, no shadow
  disabledButton: {
    backgroundColor: '#bdc3c7',          // Light gray (indicates disabled)
    shadowOpacity: 0,                    // Remove shadow
    elevation: 0,                        // Remove elevation
  },
  
  // ================================================================================
  // TEXT STYLES - BUTTON TEXT STYLING
  // ================================================================================
  
  // Base Text Style: Applied to all button text
  baseText: {
    fontWeight: '600',                   // Semi-bold (readable)
    textAlign: 'center',                 // Center align
  },
  
  // Primary Button Text: White color
  primaryText: {
    color: 'white',
  },
  
  // Secondary Button Text: White color
  secondaryText: {
    color: 'white',
  },
  
  // Link Button Text: Blue color (matches primary button)
  linkText: {
    color: '#3498db',
  },
  
  // Text Size Variants
  smallText: {
    fontSize: 14,                        // Smaller text
  },
  mediumText: {
    fontSize: 16,                        // Default text size
  },
  largeText: {
    fontSize: 18,                        // Larger text
  },
  
  // Disabled Text: Gray color
  disabledText: {
    color: '#7f8c8d',                    // Dark gray (low contrast = disabled)
  },
});