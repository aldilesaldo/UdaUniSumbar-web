import {
  AdminSession,
  AmbassadorBio,
  CmsBoardMember,
  CmsBoardSummaryItem,
  CmsEventItem,
  CmsMisiEntry,
  CmsState,
  RoleFilter,
  clearAdminSession,
  createEmptyBoardMember,
  createEmptyEvent,
  createTemplateYearLineup,
  exportCatalogCsv,
  exportCmsBackupJson,
  formatBytesCompact,
  getAdminSession,
  getCmsState,
  getDefaultPasscodeValue,
  importCmsBackupJson,
  isUsingDefaultPasscodeHint,
  resetCmsModule,
  resolveCmsImageUrl,
  saveCmsState,
  saveCompressedAdminImage,
  setAdminSession,
  updateAdminPasscode,
  verifyAdminPasscode,
} from './cmsStore';

type AdminTab = 'overview' | 'catalog' | 'events' | 'board' | 'visimisi';

function escapeHtml(raw: string | undefined | null): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function setupAdminPanel(): void {
  const dialog = document.getElementById('admin-cms-dialog') as HTMLDialogElement | null;
  if (!dialog) return;

  let activeTab: AdminTab = 'overview';
  let session: AdminSession | null = getAdminSession();
  let selectedYear = getCmsState().catalogYears[0]?.year ?? '2024';
  let selectedRole: RoleFilter = 'uda';
  let selectedSlotIndex = 0;
  let catalogQuery = '';
  let newYearMode = false;
  let selectedEventId = getCmsState().events[0]?.id ?? '';
  let selectedBoardId = getCmsState().boardMembers[0]?.id ?? '';
  let toastMessage = '';
  let toastType: 'success' | 'error' | 'info' = 'success';
  let toastTimer = 0;
  let pendingConfirm: {
    key: string;
    label: string;
    onConfirm: () => void;
  } | null = null;
  let uploadStatNote = '';

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    toastMessage = msg;
    toastType = type;
    window.clearTimeout(toastTimer);
    render();
    toastTimer = window.setTimeout(() => {
      toastMessage = '';
      const bar = dialog.querySelector<HTMLElement>('[data-admin-toast]');
      if (bar) bar.hidden = true;
    }, 4200);
  };

  const openAdminDialog = () => {
    session = getAdminSession();
    pendingConfirm = null;
    uploadStatNote = '';
    if (!dialog.open) {
      dialog.showModal();
    }
    render();
  };

  // Hidden Admin entry: 10 consecutive clicks on the website logo (completely invisible to visitors)
  const SECRET_CLICK_TARGET = 10;
  const SECRET_CLICK_WINDOW_MS = 2500;
  let logoClickCount = 0;
  let lastLogoClickAt = 0;

  const handleSecretLogoClick = (e: MouseEvent, isHeaderLink: boolean) => {
    if (isHeaderLink) {
      e.preventDefault();
    }
    const now = Date.now();
    if (now - lastLogoClickAt > SECRET_CLICK_WINDOW_MS) {
      logoClickCount = 0;
    }
    logoClickCount += 1;
    lastLogoClickAt = now;

    if (logoClickCount >= SECRET_CLICK_TARGET) {
      logoClickCount = 0;
      lastLogoClickAt = 0;
      openAdminDialog();
      return;
    }

    if (isHeaderLink && logoClickCount === 1 && window.scrollY > 24) {
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  };

  const headerBrand = document.querySelector<HTMLElement>('.site-header .brand');
  headerBrand?.addEventListener('click', (e) => handleSecretLogoClick(e, true));

  const footerLogo = document.querySelector<HTMLElement>('.site-footer-brand img');
  footerLogo?.addEventListener('click', (e) => handleSecretLogoClick(e, false));

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.close();
    }
  });

  const cloneState = (): CmsState => JSON.parse(JSON.stringify(getCmsState())) as CmsState;

  const getTabTitle = (tab: AdminTab): {crumb: string; title: string} => {
    switch (tab) {
      case 'overview':
        return {crumb: 'Ringkasan & Log', title: 'Ringkasan Portal & Riwayat Perubahan'};
      case 'catalog':
        return {crumb: 'Katalog Uda & Uni', title: 'Manajemen Katalog Uda & Uni per Angkatan'};
      case 'events':
        return {crumb: 'Berita & Program', title: 'Berita dan Program Kegiatan'};
      case 'board':
        return {crumb: 'Kepengurusan 2027', title: 'Struktur Kepengurusan & Angka Ringkasan'};
      case 'visimisi':
        return {crumb: 'Visi, Misi & Backup', title: 'Visi, Misi, Cadangan Data & Pengaturan'};
    }
  };

  const renderLoginScreen = () => {
    const useDefaultHint = isUsingDefaultPasscodeHint();
    dialog.innerHTML = `
      <div class="admin-auth-shell">
        <button type="button" class="admin-close-x" data-admin-close aria-label="Tutup Panel Admin">×</button>
        <div class="admin-auth-brand">
          <img src="/assets/aistudio/logo_uda_uni_2027_a45f5678.png" width="40" height="40" alt="Logo Ikatan Uda &amp; Uni">
          <div>
            <strong>Konsol Admin Portal</strong>
            <span>Ikatan Uda &amp; Uni Duta Wisata Sumatera Barat</span>
          </div>
        </div>
        <h2 class="admin-auth-title">Masuk Pengelola Data</h2>
        <p class="admin-auth-sub">Kelola katalog Uda &amp; Uni, berita dan program kegiatan, struktur kepengurusan, serta visi dan misi secara langsung di browser.</p>

        <div class="admin-local-notice">
          <strong>Mode Penyimpanan Lokal Aktif</strong>
          <span>Perubahan disimpan di browser (<code>localStorage</code> &amp; <code>IndexedDB</code>) dan belum terhubung ke Firebase sesuai arahan Anda.</span>
        </div>

        <form class="admin-auth-form" data-admin-login-form>
          <div class="admin-field">
            <label for="admin-operator-name">Nama Operator / Pengurus</label>
            <input id="admin-operator-name" name="operator" type="text" value="Admin Sekretariat" required autocomplete="name">
          </div>
          <div class="admin-field">
            <label for="admin-passcode-input">Kata Sandi Admin</label>
            <input id="admin-passcode-input" name="passcode" type="password" placeholder="Masukkan kata sandi admin" required autocomplete="current-password">
            ${
              useDefaultHint
                ? `<small class="admin-field-hint">Sandi bawaan awal: <code>${escapeHtml(getDefaultPasscodeValue())}</code> (dapat diganti di menu Pengaturan)</small>`
                : `<small class="admin-field-hint">Masukkan kata sandi pengelola yang tersimpan di browser ini.</small>`
            }
          </div>
          <p class="admin-auth-error" data-admin-auth-error hidden></p>
          <div class="admin-auth-actions">
            <button type="button" class="admin-btn admin-btn--ghost" data-admin-close>Batal</button>
            <button type="submit" class="admin-btn admin-btn--primary">Buka Panel Admin</button>
          </div>
        </form>
      </div>
    `;

    dialog.querySelectorAll('[data-admin-close]').forEach((el) => {
      el.addEventListener('click', () => dialog.close());
    });

    const form = dialog.querySelector<HTMLFormElement>('[data-admin-login-form]');
    const errEl = dialog.querySelector<HTMLElement>('[data-admin-auth-error]');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const operator = String(fd.get('operator') || 'Admin Sekretariat');
      const passcode = String(fd.get('passcode') || '');
      const ok = await verifyAdminPasscode(passcode);
      if (!ok) {
        if (errEl) {
          errEl.textContent = 'Kata sandi tidak valid. Periksa kembali sandi admin Anda.';
          errEl.hidden = false;
        }
        return;
      }
      session = setAdminSession(operator);
      showToast(`Selamat datang, ${session.operatorName}. Mode lokal siap digunakan.`, 'success');
    });
  };

  const renderOverviewTab = (state: CmsState): string => {
    const totalProfiles = state.catalogYears.reduce((sum, y) => sum + y.uda.length + y.uni.length, 0);
    const customPhotos = state.catalogYears.reduce((sum, y) => {
      return (
        sum +
        [...y.uda, ...y.uni].filter((p) => p.photo?.thumb && p.photo.thumb.startsWith('cms-media://')).length
      );
    }, 0);
    const publishedEvents = state.events.filter((e) => e.status === 'published').length;
    const publishedBoard = state.boardMembers.filter((m) => m.status === 'published').length;

    const logsHtml = state.activityLog
      .slice(0, 15)
      .map(
        (log) => `
          <tr>
            <td class="admin-log-time is-tabular" data-label="Waktu">${escapeHtml(formatDateTime(log.timestamp))}</td>
            <td class="admin-log-op" data-label="Operator"><strong>${escapeHtml(log.operator)}</strong></td>
            <td class="admin-log-mod" data-label="Modul"><span class="admin-tag">${escapeHtml(log.module)}</span></td>
            <td class="admin-log-action" data-label="Aksi">${escapeHtml(log.action)}</td>
            <td class="admin-log-summary" data-label="Ringkasan">${escapeHtml(log.summary)}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <div class="admin-section">
        <div class="admin-notice-banner">
          <div>
            <strong>Penyimpanan Lokal Aktif · Siap Migrasi Firebase</strong>
            <p>Seluruh pembaruan data &amp; kompresi foto langsung tersinkron ke halaman utama website tanpa koneksi server atau Firebase. Gunakan fitur <em>Ekspor Backup JSON</em> berkala untuk mencadangkan data antar perangkat.</p>
          </div>
          <div class="admin-notice-actions">
            <button type="button" class="admin-btn admin-btn--secondary" data-action="export-json">Unduh Backup JSON</button>
          </div>
        </div>

        <div class="admin-kpi-grid">
          <div class="admin-kpi">
            <span class="admin-kpi-label">Tahun Angkatan</span>
            <strong class="admin-kpi-val is-tabular">${state.catalogYears.length}</strong>
            <span class="admin-kpi-sub">${state.catalogYears.map((y) => y.year).join(', ')}</span>
          </div>
          <div class="admin-kpi">
            <span class="admin-kpi-label">Total Profil Uda &amp; Uni</span>
            <strong class="admin-kpi-val is-tabular">${totalProfiles}</strong>
            <span class="admin-kpi-sub is-tabular">${customPhotos} foto baru diunggah via Admin</span>
          </div>
          <div class="admin-kpi">
            <span class="admin-kpi-label">Berita &amp; Program</span>
            <strong class="admin-kpi-val is-tabular">${publishedEvents} / ${state.events.length}</strong>
            <span class="admin-kpi-sub">Tayang / Total agenda</span>
          </div>
          <div class="admin-kpi">
            <span class="admin-kpi-label">Pengurus 2027</span>
            <strong class="admin-kpi-val is-tabular">${publishedBoard} / ${state.boardMembers.length}</strong>
            <span class="admin-kpi-sub">Pengurus tampil di kartu 3D</span>
          </div>
        </div>

        <div class="admin-panel-block">
          <div class="admin-block-head">
            <div>
              <h3>Akses Cepat Modul</h3>
              <p>Pilih modul konten website yang ingin diperbarui.</p>
            </div>
          </div>
          <div class="admin-quick-grid">
            <button type="button" class="admin-quick-card" data-switch-tab="catalog">
              <strong>Katalog Uda &amp; Uni</strong>
              <span>Edit utusan daerah, foto potret terkompresi, dan tambah tahun angkatan.</span>
            </button>
            <button type="button" class="admin-quick-card" data-switch-tab="events">
              <strong>Berita dan Program Kegiatan</strong>
              <span>Tambah/ubah kartu sorotan Section 2, metrik angka, gambar, dan isi pop-up.</span>
            </button>
            <button type="button" class="admin-quick-card" data-switch-tab="board">
              <strong>Kepengurusan 2027</strong>
              <span>Ubah angka ringkasan, profil pengurus inti &amp; bidang, serta mandat kerja.</span>
            </button>
            <button type="button" class="admin-quick-card" data-switch-tab="visimisi">
              <strong>Visi, Misi &amp; Backup</strong>
              <span>Perbarui Visi-Misi 4 pilar, Sapta Pesona, ekspor CSV/JSON, &amp; ganti sandi.</span>
            </button>
          </div>
        </div>

        <div class="admin-panel-block">
          <div class="admin-block-head">
            <div>
              <h3>Riwayat Perubahan Terbaru</h3>
              <p>Catatan perubahan data aktual yang dilakukan melalui Panel Admin.</p>
            </div>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Operator</th>
                  <th>Modul</th>
                  <th>Aksi</th>
                  <th>Ringkasan</th>
                </tr>
              </thead>
              <tbody>
                ${
                  logsHtml ||
                  '<tr><td colspan="5" class="admin-empty-cell">Belum ada catatan perubahan.</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  const renderCatalogTab = (state: CmsState): string => {
    const yearObj = state.catalogYears.find((y) => y.year === selectedYear) ?? state.catalogYears[0];
    if (!yearObj) {
      return '<div class="admin-empty-state">Belum ada tahun angkatan. Tambahkan tahun baru.</div>';
    }
    selectedYear = yearObj.year;

    const list = selectedRole === 'uda' ? yearObj.uda : yearObj.uni;
    if (selectedSlotIndex < 0 || selectedSlotIndex >= list.length) {
      selectedSlotIndex = 0;
    }

    const q = catalogQuery.trim().toLowerCase();
    const filteredSlots = list.filter((p) => {
      if (!q) return true;
      return `${p.fullName} ${p.region} ${p.rankLabel} ${p.advocacy} ${p.finalistNumber ?? ''} ${p.achievement}`
        .toLowerCase()
        .includes(q);
    });

    const activePerson: AmbassadorBio = list[selectedSlotIndex] ?? list[0];
    const fallbackSvg =
      selectedRole === 'uda' ? '/assets/placeholders/silhouette-uda.svg' : '/assets/placeholders/silhouette-uni.svg';
    const previewUrl = resolveCmsImageUrl(activePerson.photo?.thumb) || fallbackSvg;

    const yearOptions = state.catalogYears
      .map(
        (y) =>
          `<button type="button" class="admin-seg-btn ${y.year === yearObj.year ? 'is-active' : ''}" data-cat-year="${escapeHtml(y.year)}">${escapeHtml(y.year)}${y.status === 'draft' ? ' (Draft)' : ''}</button>`,
      )
      .join('');

    const slotRows = filteredSlots
      .map((p) => {
        const isCustomPhoto = Boolean(p.photo?.thumb && p.photo.thumb.startsWith('cms-media://'));
        const hasRealPhoto = Boolean(p.photo?.thumb && !p.photo.thumb.includes('silhouette-'));
        const thumbSrc = resolveCmsImageUrl(p.photo?.thumb) || fallbackSvg;
        return `
          <button type="button" class="admin-list-row ${p.slotIndex === activePerson.slotIndex ? 'is-selected' : ''}" data-cat-slot="${p.slotIndex}">
            <img class="admin-list-thumb" src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" referrerpolicy="no-referrer">
            <div class="admin-list-meta">
              <strong>${escapeHtml(p.shortName)}</strong>
              <span>${escapeHtml(p.region)} · ${escapeHtml(p.rankLabel)}</span>
            </div>
            <span class="admin-status-dot ${isCustomPhoto ? 'is-custom' : hasRealPhoto ? 'is-ok' : 'is-empty'}">
              ${isCustomPhoto ? 'Upload' : hasRealPhoto ? 'Foto' : 'Siluet'}
            </span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="admin-section">
        <div class="admin-toolbar">
          <div class="admin-toolbar-group">
            <div class="admin-seg" role="group" aria-label="Pilih tahun angkatan">
              ${yearOptions}
            </div>
            <button type="button" class="admin-btn admin-btn--secondary" data-cat-toggle-new-year>+ Tambah Tahun</button>
          </div>
          <div class="admin-toolbar-group">
            <button type="button" class="admin-btn admin-btn--ghost" data-action="export-csv">Ekspor CSV</button>
            <button type="button" class="admin-btn ${yearObj.status === 'published' ? 'admin-btn--secondary' : 'admin-btn--primary'}" data-cat-toggle-year-status>
              ${yearObj.status === 'published' ? 'Status Tahun: Tayang (Ubah ke Draft)' : 'Status Tahun: Draft (Publikasikan)'}
            </button>
          </div>
        </div>

        ${
          newYearMode
            ? `
            <form class="admin-inline-create" data-cat-add-year-form>
              <label for="new-year-input">Tahun Angkatan Baru (4 digit, mis. 2027)</label>
              <input id="new-year-input" name="year" type="number" min="2020" max="2099" value="${Math.max(2027, Number(state.catalogYears[0]?.year || 2024) + 1)}" required>
              <button type="submit" class="admin-btn admin-btn--primary">Buat 19 Slot Uda &amp; 19 Uni</button>
              <button type="button" class="admin-btn admin-btn--ghost" data-cat-cancel-new-year>Batal</button>
            </form>
          `
            : ''
        }

        <div class="admin-split">
          <div class="admin-split-list">
            <div class="admin-list-controls">
              <div class="admin-seg admin-seg--full">
                <button type="button" class="admin-seg-btn ${selectedRole === 'uda' ? 'is-active' : ''}" data-cat-role="uda">Uda (${yearObj.uda.length})</button>
                <button type="button" class="admin-seg-btn ${selectedRole === 'uni' ? 'is-active' : ''}" data-cat-role="uni">Uni (${yearObj.uni.length})</button>
              </div>
              <input type="search" class="admin-search-input" placeholder="Cari nama, daerah, gelar..." value="${escapeHtml(catalogQuery)}" data-cat-search>
            </div>
            <div class="admin-scroll-list">
              ${slotRows || '<div class="admin-empty-state">Tidak ada profil sesuai pencarian.</div>'}
            </div>
          </div>

          <div class="admin-split-editor">
            <form class="admin-editor-form" data-cat-save-form>
              <div class="admin-editor-head">
                <div>
                  <span class="admin-tag">Slot #${String(activePerson.slotIndex + 1).padStart(2, '0')} · ${escapeHtml(yearObj.year)} · ${activePerson.role.toUpperCase()}</span>
                  <h3>${escapeHtml(activePerson.fullName)}</h3>
                </div>
                <div class="admin-editor-actions">
                  <button type="button" class="admin-btn admin-btn--ghost admin-mobile-back-list" data-scroll-to-list>↑ Daftar Peserta</button>
                  <button type="submit" class="admin-btn admin-btn--primary">Simpan Profil</button>
                </div>
              </div>

              <div class="admin-photo-row">
                <div class="admin-photo-preview admin-photo-preview--portrait">
                  <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(activePerson.shortName)}" data-cat-photo-preview referrerpolicy="no-referrer">
                </div>
                <div class="admin-photo-controls">
                  <strong>Foto Duta Wisata (${activePerson.role === 'uda' ? 'Uda' : 'Uni'})</strong>
                  <p>Unggah foto potret (otomatis dikompres ke WebP &le; 900px di browser sebelum disimpan agar cepat saat berpindah Uda/Uni).</p>
                  <div class="admin-photo-actions">
                    <label class="admin-btn admin-btn--secondary admin-file-label">
                      Pilih &amp; Kompres Foto
                      <input type="file" accept="image/*" hidden data-cat-upload-photo>
                    </label>
                    ${
                      activePerson.photo?.thumb
                        ? `<button type="button" class="admin-btn admin-btn--ghost" data-cat-reset-photo>Pakai Siluet Bawaan</button>`
                        : ''
                    }
                  </div>
                  ${uploadStatNote ? `<small class="admin-upload-note">${escapeHtml(uploadStatNote)}</small>` : ''}
                </div>
              </div>

              <div class="admin-form-grid">
                <div class="admin-field">
                  <label for="cat-fullName">Nama Lengkap &amp; Gelar</label>
                  <input id="cat-fullName" name="fullName" type="text" value="${escapeHtml(activePerson.fullName)}" required>
                </div>
                <div class="admin-field">
                  <label for="cat-shortName">Nama Singkat (di Stage)</label>
                  <input id="cat-shortName" name="shortName" type="text" value="${escapeHtml(activePerson.shortName)}" required>
                </div>
                <div class="admin-field">
                  <label for="cat-rankLabel">Predikat / Gelar</label>
                  <input id="cat-rankLabel" name="rankLabel" type="text" value="${escapeHtml(activePerson.rankLabel)}" required>
                </div>
                <div class="admin-field">
                  <label for="cat-region">Kabupaten / Kota Utusan</label>
                  <input id="cat-region" name="region" type="text" value="${escapeHtml(activePerson.region)}" required>
                </div>
                <div class="admin-field">
                  <label for="cat-finalistNumber">No. Finalis (opsional)</label>
                  <input id="cat-finalistNumber" name="finalistNumber" type="text" placeholder="mis. 01" value="${escapeHtml(activePerson.finalistNumber ?? '')}">
                </div>
                <div class="admin-field">
                  <label for="cat-age">Umur (opsional)</label>
                  <input id="cat-age" name="age" type="text" placeholder="mis. 21 tahun" value="${escapeHtml(activePerson.age ?? '')}">
                </div>
                <div class="admin-field">
                  <label for="cat-education">Pekerjaan / Pendidikan</label>
                  <input id="cat-education" name="education" type="text" value="${escapeHtml(activePerson.education)}">
                </div>
                <div class="admin-field">
                  <label for="cat-profession">Peran / Subjudul Profil</label>
                  <input id="cat-profession" name="profession" type="text" value="${escapeHtml(activePerson.profession)}">
                </div>
                <div class="admin-field admin-field--full">
                  <label for="cat-advocacy">Fokus Advokasi (kosongkan jika tidak ditampilkan)</label>
                  <input id="cat-advocacy" name="advocacy" type="text" value="${escapeHtml(activePerson.advocacy)}">
                </div>
                <div class="admin-field admin-field--full">
                  <label for="cat-achievementsText">Daftar Prestasi yang Pernah Diraih (1 poin per baris)</label>
                  <textarea id="cat-achievementsText" name="achievementsText" rows="5" placeholder="Tulis satu prestasi per baris untuk ditampilkan sebagai daftar poin...">${escapeHtml((activePerson.achievements ?? []).join('\n'))}</textarea>
                </div>
                <div class="admin-field admin-field--full">
                  <label for="cat-achievement">Ringkasan Prestasi &amp; Mandat (1 baris)</label>
                  <input id="cat-achievement" name="achievement" type="text" value="${escapeHtml(activePerson.achievement)}">
                </div>
                <div class="admin-field admin-field--full">
                  <label for="cat-bio">Biografi Singkat</label>
                  <textarea id="cat-bio" name="bio" rows="4">${escapeHtml(activePerson.bio)}</textarea>
                </div>
              </div>

              <div class="admin-form-foot">
                <button type="button" class="admin-btn admin-btn--ghost" data-scroll-to-list>↑ Daftar</button>
                <button type="submit" class="admin-btn admin-btn--primary">Simpan Profil</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  };

  const renderEventsTab = (state: CmsState): string => {
    const activeEvent = state.events.find((e) => e.id === selectedEventId) ?? state.events[0];
    if (activeEvent) selectedEventId = activeEvent.id;

    const listRows = state.events
      .map((ev, idx) => {
        const thumbUrl = resolveCmsImageUrl(ev.photo);
        return `
          <div class="admin-item-card ${ev.id === activeEvent?.id ? 'is-selected' : ''}">
            <button type="button" class="admin-item-select" data-ev-select="${escapeHtml(ev.id)}">
              <img class="admin-item-thumb" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">
              <div class="admin-list-meta">
                <strong>${escapeHtml(ev.title)}</strong>
                <span>${escapeHtml(ev.category)} · ${ev.status === 'published' ? 'Tayang' : 'Draft'}</span>
              </div>
            </button>
            <div class="admin-item-order">
              <button type="button" class="admin-icon-btn" data-ev-move="-1" data-ev-id="${escapeHtml(ev.id)}" ${idx === 0 ? 'disabled' : ''} title="Geser naik">↑</button>
              <button type="button" class="admin-icon-btn" data-ev-move="1" data-ev-id="${escapeHtml(ev.id)}" ${idx === state.events.length - 1 ? 'disabled' : ''} title="Geser turun">↓</button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="admin-section">
        <div class="admin-toolbar">
          <div class="admin-toolbar-group">
            <span class="admin-count-text is-tabular">${state.events.length} Berita &amp; Program Kegiatan (${state.events.filter((e) => e.status === 'published').length} Tayang)</span>
          </div>
          <div class="admin-toolbar-group">
            <button type="button" class="admin-btn admin-btn--primary" data-ev-add>+ Tambah Kegiatan</button>
          </div>
        </div>

        <div class="admin-split">
          <div class="admin-split-list">
            <div class="admin-scroll-list">
              ${listRows}
            </div>
          </div>

          <div class="admin-split-editor">
            ${
              activeEvent
                ? `
              <form class="admin-editor-form" data-ev-save-form>
                <div class="admin-editor-head">
                  <div>
                    <span class="admin-tag">${activeEvent.status === 'published' ? 'TAYANG' : 'DRAFT'} · Urutan #${state.events.findIndex((e) => e.id === activeEvent.id) + 1}</span>
                    <h3>${escapeHtml(activeEvent.title)}</h3>
                  </div>
                  <div class="admin-editor-actions">
                    <button type="button" class="admin-btn admin-btn--ghost admin-mobile-back-list" data-scroll-to-list>↑ Daftar</button>
                    ${
                      state.events.length > 1
                        ? `<button type="button" class="admin-btn admin-btn--danger" data-ev-delete="${escapeHtml(activeEvent.id)}">Hapus</button>`
                        : ''
                    }
                    <button type="submit" class="admin-btn admin-btn--primary">Simpan Event</button>
                  </div>
                </div>

                <div class="admin-photo-row">
                  <div class="admin-photo-preview admin-photo-preview--landscape">
                    <img src="${escapeHtml(resolveCmsImageUrl(activeEvent.photo))}" alt="${escapeHtml(activeEvent.photoAlt)}" referrerpolicy="no-referrer">
                  </div>
                  <div class="admin-photo-controls">
                    <strong>Foto Kartu &amp; Pop-Up Event</strong>
                    <p>Gambar disinkronkan otomatis antara Section 2 dan pop-up detail event. Otomatis dikompres saat diunggah.</p>
                    <div class="admin-photo-actions">
                      <label class="admin-btn admin-btn--secondary admin-file-label">
                        Unggah &amp; Kompres Foto Event
                        <input type="file" accept="image/*" hidden data-ev-upload-photo>
                      </label>
                    </div>
                    ${uploadStatNote ? `<small class="admin-upload-note">${escapeHtml(uploadStatNote)}</small>` : ''}
                  </div>
                </div>

                <div class="admin-form-grid">
                  <div class="admin-field">
                    <label for="ev-status">Status Publikasi</label>
                    <select id="ev-status" name="status">
                      <option value="published" ${activeEvent.status === 'published' ? 'selected' : ''}>Tayang di Website</option>
                      <option value="draft" ${activeEvent.status === 'draft' ? 'selected' : ''}>Draft (Disembunyikan)</option>
                    </select>
                  </div>
                  <div class="admin-field">
                    <label for="ev-category">Label Kategori Kartu</label>
                    <input id="ev-category" name="category" type="text" value="${escapeHtml(activeEvent.category)}" required>
                  </div>
                  <div class="admin-field admin-field--full">
                    <label for="ev-title">Judul Program / Event</label>
                    <input id="ev-title" name="title" type="text" value="${escapeHtml(activeEvent.title)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="ev-modalKicker">Sub-Judul Pop-Up</label>
                    <input id="ev-modalKicker" name="modalKicker" type="text" value="${escapeHtml(activeEvent.modalKicker)}">
                  </div>
                  <div class="admin-field">
                    <label for="ev-focusLine">Baris Fokus Pop-Up</label>
                    <input id="ev-focusLine" name="focusLine" type="text" value="${escapeHtml(activeEvent.focusLine)}">
                  </div>
                  <div class="admin-field admin-field--full">
                    <label for="ev-cardSummary">Ringkasan Kartu Section 2</label>
                    <textarea id="ev-cardSummary" name="cardSummary" rows="2">${escapeHtml(activeEvent.cardSummary)}</textarea>
                  </div>
                  <div class="admin-field admin-field--full">
                    <label for="ev-detailSummary">Narasi Utama Pop-Up (Rata Kiri-Kanan)</label>
                    <textarea id="ev-detailSummary" name="detailSummary" rows="3">${escapeHtml(activeEvent.detailSummary)}</textarea>
                  </div>
                </div>

                <div class="admin-subfieldset">
                  <h4>3 Angka Metrik Kartu Depan</h4>
                  <div class="admin-tri-grid">
                    ${[0, 1, 2]
                      .map((mIdx) => {
                        const m = activeEvent.metrics[mIdx] ?? {value: '', label: ''};
                        return `
                          <div class="admin-mini-pair">
                            <span class="admin-subitem-label">Metrik #${mIdx + 1}</span>
                            <input type="text" name="metricVal_${mIdx}" value="${escapeHtml(m.value)}" placeholder="Angka (mis. 19)" aria-label="Angka Metrik ${mIdx + 1}">
                            <input type="text" name="metricLabel_${mIdx}" value="${escapeHtml(m.label)}" placeholder="Keterangan" aria-label="Keterangan Metrik ${mIdx + 1}">
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                </div>

                <div class="admin-subfieldset">
                  <h4>3 Poin Rincian Pop-Up</h4>
                  ${[0, 1, 2]
                    .map((dIdx) => {
                      const d = activeEvent.details[dIdx] ?? {label: '', text: ''};
                      return `
                        <div class="admin-detail-pair">
                          <span class="admin-subitem-label admin-detail-label">Poin Rincian #${dIdx + 1}</span>
                          <input type="text" name="detailLabel_${dIdx}" value="${escapeHtml(d.label)}" placeholder="Label poin" aria-label="Label Poin Rincian ${dIdx + 1}">
                          <input type="text" name="detailText_${dIdx}" value="${escapeHtml(d.text)}" placeholder="Uraian poin rincian" aria-label="Uraian Poin Rincian ${dIdx + 1}">
                        </div>
                      `;
                    })
                    .join('')}
                </div>

                <div class="admin-form-foot">
                  <button type="button" class="admin-btn admin-btn--ghost" data-scroll-to-list>↑ Daftar</button>
                  ${
                    state.events.length > 1
                      ? `<button type="button" class="admin-btn admin-btn--danger" data-ev-delete="${escapeHtml(activeEvent.id)}">Hapus</button>`
                      : ''
                  }
                  <button type="submit" class="admin-btn admin-btn--primary">Simpan Event</button>
                </div>
              </form>
            `
                : '<div class="admin-empty-state">Pilih event untuk diedit.</div>'
            }
          </div>
        </div>
      </div>
    `;
  };

  const renderBoardTab = (state: CmsState): string => {
    const activeMember = state.boardMembers.find((m) => m.id === selectedBoardId) ?? state.boardMembers[0];
    if (activeMember) selectedBoardId = activeMember.id;

    const summaryInputs = state.boardSummary
      .map(
        (s, idx) => `
          <div class="admin-summary-edit-card">
            <label>Statistik #${idx + 1}</label>
            <input type="text" name="sumLabel_${idx}" value="${escapeHtml(s.label)}" placeholder="Label">
            <div class="admin-summary-pair">
              <input type="text" name="sumVal_${idx}" value="${escapeHtml(s.value)}" placeholder="Angka">
              <input type="text" name="sumUnit_${idx}" value="${escapeHtml(s.unit)}" placeholder="Satuan (opsional)">
            </div>
          </div>
        `,
      )
      .join('');

    const listRows = state.boardMembers
      .map((member, idx) => {
        const thumbUrl = resolveCmsImageUrl(member.photo);
        return `
          <div class="admin-item-card ${member.id === activeMember?.id ? 'is-selected' : ''}">
            <button type="button" class="admin-item-select" data-bd-select="${escapeHtml(member.id)}">
              <img class="admin-list-thumb" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">
              <div class="admin-list-meta">
                <strong>${escapeHtml(member.cardName)}</strong>
                <span>${escapeHtml(member.cardRolePrefix)} · ${member.status === 'published' ? 'Tayang' : 'Draft'}</span>
              </div>
            </button>
            <div class="admin-item-order">
              <button type="button" class="admin-icon-btn" data-bd-move="-1" data-bd-id="${escapeHtml(member.id)}" ${idx === 0 ? 'disabled' : ''} title="Geser naik">↑</button>
              <button type="button" class="admin-icon-btn" data-bd-move="1" data-bd-id="${escapeHtml(member.id)}" ${idx === state.boardMembers.length - 1 ? 'disabled' : ''} title="Geser turun">↓</button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="admin-section">
        <form class="admin-panel-block" data-bd-summary-form>
          <div class="admin-block-head">
            <div>
              <h3>Ringkasan Angka Section Kepengurusan</h3>
              <p>Tiga angka utama di bagian kiri Section 3 (Utusan Daerah, Bidang Kerja, Masa Bakti).</p>
            </div>
            <button type="submit" class="admin-btn admin-btn--secondary">Simpan Ringkasan Angka</button>
          </div>
          <div class="admin-tri-grid">
            ${summaryInputs}
          </div>
        </form>

        <div class="admin-toolbar">
          <div class="admin-toolbar-group">
            <span class="admin-count-text is-tabular">${state.boardMembers.length} Pengurus (${state.boardMembers.filter((m) => m.status === 'published').length} Tayang di Kartu 3D)</span>
          </div>
          <div class="admin-toolbar-group">
            <button type="button" class="admin-btn admin-btn--primary" data-bd-add>+ Tambah Pengurus</button>
          </div>
        </div>

        <div class="admin-split">
          <div class="admin-split-list">
            <div class="admin-scroll-list">
              ${listRows}
            </div>
          </div>

          <div class="admin-split-editor">
            ${
              activeMember
                ? `
              <form class="admin-editor-form" data-bd-save-form>
                <div class="admin-editor-head">
                  <div>
                    <span class="admin-tag">${activeMember.status === 'published' ? 'TAYANG' : 'DRAFT'} · ${escapeHtml(activeMember.division)}</span>
                    <h3>${escapeHtml(activeMember.name)}</h3>
                  </div>
                  <div class="admin-editor-actions">
                    <button type="button" class="admin-btn admin-btn--ghost admin-mobile-back-list" data-scroll-to-list>↑ Daftar</button>
                    ${
                      state.boardMembers.length > 1
                        ? `<button type="button" class="admin-btn admin-btn--danger" data-bd-delete="${escapeHtml(activeMember.id)}">Hapus</button>`
                        : ''
                    }
                    <button type="submit" class="admin-btn admin-btn--primary">Simpan Pengurus</button>
                  </div>
                </div>

                <div class="admin-photo-row">
                  <div class="admin-photo-preview admin-photo-preview--portrait">
                    <img src="${escapeHtml(resolveCmsImageUrl(activeMember.photo))}" alt="${escapeHtml(activeMember.name)}" referrerpolicy="no-referrer">
                  </div>
                  <div class="admin-photo-controls">
                    <strong>Foto Pengurus (Kartu 3D &amp; Pop-Up)</strong>
                    <p>Foto yang sama digunakan pada tumpukan kartu 3D Section 3 dan panel detail pengurus.</p>
                    <div class="admin-photo-actions">
                      <label class="admin-btn admin-btn--secondary admin-file-label">
                        Unggah &amp; Kompres Foto
                        <input type="file" accept="image/*" hidden data-bd-upload-photo>
                      </label>
                    </div>
                    ${uploadStatNote ? `<small class="admin-upload-note">${escapeHtml(uploadStatNote)}</small>` : ''}
                  </div>
                </div>

                <div class="admin-form-grid">
                  <div class="admin-field">
                    <label for="bd-status">Status Publikasi</label>
                    <select id="bd-status" name="status">
                      <option value="published" ${activeMember.status === 'published' ? 'selected' : ''}>Tayang di Website</option>
                      <option value="draft" ${activeMember.status === 'draft' ? 'selected' : ''}>Draft (Disembunyikan)</option>
                    </select>
                  </div>
                  <div class="admin-field">
                    <label for="bd-divisionKey">Kelompok Bidang</label>
                    <select id="bd-divisionKey" name="divisionKey">
                      <option value="inti" ${activeMember.divisionKey === 'inti' ? 'selected' : ''}>Pengurus Inti</option>
                      <option value="budaya" ${activeMember.divisionKey === 'budaya' ? 'selected' : ''}>Advokasi &amp; Budaya</option>
                      <option value="promosi" ${activeMember.divisionKey === 'promosi' ? 'selected' : ''}>Promosi &amp; Media</option>
                      <option value="kemitraan" ${activeMember.divisionKey === 'kemitraan' ? 'selected' : ''}>Kemitraan &amp; Sosial</option>
                    </select>
                  </div>
                  <div class="admin-field">
                    <label for="bd-name">Nama Lengkap &amp; Gelar (Pop-Up)</label>
                    <input id="bd-name" name="name" type="text" value="${escapeHtml(activeMember.name)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="bd-cardName">Nama di Kartu 3D</label>
                    <input id="bd-cardName" name="cardName" type="text" value="${escapeHtml(activeMember.cardName)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="bd-cardRolePrefix">Jabatan Singkat Kartu</label>
                    <input id="bd-cardRolePrefix" name="cardRolePrefix" type="text" value="${escapeHtml(activeMember.cardRolePrefix)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="bd-role">Jabatan Lengkap Pop-Up</label>
                    <input id="bd-role" name="role" type="text" value="${escapeHtml(activeMember.role)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="bd-division">Nama Bidang / Divisi</label>
                    <input id="bd-division" name="division" type="text" value="${escapeHtml(activeMember.division)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="bd-origin">Asal Utusan Daerah</label>
                    <input id="bd-origin" name="origin" type="text" value="${escapeHtml(activeMember.origin)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="bd-cohortYear">Tahun Angkatan (Kartu)</label>
                    <input id="bd-cohortYear" name="cohortYear" type="text" value="${escapeHtml(activeMember.cohortYear)}" required>
                  </div>
                  <div class="admin-field">
                    <label for="bd-badge">Predikat Utama</label>
                    <input id="bd-badge" name="badge" type="text" value="${escapeHtml(activeMember.badge)}">
                  </div>
                  <div class="admin-field admin-field--full">
                    <label for="bd-cardRoleCopy">Ringkasan Singkat di Kartu 3D</label>
                    <input id="bd-cardRoleCopy" name="cardRoleCopy" type="text" value="${escapeHtml(activeMember.cardRoleCopy)}">
                  </div>
                  <div class="admin-field admin-field--full">
                    <label for="bd-summary">Deskripsi Peran di Pop-Up (Rata Kiri-Kanan)</label>
                    <textarea id="bd-summary" name="summary" rows="3">${escapeHtml(activeMember.summary)}</textarea>
                  </div>
                </div>

                <div class="admin-subfieldset">
                  <h4>3 Mandat Program Kerja</h4>
                  ${[0, 1, 2]
                    .map(
                      (tIdx) => `
                        <div class="admin-field admin-field--full">
                          <label for="bd-task-${tIdx}">Mandat ${tIdx + 1}</label>
                          <input id="bd-task-${tIdx}" type="text" name="task_${tIdx}" value="${escapeHtml(activeMember.tasks[tIdx] ?? '')}">
                        </div>
                      `,
                    )
                    .join('')}
                </div>

                <div class="admin-form-foot">
                  <button type="button" class="admin-btn admin-btn--ghost" data-scroll-to-list>↑ Daftar</button>
                  ${
                    state.boardMembers.length > 1
                      ? `<button type="button" class="admin-btn admin-btn--danger" data-bd-delete="${escapeHtml(activeMember.id)}">Hapus</button>`
                      : ''
                  }
                  <button type="submit" class="admin-btn admin-btn--primary">Simpan Pengurus</button>
                </div>
              </form>
            `
                : '<div class="admin-empty-state">Pilih pengurus untuk diedit.</div>'
            }
          </div>
        </div>
      </div>
    `;
  };

  const renderMisiGroupFields = (prefix: string, items: CmsMisiEntry[], groupTitle: string): string => `
    <div class="admin-subfieldset">
      <h4>${escapeHtml(groupTitle)}</h4>
      <div class="admin-misi-edit-grid">
        ${items
          .map(
            (item, idx) => `
              <div class="admin-misi-edit-item">
                <span class="admin-subitem-label">Pilar #${idx + 1}</span>
                <input type="text" name="${prefix}_idx_${idx}" value="${escapeHtml(item.indexLabel)}" placeholder="Label indeks" aria-label="Label indeks pilar ${idx + 1}">
                <input type="text" name="${prefix}_title_${idx}" value="${escapeHtml(item.title)}" placeholder="Judul pilar" aria-label="Judul pilar ${idx + 1}">
                <textarea name="${prefix}_desc_${idx}" rows="2" placeholder="Deskripsi" aria-label="Deskripsi pilar ${idx + 1}">${escapeHtml(item.description)}</textarea>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
  `;

  const renderVisiMisiTab = (state: CmsState): string => {
    const vm = state.visimisi;
    return `
      <div class="admin-section">
        <form class="admin-panel-block" data-vm-save-form>
          <div class="admin-block-head">
            <div>
              <h3>Konten Pop-Up Visi &amp; Misi Ikatan</h3>
              <p>Perubahan langsung memperbarui kartu Visi, Misi, Sebaran 19 Kab/Kota, dan Sapta Pesona.</p>
            </div>
            <button type="submit" class="admin-btn admin-btn--primary">Simpan Visi &amp; Misi</button>
          </div>

          <div class="admin-form-grid">
            <div class="admin-field">
              <label for="vm-eyebrow">Label Atas Dialog</label>
              <input id="vm-eyebrow" name="eyebrow" type="text" value="${escapeHtml(vm.eyebrow)}">
            </div>
            <div class="admin-field">
              <label for="vm-seal">Label Mandat Bawah</label>
              <input id="vm-seal" name="sealLabel" type="text" value="${escapeHtml(vm.sealLabel)}">
            </div>
            <div class="admin-field admin-field--full">
              <label for="vm-chips">Label Nilai Utama (pisahkan dengan koma)</label>
              <input id="vm-chips" name="chips" type="text" value="${escapeHtml(vm.chips.join(', '))}">
            </div>
            <div class="admin-field admin-field--full">
              <label for="vm-quoteLead">Kutipan Visi — Bagian Utama</label>
              <textarea id="vm-quoteLead" name="visiQuoteLead" rows="2">${escapeHtml(vm.visiQuoteLead)}</textarea>
            </div>
            <div class="admin-field admin-field--full">
              <label for="vm-quoteMuted">Kutipan Visi — Lanjutan Sekunder</label>
              <textarea id="vm-quoteMuted" name="visiQuoteMuted" rows="2">${escapeHtml(vm.visiQuoteMuted)}</textarea>
            </div>
            <div class="admin-field admin-field--full">
              <label for="vm-desc">Sub-Deskripsi Visi</label>
              <textarea id="vm-desc" name="visiDesc" rows="2">${escapeHtml(vm.visiDesc)}</textarea>
            </div>
          </div>

          ${renderMisiGroupFields('misi', vm.misiItems, 'Tab 1 — Empat Misi Strategis')}
          ${renderMisiGroupFields('sebaran', vm.sebaranItems, 'Tab 2 — Sebaran 19 Kabupaten / Kota')}
          ${renderMisiGroupFields('komitmen', vm.komitmenItems, 'Tab 3 — Pilar Sapta Pesona')}

          <div class="admin-form-foot">
            <button type="submit" class="admin-btn admin-btn--primary">Simpan Visi &amp; Misi</button>
          </div>
        </form>

        <div class="admin-panel-block">
          <div class="admin-block-head">
            <div>
              <h3>Cadangan, Pemulihan &amp; Keamanan Lokal</h3>
              <p>Kelola ekspor-impor JSON, pulihkan data bawaan per modul, atau ubah kata sandi Admin lokal.</p>
            </div>
          </div>

          <div class="admin-tools-grid">
            <div class="admin-tool-box">
              <strong>Ekspor &amp; Impor Backup Data</strong>
              <p>Simpan seluruh data teks ke file JSON, pulihkan cadangan JSON, atau unduh kode sumber website dalam format Repomix (.txt).</p>
              <div class="admin-photo-actions">
                <button type="button" class="admin-btn admin-btn--secondary" data-action="export-json">Ekspor JSON</button>
                <label class="admin-btn admin-btn--ghost admin-file-label">
                  Impor JSON Backup
                  <input type="file" accept=".json,application/json" hidden data-action-import-json>
                </label>
                <button type="button" class="admin-btn admin-btn--secondary" data-action="download-repomix">Unduh Repomix (.txt)</button>
              </div>
            </div>

            <div class="admin-tool-box">
              <strong>Pulihkan Data Bawaan (Reset)</strong>
              <p>Kembalikan modul tertentu atau seluruh situs ke setelan bawaan awal.</p>
              <div class="admin-reset-row">
                <button type="button" class="admin-btn admin-btn--ghost" data-reset-mod="catalog">Reset Katalog</button>
                <button type="button" class="admin-btn admin-btn--ghost" data-reset-mod="events">Reset Event</button>
                <button type="button" class="admin-btn admin-btn--ghost" data-reset-mod="board">Reset Pengurus</button>
                <button type="button" class="admin-btn admin-btn--danger" data-reset-mod="all">Reset Semua</button>
              </div>
            </div>
          </div>

          <form class="admin-passcode-form" data-passcode-form>
            <h4>Ubah Kata Sandi Admin Lokal</h4>
            <div class="admin-tri-grid admin-passcode-grid">
              <div class="admin-field">
                <label for="admin-cur-pass">Sandi Saat Ini</label>
                <input id="admin-cur-pass" type="password" name="currentPasscode" placeholder="Sandi saat ini" required autocomplete="current-password">
              </div>
              <div class="admin-field">
                <label for="admin-new-pass">Sandi Baru (min. 6 karakter)</label>
                <input id="admin-new-pass" type="password" name="newPasscode" placeholder="Sandi baru (min. 6 karakter)" required autocomplete="new-password">
              </div>
              <div class="admin-field admin-passcode-submit-wrap">
                <button type="submit" class="admin-btn admin-btn--secondary">Simpan Sandi Baru</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const render = () => {
    if (!session) {
      renderLoginScreen();
      return;
    }

    const state = getCmsState();
    const {crumb, title} = getTabTitle(activeTab);

    let bodyHtml = '';
    if (activeTab === 'overview') bodyHtml = renderOverviewTab(state);
    else if (activeTab === 'catalog') bodyHtml = renderCatalogTab(state);
    else if (activeTab === 'events') bodyHtml = renderEventsTab(state);
    else if (activeTab === 'board') bodyHtml = renderBoardTab(state);
    else bodyHtml = renderVisiMisiTab(state);

    dialog.innerHTML = `
      <div class="admin-workspace">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-brand">
            <div class="admin-sidebar-brand-left">
              <img src="/assets/aistudio/logo_uda_uni_2027_a45f5678.png" width="32" height="32" alt="Logo">
              <div>
                <strong>Menu Admin</strong>
                <span class="admin-brand-sub-desktop">Mode Lokal (Non-Firebase)</span>
                <span class="admin-brand-sub-mobile">${escapeHtml(session.operatorName)} · Lokal</span>
              </div>
            </div>
            <div class="admin-mobile-head-actions">
              <button type="button" class="admin-btn admin-btn--ghost" data-admin-logout>Keluar</button>
              <button type="button" class="admin-btn admin-btn--secondary" data-admin-close aria-label="Tutup Panel Admin">Tutup</button>
            </div>
          </div>

          <nav class="admin-nav" aria-label="Menu utama Admin">
            <button type="button" class="admin-nav-btn ${activeTab === 'overview' ? 'is-active' : ''}" data-switch-tab="overview">
              <span>Ringkasan &amp; Log</span>
            </button>
            <button type="button" class="admin-nav-btn ${activeTab === 'catalog' ? 'is-active' : ''}" data-switch-tab="catalog">
              <span>Katalog Uda &amp; Uni</span>
              <span class="admin-nav-count is-tabular">${state.catalogYears.length}</span>
            </button>
            <button type="button" class="admin-nav-btn ${activeTab === 'events' ? 'is-active' : ''}" data-switch-tab="events">
              <span>Berita &amp; Program</span>
              <span class="admin-nav-count is-tabular">${state.events.length}</span>
            </button>
            <button type="button" class="admin-nav-btn ${activeTab === 'board' ? 'is-active' : ''}" data-switch-tab="board">
              <span>Kepengurusan 2027</span>
              <span class="admin-nav-count is-tabular">${state.boardMembers.length}</span>
            </button>
            <button type="button" class="admin-nav-btn ${activeTab === 'visimisi' ? 'is-active' : ''}" data-switch-tab="visimisi">
              <span>Visi, Misi &amp; Backup</span>
            </button>
          </nav>

          <div class="admin-sidebar-foot">
            <div class="admin-operator-badge">
              <strong>${escapeHtml(session.operatorName)}</strong>
              <span>Penyimpanan Browser Lokal</span>
            </div>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--full" data-admin-logout>Kunci &amp; Keluar</button>
          </div>
        </aside>

        <div class="admin-main">
          <header class="admin-topbar">
            <div class="admin-breadcrumb">
              <span>Portal Uda &amp; Uni</span>
              <span aria-hidden="true">/</span>
              <strong>${escapeHtml(crumb)}</strong>
            </div>
            <div class="admin-topbar-actions">
              <button type="button" class="admin-btn admin-btn--secondary" data-action="export-json">Backup JSON</button>
              <button type="button" class="admin-btn admin-btn--ghost admin-tablet-only-btn" data-admin-logout>Keluar</button>
              <button type="button" class="admin-btn admin-btn--ghost" data-admin-close>Tutup Panel</button>
            </div>
          </header>

          ${
            pendingConfirm
              ? `
              <div class="admin-confirm-bar" role="alert">
                <span>${escapeHtml(pendingConfirm.label)}</span>
                <div class="admin-confirm-actions">
                  <button type="button" class="admin-btn admin-btn--ghost" data-confirm-cancel>Batal</button>
                  <button type="button" class="admin-btn admin-btn--danger" data-confirm-proceed>Ya, Lanjutkan</button>
                </div>
              </div>
            `
              : ''
          }

          ${
            toastMessage
              ? `<div class="admin-toast admin-toast--${toastType}" data-admin-toast>${escapeHtml(toastMessage)}</div>`
              : ''
          }

          <div class="admin-viewport">
            <div class="admin-view-title">
              <h2>${escapeHtml(title)}</h2>
            </div>
            ${bodyHtml}
          </div>
        </div>
      </div>
    `;

    bindRenderedEvents();

    // Keep active navigation pill visible when scrolling horizontal mobile tab bar
    if (window.innerWidth <= 980) {
      const activeNav = dialog.querySelector<HTMLElement>('.admin-nav-btn.is-active');
      activeNav?.scrollIntoView({inline: 'nearest', block: 'nearest'});
    }
  };

  const scrollToMobileSection = (selector: string) => {
    if (window.innerWidth > 980) return;
    window.requestAnimationFrame(() => {
      const target = dialog.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  };

  const bindRenderedEvents = () => {
    dialog.querySelectorAll('[data-admin-close]').forEach((el) => {
      el.addEventListener('click', () => dialog.close());
    });

    dialog.querySelectorAll('[data-admin-logout]').forEach((el) => {
      el.addEventListener('click', () => {
        clearAdminSession();
        session = null;
        render();
      });
    });

    dialog.querySelectorAll('[data-scroll-to-list]').forEach((el) => {
      el.addEventListener('click', () => {
        const listEl = dialog.querySelector<HTMLElement>('.admin-split-list');
        listEl?.scrollIntoView({behavior: 'smooth', block: 'start'});
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-switch-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.switchTab as AdminTab;
        if (!nextTab) return;
        activeTab = nextTab;
        pendingConfirm = null;
        uploadStatNote = '';
        render();
      });
    });

    dialog.querySelectorAll('[data-action="export-json"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dateTag = new Date().toISOString().slice(0, 10);
        downloadTextFile(`backup-uda-uni-sumbar-${dateTag}.json`, exportCmsBackupJson(), 'application/json');
        showToast('Backup JSON berhasil diunduh.', 'success');
      });
    });

    dialog.querySelector('[data-action="export-csv"]')?.addEventListener('click', () => {
      const dateTag = new Date().toISOString().slice(0, 10);
      downloadTextFile(`katalog-uda-uni-${dateTag}.csv`, exportCatalogCsv(), 'text/csv;charset=utf-8');
      showToast('Katalog Uda & Uni diekspor ke format CSV.', 'success');
    });

    dialog.querySelectorAll('[data-action="download-repomix"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const resp = await fetch('/repomix-output.txt', {cache: 'no-cache'});
          if (!resp.ok) throw new Error('File Repomix belum tersedia.');
          const text = await resp.text();
          downloadTextFile('repomix-uda-uni-sumbar.txt', text, 'text/plain;charset=utf-8');
          showToast('File Repomix (.txt) berhasil diunduh.', 'success');
        } catch {
          showToast('Gagal mengunduh file Repomix (.txt).', 'error');
        }
      });
    });

    dialog.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => {
      pendingConfirm = null;
      render();
    });
    dialog.querySelector('[data-confirm-proceed]')?.addEventListener('click', () => {
      const fn = pendingConfirm?.onConfirm;
      pendingConfirm = null;
      fn?.();
    });

    // Catalog bindings
    dialog.querySelectorAll<HTMLElement>('[data-cat-year]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedYear = btn.dataset.catYear || selectedYear;
        selectedSlotIndex = 0;
        uploadStatNote = '';
        render();
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-cat-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRole = (btn.dataset.catRole as RoleFilter) || 'uda';
        selectedSlotIndex = 0;
        uploadStatNote = '';
        render();
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-cat-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSlotIndex = Number(btn.dataset.catSlot || 0);
        uploadStatNote = '';
        render();
        scrollToMobileSection('.admin-split-editor');
      });
    });

    const catSearch = dialog.querySelector<HTMLInputElement>('[data-cat-search]');
    catSearch?.addEventListener('input', () => {
      catalogQuery = catSearch.value;
      const caret = catSearch.selectionStart ?? catalogQuery.length;
      render();
      const restored = dialog.querySelector<HTMLInputElement>('[data-cat-search]');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(caret, caret);
      }
    });

    dialog.querySelector('[data-cat-toggle-new-year]')?.addEventListener('click', () => {
      newYearMode = !newYearMode;
      render();
    });
    dialog.querySelector('[data-cat-cancel-new-year]')?.addEventListener('click', () => {
      newYearMode = false;
      render();
    });

    dialog.querySelector<HTMLFormElement>('[data-cat-add-year-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const yearStr = String(fd.get('year') || '').trim();
      if (!/^\d{4}$/.test(yearStr)) {
        showToast('Masukkan tahun 4 digit yang valid.', 'error');
        return;
      }
      const next = cloneState();
      if (next.catalogYears.some((y) => y.year === yearStr)) {
        showToast(`Angkatan ${yearStr} sudah ada.`, 'error');
        return;
      }
      next.catalogYears.unshift(createTemplateYearLineup(yearStr, 'published'));
      next.catalogYears.sort((a, b) => Number(b.year) - Number(a.year));
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Katalog',
        action: 'Tambah Tahun Angkatan',
        summary: `Menambahkan angkatan ${yearStr} lengkap dengan 19 slot Uda & 19 slot Uni.`,
      });
      newYearMode = false;
      selectedYear = yearStr;
      selectedSlotIndex = 0;
      showToast(`Angkatan ${yearStr} berhasil dibuat dan langsung tayang di katalog.`, 'success');
    });

    dialog.querySelector('[data-cat-toggle-year-status]')?.addEventListener('click', () => {
      const next = cloneState();
      const target = next.catalogYears.find((y) => y.year === selectedYear);
      if (!target) return;
      target.status = target.status === 'published' ? 'draft' : 'published';
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Katalog',
        action: 'Ubah Status Angkatan',
        summary: `Angkatan ${target.year} diubah ke status ${target.status === 'published' ? 'Tayang' : 'Draft'}.`,
      });
      showToast(`Status angkatan ${target.year} diperbarui.`, 'success');
    });

    dialog.querySelector<HTMLInputElement>('[data-cat-upload-photo]')?.addEventListener('change', async (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await saveCompressedAdminImage(file, 'portrait');
        const next = cloneState();
        const yearObj = next.catalogYears.find((y) => y.year === selectedYear);
        const list = selectedRole === 'uda' ? yearObj?.uda : yearObj?.uni;
        const person = list?.[selectedSlotIndex];
        if (!person) return;
        person.photo = {thumb: res.refUrl, full: res.refUrl};
        saveCmsState(next, {
          operator: session?.operatorName,
          module: 'Katalog',
          action: 'Unggah Foto Duta',
          summary: `${person.shortName} (${selectedYear}) — dikompres ${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)}.`,
        });
        uploadStatNote = `Terkompres: ${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)} (${res.width}×${res.height}px)`;
        showToast('Foto potret dikompresi, disimpan ke browser & diterapkan ke panggung utama.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memproses foto.', 'error');
      }
    });

    dialog.querySelector('[data-cat-reset-photo]')?.addEventListener('click', () => {
      const next = cloneState();
      const yearObj = next.catalogYears.find((y) => y.year === selectedYear);
      const list = selectedRole === 'uda' ? yearObj?.uda : yearObj?.uni;
      const person = list?.[selectedSlotIndex];
      if (!person) return;
      delete person.photo;
      uploadStatNote = '';
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Katalog',
        action: 'Reset Foto Slot',
        summary: `Mengembalikan foto ${person.shortName} (${selectedYear}) ke siluet bawaan.`,
      });
      showToast('Foto profil dikembalikan ke siluet bawaan.', 'info');
    });

    dialog.querySelector<HTMLFormElement>('[data-cat-save-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const next = cloneState();
      const yearObj = next.catalogYears.find((y) => y.year === selectedYear);
      const list = selectedRole === 'uda' ? yearObj?.uda : yearObj?.uni;
      const person = list?.[selectedSlotIndex];
      if (!person) return;

      person.fullName = String(fd.get('fullName') || person.fullName).trim();
      person.shortName = String(fd.get('shortName') || person.shortName).trim();
      person.rankLabel = String(fd.get('rankLabel') || person.rankLabel).trim();
      person.region = String(fd.get('region') || person.region).trim();
      const finalistNumber = String(fd.get('finalistNumber') || '').trim();
      if (finalistNumber) person.finalistNumber = finalistNumber;
      else delete person.finalistNumber;
      const age = String(fd.get('age') || '').trim();
      if (age) person.age = age;
      else delete person.age;
      person.education = String(fd.get('education') || '').trim();
      person.profession = String(fd.get('profession') || '').trim();
      person.advocacy = String(fd.get('advocacy') || '').trim();
      const achievementsList = String(fd.get('achievementsText') || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const singleAchievement = String(fd.get('achievement') || '').trim();
      if (achievementsList.length > 0) {
        person.achievements = achievementsList;
        person.achievement = singleAchievement || achievementsList.join(' · ');
      } else {
        delete person.achievements;
        person.achievement = singleAchievement;
      }
      person.bio = String(fd.get('bio') || '').trim();

      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Katalog',
        action: 'Perbarui Profil Duta',
        summary: `Menyimpan perubahan ${person.shortName} (${person.region}, ${selectedYear}).`,
      });
      showToast(`Profil ${person.shortName} tersimpan dan langsung aktif di katalog.`, 'success');
    });

    // Events bindings
    dialog.querySelectorAll<HTMLElement>('[data-ev-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedEventId = btn.dataset.evSelect || selectedEventId;
        uploadStatNote = '';
        render();
        scrollToMobileSection('.admin-split-editor');
      });
    });

    dialog.querySelector('[data-ev-add]')?.addEventListener('click', () => {
      const next = cloneState();
      const created = createEmptyEvent();
      next.events.push(created);
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Event',
        action: 'Tambah Event Baru',
        summary: `Menambahkan draft event baru "${created.title}".`,
      });
      selectedEventId = created.id;
      showToast('Event baru ditambahkan (status Draft). Silakan lengkapi & publikasikan.', 'info');
      scrollToMobileSection('.admin-split-editor');
    });

    dialog.querySelectorAll<HTMLElement>('[data-ev-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.evId;
        const delta = Number(btn.dataset.evMove || 0);
        const next = cloneState();
        const idx = next.events.findIndex((e) => e.id === id);
        const targetIdx = idx + delta;
        if (idx < 0 || targetIdx < 0 || targetIdx >= next.events.length) return;
        const [item] = next.events.splice(idx, 1);
        next.events.splice(targetIdx, 0, item);
        saveCmsState(next, {
          operator: session?.operatorName,
          module: 'Event',
          action: 'Urutkan Event',
          summary: `Memindahkan urutan "${item.title}" ke posisi #${targetIdx + 1}.`,
        });
        showToast('Urutan Berita dan Program Kegiatan diperbarui.', 'success');
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-ev-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.evDelete;
        const target = getCmsState().events.find((ev) => ev.id === id);
        if (!id || !target) return;
        pendingConfirm = {
          key: `del-ev-${id}`,
          label: `Hapus permanen event "${target.title}"?`,
          onConfirm: () => {
            const next = cloneState();
            next.events = next.events.filter((ev) => ev.id !== id);
            saveCmsState(next, {
              operator: session?.operatorName,
              module: 'Event',
              action: 'Hapus Event',
              summary: `Menghapus event "${target.title}".`,
            });
            selectedEventId = next.events[0]?.id ?? '';
            showToast('Event berhasil dihapus.', 'info');
          },
        };
        render();
      });
    });

    dialog.querySelector<HTMLInputElement>('[data-ev-upload-photo]')?.addEventListener('change', async (e) => {
      const file = (e.currentTarget as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const res = await saveCompressedAdminImage(file, 'landscape');
        const next = cloneState();
        const ev = next.events.find((item) => item.id === selectedEventId);
        if (!ev) return;
        ev.photo = res.refUrl;
        saveCmsState(next, {
          operator: session?.operatorName,
          module: 'Event',
          action: 'Unggah Foto Event',
          summary: `Foto "${ev.title}" dikompres ${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)}.`,
        });
        uploadStatNote = `Terkompres: ${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)} (${res.width}×${res.height}px)`;
        showToast('Foto event diperbarui pada Section 2 & pop-up detail.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memproses foto event.', 'error');
      }
    });

    dialog.querySelector<HTMLFormElement>('[data-ev-save-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const next = cloneState();
      const ev = next.events.find((item) => item.id === selectedEventId);
      if (!ev) return;

      ev.status = fd.get('status') === 'draft' ? 'draft' : 'published';
      ev.category = String(fd.get('category') || ev.category).trim();
      ev.title = String(fd.get('title') || ev.title).trim();
      ev.modalKicker = String(fd.get('modalKicker') || ev.modalKicker).trim();
      ev.focusLine = String(fd.get('focusLine') || '').trim();
      ev.cardSummary = String(fd.get('cardSummary') || '').trim();
      ev.detailSummary = String(fd.get('detailSummary') || '').trim();
      ev.photoAlt = ev.title;
      ev.metrics = [0, 1, 2].map((idx) => ({
        value: String(fd.get(`metricVal_${idx}`) || '').trim(),
        label: String(fd.get(`metricLabel_${idx}`) || '').trim(),
      }));
      ev.details = [0, 1, 2]
        .map((idx) => ({
          label: String(fd.get(`detailLabel_${idx}`) || '').trim(),
          text: String(fd.get(`detailText_${idx}`) || '').trim(),
        }))
        .filter((d) => d.label || d.text);

      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Event',
        action: 'Simpan Event',
        summary: `Memperbarui "${ev.title}" (${ev.status === 'published' ? 'Tayang' : 'Draft'}).`,
      });
      showToast(`Program "${ev.title}" disimpan dan langsung diperbarui di halaman depan.`, 'success');
    });

    // Board bindings
    dialog.querySelector<HTMLFormElement>('[data-bd-summary-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const next = cloneState();
      const items: CmsBoardSummaryItem[] = next.boardSummary.map((orig, idx) => ({
        id: orig.id,
        label: String(fd.get(`sumLabel_${idx}`) || orig.label).trim(),
        value: String(fd.get(`sumVal_${idx}`) || orig.value).trim(),
        unit: String(fd.get(`sumUnit_${idx}`) || '').trim(),
      }));
      next.boardSummary = items;
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Pengurus',
        action: 'Perbarui Ringkasan Angka',
        summary: `Memperbarui 3 angka ringkasan Section 3 (${items.map((i) => `${i.label}: ${i.value}`).join(', ')}).`,
      });
      showToast('Ringkasan angka Section Kepengurusan diperbarui.', 'success');
    });

    dialog.querySelectorAll<HTMLElement>('[data-bd-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedBoardId = btn.dataset.bdSelect || selectedBoardId;
        uploadStatNote = '';
        render();
        scrollToMobileSection('.admin-split-editor');
      });
    });

    dialog.querySelector('[data-bd-add]')?.addEventListener('click', () => {
      const next = cloneState();
      const created = createEmptyBoardMember();
      next.boardMembers.push(created);
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Pengurus',
        action: 'Tambah Pengurus Baru',
        summary: `Menambahkan draft profil pengurus "${created.cardName}".`,
      });
      selectedBoardId = created.id;
      showToast('Profil pengurus baru ditambahkan (Draft). Lengkapi data & publikasikan.', 'info');
      scrollToMobileSection('.admin-split-editor');
    });

    dialog.querySelectorAll<HTMLElement>('[data-bd-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.bdId;
        const delta = Number(btn.dataset.bdMove || 0);
        const next = cloneState();
        const idx = next.boardMembers.findIndex((m) => m.id === id);
        const targetIdx = idx + delta;
        if (idx < 0 || targetIdx < 0 || targetIdx >= next.boardMembers.length) return;
        const [item] = next.boardMembers.splice(idx, 1);
        next.boardMembers.splice(targetIdx, 0, item);
        saveCmsState(next, {
          operator: session?.operatorName,
          module: 'Pengurus',
          action: 'Urutkan Pengurus',
          summary: `Memindahkan urutan "${item.cardName}" ke posisi #${targetIdx + 1}.`,
        });
        showToast('Urutan kartu pengurus 2027 diperbarui.', 'success');
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-bd-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.bdDelete;
        const target = getCmsState().boardMembers.find((m) => m.id === id);
        if (!id || !target) return;
        pendingConfirm = {
          key: `del-bd-${id}`,
          label: `Hapus permanen profil pengurus "${target.name}"?`,
          onConfirm: () => {
            const next = cloneState();
            next.boardMembers = next.boardMembers.filter((m) => m.id !== id);
            saveCmsState(next, {
              operator: session?.operatorName,
              module: 'Pengurus',
              action: 'Hapus Pengurus',
              summary: `Menghapus profil pengurus "${target.name}".`,
            });
            selectedBoardId = next.boardMembers[0]?.id ?? '';
            showToast('Profil pengurus dihapus.', 'info');
          },
        };
        render();
      });
    });

    dialog.querySelector<HTMLInputElement>('[data-bd-upload-photo]')?.addEventListener('change', async (e) => {
      const file = (e.currentTarget as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const res = await saveCompressedAdminImage(file, 'portrait');
        const next = cloneState();
        const member = next.boardMembers.find((m) => m.id === selectedBoardId);
        if (!member) return;
        member.photo = res.refUrl;
        saveCmsState(next, {
          operator: session?.operatorName,
          module: 'Pengurus',
          action: 'Unggah Foto Pengurus',
          summary: `Foto "${member.cardName}" dikompres ${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)}.`,
        });
        uploadStatNote = `Terkompres: ${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)} (${res.width}×${res.height}px)`;
        showToast('Foto pengurus diperbarui di kartu 3D & pop-up detail.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memproses foto pengurus.', 'error');
      }
    });

    dialog.querySelector<HTMLFormElement>('[data-bd-save-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const next = cloneState();
      const member = next.boardMembers.find((m) => m.id === selectedBoardId);
      if (!member) return;

      const divKey = String(fd.get('divisionKey') || 'budaya') as CmsBoardMember['divisionKey'];
      member.status = fd.get('status') === 'draft' ? 'draft' : 'published';
      member.divisionKey = divKey;
      member.isCore = divKey === 'inti';
      member.name = String(fd.get('name') || member.name).trim();
      member.cardName = String(fd.get('cardName') || member.cardName).trim();
      member.cardRolePrefix = String(fd.get('cardRolePrefix') || member.cardRolePrefix).trim();
      member.cardRoleCopy = String(fd.get('cardRoleCopy') || '').trim();
      member.role = String(fd.get('role') || member.role).trim();
      member.division = String(fd.get('division') || member.division).trim();
      member.origin = String(fd.get('origin') || '').trim();
      member.cohortYear = String(fd.get('cohortYear') || '').trim();
      member.badge = String(fd.get('badge') || '').trim();
      member.summary = String(fd.get('summary') || '').trim();
      member.photoAlt = `${member.name} — ${member.role}`;
      member.tasks = [0, 1, 2].map((i) => String(fd.get(`task_${i}`) || '').trim()).filter(Boolean);

      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Pengurus',
        action: 'Simpan Pengurus',
        summary: `Memperbarui profil "${member.name}" (${member.status === 'published' ? 'Tayang' : 'Draft'}).`,
      });
      showToast(`Profil ${member.cardName} tersimpan dan kartu 3D langsung diperbarui.`, 'success');
    });

    // Visi Misi & Backup bindings
    dialog.querySelector<HTMLFormElement>('[data-vm-save-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const next = cloneState();
      const vm = next.visimisi;

      vm.eyebrow = String(fd.get('eyebrow') || vm.eyebrow).trim();
      vm.sealLabel = String(fd.get('sealLabel') || vm.sealLabel).trim();
      vm.chips = String(fd.get('chips') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      vm.visiQuoteLead = String(fd.get('visiQuoteLead') || vm.visiQuoteLead).trim();
      vm.visiQuoteMuted = String(fd.get('visiQuoteMuted') || '').trim();
      vm.visiDesc = String(fd.get('visiDesc') || '').trim();

      const readGroup = (prefix: string, orig: CmsMisiEntry[]): CmsMisiEntry[] =>
        orig.map((item, idx) => ({
          indexLabel: String(fd.get(`${prefix}_idx_${idx}`) || item.indexLabel).trim(),
          title: String(fd.get(`${prefix}_title_${idx}`) || item.title).trim(),
          description: String(fd.get(`${prefix}_desc_${idx}`) || item.description).trim(),
        }));

      vm.misiItems = readGroup('misi', vm.misiItems);
      vm.sebaranItems = readGroup('sebaran', vm.sebaranItems);
      vm.komitmenItems = readGroup('komitmen', vm.komitmenItems);

      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Visi & Misi',
        action: 'Simpan Visi & Misi',
        summary: 'Memperbarui kutipan Visi, 4 Misi Strategis, Sebaran 19 Kab/Kota, & Sapta Pesona.',
      });
      showToast('Data Visi & Misi berhasil disimpan dan diterapkan.', 'success');
    });

    dialog.querySelector<HTMLInputElement>('[data-action-import-json]')?.addEventListener('change', async (e) => {
      const file = (e.currentTarget as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const res = importCmsBackupJson(text, session?.operatorName);
        if (!res.ok) {
          showToast(res.error, 'error');
          return;
        }
        selectedYear = res.state.catalogYears[0]?.year ?? '2024';
        selectedEventId = res.state.events[0]?.id ?? '';
        selectedBoardId = res.state.boardMembers[0]?.id ?? '';
        showToast('Backup JSON berhasil diimpor dan diterapkan ke seluruh situs.', 'success');
      } catch {
        showToast('Gagal membaca file JSON.', 'error');
      }
    });

    dialog.querySelectorAll<HTMLElement>('[data-reset-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.resetMod as 'catalog' | 'events' | 'board' | 'visimisi' | 'all';
        const labelMap: Record<typeof mod, string> = {
          catalog: 'Pulihkan Katalog Uda & Uni ke data bawaan? Foto upload pada katalog akan dilepas dari slot.',
          events: 'Pulihkan seluruh Berita dan Program Kegiatan ke data bawaan?',
          board: 'Pulihkan Struktur Kepengurusan 2027 ke data bawaan?',
          visimisi: 'Pulihkan Visi & Misi ke teks bawaan?',
          all: 'Pulihkan SELURUH data portal ke setelan bawaan awal?',
        };
        pendingConfirm = {
          key: `reset-${mod}`,
          label: labelMap[mod],
          onConfirm: () => {
            const updated = resetCmsModule(mod, session?.operatorName);
            selectedYear = updated.catalogYears[0]?.year ?? '2024';
            selectedEventId = updated.events[0]?.id ?? '';
            selectedBoardId = updated.boardMembers[0]?.id ?? '';
            showToast('Data berhasil dipulihkan ke bawaan.', 'info');
          },
        };
        render();
      });
    });

    dialog.querySelector<HTMLFormElement>('[data-passcode-form]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const currentPass = String(fd.get('currentPasscode') || '');
      const newPass = String(fd.get('newPasscode') || '');
      const res = await updateAdminPasscode(currentPass, newPass);
      if (!res.ok) {
        showToast(res.error || 'Gagal mengganti sandi.', 'error');
        return;
      }
      showToast('Kata sandi admin lokal berhasil diperbarui.', 'success');
    });
  };
}
