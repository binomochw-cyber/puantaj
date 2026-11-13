/* Sihir Dükkanı – Puantaj Paneli : EXCEL YAZICI (ExcelJS)
 * excel-model.js'in ürettiği tarifi gerçek .xlsx dosyasına çevirir.
 */
(function (kok) {
  'use strict';

  function harf(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

  function deger(v) {
    if (v && typeof v === 'object' && v.tarih) {
      var p = v.tarih.split('-');
      return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    }
    return v;
  }

  function cerceve(c) {
    if (!c) return undefined;
    var o = {};
    if (c.sol) o.left = { style: c.sol };
    if (c.sag) o.right = { style: c.sag };
    if (c.ust) o.top = { style: c.ust };
    if (c.alt) o.bottom = { style: c.alt };
    return o;
  }

  function excelYaz(model, ExcelJS) {
    ExcelJS = ExcelJS || kok.ExcelJS;
    if (!ExcelJS) throw new Error('ExcelJS kütüphanesi yüklenemedi (internet bağlantısını kontrol edin).');
    var wb = new ExcelJS.Workbook();
    wb.creator = 'Sihir Dükkanı Puantaj Paneli';
    wb.created = new Date();
    wb.calcProperties = { fullCalcOnLoad: true };

    model.sayfalar.forEach(function (sy) {
      var views = [];
      if (sy.dondur) {
        views.push({ state: 'frozen', xSplit: sy.dondur.x, ySplit: sy.dondur.y, topLeftCell: harf(sy.dondur.x) + (sy.dondur.y + 1), activeCell: 'A1' });
      }
      var ws = wb.addWorksheet(sy.ad, { views: views, properties: { defaultRowHeight: 15 } });

      sy.sutunlar.forEach(function (s) {
        for (var i = s.min; i <= s.max; i++) {
          var col = ws.getColumn(i);
          col.width = s.genislik;
          if (s.gizli) col.hidden = true;
        }
      });

      sy.hucreler.forEach(function (h) {
        var cell = ws.getCell(h.r, h.c + 1);
        if (h.f) {
          var sonuc = h.v === undefined ? undefined : deger(h.v);
          cell.value = sonuc === undefined ? { formula: h.f } : { formula: h.f, result: sonuc };
        } else if (h.v !== undefined) {
          cell.value = deger(h.v);
        }
        var s = h.s || {};
        var font = { name: model.font, size: s.sz || model.boyut };
        if (s.b) font.bold = true;
        if (s.renk) font.color = { argb: s.renk };
        cell.font = font;
        if (s.dolgu) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.dolgu } };
        if (s.nf) cell.numFmt = s.nf;
        if (s.yatay || s.dikey || s.kaydir) {
          var al = {};
          if (s.yatay) al.horizontal = s.yatay;
          if (s.dikey) al.vertical = s.dikey;
          if (s.kaydir) al.wrapText = true;
          cell.alignment = al;
        }
        var b = cerceve(s.cerceve);
        if (b) cell.border = b;
        if (h.not) cell.note = h.not;
      });

      Object.keys(sy.yukseklik).forEach(function (r) { ws.getRow(+r).height = sy.yukseklik[r]; });
      if (sy.filtre) ws.autoFilter = sy.filtre;

      var oncelik = 1;
      sy.kb.forEach(function (kb) {
        ws.addConditionalFormatting({
          ref: kb.ref,
          rules: kb.kurallar.map(function (k) {
            var style = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: k.dolgu } } };
            if (k.yaziRenk) style.font = { color: { argb: k.yaziRenk } };
            if (k.tur === 'esit') return { type: 'cellIs', operator: 'equal', formulae: [k.deger], style: style, priority: oncelik++ };
            return { type: 'expression', formulae: [k.formul], style: style, priority: oncelik++ };
          })
        });
      });
    });

    return wb.xlsx.writeBuffer().then(function (buf) {
      return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    });
  }

  kok.ExcelYazici = { excelYaz: excelYaz };
})(this);
