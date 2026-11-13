# Sihir Dükkanı – Haftalık Puantaj Paneli

Shift .xlsx dosyasını yükleyin, gerekirse değişiklik notu yazın, "Puantajı Üret" ile 5 sayfalık puantaj Excel'ini indirin.
Tamamen ücretsizdir. Dosyalar hiçbir yere gönderilmez, her şey tarayıcıda yapılır.

## Klasördekiler
- `index.html` : panelin sayfası
- `css/stil.css` : görünüm
- `js/ayarlar-varsayilan.js` : varsayılan personel, şube ve kod listesi
- `js/cekirdek.js` : shift okuyucu ve hesap kuralları
- `js/not-cozucu.js` : "Aytaç çarşamba hasta" gibi kısa notları anlayan kısım
- `js/excel-model.js` : 5 sayfanın tarifi (formüller, renkler, notlar)
- `js/excel-yazici.js` : Excel dosyasını oluşturan kısım (ExcelJS)
- `js/app.js` : ekran ve düğmeler

## Kütüphaneler (ücretsiz, sürümü sabit)
- SheetJS 0.20.3 (Excel okuma): https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
- ExcelJS 4.4.0 (Excel yazma): https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js

## Kabul testleri (geçti)
- Örnek shift 02.11–08.11.2026: Bilgi Havuzu bölüm 7'deki tüm kişi ve şube toplamları ile uyarılar birebir tutuyor; çıktı, örnek puantajla hücre hücre aynı.
- "Sude çarşamba hasta" notu: Bilgi Havuzu bölüm 8'deki sonuç birebir tutuyor (Bahçeli 232,5, genel 511).
