---
name: live-cms-google-slides
description: Pakai saat tim mau Google Slides jadi CMS untuk website/microsite/portfolio yang ikut update otomatis (near-realtime) saat slide diedit. Bantu pilih arsitektur, susun template slide, generate kode, SOP editor, dan debug.
---

# Live CMS: Google Slides → Website

Kategori library: **Bikin sistem** (juga nyerempet Bikin desain).

Tim non-teknis edit konten di Google Slides (teks, gambar, urutan, hide slide), website ikut berubah dalam hitungan detik sampai ±1–5 menit. Tanpa redeploy, tanpa sentuh kode.

## Kapan dipakai

- Microsite campaign / event yang kontennya sering berubah (rundown, line-up, KV, harga).
- Portfolio atau company profile yang di-maintain tim kreatif, bukan developer.
- "Deck jadi website": pitch, proposal, case study yang mau di-share sebagai link premium, bukan PDF.
- Layar info / LED / kiosk yang menampilkan konten dari deck (rotasi KV, jadwal).

**Jangan dipakai** kalau: konten butuh form/transaksi, ribuan item (pakai Sheets/Airtable/headless CMS), multi-bahasa kompleks, atau butuh workflow approval berlapis dengan versioning ketat.

## Fakta penting dulu (biar ekspektasi klien benar)

| Hal | Fakta | Implikasi |
|---|---|---|
| "Realtime" | Google Slides **tidak punya onEdit trigger** (itu hanya ada di Sheets). | Yang mungkin: tombol **Publish now** (instan, manual) + polling/time trigger (±1 menit). Jual sebagai *near-realtime*, bukan realtime. |
| Timestamp edit | `DriveApp.getLastUpdated()` bisa telat ±1 menit dari edit sebenarnya. | Latency realistis: 1–2 menit otomatis, <10 detik via Publish now. |
| URL gambar | `contentUrl` dari Slides API **expire** (± menit–jam). | Gambar wajib di-copy ke storage sendiri (Drive publik / server cache / CDN). Jangan hotlink. |
| Kuota Apps Script | Akun Gmail gratis: total runtime trigger ±90 menit/hari; Workspace ±6 jam/hari. URL Fetch & eksekusi web app juga dibatasi. *(Angka dari halaman Quotas Google, cek ulang sebelum janji ke klien.)* | Trigger 1 menit × 1–3 detik masih aman, tapi build ulang gambar tiap menit tidak. Hanya build saat ada perubahan. |
| Web app Apps Script | Cold start 1–3 detik, ada batas eksekusi simultan. | Oke untuk traffic kecil–menengah. Untuk launch campaign besar, taruh cache/CDN di depan (tier Recommended+ / Premium). |
| Publish to web | Embed iframe auto-republish ±5 menit. | Termurah, tapi tampilannya tetap "deck", bukan website. SEO & mobile lemah. |

## Pilih tier

| | **Lean** | **Recommended** | **Premium** |
|---|---|---|---|
| Arsitektur | Slides → *Publish to web* → iframe di website | Slides → Apps Script (build JSON + simpan gambar ke Drive) → static HTML/JS yang polling JSON | Slides API (service account) → Next.js ISR + image cache WebP → Apps Script ping `/api/revalidate` |
| Latency | ±5 menit | ±1 menit otomatis, instan via menu | ±60 detik + 1 view, instan via menu |
| Tampilan | Deck di dalam frame | Website custom, layout bebas | Website sinematik, animasi, SEO, Lighthouse 90+ |
| Build | 1 jam | 1–3 hari | 1–2 minggu |
| Hosting | Rp0 | Rp0 (GitHub Pages / Netlify / Vercel free) | Vercel Pro ±USD 20/bulan/seat atau VPS |
| Maintenance | Nyaris nol | Rendah (1 script, 1 file HTML) | Sedang (Node app, dependency update, env secret) |
| Risiko utama | Terlihat murah, tidak brandable | Kuota Apps Script & cold start saat traffic spike | Butuh developer untuk perubahan layout |
| Cocok untuk | Internal, draft, event kecil | Microsite campaign, portfolio, kiosk | Flagship client, company profile, pitch premium |

**Default rekomendasi: Recommended.** Starter code-nya ada di `starter/`. Reference build Premium ada di repo ini (Next.js site K-GROUP AI Optimization 2027, PR #1).

## Arsitektur Recommended

```
[Editor edit Google Slides]
        │  (menu Website → Publish now)  atau  (time trigger 1–5 menit, cek lastUpdated)
        ▼
[Apps Script: rebuild()]
   - baca slide: title, body, image, speaker notes (key: value), skip/hidden
   - gambar → getBlob() → simpan ke Drive folder publik (nama = hash, jadi tidak duplikat)
   - tulis content.json ke Drive + CacheService
        ▼
[Apps Script Web App: doGet()] ── JSON (cache, cepat) ──▶ [Website static: fetch + polling 30 detik]
                                                           re-render hanya kalau `version` berubah
```

### Content contract (yang wajib disepakati tim)

Satu slide = satu blok konten, urut sesuai urutan slide.

- **Title placeholder** → `title`
- **Text box lain** → `body[]` (per paragraf)
- **Gambar terbesar** di slide → `image` (alt dari *Alt text* gambar)
- **Speaker notes** format `key: value` per baris → override/explicit field. Contoh:
  ```
  section: hero
  cta: Lihat karya | https://marrakesh.id/work
  tag: CGI · Anamorphic
  ```
  Key berulang = list. Nilai multi-bagian pakai `|`.
- **Skip slide** = tidak tampil di website (cara paling aman untuk "draft").
- `section:` menentukan komponen di website (hero, text, gallery, stats, cta…). Slide tanpa `section` = `default`.

Kenapa speaker notes: editor tidak perlu tahu kode, layout slide boleh "kotor" untuk presentasi, tapi data tetap rapi.

## Langkah implementasi (bisa diikuti non-teknis)

| Phase | Activity | PIC (saran) | Output | Dependency |
|---|---|---|---|---|
| 0. Scope | Pilih tier, daftar section website, tentukan siapa editor & approver | Jan (approve), Harry (tech) | 1 halaman scope | Brief klien |
| 1. Template | Buat master deck: layout per section + contoh speaker notes | Ega (designer) + Harry | Template Slides | Phase 0 |
| 2. Script | Paste `starter/apps-script/Code.gs`, isi Script Properties, `installTrigger()`, Deploy → Web app | Harry | URL web app `/exec` | Template |
| 3. Website | Isi `CONTENT_URL` di `starter/web/index.html`, styling sesuai KV, deploy ke Netlify/Pages | Harry / dev | URL website | Phase 2 |
| 4. QA | Edit teks, ganti gambar, skip slide, ubah urutan → cek website ≤2 menit; cek HP | Azzam (QA konten) | Checklist QA ✓ | Phase 3 |
| 5. Handover | SOP editor 1 halaman + training 30 menit | Jihan (admin konten) | SOP + akses | QA lulus |

**Acceptance criteria:** edit teks muncul ≤2 menit (otomatis) / ≤10 detik (Publish now); gambar baru tampil tanpa link rusak setelah 24 jam; slide di-skip hilang; website tetap tampil walau Apps Script error (pakai snapshot terakhir).

## Keamanan

- Web app di-deploy **Execute as: Me**, **Who has access: Anyone**. Artinya JSON publik, jadi **jangan taruh data internal di deck website** (harga internal, HPP, kontak pribadi). Pisahkan deck website dari deck internal.
- Folder gambar Drive di-share "Anyone with the link: Viewer". Hanya gambar yang sudah di-publish yang masuk folder itu.
- Edit access deck = kemampuan mengubah website live. Batasi editor, pakai *Version history* untuk rollback, aktifkan notifikasi komentar.
- Tier Premium: secret (`REVALIDATE_SECRET`, service account) hanya di env server & Script Properties, jangan di kode/deck.

## Maintenance & biaya

- Lean/Recommended: ±0–1 jam/bulan (cek log Apps Script kalau ada error, renew authorization kalau pemilik script ganti password/akses).
- Single point of failure: **akun pemilik script**. Pakai akun Workspace kantor (bukan Gmail pribadi) supaya tidak hilang saat orang resign.
- Untuk dijual ke klien: setup Recommended bisa dipaket sebagai "Live Microsite" (setup fee + retainer maintenance kecil). Hitung HPP: jam Harry/dev + jam designer template + QA. Jangan jadikan bonus gratis.

## Cara Claude menjalankan skill ini

Saat user minta Live CMS Slides → website:

1. Tanya/isi asumsi: tujuan site, jumlah section, siapa editor, traffic perkiraan, deadline, akun (Gmail vs Workspace), apakah butuh SEO/animasi. Tandai asumsi.
2. Rekomendasikan **satu tier** dengan alasan (latency, biaya, maintenance, risiko). Jangan overengineer: kalau traffic kecil & internal, Lean/Recommended.
3. Rancang **content contract**: daftar `section` + key speaker notes per section + contoh isi notes.
4. Generate kode dari `starter/` yang disesuaikan (renderer per section, styling sesuai brand). Selalu jaga: hanya rebuild saat berubah, gambar di-copy (bukan hotlink), fallback snapshot terakhir.
5. Tulis SOP editor 1 halaman (Do/Don't) + QA checklist.
6. Selalu sebut keterbatasan: bukan realtime murni, kuota, data publik.

Prompt siap salin ada di `prompts.md`. Contoh output ada di dalam tiap prompt.
