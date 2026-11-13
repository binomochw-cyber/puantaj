/* Sihir Dükkanı – Puantaj Paneli
 * Ayarların VARSAYILAN değerleri (Bilgi Havuzu bölüm 6 ve 2).
 * Panelde "Ayarlar" ekranından değiştirilir, tarayıcıda saklanır.
 * "Varsayılana dön" bu dosyadaki değerleri geri yükler.
 */
(function (kok) {
  var VARSAYILAN_AYARLAR = {
    surum: 2,
    hedef: 45,          // Full Time haftalık hedef (net saat)
    mola: 1,            // her vardiyadan düşülen mola (saat)
    subeler: [
      { ad: 'Bahçeli',   baslik: 'BAHÇELİ',   kodlar: ['BAHÇELİ', 'BAHCELI', 'BAHÇE'],          kapanis: '13:30-22:00', kapanisCumaCmt: '14:30-23:00' },
      { ad: 'Kentpark',  baslik: 'KENTPARK',  kodlar: ['KENTPARK', 'KENT PARK', 'KENT'],        kapanis: '13:30-22:00', kapanisCumaCmt: '14:30-23:00' },
      { ad: 'One Tower', baslik: 'ONE TOWER', kodlar: ['ONE TOWER', 'ONETOWER', 'ONE', 'OT'],    kapanis: '13:30-22:00', kapanisCumaCmt: '14:30-23:00' },
      { ad: 'Hoşdere',   baslik: 'HOŞDERE',   kodlar: ['HOŞDERE', 'HOSDERE', 'HOŞ'],            kapanis: '13:30-22:00', kapanisCumaCmt: '14:30-23:00' }
    ],
    // Özel vardiya kodları (B = haftalık izin her zaman sabittir)
    kodlar: [
      { kod: 'H', sube: 'Hoşdere', saat: '10:00-18:30', aciklama: 'Hoşdere açılış vardiyası' }
    ],
    // Personel: tam ad, ana şube, sözleşme, shift'te geçen kısa adlar
    personel: [
      { ad: 'Aytaç Gelen',      sube: 'Bahçeli',   soz: 'Full Time', kisa: ['AYTAÇ GELEN', 'AYTAÇ'] },
      { ad: 'Enes Çam',         sube: 'Bahçeli',   soz: 'Full Time', kisa: ['ENES ÇAM', 'ENES'] },
      { ad: 'Sude Kalyoncu',    sube: 'Bahçeli',   soz: 'Full Time', kisa: ['SUDE'] },
      { ad: 'Osman Boy',        sube: 'Bahçeli',   soz: 'Part Time', kisa: ['OSMAN'] },
      { ad: 'Zeynep Balyemez',  sube: 'Bahçeli',   soz: 'Part Time', kisa: ['ZEYNEP BALYEMEZ'] },
      { ad: 'Zeynep Yorgun',    sube: 'Bahçeli',   soz: 'Full Time', kisa: ['ZEYNEP YORGUN'] },
      { ad: 'Yusuf Çağlayan',   sube: 'Kentpark',  soz: 'Part Time', kisa: ['YUSUF'], sozNot: 'kullanıcı bildirdi' },
      { ad: 'Mervenur Sarıtaş', sube: 'Kentpark',  soz: 'Full Time', kisa: ['MERVENUR'] },
      { ad: 'Nida Nur Bayar',   sube: 'Kentpark',  soz: 'Full Time', kisa: ['NİDA NUR', 'NİDA'] },
      { ad: 'Miraç Suluv',      sube: 'Kentpark',  soz: 'Full Time', kisa: ['MİRAÇ'] },
      { ad: 'Neslihan Birok',   sube: 'One Tower', soz: 'Full Time', kisa: ['NESLİHAN'] },
      { ad: 'Burcunur Özcan',   sube: 'One Tower', soz: 'Full Time', kisa: ['BURCUNUR ÖZCAN', 'BURCUNUR'] },
      { ad: 'Melike Görkem',    sube: 'Hoşdere',   soz: 'Full Time', kisa: ['MELİKE'] }
    ],
    // Bu şube–gün çiftlerinde personelsiz kalma normaldir (uyarı verme). Örn: "Hoşdere|Sal"
    bosOlabilir: []
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = VARSAYILAN_AYARLAR;
  else kok.VARSAYILAN_AYARLAR = VARSAYILAN_AYARLAR;
})(this);
