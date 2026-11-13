/* Sihir Dükkanı – Puantaj Paneli : ÇEKİRDEK
 * Kural tabanlı, deterministik. Kütüphane kullanmaz.
 *  - haftaBul(dosyaAdi)            : dosya adından hafta (ilk tarih = Pazartesi)
 *  - shiftOku(satirlar, ayarlar, hafta) : shift tablosunu (2 boyutlu dizi) kişi/gün verisine çevirir
 *  - uygula(veri, degisiklikler, ayarlar) : kullanıcının notlarını uygular
 *  - hesapla(sonuc, ayarlar)       : Detay satırları, kişi/şube toplamları, uyarılar
 */
(function (kok) {
  'use strict';

  var GUN_ADLARI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  var GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  var DURUM = { CALISMA: 'Çalışma', IZIN: 'İzin', FAZLA: 'Fazla İzin' };

  /* ---------- metin yardımcıları ---------- */
  function buyuk(s) {
    return String(s == null ? '' : s).replace(/ /g, ' ').toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
  }
  // Türkçe harfleri sadeleştirip büyük harfe çevirir (eşleştirme için)
  function katla(s) {
    return buyuk(s).replace(/Ç/g, 'C').replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ö/g, 'O')
      .replace(/Ş/g, 'S').replace(/Ü/g, 'U').replace(/Â/g, 'A').replace(/Î/g, 'I').replace(/Û/g, 'U');
  }
  function iki(n) { return (n < 10 ? '0' : '') + n; }
  function saatYaz(dk) { dk = ((dk % 1440) + 1440) % 1440; return iki(Math.floor(dk / 60)) + ':' + iki(dk % 60); }
  function aralikYaz(g, c) { return saatYaz(g) + '-' + saatYaz(c); }
  function sureSaat(g, c) { var d = (c - g) % 1440; if (d < 0) d += 1440; return d / 60; }
  function sayiYaz(x) { var r = Math.round(x * 100) / 100; return String(r); }
  function tarihYaz(d) { return iki(d.getUTCDate()) + '.' + iki(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
  function ggaa(d) { return iki(d.getUTCDate()) + '.' + iki(d.getUTCMonth() + 1); }
  function kopya(o) { return JSON.parse(JSON.stringify(o)); }

  // "10.00-18.30", "14:30-23:00", "10.00-15:30", "10-18", "13:30-22" -> {g, c} (dakika)
  var ARALIK_RE = /(\d{1,2})(?:[.:,](\d{2}))?\s*[-–—]\s*_?\s*(\d{1,2})(?:[.:,](\d{2}))?/;
  function aralikCoz(metin) {
    var m = ARALIK_RE.exec(String(metin));
    if (!m) return null;
    var g1 = +m[1], g2 = m[2] ? +m[2] : 0, c1 = +m[3], c2 = m[4] ? +m[4] : 0;
    if (g1 > 24 || c1 > 24 || g2 > 59 || c2 > 59) return null;
    return { g: (g1 % 24) * 60 + g2, c: (c1 % 24) * 60 + c2 };
  }
  function tamAralikMi(metin) {
    return /^\s*\d{1,2}(?:[.:,]\d{2})?\s*[-–—]\s*_?\s*\d{1,2}(?:[.:,]\d{2})?\s*$/.test(String(metin));
  }

  /* ---------- hafta ---------- */
  function haftaBul(dosyaAdi) {
    var ad = String(dosyaAdi || '');
    var m = /(\d{1,2})\s*[.\/]\s*(\d{1,2})(?:\s*[.\/]\s*(\d{4}))?/.exec(ad);
    if (!m) return { hata: 'Dosya adında tarih bulunamadı.' };
    var gun = +m[1], ay = +m[2], yil = m[3] ? +m[3] : null;
    if (!yil) {
      var y = /(20\d{2})/.exec(ad.slice(m.index + m[0].length));
      if (y) yil = +y[1];
    }
    if (!yil) return { hata: 'Dosya adındaki ilk tarihte yıl bulunamadı.' };
    var d = new Date(Date.UTC(yil, ay - 1, gun));
    if (d.getUTCDate() !== gun || d.getUTCMonth() !== ay - 1) return { hata: 'Dosya adındaki tarih geçersiz: ' + m[0] };
    return haftaOlustur(d);
  }
  function haftaOlustur(pzt) {
    var tarihler = [];
    for (var i = 0; i < 7; i++) tarihler.push(new Date(pzt.getTime() + i * 86400000));
    var h = {
      pzt: pzt, tarihler: tarihler,
      baslangic: tarihYaz(tarihler[0]), bitis: tarihYaz(tarihler[6]),
      dosyaEtiketi: ggaa(tarihler[0]) + '-' + ggaa(tarihler[6]) + '.' + tarihler[6].getUTCFullYear(),
      pazartesiMi: pzt.getUTCDay() === 1
    };
    if (!h.pazartesiMi) h.hata = 'Dosya adındaki ilk tarih (' + h.baslangic + ') Pazartesi değil (' + ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][pzt.getUTCDay()] + ').';
    return h;
  }
  function haftaTarihten(gun, ay, yil) { return haftaOlustur(new Date(Date.UTC(yil, ay - 1, gun))); }

  /* ---------- ayar indeksleri ---------- */
  function indeksle(ayarlar) {
    var subeler = ayarlar.subeler.map(function (s, i) { return Object.assign({ sira: i }, s); });
    var subeKod = {};      // katlanmış kod -> şube adı
    subeler.forEach(function (s) {
      [s.ad, s.baslik].concat(s.kodlar || []).forEach(function (k) { if (k) subeKod[katla(k)] = s.ad; });
    });
    var personel = ayarlar.personel.map(function (p, i) { return Object.assign({ sira: i }, p); });
    var adAnahtar = {};    // katlanmış ad/kısa ad -> kişi
    personel.forEach(function (p) {
      [p.ad].concat(p.kisa || []).forEach(function (k) {
        var kk = katla(k);
        if (!kk) return;
        if (adAnahtar[kk] && adAnahtar[kk] !== p) adAnahtar[kk] = 'BELIRSIZ'; else adAnahtar[kk] = p;
      });
    });
    var kodlar = {};
    (ayarlar.kodlar || []).forEach(function (k) {
      var a = aralikCoz(k.saat);
      if (a) kodlar[katla(k.kod)] = { sube: k.sube, g: a.g, c: a.c };
    });
    return { subeler: subeler, subeKod: subeKod, personel: personel, adAnahtar: adAnahtar, kodlar: kodlar };
  }
  function subeSirasi(ix, ad) {
    for (var i = 0; i < ix.subeler.length; i++) if (ix.subeler[i].ad === ad) return i;
    return 99;
  }
  function subeBul(ix, metin) { return ix.subeKod[katla(metin)] || null; }

  // shift'teki ismi Ayarlar'daki kişiye eşleştirir
  function kisiEslestir(ix, ham) {
    var k = katla(ham);
    if (!k) return null;
    var p = ix.adAnahtar[k];
    if (p && p !== 'BELIRSIZ') return p;
    if (p === 'BELIRSIZ') return null;
    // tam adın başıyla eşleşen tek kişi (örn. "AYTAÇ" -> Aytaç Gelen)
    var aday = ix.personel.filter(function (x) {
      var a = katla(x.ad);
      return a === k || a.indexOf(k + ' ') === 0;
    });
    return aday.length === 1 ? aday[0] : null;
  }

  // isim yoksa düzgün yazım: "AHMET YILMAZ" -> "Ahmet Yılmaz"
  function duzgunAd(ham) {
    return buyuk(ham).split(' ').map(function (w) {
      return w.charAt(0) + w.slice(1).toLocaleLowerCase('tr-TR');
    }).join(' ');
  }
  function sozCoz(ham) {
    var k = katla(ham);
    if (!k) return '';
    if (/FULL|TAM/.test(k)) return 'Full Time';
    if (/PART|PAR\b|PAR T|YARI/.test(k)) return 'Part Time';
    return '';
  }

  /* ---------- hücre çözümü ---------- */
  // dönüş: {tur:'bos'|'izin'|'saat'|'sube'|'bilinmeyen', ...}
  function hucreCoz(ix, deger, grupSube) {
    var s = String(deger == null ? '' : deger).trim();
    if (!s) return { tur: 'bos' };
    var k = katla(s);
    if (k === 'B') return { tur: 'izin' };
    if (ix.kodlar[k]) { var kd = ix.kodlar[k]; return { tur: 'saat', sube: kd.sube, g: kd.g, c: kd.c, ham: s, kod: k }; }
    if (tamAralikMi(s)) { var a = aralikCoz(s); if (a) return { tur: 'saat', sube: grupSube, g: a.g, c: a.c, ham: s }; }
    var sb = subeBul(ix, s);
    if (sb) return { tur: 'sube', sube: sb, ham: s };
    return { tur: 'bilinmeyen', ham: s };
  }

  /* ---------- K sütunu notu (serbest not) ---------- */
  var BUYUK_HARF_KELIMELER = [
    ['kurban bayramı', 'Kurban Bayramı'], ['ramazan bayramı', 'Ramazan Bayramı'], ['şeker bayramı', 'Şeker Bayramı'],
    ['yılbaşı', 'Yılbaşı'], ['cumhuriyet bayramı', 'Cumhuriyet Bayramı'], ['zafer bayramı', 'Zafer Bayramı'],
    ['emek ve dayanışma günü', 'Emek ve Dayanışma Günü'], ['demokrasi ve milli birlik günü', 'Demokrasi ve Milli Birlik Günü']
  ];
  function nedenTemizle(metin, kisi) {
    var t = String(metin).replace(/\s+/g, ' ').trim();
    // "fazla izin nedeni <isim>" ve isim parçalarını at
    var adlar = [kisi.ad].concat(kisi.kisa || []);
    t = t.replace(/fazla\s+izin\s+nedeni\s*:?/ig, ' ');
    adlar.forEach(function (a) {
      if (!a) return;
      var re = new RegExp('(^|\\s)' + a.toLocaleLowerCase('tr-TR').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$|[.,;:])', 'g');
      t = t.replace(re, ' ');
      var reB = new RegExp('(^|\\s)' + buyuk(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$|[.,;:])', 'g');
      t = t.replace(reB, ' ');
    });
    // küçük harfli isim de olabilir
    var tl = t.toLocaleLowerCase('tr-TR');
    adlar.forEach(function (a) {
      var al = String(a).toLocaleLowerCase('tr-TR');
      var i = tl.indexOf(al);
      if (al && i >= 0) { t = t.slice(0, i) + t.slice(i + al.length); tl = t.toLocaleLowerCase('tr-TR'); }
    });
    t = t.replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/[\s,;:-]+$/, '').trim();
    BUYUK_HARF_KELIMELER.forEach(function (c) {
      t = t.replace(new RegExp(c[0], 'ig'), c[1]);
    });
    if (t && /[a-zçğıöşü]/.test(t.charAt(0))) t = t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
    return t;
  }
  // Vardiya Planı için kısa neden: "29.05.2026 Kurban Bayramı mesaisini 02.11.2026 tarihinde kullandı" -> "Kurban Bayramı mesaisi"
  function kisaNeden(neden) {
    var t = String(neden || '').trim();
    var m = /^\d{1,2}\.\d{1,2}\.\d{2,4}\s+(.+?)\s+mesaisini\b.*$/i.exec(t);
    if (m) return m[1] + ' mesaisi';
    return t;
  }
  function metindekiTarihler(metin, hafta) {
    var out = [];
    var re = /(\d{1,2})\.(\d{1,2})\.(\d{4})/g, m;
    while ((m = re.exec(metin))) {
      var d = Date.UTC(+m[3], +m[2] - 1, +m[1]);
      var i = Math.round((d - hafta.pzt.getTime()) / 86400000);
      if (i >= 0 && i < 7) out.push(i);
    }
    return out;
  }
  function metindekiKisiler(ix, metin) {
    var k = ' ' + katla(metin).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var bulunan = [];
    ix.personel.forEach(function (p) {
      var anahtarlar = [p.ad].concat(p.kisa || []).map(katla).filter(Boolean)
        .sort(function (a, b) { return b.length - a.length; });
      for (var i = 0; i < anahtarlar.length; i++) {
        if (ix.adAnahtar[anahtarlar[i]] === 'BELIRSIZ') continue;
        var pos = k.indexOf(' ' + anahtarlar[i] + ' ');
        if (pos >= 0) { bulunan.push({ kisi: p, pos: pos, uzunluk: anahtarlar[i].length }); return; }
      }
    });
    bulunan.sort(function (a, b) { return a.pos - b.pos; });
    return bulunan;
  }

  /* =========================================================
   *  OKUYUCU
   *  satirlar: 2 boyutlu dizi (SheetJS sheet_to_json header:1)
   * ========================================================= */
  function shiftOku(satirlar, ayarlar, hafta) {
    var ix = indeksle(ayarlar);
    var sorular = [], bilgiler = [], aciklama = [];
    var girisler = [];   // her shift satırı
    var grup = null, gunSutun = 2;

    function hucre(r, c) { var row = satirlar[r] || []; var v = row[c]; return v == null ? '' : String(v); }

    for (var r = 0; r < satirlar.length; r++) {
      var row = satirlar[r] || [];
      // başlık satırı mı? (PAZARTESİ yazan hücre)
      var pzSutun = -1;
      for (var c = 0; c < row.length; c++) { if (katla(row[c]) === 'PAZARTESI') { pzSutun = c; break; } }
      if (pzSutun >= 0) {
        gunSutun = pzSutun;
        var subeHam = hucre(r, pzSutun + 7);
        var sb = subeBul(ix, subeHam);
        if (!sb) {
          sorular.push({ tur: 'sube', metin: 'Satır ' + (r + 1) + ': başlıktaki şube adı tanınmadı: "' + subeHam + '". Ayarlar > Şubeler bölümüne ekleyin.' });
        }
        grup = { sube: sb || duzgunAd(subeHam || ('Şube ' + (r + 1))), satir: r + 1 };
        continue;
      }
      if (!grup) continue;
      var isim = hucre(r, gunSutun - 1).trim();
      var gunler = [];
      for (var g = 0; g < 7; g++) gunler.push(hucre(r, gunSutun + g).trim());
      var notlar = [];
      for (var nc = gunSutun + 8; nc < Math.max(row.length, gunSutun + 9); nc++) {
        var nv = hucre(r, nc).trim(); if (nv) notlar.push(nv);
      }
      if (!isim) {
        if (gunler.some(Boolean)) sorular.push({ tur: 'isim', metin: 'Satır ' + (r + 1) + ': isim yok ama vardiya yazılmış (' + gunler.filter(Boolean).join(', ') + ').' });
        continue;
      }
      girisler.push({ satir: r + 1, sube: grup.sube, sozHam: hucre(r, gunSutun - 2), isimHam: isim, gunler: gunler, notlar: notlar });
    }

    if (!girisler.length) sorular.push({ tur: 'dosya', metin: 'Dosyada personel satırı bulunamadı. Başlık satırında "PAZARTESİ" yazmalı.' });

    /* kişileri birleştir */
    var kisiler = [], kisiMap = {};
    girisler.forEach(function (gi) {
      var p = kisiEslestir(ix, gi.isimHam);
      var id;
      if (p) id = 'p:' + p.sira;
      else id = 'y:' + katla(gi.isimHam);
      if (!kisiMap[id]) {
        var k = {
          id: id, ad: p ? p.ad : duzgunAd(gi.isimHam), ayar: p || null,
          girisler: [], sozler: [], tanınmadı: !p
        };
        kisiMap[id] = k; kisiler.push(k);
      }
      kisiMap[id].girisler.push(gi);
      var sz = sozCoz(gi.sozHam);
      if (sz) kisiMap[id].sozler.push({ soz: sz, sube: gi.sube, ham: buyuk(gi.sozHam).replace(/^PAR TIME$/, 'PART TIME') });
      gi.kisiId = id;
    });

    kisiler.forEach(function (k) {
      var farkli = {};
      k.sozler.forEach(function (s) { farkli[s.soz] = true; });
      var liste = Object.keys(farkli);
      if (k.ayar) {
        k.soz = k.ayar.soz;
        k.ana = k.ayar.sube;
        k.sira = k.ayar.sira;
        if (liste.length > 1) {
          var parca = k.sozler.map(function (s) { return s.sube + ' grubunda ' + s.ham; });
          // aynı ifadeleri tekrarlama
          parca = parca.filter(function (x, i) { return parca.indexOf(x) === i; });
          aciklama.push('Varsayım: ' + k.ad + " shift'te " + parca.join(', ') + ' yazıyor; ana şube ' + k.ana +
            (k.ayar.sozNot ? ' (' + k.ayar.sozNot + ')' : ' (Ayarlar)') + ', sözleşme ' + k.soz + ' kabul edildi.');
        } else if (liste.length === 1 && liste[0] !== k.soz) {
          aciklama.push('Varsayım: ' + k.ad + " shift'te " + k.sozler[0].ham + ' yazıyor; Ayarlar\'daki sözleşme (' + k.soz + ') kullanıldı.');
        }
      } else {
        k.sira = 1000 + kisiler.indexOf(k);
        // ana şube: saat yazılan ilk grup, yoksa ilk grup
        var anaGrup = null;
        k.girisler.forEach(function (gi) {
          if (anaGrup) return;
          if (gi.gunler.some(function (h) { var hc = hucreCoz(ix, h, gi.sube); return hc.tur === 'saat' || hc.tur === 'izin'; })) anaGrup = gi.sube;
        });
        k.ana = anaGrup || k.girisler[0].sube;
        if (liste.length === 1) k.soz = liste[0];
        else if (liste.length === 0) {
          k.soz = 'Part Time';
          sorular.push({ tur: 'soz', metin: k.ad + ': sözleşme tipi yazmıyor. Part Time kabul edilecek. Doğruysa onaylayın, değilse Ayarlar\'a ekleyin.' });
        } else {
          k.soz = 'Full Time';
          sorular.push({ tur: 'soz', metin: k.ad + ': bir grupta FULL TIME, başka grupta PART TIME yazıyor. Full Time kabul edilecek. Ayarlar\'a ekleyip doğru sözleşmeyi seçin.' });
        }
        sorular.push({ tur: 'isim', metin: 'Tanınmayan isim: "' + k.girisler[0].isimHam + '" (' + k.girisler.map(function (g) { return g.sube; }).join(', ') + ' grubu). "' + k.ad + '" olarak eklenecek. Ayarlar > Personel\'e eklemeniz önerilir.' });
      }
    });

    /* gün gün çözüm */
    var gunVeri = {};
    kisiler.forEach(function (k) {
      var gunler = [];
      for (var g = 0; g < 7; g++) {
        var saatler = [], subeRef = [], izin = false, bilinmeyen = [];
        k.girisler.forEach(function (gi) {
          var hc = hucreCoz(ix, gi.gunler[g], gi.sube);
          if (hc.tur === 'saat') saatler.push(hc);
          else if (hc.tur === 'sube') subeRef.push(hc.sube);
          else if (hc.tur === 'izin') izin = true;
          else if (hc.tur === 'bilinmeyen') bilinmeyen.push(hc.ham + ' (' + gi.sube + ' grubu, satır ' + gi.satir + ')');
        });
        var gk = { durum: null };
        var etiket = k.ad + ' – ' + GUN_ADLARI[g] + ' ' + ggaa(hafta.tarihler[g]);
        if (bilinmeyen.length) {
          sorular.push({ tur: 'kod', metin: etiket + ': tanınmayan kod "' + bilinmeyen.join('", "') + '". Bu gün boş kabul edilecek.' });
        }
        // aynı saat iki grupta yazılmışsa tek say
        var tekil = [];
        saatler.forEach(function (s) {
          if (!tekil.some(function (t) { return t.g === s.g && t.c === s.c && t.sube === s.sube; })) tekil.push(s);
        });
        if (tekil.length > 1) {
          sorular.push({ tur: 'celiski', metin: etiket + ': birden fazla saat yazıyor (' + tekil.map(function (t) { return aralikYaz(t.g, t.c) + ' ' + t.sube; }).join(' / ') + '). İlki alınacak.' });
        }
        if (tekil.length) {
          var s0 = tekil[0];
          gk = { durum: DURUM.CALISMA, sube: s0.sube, g: s0.g, c: s0.c };
          subeRef.forEach(function (sr) {
            if (sr !== s0.sube) sorular.push({ tur: 'celiski', metin: etiket + ': bir grupta "' + sr + '" yazıyor ama saat ' + s0.sube + ' grubunda. ' + s0.sube + ' alınacak.' });
          });
          if (izin) sorular.push({ tur: 'celiski', metin: etiket + ': bir grupta B (izin), başka grupta saat yazıyor. Çalışma kabul edilecek.' });
        } else if (subeRef.length) {
          var hedefSube = subeRef[0];
          var kap = kapanisBul(ix, ayarlar, girisler, hedefSube, g);
          gk = { durum: DURUM.CALISMA, sube: hedefSube, g: kap.g, c: kap.c, varsayilanKapanis: true };
          bilgiler.push(etiket + ': "' + hedefSube + '" yazıyor, o şubede saat yok → kapanış vardiyası ' + aralikYaz(kap.g, kap.c) + ' alındı.');
          aciklama.push(k.ad + ' ' + ggaa(hafta.tarihler[g]) + ' (' + GUN_KISA[g] + '): ' + hedefSube + "'de saat yazmadığı için kapanış vardiyası " + aralikYaz(kap.g, kap.c) + ' kabul edildi.');
        } else if (izin) {
          gk = { durum: DURUM.IZIN, sube: k.ana };
        }
        gk.degisiklik = [];
        gunler.push(gk);
      }
      gunVeri[k.id] = gunler;
    });

    /* K sütunu notları */
    var kNotlari = [];
    girisler.forEach(function (gi) {
      gi.notlar.forEach(function (metin) {
        var kayit = { metin: metin, satir: gi.satir, sube: gi.sube, cozuldu: false };
        kNotlari.push(kayit);
        var bulunan = metindekiKisiler(ix, metin);
        var kisiId = bulunan.length ? 'p:' + bulunan[0].kisi.sira : gi.kisiId;
        var kisi = kisiMap[kisiId];
        var tarihler = metindekiTarihler(metin, hafta);
        var izinGunleri = tarihler.filter(function (i) { return kisi && gunVeri[kisi.id][i].durum === DURUM.IZIN; });
        if (kisi && izinGunleri.length === 1 && /izin|kulland|rapor|hasta/i.test(metin)) {
          var gi2 = izinGunleri[0];
          var neden = nedenTemizle(metin, kisi.ayar || { ad: kisi.ad, kisa: [] });
          var gv = gunVeri[kisi.id][gi2];
          gv.durum = DURUM.FAZLA; gv.neden = neden; gv.sube = kisi.ana;
          kayit.cozuldu = true; kayit.kisi = kisi.ad; kayit.gun = gi2; kayit.neden = neden;
          var digerB = gunVeri[kisi.id].map(function (x, i) { return x.durum === DURUM.IZIN ? GUN_ADLARI[i] : null; }).filter(Boolean);
          aciklama.push(kisi.ad + ' ' + ggaa(hafta.tarihler[gi2]) + ' (' + GUN_KISA[gi2] + '): Fazla İzin — ' + neden + '.' +
            (digerB.length ? ' ' + digerB.join(', ') + ' izni normal izin (B).' : ''));
          kayit.ozet = kisi.ad + ' – ' + GUN_ADLARI[gi2] + ' ' + ggaa(hafta.tarihler[gi2]) + ' – Fazla İzin (' + neden + ')';
        } else {
          sorular.push({ tur: 'not', metin: 'Shift notu çözülemedi (satır ' + gi.satir + ', ' + gi.sube + '): "' + metin + '". Gerekirse "Değişiklikler" bölümünden ekleyin.' });
        }
      });
    });

    return {
      hafta: hafta, kisiler: kisiler.map(function (k) {
        return { id: k.id, ad: k.ad, soz: k.soz, ana: k.ana, sira: k.sira, tanınmadı: k.tanınmadı, satirlar: k.girisler.map(function (g) { return g.satir; }) };
      }),
      gunler: gunVeri, sorular: sorular, bilgiler: bilgiler, aciklama: aciklama, kNotlari: kNotlari,
      grupSayisi: (function () { var s = {}; girisler.forEach(function (g) { s[g.sube] = 1; }); return Object.keys(s).length; })(),
      satirSayisi: girisler.length
    };
  }

  // Şubenin kapanış vardiyası. Cuma/Cumartesi o şubede 14:30-23:00 yazıyorsa o.
  function kapanisBul(ix, ayarlar, girisler, sube, g) {
    var s = null;
    ayarlar.subeler.forEach(function (x) { if (x.ad === sube) s = x; });
    var normal = aralikCoz((s && s.kapanis) || '13:30-22:00');
    var cc = aralikCoz((s && s.kapanisCumaCmt) || '14:30-23:00');
    if (g === 4 || g === 5) {
      var var_ = girisler.some(function (gi) {
        if (gi.sube !== sube) return false;
        var hc = hucreCoz(ix, gi.gunler[g], gi.sube);
        return hc.tur === 'saat' && hc.g === cc.g && hc.c === cc.c;
      });
      if (var_) return cc;
    }
    return normal;
  }

  /* =========================================================
   *  DEĞİŞİKLİKLERİ UYGULA
   * ========================================================= */
  function degisiklikEtiketi(d, veri) {
    var h = veri.hafta;
    var kisiAd = d.kisi ? (kisiById(veri, d.kisi) || {}).ad : d.ad;
    var gun = GUN_ADLARI[d.gun] + ' ' + ggaa(h.tarihler[d.gun]);
    switch (d.tur) {
      case 'fazlaIzin': return kisiAd + ' – ' + gun + ' – Fazla İzin (' + d.neden + ')';
      case 'saat': return kisiAd + ' – ' + gun + ' – Saat değişikliği: ' + aralikYaz(d.g, d.c);
      case 'ekstra': return d.ad + ' – ' + gun + ' – ' + d.sube + ' ' + aralikYaz(d.g, d.c) + ' (yerine gelen / ekstra' + (d.yerine ? ', ' + (kisiById(veri, d.yerine) || {}).ad + ' yerine' : '') + ')';
      case 'sube': return kisiAd + ' – ' + gun + ' – Şube değişikliği: ' + d.sube;
      case 'izne': return kisiAd + ' – ' + gun + ' – Çalışma izne (B) çevrildi';
      case 'calismaya': return kisiAd + ' – ' + gun + ' – İzin çalışmaya çevrildi: ' + (d.sube ? d.sube + ' ' : '') + aralikYaz(d.g, d.c);
    }
    return '?';
  }
  function kisiById(veri, id) {
    for (var i = 0; i < veri.kisiler.length; i++) if (veri.kisiler[i].id === id) return veri.kisiler[i];
    return null;
  }
  function gunMetni(gk) {
    if (!gk || !gk.durum) return 'boş';
    if (gk.durum === DURUM.CALISMA) return 'Çalışma ' + aralikYaz(gk.g, gk.c) + ' ' + gk.sube;
    if (gk.durum === DURUM.IZIN) return 'İzin (B)';
    return 'Fazla İzin (' + gk.neden + ')';
  }

  function uygula(veri, degisiklikler, ayarlar) {
    var s = kopya(veri);
    s.hafta = veri.hafta;
    var ix = indeksle(ayarlar);
    s.uygulananlar = [];
    (degisiklikler || []).forEach(function (d, no) {
      var h = s.hafta;
      var tarihK = ggaa(h.tarihler[d.gun]) + ' (' + GUN_KISA[d.gun] + ')';
      var kaynak = d.kaynak ? ' [Not: "' + d.kaynak + '"]' : '';
      if (d.tur === 'ekstra') {
        // aynı isimde bilinen personel var mı?
        var p = kisiEslestir(ix, d.ad);
        var kisi = p ? kisiById(s, 'p:' + p.sira) : null;
        if (!kisi) {
          var id = p ? 'p:' + p.sira : 'd:' + katla(d.ad);
          kisi = kisiById(s, id);
          if (!kisi) {
            kisi = { id: id, ad: p ? p.ad : duzgunAd(d.ad), soz: p ? p.soz : (d.soz || 'Destek'), ana: p ? p.sube : d.sube, sira: p ? p.sira : 2000 + no, destek: !p, satirlar: [] };
            s.kisiler.push(kisi);
            s.gunler[id] = []; for (var i = 0; i < 7; i++) s.gunler[id].push({ durum: null, degisiklik: [] });
          }
        }
        var gk = s.gunler[kisi.id][d.gun];
        var once = gunMetni(gk);
        if (gk.durum === DURUM.CALISMA) s.sorular.push({ tur: 'celiski', metin: kisi.ad + ' ' + tarihK + ' zaten çalışıyor (' + aralikYaz(gk.g, gk.c) + ' ' + gk.sube + '); ekstra vardiya bunun yerine yazıldı.' });
        gk.durum = DURUM.CALISMA; gk.sube = d.sube; gk.g = d.g; gk.c = d.c;
        var yerine = d.yerine ? (kisiById(s, d.yerine) || {}).ad : null;
        gk.degisiklik.push((yerine ? yerine + ' yerine geldi' : 'Ekstra/yerine gelen') + ': ' + d.sube + ' ' + aralikYaz(d.g, d.c));
        s.aciklama.push(kisi.ad + ' ' + tarihK + ': ' + (yerine ? yerine + ' yerine ' : 'ekstra ') + d.sube + ' ' + aralikYaz(d.g, d.c) +
          ' (net ' + sayiYaz(sureSaat(d.g, d.c) - ayarlar.mola) + ' sa' + (kisi.destek ? ', Destek – hedef yok' : '') + ').' + (once !== 'boş' ? ' Önce: ' + once + '.' : '') + kaynak);
        s.uygulananlar.push(degisiklikEtiketi(d, s));
        return;
      }
      var k = kisiById(s, d.kisi);
      if (!k) { s.sorular.push({ tur: 'not', metin: 'Değişiklik uygulanamadı (kişi bulunamadı): ' + JSON.stringify(d) }); return; }
      var gv = s.gunler[k.id][d.gun];
      var onceM = gunMetni(gv);
      var onceSaat = gv.durum === DURUM.CALISMA ? aralikYaz(gv.g, gv.c) : null;
      switch (d.tur) {
        case 'fazlaIzin':
          gv.durum = DURUM.FAZLA; gv.neden = d.neden; gv.sube = k.ana; delete gv.g; delete gv.c;
          gv.degisiklik.push('Önce: ' + onceM);
          s.aciklama.push(k.ad + ' ' + tarihK + ': Fazla İzin — ' + d.neden + ' (önce: ' + onceM + ').' + kaynak);
          break;
        case 'saat':
          if (gv.durum !== DURUM.CALISMA) {
            gv.sube = d.sube || k.ana;
          } else if (d.sube) gv.sube = d.sube;
          gv.durum = DURUM.CALISMA; gv.g = d.g; gv.c = d.c; delete gv.neden;
          gv.degisiklik.push('Saat değişti: ' + (onceSaat || onceM) + ' → ' + aralikYaz(d.g, d.c));
          s.aciklama.push(k.ad + ' ' + tarihK + ': saat değişti ' + (onceSaat || onceM) + ' → ' + aralikYaz(d.g, d.c) + '.' + kaynak);
          break;
        case 'sube':
          if (gv.durum !== DURUM.CALISMA) { s.sorular.push({ tur: 'not', metin: k.ad + ' ' + tarihK + ' çalışmıyor; şube değişikliği uygulanamadı.' }); return; }
          var eski = gv.sube; gv.sube = d.sube;
          gv.degisiklik.push('Şube değişti: ' + eski + ' → ' + d.sube);
          s.aciklama.push(k.ad + ' ' + tarihK + ': şube değişti ' + eski + ' → ' + d.sube + ' (' + aralikYaz(gv.g, gv.c) + ').' + kaynak);
          break;
        case 'izne':
          gv.durum = DURUM.IZIN; gv.sube = k.ana; delete gv.g; delete gv.c; delete gv.neden;
          gv.degisiklik.push('İzne çevrildi (önce: ' + onceM + ')');
          s.aciklama.push(k.ad + ' ' + tarihK + ': izne (B) çevrildi (önce: ' + onceM + ').' + kaynak);
          break;
        case 'calismaya':
          gv.durum = DURUM.CALISMA; gv.sube = d.sube || k.ana; gv.g = d.g; gv.c = d.c; delete gv.neden;
          gv.degisiklik.push('Çalışmaya çevrildi (önce: ' + onceM + ')');
          s.aciklama.push(k.ad + ' ' + tarihK + ': çalışmaya çevrildi ' + gv.sube + ' ' + aralikYaz(d.g, d.c) + ' (önce: ' + onceM + ').' + kaynak);
          break;
      }
      s.uygulananlar.push(degisiklikEtiketi(d, s));
    });
    return s;
  }

  /* =========================================================
   *  HESAP
   * ========================================================= */
  function hesapla(s, ayarlar) {
    var ix = indeksle(ayarlar);
    var h = s.hafta;
    var subeAdlari = ix.subeler.map(function (x) { return x.ad; });
    // ana şubesi ayarlarda olmayan şubeleri sona ekle
    s.kisiler.forEach(function (k) { if (subeAdlari.indexOf(k.ana) < 0) subeAdlari.push(k.ana); });
    function sSira(ad) { var i = subeAdlari.indexOf(ad); return i < 0 ? 99 : i; }

    // kişi sırası: ana şube sırası, sonra ayar sırası
    var kisiler = s.kisiler.slice().sort(function (a, b) {
      return (sSira(a.ana) - sSira(b.ana)) || (a.sira - b.sira);
    });
    kisiler.forEach(function (k, i) { k.genelSira = i; });

    var mola = ayarlar.mola;
    var detay = [];
    kisiler.forEach(function (k) {
      s.gunler[k.id].forEach(function (gk, g) {
        if (!gk.durum) return;
        var r = {
          gun: g, tarih: h.tarihler[g], gunAd: GUN_ADLARI[g], kisi: k.ad, kisiId: k.id, soz: k.soz, ana: k.ana,
          sube: gk.durum === DURUM.CALISMA ? gk.sube : k.ana, durum: gk.durum,
          g: gk.durum === DURUM.CALISMA ? gk.g : null, c: gk.durum === DURUM.CALISMA ? gk.c : null,
          mola: gk.durum === DURUM.CALISMA ? mola : 0, neden: gk.durum === DURUM.FAZLA ? (gk.neden || '') : '',
          kisiSira: k.genelSira, degisiklik: gk.degisiklik || []
        };
        r.brut = r.durum === DURUM.CALISMA ? sureSaat(r.g, r.c) : 0;
        r.net = r.durum === DURUM.CALISMA ? r.brut - r.mola : 0;
        detay.push(r);
      });
    });
    var durumSira = {}; durumSira[DURUM.CALISMA] = 0; durumSira[DURUM.IZIN] = 1; durumSira[DURUM.FAZLA] = 2;
    detay.sort(function (a, b) {
      return (a.gun - b.gun) || (durumSira[a.durum] - durumSira[b.durum]) || (sSira(a.sube) - sSira(b.sube)) ||
        ((a.g == null ? 0 : a.g) - (b.g == null ? 0 : b.g)) || (a.kisiSira - b.kisiSira);
    });

    // kişi toplamları
    var kisiOzet = kisiler.map(function (k) {
      var o = { id: k.id, ad: k.ad, soz: k.soz, ana: k.ana, net: 0, calisilan: 0, izin: 0, fazla: 0, nedenler: [], destek: !!k.destek };
      detay.forEach(function (r) {
        if (r.kisiId !== k.id) return;
        o.net += r.net;
        if (r.durum === DURUM.CALISMA) o.calisilan++;
        else if (r.durum === DURUM.IZIN) o.izin++;
        else { o.fazla++; o.nedenler.push(r.neden); }
      });
      o.net = Math.round(o.net * 100) / 100;
      o.hedef = k.soz === 'Full Time' ? ayarlar.hedef : null;
      o.fark = o.hedef == null ? null : Math.round((o.net - o.hedef) * 100) / 100;
      o.uyari = uyariMetni(o);
      return o;
    });

    // şube toplamları
    var subeOzet = subeAdlari.map(function (ad) {
      var o = { ad: ad, gunler: [0, 0, 0, 0, 0, 0, 0], toplam: 0, personelGun: 0 };
      detay.forEach(function (r) {
        if (r.durum !== DURUM.CALISMA || r.sube !== ad) return;
        o.gunler[r.gun] += r.net; o.toplam += r.net; o.personelGun++;
      });
      return o;
    }).filter(function (o, i) { return i < ix.subeler.length || o.personelGun > 0; });

    // kontroller (bölüm 5)
    var sorular = (s.sorular || []).slice();
    detay.forEach(function (r) {
      if (r.durum !== DURUM.CALISMA) return;
      if (r.brut < 4 || r.brut > 13) sorular.push({ tur: 'sure', metin: r.kisi + ' – ' + r.gunAd + ' ' + ggaa(r.tarih) + ': vardiya ' + aralikYaz(r.g, r.c) + ' = ' + sayiYaz(r.brut) + ' saat (' + (r.brut < 4 ? '4 saatten kısa' : '13 saatten uzun') + ').' });
    });
    var bosOlabilir = ayarlar.bosOlabilir || [];
    ix.subeler.forEach(function (sb) {
      for (var g = 0; g < 7; g++) {
        var var_ = detay.some(function (r) { return r.gun === g && r.durum === DURUM.CALISMA && r.sube === sb.ad; });
        if (!var_ && bosOlabilir.indexOf(sb.ad + '|' + GUN_KISA[g]) < 0) {
          sorular.push({ tur: 'bos', metin: sb.ad + ' – ' + GUN_ADLARI[g] + ' ' + ggaa(h.tarihler[g]) + ': o gün bu şubede kimse çalışmıyor.', anahtar: sb.ad + '|' + GUN_KISA[g] });
        }
      }
    });

    var genel = Math.round(subeOzet.reduce(function (a, o) { return a + o.toplam; }, 0) * 100) / 100;
    return { detay: detay, kisiler: kisiler, kisiOzet: kisiOzet, subeOzet: subeOzet, subeAdlari: subeAdlari, sorular: sorular, genelToplam: genel };
  }

  function uyariMetni(o) {
    if (o.soz !== 'Full Time') return '-';
    var t = '';
    if (o.izin === 0 && o.fazla === 0) t += 'İzin günü yok; ';
    if (o.fazla > 0) t += 'Fazla izin ' + o.fazla + ' gün; ';
    if (o.fark > 0) t += 'Fazla mesai ' + sayiYaz(o.fark) + ' sa; ';
    if (o.fark < 0) t += 'Eksik ' + sayiYaz(-o.fark) + ' sa; ';
    return t === '' ? 'Tamam' : t;
  }

  var API = {
    GUN_ADLARI: GUN_ADLARI, GUN_KISA: GUN_KISA, DURUM: DURUM,
    buyuk: buyuk, katla: katla, saatYaz: saatYaz, aralikYaz: aralikYaz, aralikCoz: aralikCoz, sureSaat: sureSaat,
    sayiYaz: sayiYaz, tarihYaz: tarihYaz, ggaa: ggaa, kisaNeden: kisaNeden, kopya: kopya,
    haftaBul: haftaBul, haftaTarihten: haftaTarihten, indeksle: indeksle, kisiEslestir: kisiEslestir, subeBul: subeBul,
    metindekiKisiler: metindekiKisiler, duzgunAd: duzgunAd,
    shiftOku: shiftOku, uygula: uygula, hesapla: hesapla, degisiklikEtiketi: degisiklikEtiketi, kisiById: kisiById, gunMetni: gunMetni
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else kok.Cekirdek = API;
})(this);
