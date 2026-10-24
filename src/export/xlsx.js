// Penulis .xlsx minimal (JSZip) – tanpa dependensi lain. Mendukung gaya, merge, rumus (+nilai cache), lebar kolom.
import JSZip from 'jszip';

const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function colName(n) { // 1 -> A
  let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s;
}
export const ref = (r, c) => `${colName(c)}${r}`;
const argb = (hex) => 'FF' + String(hex).replace('#', '').toUpperCase();

class Styles {
  constructor() {
    this.fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = []; this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.cache = new Map();
  }
  idx(arr, xml) { let i = arr.indexOf(xml); if (i < 0) { arr.push(xml); i = arr.length - 1; } return i; }
  get(st) {
    if (!st) return 0;
    const key = JSON.stringify(st);
    if (this.cache.has(key)) return this.cache.get(key);
    const font = `<font>${st.bold ? '<b/>' : ''}${st.italic ? '<i/>' : ''}<sz val="${st.size || 11}"/>${st.color ? `<color rgb="${argb(st.color)}"/>` : ''}<name val="${st.font || 'Calibri'}"/><family val="2"/></font>`;
    const fontId = this.idx(this.fonts, font);
    const fillId = st.bg ? this.idx(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(st.bg)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    let borderId = 0;
    if (st.border) {
      const b = st.border === 'medium' ? 'medium' : 'thin';
      const col = `<color rgb="${argb(st.borderColor || '#808080')}"/>`;
      borderId = this.idx(this.borders, `<border><left style="${b}">${col}</left><right style="${b}">${col}</right><top style="${b}">${col}</top><bottom style="${b}">${col}</bottom><diagonal/></border>`);
    }
    let numFmtId = 0;
    if (st.numFmt) {
      const builtin = { '0': 1, '0.00': 2, '0.0': null };
      if (builtin[st.numFmt]) numFmtId = builtin[st.numFmt];
      else { let i = this.numFmts.indexOf(st.numFmt); if (i < 0) { this.numFmts.push(st.numFmt); i = this.numFmts.length - 1; } numFmtId = 164 + i; }
    }
    const al = (st.h || st.v || st.wrap) ? `<alignment${st.h ? ` horizontal="${st.h}"` : ''} vertical="${st.v || 'center'}"${st.wrap ? ' wrapText="1"' : ''}/>` : '';
    const xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ''} applyFont="1"${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`;
    this.xfs.push(xf);
    const id = this.xfs.length - 1;
    this.cache.set(key, id);
    return id;
  }
  xml() {
    const nf = this.numFmts.length ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${nf}<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts><fills count="${this.fills.length}">${this.fills.join('')}</fills><borders count="${this.borders.length}">${this.borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

export class Sheet {
  constructor(wb, name) {
    this.wb = wb; this.name = name.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31);
    this.cells = new Map(); this.merges = []; this.cols = {}; this.rows = {}; this.freeze = null; this.tab = null; this.landscape = true;
  }
  /** value: angka | teks | {f:'rumus', v:nilaiCache} | null (hanya gaya) */
  set(r, c, value, style) { this.cells.set(`${r},${c}`, { r, c, value, s: this.wb.styles.get(style) }); return this; }
  style(r1, c1, r2, c2, style) { // gaya untuk blok (tidak menimpa isi)
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const cur = this.cells.get(`${r},${c}`);
      if (cur) cur.s = this.wb.styles.get(style); else this.set(r, c, null, style);
    }
  }
  merge(r1, c1, r2, c2) { this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`); }
  width(c, w) { this.cols[c] = w; }
  height(r, h) { this.rows[r] = h; }
  xml() {
    const byRow = new Map(); let maxR = 1, maxC = 1;
    for (const x of this.cells.values()) { (byRow.get(x.r) || byRow.set(x.r, []).get(x.r)).push(x); maxR = Math.max(maxR, x.r); maxC = Math.max(maxC, x.c); }
    const rowsXml = [...new Set([...byRow.keys(), ...Object.keys(this.rows).map(Number)])].sort((a, b) => a - b).map((r) => {
      const cs = (byRow.get(r) || []).sort((a, b) => a.c - b.c).map((x) => {
        const a = ref(x.r, x.c), s = x.s ? ` s="${x.s}"` : '', v = x.value;
        if (v === null || v === undefined || v === '') return `<c r="${a}"${s}/>`;
        if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${a}"${s}><v>${v}</v></c>` : `<c r="${a}"${s}/>`;
        if (typeof v === 'object' && v.f) {
          const cv = v.v;
          if (typeof cv === 'number' && Number.isFinite(cv)) return `<c r="${a}"${s}><f>${esc(v.f)}</f><v>${cv}</v></c>`;
          if (typeof cv === 'string') return `<c r="${a}"${s} t="str"><f>${esc(v.f)}</f><v>${esc(cv)}</v></c>`;
          return `<c r="${a}"${s}><f>${esc(v.f)}</f></c>`;
        }
        return `<c r="${a}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      }).join('');
      const h = this.rows[r] ? ` ht="${this.rows[r]}" customHeight="1"` : '';
      return `<row r="${r}"${h}>${cs}</row>`;
    }).join('');
    const colsXml = Object.keys(this.cols).length ? `<cols>${Object.entries(this.cols).sort((a, b) => a[0] - b[0]).map(([c, w]) => `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const pane = this.freeze ? `<pane${this.freeze.c > 1 ? ` xSplit="${this.freeze.c - 1}"` : ''}${this.freeze.r > 1 ? ` ySplit="${this.freeze.r - 1}"` : ''} topLeftCell="${ref(this.freeze.r, this.freeze.c)}" activePane="${this.freeze.r > 1 && this.freeze.c > 1 ? 'bottomRight' : this.freeze.r > 1 ? 'bottomLeft' : 'topRight'}" state="frozen"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr>${this.tab ? `<tabColor rgb="${argb(this.tab)}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ref(maxR, maxC)}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${colsXml}<sheetData>${rowsXml}</sheetData>${this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${this.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }
}

export class Workbook {
  constructor() { this.styles = new Styles(); this.sheets = []; }
  addSheet(name) {
    let n = name.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31), i = 2;
    while (this.sheets.some((s) => s.name.toLowerCase() === n.toLowerCase())) n = name.slice(0, 28) + ' ' + i++;
    const s = new Sheet(this, n); this.sheets.push(s); return s;
  }
  async toBlob() {
    const z = new JSZip();
    z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${this.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
    z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${this.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
    z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${this.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    z.file('xl/styles.xml', this.styles.xml());
    this.sheets.forEach((s, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, s.xml()));
    return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  }
}
