/* Sihir Dükkanı – Puantaj Paneli : HIZLI NOT ÇÖZÜCÜ
 * Kısa Türkçe notu kural tabanlı değişikliklere çevirir. Emin olamazsa null döner (form açılır).
 *  notCoz(metin, veri, ayarlar) -> { degisiklikler:[...], aciklama:'Anladığım şu: ...' } | { hata:'...', taslak:{...} }
 * Örnekler:
 *  "Aytaç çarşamba hasta"
 *  "Sude cuma 10-18 yerine 13:30-22"
 *  "Furkan hasta salı, yerine İsmail Bulut One Tower 10-22"
 *  "Enes perşembe izinli" / "Osman cuma gelmedi" / "Mervenur salı rapor"
 *  "Nida cumartesi izne çevir" / "Miraç pazartesi çalıştı 10-18.30"
 *  "Neslihan cuma kentpark'ta"
 */
(function (kok) {
  'use strict';
  var C = (typeof module !== 'undefined' && module.exports) ? require('./cekirdek.js') : kok.Cekirdek;

  var GUN_KELIME = [
    // uzun olanlar önce (cumartesi > cuma)
    ['CUMARTESI', 5], ['CMT', 5], ['CTESI', 5], ['CTS', 5],
    ['PAZARTESI', 0], ['PZT', 0], ['PTESI', 0],
    ['CARSAMBA', 2], ['CARS', 2], ['CAR', 2],
    ['PERSEMBE', 3], ['PER', 3], ['PRS', 3],
    ['CUMA', 4], ['CUM', 4],
    ['SALI', 1], ['SAL', 1],
    ['PAZAR', 6], ['PAZ', 6]
  ];

  function kelimeler(k) { return k.split(' ').filter(Boolean); }
  // ek atma: "SUDE'NIN" -> "SUDE", "CARSAMBAYA" -> kök kontrolü
  function kokEslesir(kelime, kokk) {
    if (kelime === kokk) return true;
    if (kelime.indexOf(kokk) !== 0) return false;
    var ek = kelime.slice(kokk.length);
    return /^(YA|YE|DA|DE|TA|TE|NIN|NUN|IN|UN|I|U|E|A|GUNU|GUNKU|KI|DAN|DEN|TAN|TEN|LARI|LERI|SINDA|SINDE|NDA|NDE)$/.test(ek);
  }

  function gunleriBul(kat, hafta) {
    var out = [];
    // tarih: 04.11 veya 4.11.2026 (saat aralıkları önceden silinmiş olmalı)
    var re = /\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/g, m;
    while ((m = re.exec(kat))) {
      var gun = +m[1], ay = +m[2];
      for (var i = 0; i < 7; i++) {
        var t = hafta.tarihler[i];
        if (t.getUTCDate() === gun && t.getUTCMonth() + 1 === ay) out.push(i);
      }
    }
    kelimeler(kat.replace(/[^A-Z0-9 ]/g, ' ')).forEach(function (w) {
      for (var j = 0; j < GUN_KELIME.length; j++) {
        if (kokEslesir(w, GUN_KELIME[j][0])) { out.push(GUN_KELIME[j][1]); break; }
      }
    });
    var tek = []; out.forEach(function (g) { if (tek.indexOf(g) < 0) tek.push(g); });
    return tek;
  }

  // metindeki saat aralıklarını sırayla bulur ve metinden çıkarır
  function aralikları(metin) {
    var re = /(\d{1,2})(?:[.:,](\d{2}))?\s*[-–—]\s*(\d{1,2})(?:[.:,](\d{2}))?/g, m, list = [];
    while ((m = re.exec(metin))) {
      var a = C.aralikCoz(m[0]);
      if (a) list.push({ g: a.g, c: a.c, bas: m.index, son: m.index + m[0].length });
    }
    var kalan = metin;
    for (var i = list.length - 1; i >= 0; i--) kalan = kalan.slice(0, list[i].bas) + ' ' + kalan.slice(list[i].son);
    return { list: list, kalan: kalan };
  }
  function sureBul(metin) {
    var m = /(\d{1,2}(?:[.,]5)?)\s*(?:saat|sa)\b/i.exec(metin);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }

  function subeleriBul(ix, kat) {
    var bulunan = [];
    var k = ' ' + kat.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var anahtarlar = Object.keys(ix.subeKod).sort(function (a, b) { return b.length - a.length; });
    var kullanildi = [];
    anahtarlar.forEach(function (a) {
      if (a.length < 3) return;   // "OT" gibi kısaltmaları serbest metinde arama
      var re = new RegExp(' ' + a.replace(/ /g, '\\s') + '(?:[A-Z]{0,4})? ', 'g'), m;
      while ((m = re.exec(k))) {
        var cakisma = kullanildi.some(function (u) { return m.index < u[1] && m.index + m[0].length > u[0]; });
        if (!cakisma) { bulunan.push({ sube: ix.subeKod[a], pos: m.index }); kullanildi.push([m.index, m.index + m[0].length]); }
      }
    });
    bulunan.sort(function (a, b) { return a.pos - b.pos; });
    return bulunan;
  }

  // "yerine" sonrasındaki yeni kişinin adını çıkarır (tanınmayan olabilir)
  function yeniKisiAdi(orijinal, yerineIndex) {
    var sonra = orijinal.slice(yerineIndex).replace(/^yerine\s*/i, '');
    // şube adı, saat veya rakama kadar olan kelimeler
    var kelime = sonra.split(/\s+/);
    var ad = [];
    for (var i = 0; i < kelime.length; i++) {
      var w = kelime[i].replace(/[,.;:]+$/, '');
      if (!w || /\d/.test(w)) break;
      var kw = C.katla(w);
      if (/^(GELDI|GELECEK|GELIYOR|CALISTI|CALISACAK|ILE|VE|SUBE|SUBESINDE|SUBEDE|ONE|KENT|KENTPARK|BAHCELI|HOSDERE|TOWER|SAAT|SA)$/.test(kw)) break;
      ad.push(w.replace(/['’].*$/, ''));
      if (ad.length >= 3) break;
    }
    return ad.join(' ').trim();
  }

  function nedenBul(kat) {
    if (/\bHASTA|\bHASTALIK|\bHASTANE/.test(kat)) return 'Hastalık';
    if (/\bRAPOR/.test(kat)) return 'Rapor';
    if (/\bIZINLI\b|\bUCRETSIZ IZIN|\bMAZERET/.test(kat)) return /UCRETSIZ/.test(kat) ? 'Ücretsiz izin' : (/MAZERET/.test(kat) ? 'Mazeret izni' : 'İzinli');
    if (/\bGELMEDI|\bGELMEYECEK|\bYOK\b|\bDEVAMSIZ/.test(kat)) return 'Gelmedi';
    if (/\bVEFAT|\bCENAZE/.test(kat)) return 'Vefat izni';
    if (/\bEVLILIK|\bDUGUN/.test(kat)) return 'Evlilik izni';
    if (/\bBAYRAM/.test(kat)) return 'Bayram izni';
    return null;
  }

  function notCoz(metin, veri, ayarlar) {
    var ix = C.indeksle(ayarlar);
    var hafta = veri.hafta;
    var orijinal = String(metin || '').trim();
    if (!orijinal) return { hata: 'Not boş.' };
    var ar = aralikları(orijinal);
    var kat = C.katla(ar.kalan);
    var kisiBul = C.metindekiKisiler(ix, ar.kalan);
    // shift'te olmayan ama ayarlarda olan kişiler de kabul (veride yoksa uyar)
    var gunler = gunleriBul(kat, hafta);
    var subeler = subeleriBul(ix, kat);
    var neden = nedenBul(kat);
    var yerineIdx = C.katla(orijinal).search(/\bYERINE\b/);
    var taslak = { metin: orijinal };
    if (kisiBul.length) taslak.kisi = 'p:' + kisiBul[0].kisi.sira;
    if (gunler.length) taslak.gun = gunler[0];

    function kisiIdVeride(p) {
      var id = 'p:' + p.sira;
      return C.kisiById(veri, id) ? id : null;
    }
    function gunVerisi(id, g) { return veri.gunler[id] ? veri.gunler[id][g] : null; }
    function etiket(d) { return C.degisiklikEtiketi(d, veri); }

    if (!gunler.length) return { hata: 'Gün anlaşılamadı (ör. "çarşamba" veya "04.11" yazın).', taslak: taslak };

    var sonuc = [];
    // --- 1) "X hasta salı, yerine Y [şube] [saat]" : yerine gelen personel ---
    var ikinciKisiTanimsiz = false;
    if (yerineIdx >= 0 && neden && kisiBul.length >= 1) {
      var x = kisiBul[0].kisi;
      var xid = kisiIdVeride(x);
      if (!xid) return { hata: x.ad + ' bu haftanın shift\'inde yok.', taslak: taslak };
      // yerine sonrasındaki kişi
      var yerineKonum = C.katla(ar.kalan).search(/\bYERINE\b/);
      var yAd = null;
      var sonrakiKisi = kisiBul.filter(function (b) { return b.pos > yerineKonum && b.kisi !== x; })[0];
      if (sonrakiKisi) yAd = sonrakiKisi.kisi.ad;
      else { yAd = yeniKisiAdi(ar.kalan, ar.kalan.toLocaleLowerCase('tr-TR').search(/yerine/)); ikinciKisiTanimsiz = true; }
      if (!yAd) return { hata: 'Yerine gelen kişinin adı anlaşılamadı.', taslak: taslak };
      if (gunler.length !== 1) return { hata: 'Yerine gelen personel için tek gün yazın.', taslak: taslak };
      var g = gunler[0];
      var gx = gunVerisi(xid, g);
      var subeY = subeler.length ? subeler[subeler.length - 1].sube : (gx && gx.durum === 'Çalışma' ? gx.sube : x.sube);
      var saatY = ar.list.length ? ar.list[ar.list.length - 1] : null;
      var sure = sureBul(ar.kalan);
      var varsayim = '';
      if (!saatY && sure) { saatY = { g: 600, c: (600 + Math.round(sure * 60)) % 1440 }; varsayim = ' (' + sure + ' saat → 10:00 başlangıç varsayıldı)'; }
      if (!saatY && gx && gx.durum === 'Çalışma') { saatY = { g: gx.g, c: gx.c }; varsayim = ' (' + x.ad + "'in saati alındı)"; }
      if (!saatY) return { hata: 'Yerine gelen kişinin saati anlaşılamadı (ör. 10-22).', taslak: taslak };
      var d1 = { tur: 'fazlaIzin', kisi: xid, gun: g, neden: neden, kaynak: orijinal };
      var d2 = { tur: 'ekstra', ad: yAd, sube: subeY, gun: g, g: saatY.g, c: saatY.c, yerine: xid, kaynak: orijinal };
      sonuc.push(d1, d2);
      return {
        degisiklikler: sonuc,
        aciklama: 'Anladığım şu: ' + etiket(d1) + '; ' + etiket(d2) + varsayim +
          (ikinciKisiTanimsiz ? '. "' + yAd + '" Ayarlar\'da yok → Destek (hedef yok) olarak eklenecek' : '') + '. Doğru mu?'
      };
    }

    if (!kisiBul.length) {
      // aynı ilk adı taşıyan birden fazla kişi var mı? (ör. iki Zeynep)
      var kel = (' ' + kat.replace(/[^A-Z0-9 ]/g, ' ') + ' ');
      var ayni = ix.personel.filter(function (pp) { var ilk = C.katla(pp.ad).split(' ')[0]; return ilk.length > 2 && kel.indexOf(' ' + ilk + ' ') >= 0; });
      if (ayni.length > 1) return { hata: 'Bu adda birden fazla kişi var (' + ayni.map(function (pp) { return pp.ad; }).join(', ') + '). Soyadıyla yazın veya listeden seçin.', taslak: taslak };
      return { hata: 'Kişi adı tanınmadı. Listeden seçin.', taslak: taslak };
    }
    if (kisiBul.length > 1 && yerineIdx < 0) return { hata: 'Birden fazla kişi adı var (' + kisiBul.map(function (b) { return b.kisi.ad; }).join(', ') + '). Her kişi için ayrı not yazın.', taslak: taslak };
    var p = kisiBul[0].kisi;
    var id = kisiIdVeride(p);
    if (!id) return { hata: p.ad + ' bu haftanın shift\'inde yok. Yerine/ekstra personel olarak formdan ekleyin.', taslak: taslak };

    // --- 2) izne çevir ---
    if (/\bIZNE\b|\bIZIN YAP|\bB YAP|\bHAFTALIK IZIN|\bIZIN GUNU/.test(kat) && !neden) {
      gunler.forEach(function (g) { sonuc.push({ tur: 'izne', kisi: id, gun: g, kaynak: orijinal }); });
    }
    // --- 3) hasta / rapor / izinli / gelmedi -> Fazla İzin ---
    else if (neden) {
      gunler.forEach(function (g) { sonuc.push({ tur: 'fazlaIzin', kisi: id, gun: g, neden: neden, kaynak: orijinal }); });
    }
    // --- 4) saat değişikliği / izni çalışmaya çevir ---
    else if (ar.list.length) {
      if (gunler.length !== 1) return { hata: 'Saat değişikliği için tek gün yazın.', taslak: taslak };
      var g2 = gunler[0];
      var yeni = ar.list[ar.list.length - 1];
      var mevcut = gunVerisi(id, g2);
      var subeYeni = subeler.length ? subeler[subeler.length - 1].sube : null;
      var uyari = '';
      if (ar.list.length >= 2 && mevcut && mevcut.durum === 'Çalışma') {
        var eski = ar.list[0];
        if (eski.g !== mevcut.g || eski.c !== mevcut.c) uyari = ' (Dikkat: shift\'teki saat ' + C.aralikYaz(mevcut.g, mevcut.c) + ', notta ' + C.aralikYaz(eski.g, eski.c) + ' yazıyor.)';
      }
      if (mevcut && mevcut.durum === 'İzin') sonuc.push({ tur: 'calismaya', kisi: id, gun: g2, g: yeni.g, c: yeni.c, sube: subeYeni || undefined, kaynak: orijinal });
      else sonuc.push({ tur: 'saat', kisi: id, gun: g2, g: yeni.g, c: yeni.c, sube: subeYeni || undefined, kaynak: orijinal });
      return { degisiklikler: sonuc, aciklama: 'Anladığım şu: ' + sonuc.map(etiket).join('; ') + '.' + uyari + ' Doğru mu?' };
    }
    // --- 5) şube değişikliği ---
    else if (subeler.length) {
      gunler.forEach(function (g) { sonuc.push({ tur: 'sube', kisi: id, gun: g, sube: subeler[subeler.length - 1].sube, kaynak: orijinal }); });
    }
    if (!sonuc.length) return { hata: 'Ne değiştiği anlaşılamadı (hasta, rapor, izinli, saat, şube, izne çevir…).', taslak: taslak };

    // kontrol: o gün kişi zaten o durumdaysa uyar
    var notlar = [];
    sonuc.forEach(function (d) {
      var gv = gunVerisi(id, d.gun);
      if (d.tur === 'fazlaIzin' && gv && !gv.durum) notlar.push(C.GUN_ADLARI[d.gun] + ' zaten vardiyası yok');
      if (d.tur === 'izne' && gv && gv.durum === 'İzin') notlar.push(C.GUN_ADLARI[d.gun] + ' zaten izinli');
      if (d.tur === 'sube' && gv && gv.durum !== 'Çalışma') notlar.push(C.GUN_ADLARI[d.gun] + ' çalışmıyor, şube değişmez');
    });
    return {
      degisiklikler: sonuc,
      aciklama: 'Anladığım şu: ' + sonuc.map(etiket).join('; ') + '.' + (notlar.length ? ' (Dikkat: ' + notlar.join(', ') + '.)' : '') + ' Doğru mu?'
    };
  }

  var API = { notCoz: notCoz, gunleriBul: gunleriBul };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else kok.NotCozucu = API;
})(this);
