/* Sihir Dükkanı – Puantaj Paneli : EXCEL MODELİ
 * Hesap sonucundan 5 sayfalık çalışma kitabının tarifini (hücre, formül, stil, not, koşullu biçim) üretir.
 * Kütüphaneden bağımsızdır; excel-yazici.js bu tarifi ExcelJS ile .xlsx dosyasına çevirir.
 * Her formül hücresi, telefon gibi formül hesaplamayan görüntüleyiciler için hesaplanmış sonucu da taşır.
 */
(function (kok) {
  'use strict';
  var C = (typeof module !== 'undefined' && module.exports) ? require('./cekirdek.js') : kok.Cekirdek;

  var RENK = { bordo: 'FF5B2333', acikBordo: 'FFE6D5D9', beyaz: 'FFFFFFFF', sari: 'FFFFF2CC', yesil: 'FFD9EAD3', kirmizi: 'FFF4CCCC', mavi: 'FF0000FF', koyuYesil: 'FF006100' };
  var INCE = { sol: 'thin', sag: 'thin', ust: 'thin', alt: 'thin' };
  var ST = {
    baslik: { b: true, renk: RENK.beyaz, dolgu: RENK.bordo, yatay: 'center', dikey: 'center', kaydir: true, cerceve: INCE },
    govde: { cerceve: INCE },
    toplam: { b: true, dolgu: RENK.sari, cerceve: INCE }
  };
  function st() { var o = {}; for (var i = 0; i < arguments.length; i++) { var a = arguments[i]; for (var k in a) if (a[k] !== undefined) o[k] = a[k]; } return o; }
  function harf(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function tarihVal(d) { return { tarih: d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2) }; }
  function yuvarla(x) { return Math.round(x * 1e6) / 1e6; }

  function Sayfa(ad) {
    this.ad = ad; this.hucreler = []; this.sutunlar = []; this.yukseklik = {}; this.kb = []; this.dondur = null; this.filtre = null;
  }
  Sayfa.prototype.yaz = function (r, c, v, s, ek) {
    var h = { r: r, c: c, s: s || {} };
    if (v !== undefined && v !== null && v !== '') h.v = v;
    if (ek) { if (ek.f) h.f = ek.f; if (ek.not) h.not = ek.not; if (ek.v !== undefined) h.v = ek.v; }
    this.hucreler.push(h); return h;
  };
  Sayfa.prototype.genislik = function (min, max, w, gizli) { this.sutunlar.push({ min: min, max: max, genislik: w, gizli: !!gizli }); };

  function kitapModeli(s, h, ayarlar) {
    var hafta = s.hafta;
    var D = C.DURUM;
    var n = h.detay.length;
    var son = Math.max(n + 1, 2);
    function R(col) { return 'Detay!$' + col + '$2:$' + col + '$' + son; }
    function DATE(d) { return 'DATE(' + d.getUTCFullYear() + ',' + (d.getUTCMonth() + 1) + ',' + d.getUTCDate() + ')'; }
    var subeBaslik = {};
    ayarlar.subeler.forEach(function (x) { subeBaslik[x.ad] = x.baslik || C.buyuk(x.ad); });
    function baslikAd(ad) { return subeBaslik[ad] || C.buyuk(ad); }
    var ozetMap = {}; h.kisiOzet.forEach(function (o) { ozetMap[o.id] = o; });
    var gunAciklik = hafta.tarihler.map(function (d, i) { return C.GUN_KISA[i] + '\n' + C.ggaa(d); });
    var gunUzun = hafta.tarihler.map(function (d, i) { return C.GUN_ADLARI[i] + '\n' + C.ggaa(d); });

    /* ---------- 1) Özet ---------- */
    var oz = new Sayfa('Özet');
    ['Personel', 'Şube', 'Çalıştığı Gün', 'İzin Günü', 'Fazla İzin', 'Fazla İzin Nedeni', 'Çalıştığı Saat (net)'].forEach(function (t, c) { oz.yaz(1, c, t, ST.baslik); });
    h.kisiOzet.forEach(function (o, i) {
      var r = i + 2;
      oz.yaz(r, 0, o.ad, ST.govde);
      oz.yaz(r, 1, o.ana, ST.govde);
      oz.yaz(r, 2, null, ST.govde, { f: 'COUNTIFS(' + R('C') + ',$A' + r + ',' + R('G') + ',"Çalışma")', v: o.calisilan });
      oz.yaz(r, 3, null, ST.govde, { f: 'COUNTIFS(' + R('C') + ',$A' + r + ',' + R('G') + ',"İzin")', v: o.izin });
      oz.yaz(r, 4, null, ST.govde, { f: 'COUNTIFS(' + R('C') + ',$A' + r + ',' + R('G') + ',"Fazla İzin")', v: o.fazla });
      oz.yaz(r, 5, null, ST.govde, { f: 'IFERROR(INDEX(' + R('M') + ',MATCH($A' + r + '&"|Fazla İzin",' + R('N') + ',0)),"")', v: o.nedenler[0] || '' });
      oz.yaz(r, 6, null, st(ST.govde, { nf: '0.0' }), { f: 'SUMIFS(' + R('L') + ',' + R('C') + ',$A' + r + ')', v: o.net });
    });
    var ozSon = h.kisiOzet.length + 1, ozT = ozSon + 1;
    oz.yaz(ozT, 0, 'TOPLAM', ST.toplam); oz.yaz(ozT, 1, null, ST.toplam); oz.yaz(ozT, 5, null, ST.toplam);
    [2, 3, 4, 6].forEach(function (c) {
      var L = harf(c);
      var top = h.kisiOzet.reduce(function (a, o) { return a + [0, 0, o.calisilan, o.izin, o.fazla, 0, o.net][c]; }, 0);
      oz.yaz(ozT, c, null, c === 6 ? st(ST.toplam, { nf: '0.0' }) : ST.toplam, { f: 'SUM(' + L + '2:' + L + ozSon + ')', v: yuvarla(top) });
    });
    oz.kb.push({ ref: 'A2:G' + ozSon, kurallar: [{ tur: 'ifade', formul: '$E2>0', dolgu: RENK.kirmizi }] });
    oz.dondur = { x: 0, y: 1 };
    oz.genislik(1, 1, 20); oz.genislik(2, 2, 12); oz.genislik(3, 3, 13); oz.genislik(4, 5, 11); oz.genislik(6, 6, 60); oz.genislik(7, 7, 18);

    /* ---------- 2) Puantaj ---------- */
    var pu = new Sayfa('Puantaj');
    pu.yaz(1, 0, 'Haftalık Puantaj ' + hafta.baslangic + ' - ' + hafta.bitis, { b: true, sz: 13, renk: RENK.bordo });
    pu.yukseklik[1] = 16.15;
    pu.yaz(2, 0, 'Full Time haftalık hedef (net saat):', { b: true });
    pu.yaz(2, 3, ayarlar.hedef, { b: true, renk: RENK.mavi });
    var pb = ['Personel', 'Sözleşme', 'Ana Şube'].concat(gunAciklik).concat(['Toplam Net', 'Hedef', 'Fark', 'Çalışılan Gün', 'İzin (B)', 'Fazla İzin', 'Uyarı']);
    pb.forEach(function (t, c) { pu.yaz(4, c, t, ST.baslik); });
    pu.yukseklik[4] = 31.5;
    var r = 5;
    var ilkVeri = 5;
    h.subeAdlari.forEach(function (sube) {
      var kisiler = h.kisiler.filter(function (k) { return k.ana === sube; });
      if (!kisiler.length) return;
      for (var c = 0; c < 17; c++) pu.yaz(r, c, c === 0 ? baslikAd(sube) : null, { b: true, renk: RENK.bordo, dolgu: RENK.acikBordo });
      r++;
      kisiler.forEach(function (k) {
        var o = ozetMap[k.id];
        pu.yaz(r, 0, k.ad, ST.govde);
        pu.yaz(r, 1, k.soz, st(ST.govde, { yatay: 'center' }));
        pu.yaz(r, 2, k.ana, st(ST.govde, { yatay: 'center' }));
        for (var g = 0; g < 7; g++) {
          var gk = s.gunler[k.id][g];
          var dt = DATE(hafta.tarihler[g]);
          var base = R('C') + ',$A' + r + ',' + R('A') + ',' + dt;
          var f = 'IF(COUNTIFS(' + base + ',' + R('G') + ',"Çalışma")>0,SUMIFS(' + R('L') + ',' + R('C') + ',$A' + r + ',' + R('A') + ',' + dt + '),' +
            'IF(COUNTIFS(' + base + ',' + R('G') + ',"İzin")>0,"B",' +
            'IF(COUNTIFS(' + base + ',' + R('G') + ',"Fazla İzin")>0,"Fİ","-")))';
          var v = '-', not = null, stil = st(ST.govde, { yatay: 'center', nf: '0.0' });
          var degisim = (gk.degisiklik || []).join('\n');
          if (gk.durum === D.CALISMA) {
            v = yuvarla(C.sureSaat(gk.g, gk.c) - ayarlar.mola);
            not = C.aralikYaz(gk.g, gk.c) + (gk.sube !== k.ana ? ' (' + gk.sube + ')' : '');
            if (gk.sube !== k.ana) stil.dolgu = RENK.sari;
          } else if (gk.durum === D.IZIN) { v = 'B'; }
          else if (gk.durum === D.FAZLA) { v = 'Fİ'; not = 'Fazla izin: ' + gk.neden; }
          if (degisim) not = (not ? not + '\n' : '') + degisim;
          pu.yaz(r, 3 + g, null, stil, { f: f, v: v, not: not });
        }
        pu.yaz(r, 10, null, st(ST.govde, { b: true, yatay: 'center', nf: '0.0' }), { f: 'SUMIFS(' + R('L') + ',' + R('C') + ',$A' + r + ')', v: o.net });
        pu.yaz(r, 11, null, st(ST.govde, { yatay: 'center' }), { f: 'IF(B' + r + '="Full Time",$D$2,"-")', v: o.hedef == null ? '-' : o.hedef });
        pu.yaz(r, 12, null, st(ST.govde, { yatay: 'center', nf: '0.0;\\-0.0;0.0' }), { f: 'IF(ISNUMBER(L' + r + '),K' + r + '-L' + r + ',"-")', v: o.fark == null ? '-' : o.fark });
        pu.yaz(r, 13, null, st(ST.govde, { yatay: 'center' }), { f: 'COUNTIFS(' + R('C') + ',$A' + r + ',' + R('G') + ',"Çalışma")', v: o.calisilan });
        pu.yaz(r, 14, null, st(ST.govde, { yatay: 'center' }), { f: 'COUNTIFS(' + R('C') + ',$A' + r + ',' + R('G') + ',"İzin")', v: o.izin });
        pu.yaz(r, 15, null, st(ST.govde, { yatay: 'center' }), { f: 'COUNTIFS(' + R('C') + ',$A' + r + ',' + R('G') + ',"Fazla İzin")', v: o.fazla });
        var parca = 'IF(AND(O' + r + '=0,P' + r + '=0),"İzin günü yok; ","")&IF(P' + r + '>0,"Fazla izin "&P' + r + '&" gün; ","")&IF(M' + r + '>0,"Fazla mesai "&M' + r + '&" sa; ","")&IF(M' + r + '<0,"Eksik "&-M' + r + '&" sa; ","")';
        pu.yaz(r, 16, null, ST.govde, { f: 'IF(B' + r + '<>"Full Time","-",IF(' + parca + '="","Tamam",' + parca + '))', v: o.uyari });
        r++;
      });
    });
    var puSon = r - 1;
    pu.kb.push({ ref: 'D' + ilkVeri + ':J' + puSon, kurallar: [{ tur: 'esit', deger: '"B"', dolgu: RENK.yesil }, { tur: 'esit', deger: '"Fİ"', dolgu: RENK.kirmizi }] });
    pu.kb.push({ ref: 'Q' + ilkVeri + ':Q' + puSon, kurallar: [{ tur: 'esit', deger: '"Tamam"', dolgu: RENK.yesil, yaziRenk: RENK.koyuYesil }, { tur: 'ifade', formul: 'AND(Q' + ilkVeri + '<>"Tamam",Q' + ilkVeri + '<>"-",Q' + ilkVeri + '<>"")', dolgu: RENK.kirmizi }] });
    // AÇIKLAMA bloğu
    r = puSon + 2;
    pu.yaz(r++, 0, 'AÇIKLAMA', { b: true, sz: 9 });
    var aciklama = [
      'Renkler: yeşil = haftalık izin (B) · kırmızımsı = fazla izin (Fİ, neden hücre notunda) · sarı = kendi şubesi dışında çalıştığı gün (hücre notunda saat ve şube).',
      "Saatler net saattir: her vardiyadan " + C.sayiYaz(ayarlar.mola) + " saat mola düşülür. Tüm toplamlar Detay sayfasından formülle hesaplanır; Detay'daki mavi giriş/çıkış/mola hücreleri değiştirilirse her şey güncellenir.",
      'Boş vardiya hücresi "-" (part time, vardiya yok); izin sayılmaz.'
    ].concat(s.aciklama || []);
    aciklama.forEach(function (t) { pu.yaz(r++, 0, t, { sz: 9 }); });
    pu.dondur = { x: 3, y: 4 };
    pu.genislik(1, 1, 20); pu.genislik(2, 3, 11); pu.genislik(4, 10, 8); pu.genislik(11, 11, 11); pu.genislik(12, 13, 8);
    pu.genislik(14, 14, 10); pu.genislik(15, 15, 8); pu.genislik(16, 16, 10); pu.genislik(17, 17, 34);

    /* ---------- 3) Vardiya Planı ---------- */
    var vp = new Sayfa('Vardiya Planı');
    r = 1;
    h.subeAdlari.forEach(function (sube) {
      var kendi = h.kisiler.filter(function (k) { return k.ana === sube; });
      var misafir = h.kisiler.filter(function (k) {
        return k.ana !== sube && s.gunler[k.id].some(function (gk) { return gk.durum === D.CALISMA && gk.sube === sube; });
      });
      if (!kendi.length && !misafir.length) return;
      if (r > 1) r++;   // bloklar arası boş satır
      vp.yaz(r, 0, baslikAd(sube), ST.baslik);
      gunUzun.forEach(function (t, g) { vp.yaz(r, g + 1, t, ST.baslik); });
      vp.yukseklik[r] = 30; r++;
      kendi.forEach(function (k) {
        vp.yaz(r, 0, k.ad + ' (' + k.soz + ')', st(ST.govde, { yatay: 'left' }));
        for (var g = 0; g < 7; g++) {
          var gk = s.gunler[k.id][g], v = null, stl = st(ST.govde, { yatay: 'center' });
          if (gk.durum === D.CALISMA) {
            if (gk.sube === sube) v = C.aralikYaz(gk.g, gk.c);
            else { v = '→ ' + baslikAd(gk.sube); stl.dolgu = RENK.sari; }
          } else if (gk.durum === D.IZIN) { v = 'İZİN'; stl.dolgu = RENK.yesil; }
          else if (gk.durum === D.FAZLA) { v = 'FAZLA İZİN (' + C.kisaNeden(gk.neden) + ')'; stl.dolgu = RENK.kirmizi; }
          vp.yaz(r, g + 1, v, stl);
        }
        r++;
      });
      misafir.forEach(function (k) {
        vp.yaz(r, 0, k.ad + ' (' + k.ana + ')', st(ST.govde, { yatay: 'left', dolgu: RENK.sari }));
        for (var g = 0; g < 7; g++) {
          var gk = s.gunler[k.id][g];
          if (gk.durum === D.CALISMA && gk.sube === sube) vp.yaz(r, g + 1, C.aralikYaz(gk.g, gk.c), st(ST.govde, { yatay: 'center', dolgu: RENK.sari }));
          else vp.yaz(r, g + 1, null, st(ST.govde, { yatay: 'center' }));
        }
        r++;
      });
    });
    vp.genislik(1, 1, 28); vp.genislik(2, 8, 17);

    /* ---------- 4) Şube Özeti ---------- */
    var so = new Sayfa('Şube Özeti');
    ['Şube'].concat(gunUzun).concat(['Hafta Toplamı', 'Personel-Gün']).forEach(function (t, c) { so.yaz(1, c, t, ST.baslik); });
    so.yukseklik[1] = 30;
    h.subeOzet.forEach(function (o, i) {
      var rr = i + 2;
      so.yaz(rr, 0, o.ad, st(ST.govde, { b: true }));
      for (var g = 0; g < 7; g++) {
        so.yaz(rr, g + 1, null, st(ST.govde, { yatay: 'center', nf: '0.0' }), { f: 'SUMIFS(' + R('L') + ',' + R('A') + ',' + DATE(hafta.tarihler[g]) + ',' + R('F') + ',$A' + rr + ')', v: yuvarla(o.gunler[g]) });
      }
      so.yaz(rr, 8, null, st(ST.govde, { b: true, yatay: 'center', nf: '0.0' }), { f: 'SUM(B' + rr + ':H' + rr + ')', v: yuvarla(o.toplam) });
      so.yaz(rr, 9, null, st(ST.govde, { yatay: 'center' }), { f: 'COUNTIFS(' + R('F') + ',$A' + rr + ',' + R('G') + ',"Çalışma")', v: o.personelGun });
    });
    var soSon = h.subeOzet.length + 1, soT = soSon + 1;
    so.yaz(soT, 0, 'TOPLAM', ST.toplam);
    for (var c2 = 1; c2 <= 9; c2++) {
      var L2 = harf(c2);
      var top2 = h.subeOzet.reduce(function (a, o) { return a + (c2 <= 7 ? o.gunler[c2 - 1] : c2 === 8 ? o.toplam : o.personelGun); }, 0);
      so.yaz(soT, c2, null, st(ST.toplam, { yatay: 'center', nf: c2 === 9 ? '0' : '0.0' }), { f: 'SUM(' + L2 + '2:' + L2 + soSon + ')', v: yuvarla(top2) });
    }
    so.genislik(1, 1, 14); so.genislik(2, 10, 13);

    /* ---------- 5) Detay ---------- */
    var de = new Sayfa('Detay');
    ['Tarih', 'Gün', 'Personel', 'Sözleşme', 'Ana Şube', 'Çalıştığı Şube', 'Durum', 'Giriş', 'Çıkış', 'Mola (sa)', 'Brüt (sa)', 'Net (sa)', 'Fazla İzin Nedeni', 'Anahtar']
      .forEach(function (t, c) { de.yaz(1, c, t, ST.baslik); });
    de.yukseklik[1] = 23.85;
    h.detay.forEach(function (x, i) {
      var rr = i + 2;
      var yeniGun = i > 0 && h.detay[i - 1].gun !== x.gun;
      var cer = yeniGun ? { sol: 'thin', sag: 'thin', ust: 'thick', alt: 'thin' } : INCE;
      var dol = x.durum === D.FAZLA ? RENK.kirmizi : (x.durum === D.IZIN ? RENK.yesil : undefined);
      function sty(ek) { return st({ cerceve: cer, dolgu: dol }, ek || {}); }
      de.yaz(rr, 0, tarihVal(x.tarih), sty({ nf: 'dd\\.mm\\.yyyy' }));
      de.yaz(rr, 1, x.gunAd, sty());
      de.yaz(rr, 2, x.kisi, sty());
      de.yaz(rr, 3, x.soz, sty());
      de.yaz(rr, 4, x.ana, sty());
      de.yaz(rr, 5, x.sube, sty());
      de.yaz(rr, 6, x.durum, sty());
      de.yaz(rr, 7, x.g == null ? null : x.g / 1440, sty({ nf: 'hh:mm', renk: RENK.mavi }));
      de.yaz(rr, 8, x.c == null ? null : x.c / 1440, sty({ nf: 'hh:mm', renk: RENK.mavi }));
      de.yaz(rr, 9, x.mola, sty({ renk: RENK.mavi }), { v: x.mola });
      de.yaz(rr, 10, null, sty({ nf: '0.0' }), { f: 'IF(G' + rr + '="Çalışma",MOD(I' + rr + '-H' + rr + ',1)*24,0)', v: yuvarla(x.brut) });
      de.yaz(rr, 11, null, sty({ nf: '0.0' }), { f: 'IF(G' + rr + '="Çalışma",K' + rr + '-J' + rr + ',0)', v: yuvarla(x.net) });
      de.yaz(rr, 12, x.neden || null, sty());
      de.yaz(rr, 13, null, { cerceve: cer }, { f: 'C' + rr + '&"|"&G' + rr, v: x.kisi + '|' + x.durum });
    });
    de.filtre = 'A1:M' + son;
    de.dondur = { x: 0, y: 1 };
    de.genislik(1, 2, 12); de.genislik(3, 3, 18); de.genislik(4, 5, 11); de.genislik(6, 6, 14); de.genislik(7, 7, 12);
    de.genislik(8, 9, 8); de.genislik(10, 12, 9); de.genislik(13, 13, 50); de.genislik(14, 14, 20, true);

    return {
      dosyaAdi: 'Puantaj_' + hafta.dosyaEtiketi + '.xlsx',
      font: 'Arial', boyut: 10,
      sayfalar: [oz, pu, vp, so, de]
    };
  }

  var API = { kitapModeli: kitapModeli, harf: harf, RENK: RENK };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else kok.ExcelModel = API;
})(this);
