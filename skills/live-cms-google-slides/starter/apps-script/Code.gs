/**
 * Live CMS: Google Slides → JSON endpoint (tier Recommended)
 *
 * Alur: deck berubah → rebuild() baca slide → gambar disalin ke Drive folder publik
 *       → content.json disimpan (Drive + cache) → doGet() menyajikan JSON ke website.
 *
 * Kenapa begini:
 * - Slides TIDAK punya onEdit trigger, jadi pakai menu "Publish now" + time trigger
 *   yang hanya rebuild kalau Drive lastUpdated berubah (hemat kuota).
 * - URL gambar dari Slides expire, jadi gambar disalin ke Drive (nama file = hash isi,
 *   jadi gambar yang sama tidak diupload dua kali).
 * - doGet() tidak pernah membaca deck, hanya snapshot. Cepat dan tidak makan kuota Slides.
 *
 * SETUP (sekali):
 * 1. Buka deck → Extensions → Apps Script → paste file ini.
 * 2. Project Settings → Script properties:
 *      DECK_ID          id deck (bagian URL di antara /d/ dan /edit)
 *      IMAGE_FOLDER_ID  id folder Drive untuk gambar website (folder kosong khusus)
 *      TRIGGER_MINUTES  opsional: 1, 5, 10, 15, atau 30 (default 1; akun Gmail gratis
 *                       sebaiknya 5 supaya aman dari kuota runtime trigger)
 * 3. Pilih fungsi setup() → Run → approve izin.
 * 4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *    Copy URL yang berakhiran /exec → isi CONTENT_URL di web/index.html.
 *
 * Catatan: JSON ini PUBLIK. Jangan taruh data internal di deck website.
 */

var NOTE_LINE = /^\s*([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i;
var CACHE_KEY = 'content_v1';

/* ---------- Menu di dalam deck ---------- */

function onOpen() {
  SlidesApp.getUi()
    .createMenu('Website')
    .addItem('Publish now', 'publishNow')
    .addItem('Lihat JSON', 'showEndpoint')
    .addToUi();
}

function publishNow() {
  var out = rebuild_();
  SlidesApp.getUi().alert('Website diperbarui: ' + out.slides.length + ' blok, versi ' + out.version.slice(0, 8) + '.');
}

function showEndpoint() {
  var url = ScriptApp.getService().getUrl();
  SlidesApp.getUi().alert(url ? url : 'Belum di-deploy sebagai Web app.');
}

/* ---------- Setup & trigger ---------- */

function setup() {
  var props = PropertiesService.getScriptProperties();
  ['DECK_ID', 'IMAGE_FOLDER_ID'].forEach(function (k) {
    if (!props.getProperty(k)) throw new Error('Isi Script property ' + k + ' dulu.');
  });
  var minutes = Number(props.getProperty('TRIGGER_MINUTES') || 1);
  if ([1, 5, 10, 15, 30].indexOf(minutes) < 0) throw new Error('TRIGGER_MINUTES harus 1, 5, 10, 15, atau 30.');

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkForChanges') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkForChanges').timeBased().everyMinutes(minutes).create();
  rebuild_();
}

/** Dipanggil time trigger. Rebuild hanya kalau deck berubah sejak build terakhir. */
function checkForChanges() {
  var props = PropertiesService.getScriptProperties();
  var updated = DriveApp.getFileById(props.getProperty('DECK_ID')).getLastUpdated().getTime();
  if (updated > Number(props.getProperty('LAST_SEEN') || 0)) {
    rebuild_();
    props.setProperty('LAST_SEEN', String(updated));
  }
}

/* ---------- Endpoint ---------- */

function doGet() {
  var json = CacheService.getScriptCache().get(CACHE_KEY) || readSnapshot_();
  if (!json) json = JSON.stringify(rebuild_());
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Build ---------- */

function rebuild_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // cegah menu + trigger rebuild bersamaan
  try {
    var props = PropertiesService.getScriptProperties();
    var deck = SlidesApp.openById(props.getProperty('DECK_ID'));
    var folder = DriveApp.getFolderById(props.getProperty('IMAGE_FOLDER_ID'));

    var slides = [];
    deck.getSlides().forEach(function (slide, i) {
      if (slide.isSkipped()) return; // Skip slide = draft, tidak tampil
      try {
        slides.push(readSlide_(slide, i, folder));
      } catch (err) {
        console.warn('Slide ' + (i + 1) + ' dilewati: ' + err); // satu slide rusak tidak menjatuhkan semua
      }
    });

    var body = { title: deck.getName(), slides: slides };
    var bodyJson = JSON.stringify(body);
    var out = {
      version: hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bodyJson)),
      updatedAt: new Date().toISOString(),
      title: body.title,
      slides: slides,
    };
    var json = JSON.stringify(out);
    writeSnapshot_(json);
    if (json.length < 95000) CacheService.getScriptCache().put(CACHE_KEY, json, 21600);
    else CacheService.getScriptCache().remove(CACHE_KEY); // terlalu besar untuk cache, doGet baca snapshot
    console.log('Rebuild OK: ' + slides.length + ' blok, ' + json.length + ' byte');
    return out;
  } finally {
    lock.releaseLock();
  }
}

function readSlide_(slide, index, folder) {
  var title = '';
  var body = [];
  var bestImage = null;

  slide.getPageElements().forEach(function (el) {
    var type = el.getPageElementType();
    if (type === SlidesApp.PageElementType.SHAPE) {
      var shape = el.asShape();
      var text = shape.getText().asString().trim();
      if (!text) return;
      var ph = shape.getPlaceholderType();
      if (!title && (ph === SlidesApp.PlaceholderType.TITLE || ph === SlidesApp.PlaceholderType.CENTERED_TITLE)) {
        title = text;
      } else {
        text.split(/\n+/).forEach(function (p) { if (p.trim()) body.push(p.trim()); });
      }
    } else if (type === SlidesApp.PageElementType.IMAGE) {
      var area = el.getWidth() * el.getHeight();
      if (!bestImage || area > bestImage.area) bestImage = { el: el, area: area };
    }
    // Group, table, video, chart: diabaikan di starter ini. Tambahkan kalau dibutuhkan.
  });

  var notes = parseNotes_(slide.getNotesPage().getSpeakerNotesShape().getText().asString());

  var image = null;
  if (bestImage) {
    image = {
      src: storeImage_(bestImage.el.asImage().getBlob(), folder),
      alt: first_(notes.alt) || bestImage.el.getDescription() || bestImage.el.getTitle() || '',
    };
  }

  return {
    id: slide.getObjectId(),
    index: index,
    section: (first_(notes.section) || 'default').toLowerCase(),
    title: first_(notes.title) || title,
    body: notes.body || body,
    image: image,
    fields: notes, // semua key speaker notes, untuk renderer per section
  };
}

/** "key: value" per baris. Key berulang jadi list. Baris lain diabaikan. */
function parseNotes_(text) {
  var out = {};
  String(text || '').split('\n').forEach(function (line) {
    var m = line.match(NOTE_LINE);
    if (!m) return;
    var key = m[1].toLowerCase();
    (out[key] = out[key] || []).push(m[2].trim());
  });
  return out;
}

/** Simpan gambar ke Drive dengan nama = hash isi. Return URL publik yang stabil. */
function storeImage_(blob, folder) {
  var bytes = blob.getBytes();
  var ext = (blob.getContentType() || 'image/png').split('/')[1].replace('jpeg', 'jpg');
  var name = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes)) + '.' + ext;
  var existing = folder.getFilesByName(name);
  var file = existing.hasNext() ? existing.next() : folder.createFile(blob.setName(name));
  if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
    // Bisa ditolak kalau admin Workspace melarang share publik. Kalau begitu, pakai tier Premium (server cache).
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  // Format URL ini umum dipakai tapi bukan API resmi Google. Fallback: https://drive.google.com/thumbnail?id=ID&sz=w1920
  return 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w1920';
}

/* ---------- Snapshot di Drive (fallback kalau cache kosong) ---------- */

function writeSnapshot_(json) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SNAPSHOT_FILE_ID');
  if (id) {
    DriveApp.getFileById(id).setContent(json);
  } else {
    var folder = DriveApp.getFolderById(props.getProperty('IMAGE_FOLDER_ID'));
    var file = folder.createFile('content.json', json, MimeType.PLAIN_TEXT);
    props.setProperty('SNAPSHOT_FILE_ID', file.getId());
  }
}

function readSnapshot_() {
  var id = PropertiesService.getScriptProperties().getProperty('SNAPSHOT_FILE_ID');
  return id ? DriveApp.getFileById(id).getBlob().getDataAsString() : null;
}

/* ---------- Util ---------- */

function first_(list) { return list && list.length ? list[0] : ''; }

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
