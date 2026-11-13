/* Sihir Dükkanı – Puantaj Paneli : ARAYÜZ */
(function () {
  'use strict';
  var C = window.Cekirdek, N = window.NotCozucu, M = window.ExcelModel, Y = window.ExcelYazici;
  var AYAR_ANAHTAR = 'puantaj_ayarlar_v2', DOSYA_ANAHTAR = 'puantaj_son_dosya', NOT_ONEK = 'puantaj_notlar_';

  var D = {
    ayarlar: null, dosyaAdi: null, satirlar: null, hafta: null,
    veri: null, sonuc: null, hesap: null, notlar: [], bekleyen: null, soruImza: '', uretildi: false
  };

  /* ---------- yardımcılar ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function goster(el, v) { (typeof el === 'string' ? $(el) : el).classList.toggle('gizli', !v); }
  var bildirimZaman;
  function bildir(metin) {
    var b = $('bildirim'); b.textContent = metin; goster(b, true);
    clearTimeout(bildirimZaman); bildirimZaman = setTimeout(function () { goster(b, false); }, 3500);
  }
  function depoAl(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function depoYaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function dkGir(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function dkYaz(d) { return C.saatYaz(d); }
  function hucreMetni(gk, ana, mola) {
    if (!gk || !gk.durum) return '-';
    if (gk.durum === 'Çalışma') return C.sayiYaz(C.sureSaat(gk.g, gk.c) - mola) + (gk.sube !== ana ? '*' : '');
    if (gk.durum === 'İzin') return 'B';
    return 'Fİ';
  }

  /* ---------- ayarlar ---------- */
  function ayarGecerliMi(a) {
    return a && Array.isArray(a.personel) && Array.isArray(a.subeler) && a.subeler.length && typeof a.hedef === 'number';
  }
  function ayarYukle() {
    var a = depoAl(AYAR_ANAHTAR);
    if (a && !ayarGecerliMi(a)) { bildir('Ayarlar okunamadı, varsayılan ayarlar kullanılıyor.'); a = null; }
    D.ayarlar = a || C.kopya(window.VARSAYILAN_AYARLAR);
    if (!D.ayarlar.bosOlabilir) D.ayarlar.bosOlabilir = [];
    if (!D.ayarlar.kodlar) D.ayarlar.kodlar = [];
  }
  function ayarKaydet(a) { D.ayarlar = a; depoYaz(AYAR_ANAHTAR, a); }

  /* ---------- dosya yükleme ---------- */
  function dosyaOku(file) {
    if (!window.XLSX) { bildir('Excel okuma kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        if (ws['!ref']) { var r = XLSX.utils.decode_range(ws['!ref']); r.s.r = 0; r.s.c = 0; ws['!ref'] = XLSX.utils.encode_range(r); }
        var satirlar = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true });
        dosyaHazir(file.name, satirlar, null);
      } catch (e) {
        console.error(e);
        bildir('Dosya okunamadı: ' + e.message);
      }
    };
    fr.readAsArrayBuffer(file);
  }

  function dosyaHazir(ad, satirlar, pztISO) {
    D.dosyaAdi = ad; D.satirlar = satirlar; D.uretildi = false;
    var h;
    if (pztISO) { var p = pztISO.split('-'); h = C.haftaTarihten(+p[2], +p[1], +p[0]); }
    else h = C.haftaBul(ad);
    $('dosyaBilgi').innerHTML = '📄 <b>' + esc(ad) + '</b>';
    goster('dosyaBilgi', true);
    if (h.hata || !h.pzt) {
      D.hafta = null;
      $('tarihSorMetin').textContent = h.hata + ' Lütfen haftanın Pazartesi tarihini seçin.';
      goster('tarihSor', true);
      ['bolumOnizleme', 'bolumNotlar', 'bolumUret'].forEach(function (b) { goster(b, false); });
      return;
    }
    goster('tarihSor', false);
    haftaAyarla(h);
  }

  function haftaAyarla(h) {
    D.hafta = h;
    $('dosyaBilgi').innerHTML = '📄 <b>' + esc(D.dosyaAdi) + '</b><br>Hafta: <b>' + h.baslangic + ' Pazartesi – ' + h.bitis + ' Pazar</b>';
    var iso = h.pzt.toISOString().slice(0, 10);
    depoYaz(DOSYA_ANAHTAR, { ad: D.dosyaAdi, satirlar: D.satirlar, pzt: iso });
    D.notlar = depoAl(NOT_ONEK + h.baslangic) || [];
    ['bolumOnizleme', 'bolumNotlar', 'bolumUret'].forEach(function (b) { goster(b, true); });
    yenidenHesapla();
  }

  /* ---------- hesap ---------- */
  function idCoz(ad) {
    if (!ad || !D.veri) return null;
    for (var i = 0; i < D.veri.kisiler.length; i++) if (D.veri.kisiler[i].ad === ad) return D.veri.kisiler[i].id;
    return null;
  }
  function degisiklikleriTopla() {
    var hepsi = [];
    D.notlar.forEach(function (n) {
      n.degisiklikler.forEach(function (d) {
        var x = Object.assign({}, d);
        if (x.kisiAd) x.kisi = idCoz(x.kisiAd) || x.kisi;
        if (x.yerineAd) x.yerine = idCoz(x.yerineAd) || x.yerine;
        hepsi.push(x);
      });
    });
    return hepsi;
  }
  // değişikliklere kişi adını da yaz (ayar sırası değişse de doğru kişiye gitsin)
  function adEkle(degisiklikler) {
    return degisiklikler.map(function (d) {
      var x = Object.assign({}, d);
      if (x.kisi) { var k = C.kisiById(D.veri, x.kisi); if (k) x.kisiAd = k.ad; }
      if (x.yerine) { var y = C.kisiById(D.veri, x.yerine); if (y) x.yerineAd = y.ad; }
      return x;
    });
  }

  function yenidenHesapla() {
    if (!D.satirlar || !D.hafta) return;
    try {
      D.veri = C.shiftOku(D.satirlar, D.ayarlar, D.hafta);
      D.sonuc = C.uygula(D.veri, degisiklikleriTopla(), D.ayarlar);
      D.hesap = C.hesapla(D.sonuc, D.ayarlar);
    } catch (e) {
      console.error(e);
      bildir('Hesaplama hatası: ' + e.message);
      return;
    }
    onizlemeCiz();
    notListeCiz();
    formDoldur();
    uretDurum();
  }

  /* ---------- önizleme ---------- */
  function onizlemeCiz() {
    var h = D.hesap, v = D.veri;
    var detay = h.detay;
    var say = function (d) { return detay.filter(function (r) { return r.durum === d; }).length; };
    $('sayilar').innerHTML = [
      [h.kisiOzet.length, 'personel'], [v.grupSayisi, 'şube grubu'],
      [detay.length, 'Detay satırı (' + say('Çalışma') + ' çalışma, ' + say('İzin') + ' izin, ' + say('Fazla İzin') + ' fazla izin)'],
      [C.sayiYaz(h.genelToplam), 'toplam net saat']
    ].map(function (x) { return '<div class="sayi"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>'; }).join('');

    var html = '';
    var cozulen = v.kNotlari.filter(function (k) { return k.cozuldu; });
    var bilgi = cozulen.map(function (k) { return 'Shift notu: "' + esc(k.metin) + '"<br>→ Anladığım: <b>' + esc(k.ozet) + '</b>'; })
      .concat(D.sonuc.aciklama.filter(function (a) { return /^Varsayım/.test(a); }).map(esc))
      .concat(v.bilgiler.map(esc));
    if (bilgi.length) html += '<div class="liste-baslik">Shift\'ten okunan notlar ve varsayımlar</div><ul class="bilgi-liste"><li>' + bilgi.join('</li><li>') + '</li></ul>';
    $('shiftNotlari').innerHTML = html;

    var sor = h.sorular;
    var imza = JSON.stringify(sor.map(function (s) { return s.metin; }));
    if (imza !== D.soruImza) { D.soruImza = imza; D.soruOnay = false; }
    if (sor.length) {
      $('sorular').innerHTML = '<div class="liste-baslik" style="color:var(--kirmizi-koyu)">⚠ Üretmeden önce kontrol edin (' + sor.length + ')</div><ul class="soru-liste">' +
        sor.map(function (s, i) {
          return '<li>' + esc(s.metin) + (s.tur === 'bos' && s.anahtar ? '<br><button class="ikincil" data-bos="' + esc(s.anahtar) + '">Bu şube bu gün personelsiz olabilir, bir daha sorma</button>' : '') + '</li>';
        }).join('') + '</ul>' +
        '<label class="onay-sat"><input type="checkbox" id="soruOnay"' + (D.soruOnay ? ' checked' : '') + '> Kontrol ettim, bu haliyle üret.</label>';
      $('soruOnay').onchange = function () { D.soruOnay = this.checked; uretDurum(); };
      Array.prototype.forEach.call($('sorular').querySelectorAll('[data-bos]'), function (b) {
        b.onclick = function () {
          var a = C.kopya(D.ayarlar); a.bosOlabilir = a.bosOlabilir || [];
          if (a.bosOlabilir.indexOf(b.dataset.bos) < 0) a.bosOlabilir.push(b.dataset.bos);
          ayarKaydet(a); bildir('Kaydedildi: ' + b.dataset.bos.replace('|', ' – ') + ' için bir daha sorulmayacak.'); yenidenHesapla();
        };
      });
    } else $('sorular').innerHTML = '<ul class="bilgi-liste"><li>✓ Sorulacak bir şey yok.</li></ul>';

    // kişi tablosu
    var t = '<tr><th>Personel</th><th>Söz.</th>' + C.GUN_KISA.map(function (g, i) { return '<th>' + g + '<br>' + C.ggaa(D.hafta.tarihler[i]) + '</th>'; }).join('') +
      '<th>Net</th><th>Gün</th><th>B</th><th>Fİ</th><th>Uyarı</th></tr>';
    var oz = {}; h.kisiOzet.forEach(function (o) { oz[o.id] = o; });
    h.subeAdlari.forEach(function (sb) {
      var ks = h.kisiler.filter(function (k) { return k.ana === sb; });
      if (!ks.length) return;
      t += '<tr class="sube-satir"><td colspan="14">' + esc(C.buyuk(sb)) + '</td></tr>';
      ks.forEach(function (k) {
        var o = oz[k.id];
        t += '<tr><td>' + esc(k.ad) + '</td><td>' + esc(k.soz) + '</td>' +
          D.sonuc.gunler[k.id].map(function (gk) {
            var m = hucreMetni(gk, k.ana, D.ayarlar.mola);
            var cls = m === 'B' ? ' style="background:var(--yesil)"' : m === 'Fİ' ? ' style="background:var(--kirmizi)"' : /\*$/.test(m) ? ' style="background:var(--sari)"' : '';
            var tip = gk.durum === 'Çalışma' ? C.aralikYaz(gk.g, gk.c) + ' ' + gk.sube : gk.durum === 'Fazla İzin' ? gk.neden : '';
            return '<td class="sayi-h"' + cls + ' title="' + esc(tip) + '">' + esc(m) + '</td>';
          }).join('') +
          '<td class="sayi-h"><b>' + C.sayiYaz(o.net) + '</b></td><td class="sayi-h">' + o.calisilan + '</td><td class="sayi-h">' + o.izin + '</td><td class="sayi-h">' + o.fazla + '</td>' +
          '<td class="' + (o.uyari === 'Tamam' ? 'tamam' : o.uyari === '-' ? '' : 'uyar') + '">' + esc(o.uyari) + '</td></tr>';
      });
    });
    $('kisiTablo').innerHTML = t;
  }

  /* ---------- notlar ---------- */
  function notlariKaydet() { if (D.hafta) depoYaz(NOT_ONEK + D.hafta.baslangic, D.notlar); }
  function notListeCiz() {
    var ul = $('notListe');
    if (!D.notlar.length) { ul.innerHTML = '<li style="border-left-color:var(--cizgi);color:var(--soluk)">Henüz değişiklik yok.</li>'; return; }
    ul.innerHTML = D.notlar.map(function (n, i) {
      return '<li><div>' + esc(n.etiket) + (n.metin ? '<small>Not: "' + esc(n.metin) + '"</small>' : '<small>Formla eklendi</small>') +
        '</div><button class="ikincil" data-sil="' + i + '">Sil</button></li>';
    }).join('');
    Array.prototype.forEach.call(ul.querySelectorAll('[data-sil]'), function (b) {
      b.onclick = function () {
        D.notlar.splice(+b.dataset.sil, 1); notlariKaydet(); yenidenHesapla(); bildir('Değişiklik silindi. Puantajı yeniden üretin.');
      };
    });
  }
  function notEkle(metin, degisiklikler) {
    var etiket = degisiklikler.map(function (d) { return C.degisiklikEtiketi(d, D.veri); }).join(' · ');
    D.notlar.push({ metin: metin || '', degisiklikler: adEkle(degisiklikler), etiket: etiket });
    notlariKaydet(); yenidenHesapla();
    bildir('Eklendi. ' + (D.uretildi ? '"Yeniden Üret" ile puantajı güncelleyin.' : ''));
  }

  function hizliAnla() {
    var metin = $('hizliNot').value.trim();
    if (!metin) return;
    var r = N.notCoz(metin, D.veri, D.ayarlar);
    if (r.degisiklikler) {
      D.bekleyen = { metin: metin, degisiklikler: r.degisiklikler };
      $('onayMetin').textContent = r.aciklama;
      goster('onayKutu', true); goster('form', false);
    } else {
      D.bekleyen = null; goster('onayKutu', false);
      formAc(r.taslak || {}, 'Not tam anlaşılamadı: ' + r.hata + ' Lütfen formdan seçin.');
    }
  }

  /* ---------- form ---------- */
  function secenek(deger, metin, secili) { return '<option value="' + esc(deger) + '"' + (secili ? ' selected' : '') + '>' + esc(metin) + '</option>'; }
  function formDoldur() {
    if (!D.hesap) return;
    var kisiler = D.hesap.kisiler;
    var kSec = $('fKisi').value, ySec = $('fYerine').value, gSec = $('fGun').value, sSec = $('fSube').value;
    $('fKisi').innerHTML = kisiler.map(function (k) { return secenek(k.id, k.ad + ' (' + k.ana + ')', k.id === kSec); }).join('');
    $('fYerine').innerHTML = secenek('', '— yok (ekstra) —') + kisiler.map(function (k) { return secenek(k.id, k.ad, k.id === ySec); }).join('');
    $('fGun').innerHTML = C.GUN_ADLARI.map(function (g, i) { return secenek(i, g + ' ' + C.ggaa(D.hafta.tarihler[i]), String(i) === gSec); }).join('');
    $('fSube').innerHTML = D.ayarlar.subeler.map(function (s) { return secenek(s.ad, s.ad, s.ad === sSec); }).join('');
    $('personelListe').innerHTML = D.ayarlar.personel.map(function (p) { return '<option value="' + esc(p.ad) + '">'; }).join('');
  }
  function formAlanlari() {
    var tur = $('fTur').value;
    var goruner = {
      fazlaIzin: ['f-kisi', 'f-neden'], saat: ['f-kisi', 'f-saat', 'f-sube'], ekstra: ['f-yeniad', 'f-yerine', 'f-sube', 'f-saat'],
      sube: ['f-kisi', 'f-sube'], izne: ['f-kisi'], calismaya: ['f-kisi', 'f-sube', 'f-saat']
    }[tur];
    ['f-kisi', 'f-neden', 'f-saat', 'f-sube', 'f-yeniad', 'f-yerine'].forEach(function (c) {
      Array.prototype.forEach.call(document.querySelectorAll('.' + c), function (el) { goster(el, goruner.indexOf(c) >= 0); });
    });
    mevcutSaatiDoldur();
  }
  function mevcutSaatiDoldur() {
    if (!D.sonuc) return;
    var tur = $('fTur').value;
    var id = tur === 'ekstra' ? $('fYerine').value : $('fKisi').value;
    var gun = +$('fGun').value;
    var gk = id && D.sonuc.gunler[id] ? D.sonuc.gunler[id][gun] : null;
    var k = id ? C.kisiById(D.sonuc, id) : null;
    if (gk && gk.durum === 'Çalışma') { $('fGiris').value = dkYaz(gk.g); $('fCikis').value = dkYaz(gk.c); $('fSube').value = gk.sube; }
    else if (k) $('fSube').value = k.ana;
  }
  function formAc(taslak, hata) {
    goster('form', true); goster('onayKutu', false);
    formDoldur();
    if (taslak.kisi && C.kisiById(D.veri, taslak.kisi)) $('fKisi').value = taslak.kisi;
    if (taslak.gun != null) $('fGun').value = taslak.gun;
    formAlanlari();
    $('formHata').textContent = hata || '';
    $('form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function formGonder(e) {
    e.preventDefault();
    var tur = $('fTur').value, gun = +$('fGun').value, kisi = $('fKisi').value;
    var g = dkGir($('fGiris').value), c = dkGir($('fCikis').value), sube = $('fSube').value;
    var d;
    if ((tur === 'saat' || tur === 'ekstra' || tur === 'calismaya') && (g == null || c == null)) { $('formHata').textContent = 'Giriş ve çıkış saatini yazın.'; return; }
    if (tur === 'fazlaIzin') {
      var neden = $('fNeden').value.trim();
      if (!neden) { $('formHata').textContent = 'Nedeni yazın (ör. Hastalık).'; return; }
      d = { tur: tur, kisi: kisi, gun: gun, neden: neden };
    } else if (tur === 'saat') d = { tur: tur, kisi: kisi, gun: gun, g: g, c: c, sube: sube };
    else if (tur === 'ekstra') {
      var ad = $('fYeniAd').value.trim();
      if (ad.length < 2) { $('formHata').textContent = 'Gelen kişinin adını yazın.'; return; }
      d = { tur: tur, ad: ad, sube: sube, gun: gun, g: g, c: c, yerine: $('fYerine').value || undefined };
    } else if (tur === 'sube') d = { tur: tur, kisi: kisi, gun: gun, sube: sube };
    else if (tur === 'izne') d = { tur: tur, kisi: kisi, gun: gun };
    else d = { tur: tur, kisi: kisi, gun: gun, g: g, c: c, sube: sube };
    $('formHata').textContent = '';
    goster('form', false);
    notEkle('', [d]);
    if (tur === 'ekstra' && d.yerine) {
      var gk = D.sonuc.gunler[d.yerine][gun];
      if (gk && gk.durum === 'Çalışma') bildir('Not: ' + C.kisiById(D.veri, d.yerine).ad + ' o gün hâlâ çalışıyor görünüyor. Hasta/izinliyse "Hasta / rapor" türüyle ayrıca ekleyin.');
    }
  }

  /* ---------- üret ---------- */
  function uretDurum() {
    var sor = D.hesap ? D.hesap.sorular.length : 0;
    var engel = sor && !D.soruOnay;
    $('btnUret').textContent = D.uretildi ? 'Yeniden Üret (revize) ve İndir' : 'Puantajı Üret ve İndir';
    if (engel) {
      $('uretUyari').innerHTML = '⚠ ' + sor + ' konu kontrol bekliyor. Yukarıdaki kırmızı maddeleri okuyup "Kontrol ettim" kutusunu işaretleyin.';
      goster('uretUyari', true);
    } else goster('uretUyari', false);
  }
  function uret() {
    if (!D.hesap) return;
    if (D.hesap.sorular.length && !D.soruOnay) { uretDurum(); $('sorular').scrollIntoView({ behavior: 'smooth' }); return; }
    var btn = $('btnUret'); btn.disabled = true; btn.textContent = 'Hazırlanıyor…';
    var model;
    try { model = M.kitapModeli(D.sonuc, D.hesap, D.ayarlar); }
    catch (e) { console.error(e); bildir('Hata: ' + e.message); btn.disabled = false; uretDurum(); return; }
    Promise.resolve().then(function () { return Y.excelYaz(model); }).then(function (blob) {
      indir(blob, model.dosyaAdi);
      D.uretildi = true;
      $('uretSonuc').innerHTML = '✓ <b>' + esc(model.dosyaAdi) + '</b> indirildi (' + D.hesap.detay.length + ' Detay satırı, ' +
        C.sayiYaz(D.hesap.genelToplam) + ' net saat' + (D.notlar.length ? ', ' + D.notlar.length + ' değişiklik uygulandı' : '') + ').<br>' +
        '<b>Fazla izin/rapor, saat değişikliği veya yerine gelen personel var mı?</b> Varsa 3. bölüme yazıp "Yeniden Üret"e basın.';
    }).catch(function (e) {
      console.error(e); bildir('Excel oluşturulamadı: ' + e.message);
    }).then(function () { btn.disabled = false; uretDurum(); });
  }
  function indir(blob, ad) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = ad;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  /* ---------- ayarlar ekranı ---------- */
  var taslakAyar = null;
  function ayarAc() { taslakAyar = C.kopya(D.ayarlar); ayarCiz(); goster('ayarPanel', true); document.body.style.overflow = 'hidden'; }
  function ayarKapat() { goster('ayarPanel', false); document.body.style.overflow = ''; }
  function inp(val, cls, tip) { return '<input type="' + (tip || 'text') + '" class="' + cls + '" value="' + esc(val == null ? '' : val) + '">'; }
  function oklar(i) { return '<td class="kucuk"><button type="button" class="ikincil" data-yukari="' + i + '">↑</button><button type="button" class="ikincil" data-asagi="' + i + '">↓</button><button type="button" class="tehlike" data-sil="' + i + '">✕</button></td>'; }
  function ayarCiz() {
    var a = taslakAyar;
    $('aHedef').value = a.hedef; $('aMola').value = a.mola;
    var subeSec = function (secili) { return '<select class="p-sube">' + a.subeler.map(function (s) { return secenek(s.ad, s.ad, s.ad === secili); }).join('') + '</select>'; };
    $('aPersonel').innerHTML = '<tr><th>Ad Soyad</th><th>Ana şube</th><th>Sözleşme</th><th>Shift\'teki adlar</th><th>Sözleşme notu</th><th></th></tr>' +
      a.personel.map(function (p, i) {
        return '<tr data-i="' + i + '"><td>' + inp(p.ad, 'p-ad') + '</td><td>' + subeSec(p.sube) + '</td><td><select class="p-soz">' +
          secenek('Full Time', 'Full Time', p.soz === 'Full Time') + secenek('Part Time', 'Part Time', p.soz === 'Part Time') + '</select></td><td>' +
          inp((p.kisa || []).join(', '), 'p-kisa') + '</td><td>' + inp(p.sozNot || '', 'p-not') + '</td>' + oklar(i) + '</tr>';
      }).join('');
    $('aSubeler').innerHTML = '<tr><th>Şube adı</th><th>Başlık</th><th>Shift\'teki yazılışlar</th><th>Kapanış</th><th>Cuma/Cmt kapanış</th><th></th></tr>' +
      a.subeler.map(function (s, i) {
        return '<tr data-i="' + i + '"><td>' + inp(s.ad, 's-ad') + '</td><td>' + inp(s.baslik, 's-baslik') + '</td><td>' + inp((s.kodlar || []).join(', '), 's-kod') +
          '</td><td>' + inp(s.kapanis, 's-kap') + '</td><td>' + inp(s.kapanisCumaCmt, 's-kapcc') + '</td>' + oklar(i) + '</tr>';
      }).join('');
    $('aKodlar').innerHTML = '<tr><th>Kod</th><th>Şube</th><th>Saat</th><th>Açıklama</th><th></th></tr>' +
      a.kodlar.map(function (k, i) {
        return '<tr data-i="' + i + '"><td>' + inp(k.kod, 'k-kod') + '</td><td>' + subeSec(k.sube).replace('p-sube', 'k-sube') + '</td><td>' + inp(k.saat, 'k-saat') +
          '</td><td>' + inp(k.aciklama || '', 'k-ac') + '</td><td class="kucuk"><button type="button" class="tehlike" data-sil="' + i + '">✕</button></td></tr>';
      }).join('');
    $('aBos').innerHTML = '<tr><th>Şube</th>' + C.GUN_KISA.map(function (g) { return '<th>' + g + '</th>'; }).join('') + '</tr>' +
      a.subeler.map(function (s) {
        return '<tr><td>' + esc(s.ad) + '</td>' + C.GUN_KISA.map(function (g) {
          var k = s.ad + '|' + g;
          return '<td class="orta"><input type="checkbox" class="b-kut" data-k="' + esc(k) + '"' + ((a.bosOlabilir || []).indexOf(k) >= 0 ? ' checked' : '') + '></td>';
        }).join('') + '</tr>';
      }).join('');
    listeDugmeleri('aPersonel', 'personel'); listeDugmeleri('aSubeler', 'subeler'); listeDugmeleri('aKodlar', 'kodlar');
    $('ayarHata').textContent = '';
  }
  function listeDugmeleri(tablo, alan) {
    var t = $(tablo);
    Array.prototype.forEach.call(t.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        taslakAyar = ayarTopla(false) || taslakAyar;
        var l = taslakAyar[alan], i;
        if (b.dataset.sil != null) { i = +b.dataset.sil; l.splice(i, 1); }
        else if (b.dataset.yukari != null) { i = +b.dataset.yukari; if (i > 0) l.splice(i - 1, 0, l.splice(i, 1)[0]); }
        else if (b.dataset.asagi != null) { i = +b.dataset.asagi; if (i < l.length - 1) l.splice(i + 1, 0, l.splice(i, 1)[0]); }
        ayarCiz();
      };
    });
  }
  function listeAyir(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  // DOM'dan ayarları okur; dogrula=true ise hataları kontrol eder
  function ayarTopla(dogrula) {
    var a = C.kopya(taslakAyar);
    a.hedef = parseFloat($('aHedef').value); a.mola = parseFloat($('aMola').value);
    a.personel = Array.prototype.map.call($('aPersonel').querySelectorAll('tr[data-i]'), function (tr) {
      var p = { ad: tr.querySelector('.p-ad').value.trim(), sube: tr.querySelector('.p-sube').value, soz: tr.querySelector('.p-soz').value, kisa: listeAyir(tr.querySelector('.p-kisa').value) };
      var not = tr.querySelector('.p-not').value.trim(); if (not) p.sozNot = not;
      return p;
    });
    a.subeler = Array.prototype.map.call($('aSubeler').querySelectorAll('tr[data-i]'), function (tr) {
      return { ad: tr.querySelector('.s-ad').value.trim(), baslik: tr.querySelector('.s-baslik').value.trim(), kodlar: listeAyir(tr.querySelector('.s-kod').value),
        kapanis: tr.querySelector('.s-kap').value.trim(), kapanisCumaCmt: tr.querySelector('.s-kapcc').value.trim() };
    });
    a.kodlar = Array.prototype.map.call($('aKodlar').querySelectorAll('tr[data-i]'), function (tr) {
      return { kod: tr.querySelector('.k-kod').value.trim(), sube: tr.querySelector('.k-sube').value, saat: tr.querySelector('.k-saat').value.trim(), aciklama: tr.querySelector('.k-ac').value.trim() };
    });
    a.bosOlabilir = Array.prototype.filter.call($('aBos').querySelectorAll('.b-kut'), function (k) { return k.checked; }).map(function (k) { return k.dataset.k; });
    if (!dogrula) return a;
    var hata = [];
    if (!(a.hedef >= 0)) hata.push('Hedef saat sayı olmalı.');
    if (!(a.mola >= 0)) hata.push('Mola sayı olmalı.');
    if (!a.subeler.length) hata.push('En az bir şube olmalı.');
    var gorulen = {};
    a.subeler.forEach(function (s, i) {
      if (!s.ad) hata.push('Şube ' + (i + 1) + ': ad boş.');
      if (gorulen['s' + s.ad]) hata.push('Şube adı iki kez yazılmış: ' + s.ad); gorulen['s' + s.ad] = 1;
      if (!s.baslik) s.baslik = C.buyuk(s.ad);
      if (!C.aralikCoz(s.kapanis)) hata.push(s.ad + ': kapanış saati "13:30-22:00" biçiminde olmalı.');
      if (!C.aralikCoz(s.kapanisCumaCmt)) hata.push(s.ad + ': Cuma/Cmt kapanış "14:30-23:00" biçiminde olmalı.');
    });
    var subeAdlari = a.subeler.map(function (s) { return s.ad; });
    a.personel.forEach(function (p, i) {
      if (!p.ad) hata.push('Personel ' + (i + 1) + ': ad boş.');
      if (gorulen['p' + C.katla(p.ad)]) hata.push('Personel iki kez yazılmış: ' + p.ad); gorulen['p' + C.katla(p.ad)] = 1;
      if (subeAdlari.indexOf(p.sube) < 0) hata.push(p.ad + ': ana şube listede yok.');
    });
    a.kodlar.forEach(function (k) {
      if (!k.kod) hata.push('Kod boş olamaz.');
      if (C.katla(k.kod) === 'B') hata.push('"B" kodu haftalık izin için ayrılmış, değiştirilemez.');
      if (!C.aralikCoz(k.saat)) hata.push('Kod ' + k.kod + ': saat "10:00-18:30" biçiminde olmalı.');
    });
    if (hata.length) { $('ayarHata').innerHTML = hata.map(esc).join('<br>'); return null; }
    return a;
  }

  /* ---------- olaylar ---------- */
  function baglan() {
    var birak = $('birakAlani');
    $('dosyaSec').onchange = function () { if (this.files[0]) dosyaOku(this.files[0]); this.value = ''; };
    ['dragenter', 'dragover'].forEach(function (ev) { birak.addEventListener(ev, function (e) { e.preventDefault(); birak.classList.add('ustunde'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { birak.addEventListener(ev, function (e) { e.preventDefault(); birak.classList.remove('ustunde'); }); });
    birak.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) dosyaOku(f); });
    $('btnTarihTamam').onclick = function () {
      var v = $('tarihGir').value;
      if (!v) { bildir('Tarih seçin.'); return; }
      var p = v.split('-'); var h = C.haftaTarihten(+p[2], +p[1], +p[0]);
      if (!h.pazartesiMi) { bildir('Seçtiğiniz gün Pazartesi değil.'); return; }
      goster('tarihSor', false); haftaAyarla(h);
    };
    $('btnAnla').onclick = hizliAnla;
    $('hizliNot').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); hizliAnla(); } });
    $('btnOnayEvet').onclick = function () {
      if (!D.bekleyen) return;
      notEkle(D.bekleyen.metin, D.bekleyen.degisiklikler);
      D.bekleyen = null; $('hizliNot').value = ''; goster('onayKutu', false);
    };
    $('btnOnayHayir').onclick = function () {
      var t = D.bekleyen && D.bekleyen.degisiklikler[0] || {};
      formAc({ kisi: t.kisi, gun: t.gun }); D.bekleyen = null;
    };
    $('btnFormAc').onclick = function () { formAc({}); };
    $('btnFormKapat').onclick = function () { goster('form', false); };
    $('fTur').onchange = formAlanlari;
    $('fKisi').onchange = mevcutSaatiDoldur; $('fGun').onchange = mevcutSaatiDoldur; $('fYerine').onchange = mevcutSaatiDoldur;
    $('form').onsubmit = formGonder;
    $('btnUret').onclick = uret;

    $('btnAyarlar').onclick = ayarAc;
    $('btnAyarKapat').onclick = ayarKapat;
    $('btnPersonelEkle').onclick = function () { taslakAyar = ayarTopla(false); taslakAyar.personel.push({ ad: '', sube: taslakAyar.subeler[0].ad, soz: 'Full Time', kisa: [] }); ayarCiz(); };
    $('btnSubeEkle').onclick = function () { taslakAyar = ayarTopla(false); taslakAyar.subeler.push({ ad: '', baslik: '', kodlar: [], kapanis: '13:30-22:00', kapanisCumaCmt: '14:30-23:00' }); ayarCiz(); };
    $('btnKodEkle').onclick = function () { taslakAyar = ayarTopla(false); taslakAyar.kodlar.push({ kod: '', sube: taslakAyar.subeler[0].ad, saat: '10:00-18:30', aciklama: '' }); ayarCiz(); };
    $('btnAyarKaydet').onclick = function () {
      var a = ayarTopla(true); if (!a) return;
      ayarKaydet(a); ayarKapat(); bildir('Ayarlar kaydedildi.'); yenidenHesapla();
    };
    $('btnAyarVarsayilan').onclick = function () {
      if (!confirm('Tüm ayarlar varsayılana dönsün mü? Yaptığınız değişiklikler silinir.')) return;
      ayarKaydet(C.kopya(window.VARSAYILAN_AYARLAR)); taslakAyar = C.kopya(D.ayarlar); ayarCiz(); bildir('Varsayılan ayarlar yüklendi.'); yenidenHesapla();
    };
    $('btnAyarDisa').onclick = function () {
      var a = ayarTopla(false);
      indir(new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' }), 'puantaj-ayarlar.json');
    };
    $('ayarIce').onchange = function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var a = JSON.parse(fr.result);
          if (!ayarGecerliMi(a)) throw new Error('Dosya puantaj ayar dosyası değil.');
          if (!a.kodlar) a.kodlar = []; if (!a.bosOlabilir) a.bosOlabilir = [];
          taslakAyar = a; ayarCiz(); bildir('Ayarlar okundu. Kaydet\'e basın.');
        } catch (e) { bildir('İçe aktarılamadı: ' + e.message); }
      };
      fr.readAsText(f);
    };
  }

  /* ---------- başlangıç ---------- */
  ayarYukle();
  baglan();
  if (!window.XLSX || !window.ExcelJS) bildir('Kütüphaneler yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.');
  var son = depoAl(DOSYA_ANAHTAR);
  if (son && son.satirlar && son.ad) {
    dosyaHazir(son.ad, son.satirlar, son.pzt);
    $('dosyaBilgi').innerHTML += '<br><small style="color:var(--soluk)">Son yüklenen dosya hatırlandı. Yeni hafta için yeni dosyayı yükleyin.</small>';
  }
  window.__panel = D; // test/hata ayıklama için
})();
