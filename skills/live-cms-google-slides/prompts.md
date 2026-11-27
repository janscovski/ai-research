# Prompt siap salin: Live CMS Google Slides → Website

Isi bagian `[...]`, lalu paste ke Claude. Kalau skill `live-cms-google-slides` sudah tersimpan, Claude otomatis pakai skill-nya. Kalau belum, prompt ini tetap jalan sendiri.

---

## 1. Scoping & pilih arsitektur

**Kapan dipakai:** awal project, sebelum janji apa pun ke klien.
**Input:** tujuan website, daftar halaman/section, siapa yang edit, perkiraan traffic, deadline, akun Google (Gmail/Workspace), budget kasar.

```
Kamu adalah Technology Consultant + Operations Advisor di creative agency.
Saya mau Google Slides jadi CMS untuk website, dan website ikut update otomatis saat slide diedit.

Konteks:
- Tujuan website: [microsite campaign X / portfolio / company profile / kiosk LED]
- Section yang dibutuhkan: [hero, about, works gallery, stats, contact]
- Editor konten: [siapa, berapa orang, level teknis]
- Perkiraan traffic: [mis. 500/hari, spike saat launch 10rb/jam]
- Deadline live: [tanggal]
- Akun Google: [Gmail gratis / Google Workspace]
- Butuh SEO / animasi premium? [ya/tidak]
- Budget kasar: [Rp ...]

Tugas:
1. Rekomendasikan SATU dari tiga tier (Lean: Publish to web embed; Recommended: Apps Script JSON + static site polling; Premium: Next.js ISR + Slides API + revalidate webhook). Jelaskan alasan berdasarkan latency, biaya, maintenance, dan risiko.
2. Jelaskan jujur keterbatasan: Slides tidak punya onEdit trigger, jadi "realtime" = tombol Publish now + polling; kuota Apps Script; URL gambar Slides expire; JSON web app bersifat publik.
3. Buat tabel implementasi: Phase | Activity | PIC | Approval | Output | Dependency.
4. Estimasi biaya (setup internal, hosting/bulan, maintenance) dan harga jual yang masuk akal kalau ini dijual ke klien. Pisahkan fakta, asumsi, estimasi.
5. Tutup dengan 3 next action.
Jangan overengineer.
```

**Contoh output (ringkas):**
> **Rekomendasi: Recommended.** Traffic 500/hari dan editor 2 orang non-teknis, jadi Apps Script + static site cukup. Latency ±1 menit otomatis, <10 detik via menu *Website → Publish now*. Premium baru masuk akal kalau butuh SEO kuat dan spike >10rb/jam.
> | Phase | Activity | PIC | Approval | Output | Dependency |
> |---|---|---|---|---|---|
> | 1 | Template deck per section | Ega | Jan | Template Slides | Scope |
> | 2 | Apps Script + deploy web app | Harry | – | URL /exec | Template |
> | … | | | | | |
> **Estimasi:** setup ±16 jam kerja internal (asumsi), hosting Rp0 (Netlify free), harga jual saran Rp X setup + Rp Y/bulan maintenance.

---

## 2. Rancang content contract (template slide + speaker notes)

**Kapan dipakai:** setelah tier dipilih, sebelum designer bikin template.
**Input:** daftar section website + contoh isi tiap section (boleh copy dari brief/KV).

```
Saya pakai Google Slides sebagai CMS website. Aturan dasar:
- 1 slide = 1 blok konten, urut sesuai urutan slide.
- Title placeholder = title, text box lain = body (per paragraf), gambar terbesar = image (alt dari Alt text).
- Speaker notes berformat "key: value" per baris, override isi visual. Key berulang = list. Multi-bagian pakai "|".
- Slide yang di-skip tidak tampil.

Section website saya: [daftar section + contoh isi]

Buatkan:
1. Tabel content contract: Section | Layout slide yang disarankan | Field visual | Key speaker notes (wajib/opsional) | Contoh nilai.
2. Contoh speaker notes lengkap untuk tiap section (siap di-paste ke deck).
3. Aturan editor (Do / Don't) maksimal 8 poin, bahasa sederhana untuk tim non-teknis.
4. Edge case: field kosong, gambar >1, teks kepanjangan, slide tanpa section. Tentukan perilakunya di website.
```

**Contoh output (potongan):**
> | Section | Layout slide | Field visual | Key notes | Contoh |
> |---|---|---|---|---|
> | hero | Title + full-bleed image | title, image | `section` (wajib), `subtitle`, `cta` | `cta: Lihat karya \| /work` |
> | stats | Title + 3 text box | title, body | `stat: 120+ \| Proyek OOH` (berulang) | |
>
> Notes slide hero:
> ```
> section: hero
> subtitle: Creativity On-The-Street
> cta: Lihat karya | https://marrakesh.id/work
> ```

---

## 3. Generate kode (Apps Script + website)

**Kapan dipakai:** content contract sudah disepakati.
**Input:** content contract (output prompt 2), brand guideline singkat (warna, font, mood), tier.

```
Bangun Live CMS Google Slides → website tier [Recommended / Premium].
Mulai dari starter di skills/live-cms-google-slides/starter (Code.gs + index.html) kalau Recommended.

Content contract:
[paste tabel dari prompt 2]

Brand: warna [...], font [...], mood [premium, cinematic, editorial, tidak generik].

Syarat teknis (wajib):
- Rebuild JSON hanya saat deck berubah (cek Drive lastUpdated), plus menu "Website → Publish now".
- Gambar disalin ke storage sendiri (Drive folder publik, nama file = hash isi), jangan hotlink contentUrl.
- Web app doGet hanya baca cache/snapshot, tidak membaca deck tiap request.
- Website polling tiap 30 detik, re-render hanya kalau "version" berubah, tetap tampil snapshot terakhir kalau fetch gagal.
- Renderer per section sesuai contract, section tak dikenal di-skip tanpa error.
- Responsive 390px–1440px, aksesibel (alt text, kontras AA), tanpa framework berat.

Output: file lengkap siap paste, lalu langkah setup bernomor untuk non-teknis (Script Properties, deploy web app, isi CONTENT_URL, deploy hosting), lalu QA checklist.
```

**Contoh output:** `Code.gs` dan `index.html` versi brand, plus:
> 1. Buka deck → Extensions → Apps Script → paste `Code.gs`.
> 2. Project Settings → Script properties: `DECK_ID`, `IMAGE_FOLDER_ID`.
> 3. Jalankan `setup()` sekali, approve izin.
> 4. Deploy → New deployment → Web app → Execute as *Me*, Access *Anyone* → copy URL `/exec`.
> 5. …

---

## 4. Debug "website tidak update"

**Kapan dipakai:** editor bilang sudah edit tapi website belum berubah.
**Input:** tier, apa yang diedit, jam edit, screenshot log Apps Script (Executions), URL JSON.

```
Live CMS Google Slides → website saya tidak update.
- Tier: [Recommended / Premium]
- Yang diedit: [teks / ganti gambar / urutan / skip slide] jam [..]
- Sudah tunggu: [.. menit]. Sudah klik Website → Publish now? [ya/tidak, hasilnya]
- Log Apps Script (Executions) terakhir: [paste]
- Isi field "version" & "updatedAt" di JSON sekarang: [paste]

Diagnosa berurutan dari penyebab paling mungkin (cache browser/CDN, trigger mati/authorization expire, lastUpdated telat, kuota habis, gambar gagal disalin, speaker notes salah format, section salah ketik). Untuk tiap penyebab: cara cek (1 langkah), cara fix, cara cegah. Jangan minta saya ngoding kalau tidak perlu.
```

**Contoh output (potongan):**
> 1. **Trigger mati** (paling sering setelah pemilik ganti password). Cek: Apps Script → Triggers, ada `checkForChanges`? Fix: jalankan `setup()` lagi. Cegah: pakai akun Workspace kantor sebagai pemilik.
> 2. **Version di JSON berubah tapi halaman belum.** Cek: buka website di incognito. Fix: tunggu polling 30 detik / hard refresh. …

---

## 5. SOP editor 1 halaman

**Kapan dipakai:** handover ke tim konten / klien.
**Input:** content contract, URL deck, URL website, nama editor & approver.

```
Buat SOP 1 halaman untuk editor konten website yang CMS-nya Google Slides.
Deck: [URL], Website: [URL], Editor: [nama], Approver: [nama].
Content contract: [paste]

Isi: tujuan (1 kalimat), alur edit → cek → publish (maks 6 langkah), Do/Don't, cara rollback (Version history), siapa dihubungi kalau error, dan checklist sebelum publish (typo, alt text, ukuran gambar ≤2MB, data internal tidak ikut).
Bahasa Indonesia simpel, bisa dibaca dalam 2 menit.
```

**Contoh output (potongan):**
> **Alur:** 1) Edit di deck → 2) Cek speaker notes formatnya `key: value` → 3) Klik *Website → Publish now* → 4) Buka website, cek di HP → 5) Kalau salah: *File → Version history*, restore, Publish now lagi.
> **Jangan:** hapus slide (pakai *Skip slide*), taruh harga internal/HPP di deck website.
