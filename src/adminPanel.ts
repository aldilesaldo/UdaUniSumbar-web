import {
  AdminSession,
  AmbassadorBio,
  CmsBoardMember,
  CmsBoardSummaryItem,
  CmsEventItem,
  CmsMisiEntry,
  CmsRegistration2027,
  CmsState,
  RegistrationStatus,
  RoleFilter,
  SUMBAR_REGIONS,
  clearAdminSession,
  createEmptyBoardMember,
  createEmptyCatalogParticipant,
  createEmptyEvent,
  createTemplateYearLineup,
  deleteRegistration2027,
  exportCatalogCsv,
  exportCatalogYearPackageJson,
  exportCmsBackupJson,
  exportRegistrations2027Csv,
  extractRegistrationSequence,
  formatBytesCompact,
  getAdminSession,
  getCmsState,
  getDefaultPasscodeValue,
  getDraftPreviewYear,
  hydrateCmsMediaUrls,
  importCmsBackupJson,
  isUsingDefaultPasscodeHint,
  normalizeTwoDigitFinalistNumber,
  publishCatalogYear,
  reorderCatalogParticipant,
  resetCmsModule,
  resolveCmsDocumentUrl,
  resolveCmsImageUrl,
  reviewRegistration2027,
  saveCmsState,
  saveCompressedAdminImage,
  setAdminSession,
  setDraftPreviewYear,
  sortCatalogByFinalistNumber,
  subscribeCmsChange,
  toTitleCaseLive,
  toTitleCaseWords,
  updateAdminPasscode,
  verifyAdminPasscode,
} from './cmsStore';

type AdminTab = 'overview' | 'registrations' | 'catalog' | 'events' | 'board' | 'visimisi';
type SettingsSubTab = 'visimisi' | 'backup';

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

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
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

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return 'UU';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getRegStatusLabel(status: RegistrationStatus): string {
  if (status === 'approved') return 'Disahkan';
  if (status === 'revision') return 'Revisi';
  if (status === 'rejected') return 'Ditolak';
  return 'Menunggu';
}

function getRegStatusTone(status: RegistrationStatus): string {
  if (status === 'approved') return 'is-approved';
  if (status === 'revision') return 'is-revision';
  if (status === 'rejected') return 'is-rejected';
  return 'is-pending';
}

function polarToCartesian(cx: number, cy: number, rx: number, ry: number, angleDeg: number): {x: number; y: number} {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + rx * Math.cos(rad),
    y: cy + ry * Math.sin(rad),
  };
}

function buildEllipticalArcSlice(
  cx: number,
  cy: number,
  rxOut: number,
  ryOut: number,
  rxIn: number,
  ryIn: number,
  startDeg: number,
  endDeg: number,
): string {
  const span = Math.max(0.5, endDeg - startDeg);
  const safeEnd = span >= 359.8 ? startDeg + 359.6 : endDeg;
  const largeArc = safeEnd - startDeg > 180 ? 1 : 0;

  const p1 = polarToCartesian(cx, cy, rxOut, ryOut, startDeg);
  const p2 = polarToCartesian(cx, cy, rxOut, ryOut, safeEnd);
  const p3 = polarToCartesian(cx, cy, rxIn, ryIn, safeEnd);
  const p4 = polarToCartesian(cx, cy, rxIn, ryIn, startDeg);

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rxOut.toFixed(2)} ${ryOut.toFixed(2)} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rxIn.toFixed(2)} ${ryIn.toFixed(2)} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export function setupAdminPanel(): void {
  const dialog = document.getElementById('admin-cms-dialog') as HTMLDialogElement | null;
  if (!dialog) return;

  let activeTab: AdminTab = 'overview';
  let settingsSubTab: SettingsSubTab = 'visimisi';
  let session: AdminSession | null = getAdminSession();
  let selectedYear = getCmsState().catalogYears[0]?.year ?? '2024';
  let selectedRole: RoleFilter = 'uda';
  let selectedSlotIndex = 0;
  let catalogQuery = '';
  let newYearMode = false;
  let selectedEventId = getCmsState().events[0]?.id ?? '';
  let selectedBoardId = getCmsState().boardMembers[0]?.id ?? '';
  let selectedRegId = getCmsState().registrations2027[0]?.id ?? '';
  let regFilterStatus: 'all' | RegistrationStatus = 'all';
  let regFilterRole: 'all' | RoleFilter = 'all';
  let regFilterRegion = 'all';
  let regQuery = '';
  let previewRegDocOpen = false;
  let zoomRegPhoto: {src: string; title: string} | null = null;
  let globalSearchQuery = '';
  let overviewActivityFilter: 'all' | 'registrations' | 'logs' = 'all';
  let overviewSortOrder: 'newest' | 'oldest' = 'newest';
  let overviewBarFocusIdx = 0;
  let openRowMenuId: string | null = null;
  let notifPopoverOpen = false;
  let toastMessage = '';
  let toastType: 'success' | 'error' | 'info' = 'success';
  let toastTimer = 0;
  let pendingConfirm: {
    key: string;
    label: string;
    onConfirm: () => void;
  } | null = null;
  let uploadStatNote = '';
  let isRendering = false;
  let lastRenderedTab: AdminTab | null = null;

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    toastMessage = msg;
    toastType = type;
    window.clearTimeout(toastTimer);
    render();
    toastTimer = window.setTimeout(() => {
      toastMessage = '';
      const bar = dialog.querySelector<HTMLElement>('[data-admin-toast]');
      if (bar) bar.hidden = true;
    }, 3800);
  };

  let draftBannerEl: HTMLElement | null = null;

  const syncDraftPreviewBanner = () => {
    const previewYr = getDraftPreviewYear();
    if (!previewYr || dialog.open) {
      if (draftBannerEl) {
        draftBannerEl.remove();
        draftBannerEl = null;
      }
      return;
    }

    if (!draftBannerEl) {
      draftBannerEl = document.createElement('div');
      draftBannerEl.className = 'admin-draft-preview-bar';
      draftBannerEl.setAttribute('role', 'status');
      document.body.appendChild(draftBannerEl);
    }

    draftBannerEl.innerHTML = `
      <div class="admin-draft-preview-copy">
        <span class="admin-draft-preview-dot" aria-hidden="true"></span>
        <span><strong>Mode Pratinjau Draft ${escapeHtml(previewYr)}</strong> — Tampilan sementara di Hero Section (belum ditayangkan).</span>
      </div>
      <div class="admin-draft-preview-actions">
        <button type="button" class="admin-btn admin-btn--soft" data-preview-back>Kembali ke Admin</button>
        <button type="button" class="admin-btn admin-btn--primary" data-preview-publish>Tayangkan ${escapeHtml(previewYr)}</button>
        <button type="button" class="admin-btn admin-btn--ghost" data-preview-exit>Keluar</button>
      </div>
    `;

    draftBannerEl.querySelector('[data-preview-back]')?.addEventListener('click', () => {
      activeTab = 'catalog';
      selectedYear = previewYr;
      setDraftPreviewYear(null);
      openAdminDialog();
    });

    draftBannerEl.querySelector('[data-preview-publish]')?.addEventListener('click', () => {
      const res = publishCatalogYear(previewYr, session?.operatorName);
      if (!res.ok) {
        activeTab = 'catalog';
        selectedYear = previewYr;
        setDraftPreviewYear(null);
        openAdminDialog();
        showToast(res.error, 'error');
        return;
      }
      syncDraftPreviewBanner();
    });

    draftBannerEl.querySelector('[data-preview-exit]')?.addEventListener('click', () => {
      setDraftPreviewYear(null);
      syncDraftPreviewBanner();
    });
  };

  const openAdminDialog = () => {
    session = getAdminSession();
    pendingConfirm = null;
    uploadStatNote = '';
    zoomRegPhoto = null;
    openRowMenuId = null;
    notifPopoverOpen = false;
    if (!dialog.open) {
      dialog.showModal();
    }
    syncDraftPreviewBanner();
    render();
    void hydrateCmsMediaUrls().then(() => {
      if (dialog.open && session) {
        const focused = dialog.querySelector(':focus');
        if (!focused || activeTab === 'registrations') {
          render();
        }
      }
    });
  };

  dialog.addEventListener('close', () => {
    syncDraftPreviewBanner();
  });

  // Hidden Admin entry: 10 consecutive clicks on website logo
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

  const renderLoginScreen = () => {
    const useDefaultHint = isUsingDefaultPasscodeHint();
    dialog.innerHTML = `
      <div class="admin-auth-backdrop">
        <div class="admin-auth-card">
          <button type="button" class="admin-icon-close" data-admin-close aria-label="Tutup">×</button>
          <div class="admin-auth-logo">
            <img src="/assets/aistudio/logo_uda_uni_2027_a45f5678.png" width="44" height="44" alt="Uda &amp; Uni Sumbar">
            <div>
              <strong>Uda &amp; Uni</strong>
              <span>Portal Admin</span>
            </div>
          </div>
          <h2 class="admin-auth-title">Masuk Pengelola</h2>

          <form class="admin-auth-form" data-admin-login-form>
            <div class="admin-field">
              <label for="admin-operator-name">Nama Operator</label>
              <input id="admin-operator-name" name="operator" type="text" value="Admin Sekretariat" required autocomplete="name">
            </div>
            <div class="admin-field">
              <label for="admin-passcode-input">Kata Sandi</label>
              <input id="admin-passcode-input" name="passcode" type="password" placeholder="Masukkan kata sandi" required autocomplete="current-password">
              ${
                useDefaultHint
                  ? `<small class="admin-field-hint">Sandi awal: <code>${escapeHtml(getDefaultPasscodeValue())}</code></small>`
                  : ''
              }
            </div>
            <p class="admin-auth-error" data-admin-auth-error hidden></p>
            <div class="admin-auth-actions">
              <button type="submit" class="admin-btn admin-btn--dark admin-btn--full">Masuk Dashboard</button>
              <button type="button" class="admin-btn admin-btn--ghost admin-btn--full" data-admin-close>Batal</button>
            </div>
          </form>
        </div>
      </div>
    `;

    dialog.querySelectorAll('[data-admin-close]').forEach((btn) => {
      btn.addEventListener('click', () => dialog.close());
    });

    const form = dialog.querySelector<HTMLFormElement>('[data-admin-login-form]');
    const errEl = dialog.querySelector<HTMLElement>('[data-admin-auth-error]');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const operator = String(fd.get('operator') || 'Admin').trim();
      const passcode = String(fd.get('passcode') || '');
      const ok = await verifyAdminPasscode(passcode);
      if (!ok) {
        if (errEl) {
          errEl.textContent = 'Kata sandi tidak sesuai.';
          errEl.hidden = false;
        }
        return;
      }
      session = setAdminSession(operator);
      showToast(`Selamat datang, ${session.operatorName}.`, 'success');
      void hydrateCmsMediaUrls().then(() => {
        if (dialog.open && session) render();
      });
    });
  };

  /* ============================================================================
     3D Chart Builders — Harmonized with Brand Palette (Maroon, Gold, Obsidian)
     ============================================================================ */

  const renderOverviewLineChart = (state: CmsState): string => {
    const regs = state.registrations2027 || [];
    const sortedYears = [...state.catalogYears].sort((a, b) => Number(a.year) - Number(b.year));

    type ChartPoint = {
      label: string;
      uda: number;
      uni: number;
      detail: string;
    };

    const groups: ChartPoint[] = [];
    for (const yr of sortedYears.slice(-3)) {
      const udaFilled = yr.uda.filter((p) => Boolean(p.photo?.thumb || p.fullName.trim())).length;
      const uniFilled = yr.uni.filter((p) => Boolean(p.photo?.thumb || p.fullName.trim())).length;
      groups.push({
        label: yr.year,
        uda: udaFilled,
        uni: uniFilled,
        detail: `Angkatan ${yr.year}`,
      });
    }

    const countRegsBy = (pred: (r: CmsRegistration2027) => boolean) => ({
      uda: regs.filter((r) => r.role === 'uda' && pred(r)).length,
      uni: regs.filter((r) => r.role === 'uni' && pred(r)).length,
    });

    const allReg = countRegsBy(() => true);
    const pendingReg = countRegsBy((r) => r.status === 'pending');
    const revisionReg = countRegsBy((r) => r.status === 'revision');
    const approvedReg = countRegsBy((r) => r.status === 'approved');

    groups.push(
      {label: 'Masuk', uda: allReg.uda, uni: allReg.uni, detail: 'Total Pendaftar 2027'},
      {label: 'Antrean', uda: pendingReg.uda, uni: pendingReg.uni, detail: 'Menunggu Verifikasi'},
      {label: 'Revisi', uda: revisionReg.uda, uni: revisionReg.uni, detail: 'Perlu Perbaikan'},
      {label: 'Sah', uda: approvedReg.uda, uni: approvedReg.uni, detail: 'Disahkan 2027'},
    );

    const visibleGroups = groups.slice(0, 6);
    if (overviewBarFocusIdx >= visibleGroups.length) overviewBarFocusIdx = 0;

    const rawMax = Math.max(4, ...visibleGroups.map((g) => Math.max(g.uda, g.uni)));
    const step = rawMax <= 8 ? 2 : rawMax <= 20 ? 5 : Math.ceil(rawMax / 4 / 5) * 5;
    const yMax = Math.ceil(rawMax / step) * step;

    const svgW = 540;
    const svgH = 248;
    const padL = 38;
    const padR = 24;
    const padT = 46;
    const padB = 36;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;
    const baseY = padT + plotH;

    const gridTicks = [0, 1, 2, 3, 4].map((i) => Math.round((yMax / 4) * i));
    const count = visibleGroups.length;
    const stepX = count > 1 ? plotW / (count - 1) : 0;
    const colHitW = count > 1 ? Math.min(76, stepX) : plotW;

    const getX = (idx: number) => (count > 1 ? padL + stepX * idx : padL + plotW / 2);
    const getY = (val: number) => baseY - (yMax > 0 ? (val / yMax) * plotH : 0);

    const udaCoords = visibleGroups.map((g, idx) => ({x: getX(idx), y: getY(g.uda), val: g.uda}));
    const uniCoords = visibleGroups.map((g, idx) => ({x: getX(idx), y: getY(g.uni), val: g.uni}));

    const buildSmoothPath = (pts: Array<{x: number; y: number}>): string => {
      if (pts.length === 0) return '';
      if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const midX = (p0.x + p1.x) / 2;
        d += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }
      return d;
    };

    const buildAreaPath = (pts: Array<{x: number; y: number}>): string => {
      if (pts.length < 2) return '';
      const line = buildSmoothPath(pts);
      const last = pts[pts.length - 1];
      const first = pts[0];
      return `${line} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
    };

    const udaLinePath = buildSmoothPath(udaCoords);
    const uniLinePath = buildSmoothPath(uniCoords);
    const udaAreaPath = buildAreaPath(udaCoords);
    const uniAreaPath = buildAreaPath(uniCoords);

    const focusedGroup = visibleGroups[overviewBarFocusIdx] || visibleGroups[0];
    const focusX = getX(overviewBarFocusIdx);
    const focusTopY = Math.min(getY(focusedGroup.uda), getY(focusedGroup.uni));
    const tooltipW = 128;
    const tooltipH = 26;
    const tooltipX = Math.max(padL, Math.min(svgW - padR - tooltipW, focusX - tooltipW / 2));
    const tooltipY = Math.max(4, focusTopY - tooltipH - 14);
    const pointerX = Math.max(tooltipX + 14, Math.min(tooltipX + tooltipW - 14, focusX));

    return `
      <div class="admin-card admin-chart-card">
        <div class="admin-card-head">
          <div>
            <h3>Statistik</h3>
          </div>
          <div class="admin-legend">
            <span class="admin-legend-item"><i class="is-uda-black"></i>Uda</span>
            <span class="admin-legend-item"><i class="is-uni-red"></i>Uni</span>
          </div>
        </div>
        <div class="admin-3d-chart-wrap">
          <svg viewBox="0 0 ${svgW} ${svgH}" class="admin-3d-svg admin-line-svg" role="img" aria-label="Grafik Garis Statistik Uda (Hitam) dan Uni (Merah)">
            <defs>
              <linearGradient id="lineUdaArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#161412" stop-opacity="0.11"/>
                <stop offset="100%" stop-color="#161412" stop-opacity="0"/>
              </linearGradient>
              <linearGradient id="lineUniArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#c81e2b" stop-opacity="0.14"/>
                <stop offset="100%" stop-color="#c81e2b" stop-opacity="0"/>
              </linearGradient>
              <filter id="lineDepthShadow" x="-10%" y="-20%" width="120%" height="160%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#161412" flood-opacity="0.14"/>
              </filter>
            </defs>

            ${gridTicks
              .map((val) => {
                const y = baseY - (val / yMax) * plotH;
                return `
                  <line x1="${padL}" y1="${y.toFixed(1)}" x2="${svgW - padR}" y2="${y.toFixed(1)}" stroke="#ececef" stroke-width="1" stroke-dasharray="${val === 0 ? '0' : '3 4'}"/>
                  <text x="${padL - 9}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#8b8a90" font-size="10.5" font-weight="500" class="is-tabular">${val}</text>
                `;
              })
              .join('')}

            ${udaAreaPath ? `<path d="${udaAreaPath}" fill="url(#lineUdaArea)"/>` : ''}
            ${uniAreaPath ? `<path d="${uniAreaPath}" fill="url(#lineUniArea)"/>` : ''}

            <line
              x1="${focusX.toFixed(1)}"
              y1="${padT}"
              x2="${focusX.toFixed(1)}"
              y2="${baseY}"
              stroke="rgba(22,20,18,0.16)"
              stroke-width="1.2"
              stroke-dasharray="3 3"
            />

            ${
              udaLinePath
                ? `<path d="${udaLinePath}" fill="none" stroke="#161412" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#lineDepthShadow)"/>`
                : ''
            }
            ${
              uniLinePath
                ? `<path d="${uniLinePath}" fill="none" stroke="#c81e2b" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#lineDepthShadow)"/>`
                : ''
            }

            ${visibleGroups
              .map((g, idx) => {
                const cx = getX(idx);
                const yUda = getY(g.uda);
                const yUni = getY(g.uni);
                const isFocused = idx === overviewBarFocusIdx;
                const overlap = Math.abs(yUda - yUni) < 4;
                const udaDotY = overlap ? yUda - 2.5 : yUda;
                const uniDotY = overlap ? yUni + 2.5 : yUni;

                return `
                  <g class="admin-line-col ${isFocused ? 'is-focused' : ''}" data-bar-group="${idx}" role="button" tabindex="0" aria-label="${escapeHtml(g.detail)}: Uda ${g.uda}, Uni ${g.uni}">
                    <rect
                      x="${(cx - colHitW / 2).toFixed(1)}"
                      y="${padT - 8}"
                      width="${colHitW.toFixed(1)}"
                      height="${plotH + 34}"
                      rx="10"
                      fill="${isFocused ? 'rgba(22,20,18,0.03)' : 'transparent'}"
                    />
                    ${
                      isFocused
                        ? `<circle cx="${cx.toFixed(1)}" cy="${udaDotY.toFixed(1)}" r="9" fill="rgba(22,20,18,0.12)"/>`
                        : ''
                    }
                    ${
                      isFocused
                        ? `<circle cx="${cx.toFixed(1)}" cy="${uniDotY.toFixed(1)}" r="9" fill="rgba(200,30,43,0.14)"/>`
                        : ''
                    }
                    <circle
                      cx="${cx.toFixed(1)}"
                      cy="${udaDotY.toFixed(1)}"
                      r="${isFocused ? '5' : '3.8'}"
                      fill="#ffffff"
                      stroke="#161412"
                      stroke-width="${isFocused ? '2.8' : '2.2'}"
                    />
                    <circle
                      cx="${cx.toFixed(1)}"
                      cy="${uniDotY.toFixed(1)}"
                      r="${isFocused ? '5' : '3.8'}"
                      fill="#ffffff"
                      stroke="#c81e2b"
                      stroke-width="${isFocused ? '2.8' : '2.2'}"
                    />
                    <text
                      x="${cx.toFixed(1)}"
                      y="${(baseY + 22).toFixed(1)}"
                      text-anchor="middle"
                      fill="${isFocused ? '#161412' : '#7b7a80'}"
                      font-size="11"
                      font-weight="${isFocused ? '700' : '500'}"
                    >${escapeHtml(g.label)}</text>
                  </g>
                `;
              })
              .join('')}

            <g class="admin-3d-tooltip">
              <rect x="${tooltipX.toFixed(1)}" y="${tooltipY.toFixed(1)}" width="${tooltipW}" height="${tooltipH}" rx="13" fill="#161412"/>
              <polygon points="${(pointerX - 5).toFixed(1)},${(tooltipY + tooltipH - 1).toFixed(1)} ${(pointerX + 5).toFixed(1)},${(tooltipY + tooltipH - 1).toFixed(1)} ${pointerX.toFixed(1)},${(tooltipY + tooltipH + 5).toFixed(1)}" fill="#161412"/>
              <text x="${(tooltipX + tooltipW / 2).toFixed(1)}" y="${(tooltipY + 16.5).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="600" class="is-tabular">
                Uda ${focusedGroup.uda} · Uni ${focusedGroup.uni}
              </text>
            </g>
          </svg>
        </div>
      </div>
    `;
  };

  const renderRegistrations3dDonutCard = (regs: CmsRegistration2027[]): string => {
    const total = regs.length;
    const countPending = regs.filter((r) => r.status === 'pending').length;
    const countRevision = regs.filter((r) => r.status === 'revision').length;
    const countApproved = regs.filter((r) => r.status === 'approved').length;
    const countRejected = regs.filter((r) => r.status === 'rejected').length;
    const udaCount = regs.filter((r) => r.role === 'uda').length;
    const uniCount = regs.filter((r) => r.role === 'uni').length;
    const uniqueRegions = new Set(regs.map((r) => r.region)).size;

    const segments: Array<{
      key: RegistrationStatus;
      label: string;
      count: number;
      topColor: string;
      depthColor: string;
      dotClass: string;
    }> = [
      {key: 'approved', label: 'Disahkan', count: countApproved, topColor: '#161412', depthColor: '#050404', dotClass: 'is-obsidian'},
      {key: 'pending', label: 'Menunggu', count: countPending, topColor: '#c89a3e', depthColor: '#8d661a', dotClass: 'is-gold'},
      {key: 'revision', label: 'Revisi', count: countRevision, topColor: '#8b1e24', depthColor: '#581014', dotClass: 'is-maroon'},
      {key: 'rejected', label: 'Ditolak', count: countRejected, topColor: '#b7b3ab', depthColor: '#7f7b73', dotClass: 'is-stone'},
    ];

    const cx = 110;
    const cy = 86;
    const rxOut = 76;
    const ryOut = 48;
    const rxIn = 44;
    const ryIn = 27;
    const extrudeDepth = 16;

    const nonZero = segments.filter((s) => s.count > 0);
    let cursorDeg = 0;
    const arcs =
      total > 0
        ? nonZero.map((seg) => {
            const sweep = (seg.count / total) * 360;
            const start = cursorDeg;
            const end = cursorDeg + sweep;
            cursorDeg = end;
            return {...seg, start, end};
          })
        : [
            {
              key: 'pending' as RegistrationStatus,
              label: 'Belum Ada Data',
              count: 0,
              topColor: '#e7e5e0',
              depthColor: '#cbc7bf',
              dotClass: 'is-stone',
              start: 0,
              end: 359.6,
            },
          ];

    return `
      <div class="admin-card admin-reg-3d-card">
        <div class="admin-reg-3d-visual">
          <svg viewBox="0 0 220 190" class="admin-3d-donut-svg" role="img" aria-label="Grafik 3D Status Pendaftar 2027">
            <ellipse cx="${cx}" cy="${cy + extrudeDepth + 14}" rx="${rxOut + 4}" ry="${ryOut - 8}" fill="rgba(22,20,18,0.075)"/>
            ${[extrudeDepth, extrudeDepth - 4, extrudeDepth - 8, extrudeDepth - 12]
              .map(
                (dy) => `
                  <g>
                    ${arcs
                      .map((arc) => {
                        const d = buildEllipticalArcSlice(cx, cy + dy, rxOut, ryOut, rxIn, ryIn, arc.start, arc.end);
                        return `<path d="${d}" fill="${arc.depthColor}"/>`;
                      })
                      .join('')}
                  </g>
                `,
              )
              .join('')}
            <g>
              ${arcs
                .map((arc) => {
                  const d = buildEllipticalArcSlice(cx, cy, rxOut, ryOut, rxIn, ryIn, arc.start, arc.end);
                  const isActive = regFilterStatus === arc.key;
                  return `
                    <path
                      d="${d}"
                      fill="${arc.topColor}"
                      stroke="#ffffff"
                      stroke-width="${arcs.length > 1 ? '1.8' : '0'}"
                      class="admin-3d-slice ${isActive ? 'is-active' : ''}"
                      ${total > 0 ? `data-reg-filter="${arc.key}" role="button" tabindex="0"` : ''}
                    />
                  `;
                })
                .join('')}
            </g>
            <text x="${cx}" y="${cy - 1}" text-anchor="middle" fill="#161412" font-size="22" font-weight="700">${total}</text>
            <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#7c7b82" font-size="10.5" font-weight="500">Total Berkas</text>
          </svg>
        </div>

        <div class="admin-reg-3d-bars">
          <div class="admin-reg-3d-head">
            <h3>Distribusi Pendaftar 2027</h3>
            <div class="admin-reg-3d-chips">
              <span><strong>${uniqueRegions}/19</strong> Kab/Kota</span>
              <span><strong>${udaCount}</strong> Uda · <strong>${uniCount}</strong> Uni</span>
            </div>
          </div>

          <div class="admin-3d-bar-list">
            ${segments
              .map((seg) => {
                const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
                const isActive = regFilterStatus === seg.key;
                return `
                  <button type="button" class="admin-3d-bar-row ${isActive ? 'is-active' : ''}" data-reg-filter="${seg.key}">
                    <span class="admin-3d-bar-label">
                      <i class="admin-dot ${seg.dotClass}"></i>
                      ${seg.label}
                    </span>
                    <span class="admin-3d-track">
                      <span class="admin-3d-fill ${seg.dotClass}" style="width:${Math.max(seg.count > 0 ? 8 : 0, pct)}%"></span>
                    </span>
                    <strong class="is-tabular">${seg.count}</strong>
                    <small class="is-tabular">${pct}%</small>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;
  };

  /* ============================================================================
     TAB 1: OVERVIEW (Jobgio-Inspired Clean Proportional Layout)
     ============================================================================ */

  const renderOverviewTab = (state: CmsState): string => {
    const totalProfiles = state.catalogYears.reduce((sum, yr) => sum + yr.uda.length + yr.uni.length, 0);
    const totalEvents = state.events.length;
    const totalBoard = state.boardMembers.length;
    const regs = state.registrations2027 || [];
    const pendingRegs = regs.filter((r) => r.status === 'pending' || r.status === 'revision');
    const pendingOnlyCount = regs.filter((r) => r.status === 'pending').length;

    type ActivityRow = {
      uid: string;
      title: string;
      sub: string;
      category: string;
      statusLabel: string;
      statusTone: string;
      timeIso: string;
      timeText: string;
      targetTab: AdminTab;
      regId?: string;
      avatarUrl?: string;
    };

    const activityRows: ActivityRow[] = [];
    if (overviewActivityFilter === 'all' || overviewActivityFilter === 'registrations') {
      for (const r of regs) {
        activityRows.push({
          uid: `reg-${r.id}`,
          title: r.fullName || r.shortName,
          sub: r.regCode,
          category: `${r.role === 'uda' ? 'Uda' : 'Uni'} · ${r.region}`,
          statusLabel: getRegStatusLabel(r.status),
          statusTone: getRegStatusTone(r.status),
          timeIso: r.createdAt,
          timeText: formatShortDate(r.createdAt),
          targetTab: 'registrations',
          regId: r.id,
          avatarUrl: r.photoRef ? resolveCmsImageUrl(r.photoRef) : undefined,
        });
      }
    }
    if (overviewActivityFilter === 'all' || overviewActivityFilter === 'logs') {
      for (const log of state.activityLog.slice(0, 12)) {
        const modMap: Record<string, AdminTab> = {
          Katalog: 'catalog',
          Event: 'events',
          Pengurus: 'board',
          'Visi & Misi': 'visimisi',
          'Pendaftar 2027': 'registrations',
        };
        activityRows.push({
          uid: `log-${log.id}`,
          title: log.action,
          sub: log.summary,
          category: log.module,
          statusLabel: 'Tercatat',
          statusTone: 'is-neutral',
          timeIso: log.timestamp,
          timeText: formatShortDate(log.timestamp),
          targetTab: modMap[log.module] || 'overview',
        });
      }
    }

    activityRows.sort((a, b) => {
      const ta = new Date(a.timeIso).getTime() || 0;
      const tb = new Date(b.timeIso).getTime() || 0;
      return overviewSortOrder === 'newest' ? tb - ta : ta - tb;
    });

    const visibleRows = activityRows.slice(0, 8);

    return `
      <div class="admin-overview-stack">
        <!-- Row 1: Quick Stats Strip (Matches Reference Top Row) -->
        <section class="admin-quick-stats-row">
          <div class="admin-quick-intro">
            <h2>Ringkasan</h2>
            <p>${state.catalogYears.length} angkatan aktif di portal.</p>
          </div>
          <div class="admin-stat-strip">
            <button type="button" class="admin-stat-tile" data-admin-tab="catalog">
              <span class="admin-stat-circle">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              <strong class="is-tabular">${totalProfiles}</strong>
              <span>Katalog Duta</span>
            </button>

            <button type="button" class="admin-stat-tile" data-admin-tab="registrations">
              <span class="admin-stat-circle">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
              <strong class="is-tabular">${regs.length}</strong>
              <span>Pendaftar 2027</span>
            </button>

            <button type="button" class="admin-stat-tile is-featured" data-admin-tab="registrations">
              <span class="admin-stat-circle is-accent">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
              </span>
              <strong class="is-tabular">${pendingOnlyCount}</strong>
              <span>Antrean Verifikasi</span>
              <span class="admin-stat-jump" aria-hidden="true">↗</span>
            </button>

            <button type="button" class="admin-stat-tile" data-admin-tab="events">
              <span class="admin-stat-circle">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              <strong class="is-tabular">${totalEvents}</strong>
              <span>Berita &amp; Agenda</span>
            </button>

            <button type="button" class="admin-stat-tile" data-admin-tab="board">
              <span class="admin-stat-circle">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.5 5.5 21l2-7.8L2 9h7z"/></svg>
              </span>
              <strong class="is-tabular">${totalBoard}</strong>
              <span>Pengurus 2027</span>
            </button>
          </div>
        </section>

        <!-- Row 2: Dual-Line Chart (Uda Hitam / Uni Merah) + Pending Verification Queue -->
        <section class="admin-overview-mid">
          ${renderOverviewLineChart(state)}

          <div class="admin-card admin-pending-card">
            <div class="admin-card-head">
              <h3>Menunggu Verifikasi</h3>
              <button type="button" class="admin-icon-circle-btn" data-admin-tab="registrations" title="Buka semua pendaftar" aria-label="Buka semua pendaftar">⋯</button>
            </div>

            ${
              pendingRegs.length === 0
                ? `<div class="admin-empty-compact">
                    <p>Tidak ada berkas yang menunggu verifikasi saat ini.</p>
                    <button type="button" class="admin-btn admin-btn--soft" data-admin-tab="registrations">Buka Pendaftar 2027</button>
                  </div>`
                : `<div class="admin-pending-list">
                    ${pendingRegs
                      .slice(0, 4)
                      .map((r) => {
                        const thumb = r.photoRef ? resolveCmsImageUrl(r.photoRef) : '';
                        return `
                          <button type="button" class="admin-pending-item" data-overview-open-row data-overview-target-tab="registrations" data-overview-reg-id="${escapeHtml(r.id)}">
                            <span class="admin-avatar-sm">
                              ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : escapeHtml(getInitials(r.fullName || r.shortName))}
                            </span>
                            <span class="admin-pending-meta">
                              <strong>${escapeHtml(r.fullName || r.shortName)}</strong>
                              <small>${escapeHtml(r.region)} · ${escapeHtml(formatShortDate(r.createdAt))}</small>
                            </span>
                            <span class="admin-status-tag ${getRegStatusTone(r.status)}">${getRegStatusLabel(r.status)}</span>
                          </button>
                        `;
                      })
                      .join('')}
                  </div>`
            }
          </div>
        </section>

        <!-- Row 3: Full-Width Clean Table (Matches Reference Bottom Card) -->
        <section class="admin-card admin-table-card">
          <div class="admin-card-head">
            <h3>Aktivitas Terbaru</h3>
            <div class="admin-table-controls">
              <select class="admin-select-pill" data-overview-filter aria-label="Filter aktivitas">
                <option value="all" ${overviewActivityFilter === 'all' ? 'selected' : ''}>Semua</option>
                <option value="registrations" ${overviewActivityFilter === 'registrations' ? 'selected' : ''}>Pendaftar 2027</option>
                <option value="logs" ${overviewActivityFilter === 'logs' ? 'selected' : ''}>Riwayat CMS</option>
              </select>
              <button type="button" class="admin-btn admin-btn--soft" data-overview-sort>
                ${overviewSortOrder === 'newest' ? 'Terbaru' : 'Terlama'}
              </button>
              <button type="button" class="admin-btn admin-btn--dark" data-action="export-reg-csv">
                Ekspor CSV
              </button>
            </div>
          </div>

          ${
            visibleRows.length === 0
              ? `<div class="admin-empty-compact"><p>Belum ada aktivitas tercatat.</p></div>`
              : `<div class="admin-clean-table">
                  <div class="admin-clean-thead">
                    <span>Nama / Aksi</span>
                    <span>Kategori</span>
                    <span>Status</span>
                    <span>Waktu</span>
                    <span></span>
                  </div>
                  <div class="admin-clean-tbody">
                    ${visibleRows
                      .map((row) => {
                        const isMenuOpen = openRowMenuId === row.uid;
                        return `
                          <div class="admin-clean-row">
                            <div class="admin-row-primary">
                              <span class="admin-avatar-xs">
                                ${row.avatarUrl ? `<img src="${escapeHtml(row.avatarUrl)}" alt="">` : escapeHtml(getInitials(row.title))}
                              </span>
                              <div class="admin-row-text">
                                <strong>${escapeHtml(row.title)}</strong>
                                <small>${escapeHtml(row.sub)}</small>
                              </div>
                            </div>
                            <span class="admin-row-col">${escapeHtml(row.category)}</span>
                            <span class="admin-row-col"><span class="admin-status-tag ${row.statusTone}">${escapeHtml(row.statusLabel)}</span></span>
                            <span class="admin-row-col admin-row-time is-tabular">${escapeHtml(row.timeText)}</span>
                            <div class="admin-row-actions">
                              <button type="button" class="admin-row-dots" data-overview-dots="${escapeHtml(row.uid)}" aria-label="Aksi baris">⋯</button>
                              ${
                                isMenuOpen
                                  ? `<div class="admin-popover-menu">
                                      <button type="button" data-overview-open-row data-overview-target-tab="${row.targetTab}" ${row.regId ? `data-overview-reg-id="${escapeHtml(row.regId)}"` : ''}>Buka Detail</button>
                                      <button type="button" data-overview-close-menu>Tutup</button>
                                    </div>`
                                  : ''
                              }
                            </div>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                </div>`
          }
        </section>
      </div>
    `;
  };

  /* ============================================================================
     TAB 2: REGISTRATIONS 2027 (Clean 3D Donut + Proportional Master-Detail)
     ============================================================================ */

  const renderRegistrationsTab = (state: CmsState): string => {
    const regs = state.registrations2027 || [];
    const countPending = regs.filter((r) => r.status === 'pending').length;
    const countRevision = regs.filter((r) => r.status === 'revision').length;
    const countApproved = regs.filter((r) => r.status === 'approved').length;
    const countRejected = regs.filter((r) => r.status === 'rejected').length;

    const q = regQuery.trim().toLowerCase();
    const filtered = regs.filter((r) => {
      if (regFilterStatus !== 'all' && r.status !== regFilterStatus) return false;
      if (regFilterRole !== 'all' && r.role !== regFilterRole) return false;
      if (regFilterRegion !== 'all' && r.region !== regFilterRegion) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.shortName.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.regCode.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q)
      );
    });

    const selected = filtered.find((r) => r.id === selectedRegId) ?? filtered[0] ?? null;
    if (selected) selectedRegId = selected.id;

    const seqNum = selected ? extractRegistrationSequence(selected.regCode) : 1;
    const suggestedFinalistNo = selected
      ? normalizeTwoDigitFinalistNumber(selected.finalistNumber || String(seqNum ?? 1))
      : '';

    const photoItems = selected
      ? [
          {label: 'Potret Utama', url: selected.photoRef ? resolveCmsImageUrl(selected.photoRef) : ''},
          {label: 'Busana Adat', url: selected.photoAdatRef ? resolveCmsImageUrl(selected.photoAdatRef) : ''},
          {label: 'Kebesaran', url: selected.photoKebesaranRef ? resolveCmsImageUrl(selected.photoKebesaranRef) : ''},
          ...(selected.extraPhotos || []).map((ep) => ({
            label: ep.label || 'Foto Tambahan',
            url: ep.ref ? resolveCmsImageUrl(ep.ref) : '',
          })),
        ]
      : [];

    const docUrl = selected?.recLetterRef ? resolveCmsDocumentUrl(selected.recLetterRef) : '';
    const hasBio = Boolean(selected?.fullName && selected?.region && selected?.phone);
    const hasPhotos = photoItems.slice(0, 3).every((p) => Boolean(p.url));
    const hasDoc = Boolean(selected?.recLetterRef);
    const hasAdvocacy = Boolean(selected?.advocacy && selected.advocacy.trim().length > 10);
    const achLines = selected?.achievementsText
      ? selected.achievementsText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

    return `
      <div class="admin-module-stack">
        <div class="admin-page-bar">
          <div>
            <h2>Pendaftar 2027</h2>
          </div>
          <div class="admin-page-actions">
            <button type="button" class="admin-btn admin-btn--dark" data-action="export-reg-csv">Ekspor CSV</button>
          </div>
        </div>

        ${renderRegistrations3dDonutCard(regs)}

        <!-- Clean Filter Bar -->
        <div class="admin-filter-card">
          <div class="admin-seg-pills">
            <button type="button" class="admin-seg-pill ${regFilterStatus === 'all' ? 'is-active' : ''}" data-reg-filter="all">Semua <span class="is-tabular">${regs.length}</span></button>
            <button type="button" class="admin-seg-pill ${regFilterStatus === 'pending' ? 'is-active' : ''}" data-reg-filter="pending">Menunggu <span class="is-tabular">${countPending}</span></button>
            <button type="button" class="admin-seg-pill ${regFilterStatus === 'revision' ? 'is-active' : ''}" data-reg-filter="revision">Revisi <span class="is-tabular">${countRevision}</span></button>
            <button type="button" class="admin-seg-pill ${regFilterStatus === 'approved' ? 'is-active' : ''}" data-reg-filter="approved">Disahkan <span class="is-tabular">${countApproved}</span></button>
            <button type="button" class="admin-seg-pill ${regFilterStatus === 'rejected' ? 'is-active' : ''}" data-reg-filter="rejected">Ditolak <span class="is-tabular">${countRejected}</span></button>
          </div>

          <div class="admin-filter-inputs">
            <input type="search" class="admin-input-sm" placeholder="Cari nama, kode, WA..." value="${escapeHtml(regQuery)}" data-reg-search>
            <select class="admin-select-sm" data-reg-role-filter aria-label="Filter kategori">
              <option value="all" ${regFilterRole === 'all' ? 'selected' : ''}>Uda &amp; Uni</option>
              <option value="uda" ${regFilterRole === 'uda' ? 'selected' : ''}>Uda</option>
              <option value="uni" ${regFilterRole === 'uni' ? 'selected' : ''}>Uni</option>
            </select>
            <select class="admin-select-sm" data-reg-region-filter aria-label="Filter daerah">
              <option value="all" ${regFilterRegion === 'all' ? 'selected' : ''}>Semua Daerah</option>
              ${SUMBAR_REGIONS.map((reg) => `<option value="${escapeHtml(reg)}" ${regFilterRegion === reg ? 'selected' : ''}>${escapeHtml(reg)}</option>`).join('')}
            </select>
            ${
              regFilterStatus !== 'all' || regFilterRole !== 'all' || regFilterRegion !== 'all' || regQuery
                ? `<button type="button" class="admin-btn admin-btn--ghost" data-reg-reset-filters>Reset</button>`
                : ''
            }
          </div>
        </div>

        <!-- Master-Detail Split -->
        <div class="admin-split-grid">
          <div class="admin-card admin-list-card">
            <div class="admin-list-head">
              <strong>Daftar Pendaftar</strong>
              <span class="is-tabular">${filtered.length}</span>
            </div>
            <div class="admin-list-scroll">
              ${
                filtered.length === 0
                  ? `<div class="admin-empty-compact"><p>Tidak ada pendaftar sesuai filter.</p></div>`
                  : filtered
                      .map((r) => {
                        const isSel = selected?.id === r.id;
                        const thumb = r.photoRef ? resolveCmsImageUrl(r.photoRef) : '';
                        return `
                          <button type="button" class="admin-list-item ${isSel ? 'is-active' : ''}" data-reg-select="${escapeHtml(r.id)}">
                            <span class="admin-avatar-sm">
                              ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : escapeHtml(getInitials(r.fullName || r.shortName))}
                            </span>
                            <span class="admin-list-item-body">
                              <strong>${escapeHtml(r.fullName || r.shortName)}</strong>
                              <small>${escapeHtml(r.role === 'uda' ? 'Uda' : 'Uni')} · ${escapeHtml(r.region)}</small>
                            </span>
                            <span class="admin-status-dot ${getRegStatusTone(r.status)}" title="${getRegStatusLabel(r.status)}"></span>
                          </button>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>

          <div class="admin-card admin-editor-card admin-split-editor">
            ${
              !selected
                ? `<div class="admin-empty-compact"><p>Pilih salah satu pendaftar di sebelah kiri untuk melihat berkas.</p></div>`
                : `
                  <div class="admin-editor-head">
                    <div>
                      <div class="admin-inline-meta">
                        <button type="button" class="admin-code-chip" data-reg-copy-code="${escapeHtml(selected.regCode)}" title="Salin kode">${escapeHtml(selected.regCode)}</button>
                        <span class="admin-status-tag ${getRegStatusTone(selected.status)}">${getRegStatusLabel(selected.status)}</span>
                      </div>
                      <h3>${escapeHtml(selected.fullName)}</h3>
                      <p class="admin-subline">${escapeHtml(selected.role === 'uda' ? 'Calon Uda' : 'Calon Uni')} · ${escapeHtml(selected.region)} · ${escapeHtml(formatDateTime(selected.createdAt))}</p>
                    </div>
                    <div class="admin-editor-head-actions">
                      ${
                        selected.status === 'approved'
                          ? `<button type="button" class="admin-btn admin-btn--soft" data-reg-jump-catalog>Lihat di Katalog</button>`
                          : ''
                      }
                      <button type="button" class="admin-btn admin-btn--danger-soft" data-reg-delete="${escapeHtml(selected.id)}">Hapus</button>
                    </div>
                  </div>

                  <!-- Completeness Strip -->
                  <div class="admin-check-strip">
                    <span class="${hasBio ? 'is-ok' : ''}">Biodata</span>
                    <span class="${hasPhotos ? 'is-ok' : ''}">3 Foto</span>
                    <span class="${hasDoc ? 'is-ok' : ''}">Surat Rekomendasi</span>
                    <span class="${hasAdvocacy ? 'is-ok' : ''}">Advokasi</span>
                  </div>

                  <!-- Biodata Grid -->
                  <div class="admin-info-grid">
                    <div class="admin-info-cell">
                      <span>Nama Panggilan</span>
                      <strong>${escapeHtml(selected.shortName || '-')}</strong>
                    </div>
                    <div class="admin-info-cell">
                      <span>Usia &amp; Pendidikan</span>
                      <strong>${escapeHtml(selected.age || '-')} th · ${escapeHtml(selected.education || '-')}</strong>
                    </div>
                    <div class="admin-info-cell">
                      <span>WhatsApp</span>
                      <button type="button" class="admin-link-inline" data-reg-copy-wa="${escapeHtml(selected.phone)}">${escapeHtml(selected.phone || '-')}</button>
                    </div>
                    <div class="admin-info-cell">
                      <span>Email</span>
                      <strong>${escapeHtml(selected.email || '-')}</strong>
                    </div>
                    <div class="admin-info-cell is-full">
                      <span>Profesi / Instansi</span>
                      <strong>${escapeHtml(selected.profession || '-')}</strong>
                    </div>
                    <div class="admin-info-cell is-full">
                      <span>Gagasan Advokasi</span>
                      <p>${escapeHtml(selected.advocacy || '-')}</p>
                    </div>
                    ${
                      achLines.length > 0
                        ? `<div class="admin-info-cell is-full">
                            <span>Prestasi</span>
                            <ul class="admin-plain-list">
                              ${achLines.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
                            </ul>
                          </div>`
                        : ''
                    }
                  </div>

                  <!-- Photos -->
                  <div class="admin-sub-section">
                    <h4>Foto Peserta</h4>
                    <div class="admin-reg-photos-3">
                      ${photoItems
                        .map((item) =>
                          item.url
                            ? `<figure class="admin-photo-tile" data-reg-zoom-photo="${escapeHtml(item.url)}" data-reg-zoom-title="${escapeHtml(item.label)} — ${escapeHtml(selected.shortName)}">
                                <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}">
                                <figcaption>${escapeHtml(item.label)}</figcaption>
                              </figure>`
                            : `<div class="admin-photo-tile is-empty"><span>${escapeHtml(item.label)} belum diunggah</span></div>`,
                        )
                        .join('')}
                    </div>
                  </div>

                  <!-- Recommendation Document -->
                  <div class="admin-sub-section" data-reg-doc-section data-reg-doc-url="${escapeHtml(docUrl)}" data-reg-doc-mime="${escapeHtml(selected.recLetterMime || '')}">
                    <div class="admin-doc-row">
                      <div>
                        <h4>Surat Rekomendasi Kab/Kota</h4>
                        <small>${escapeHtml(selected.recLetterName || 'Belum ada berkas')} ${selected.recLetterSize ? `(${formatBytesCompact(selected.recLetterSize)})` : ''}${selected.recNumber ? ` · No. ${escapeHtml(selected.recNumber)}` : ''}</small>
                      </div>
                      <div class="admin-doc-btns">
                        ${
                          docUrl
                            ? `<button type="button" class="admin-btn admin-btn--soft" data-reg-toggle-doc>${previewRegDocOpen ? 'Tutup Pratinjau' : 'Pratinjau'}</button>
                               <a class="admin-btn admin-btn--soft" href="${escapeHtml(docUrl)}" download="${escapeHtml(selected.recLetterName || 'surat-rekomendasi.pdf')}">Unduh</a>`
                            : `<span class="admin-muted-tag">Kosong</span>`
                        }
                      </div>
                    </div>
                    <div data-reg-doc-slot>
                      ${
                        previewRegDocOpen && docUrl
                          ? selected.recLetterMime?.startsWith('image/')
                            ? `<div class="admin-doc-preview"><img src="${escapeHtml(docUrl)}" alt="Surat Rekomendasi"></div>`
                            : `<div class="admin-doc-preview"><iframe src="${escapeHtml(docUrl)}" title="Pratinjau Surat Rekomendasi"></iframe></div>`
                          : ''
                      }
                    </div>
                  </div>

                  <!-- Decision Form -->
                  <form class="admin-decision-box" data-reg-decision-form>
                    <div class="admin-form-grid-2">
                      <div class="admin-field">
                        <label for="reg-finalist-no">Nomor Finalis</label>
                        <input id="reg-finalist-no" name="finalistNumber" type="text" maxlength="2" value="${escapeHtml(suggestedFinalistNo)}" placeholder="01 / 02">
                      </div>
                      <div class="admin-field">
                        <label>Catatan Cepat</label>
                        <div class="admin-preset-row">
                          <button type="button" class="admin-chip-btn" data-reg-note-preset="Berkas & Surat Rekomendasi lengkap dan sah sebagai Finalis 2027.">Berkas Sah</button>
                          <button type="button" class="admin-chip-btn" data-reg-note-preset="Mohon unggah ulang Surat Rekomendasi dengan stempel dinas yang jelas.">Revisi Surat</button>
                          <button type="button" class="admin-chip-btn" data-reg-note-preset="Mohon perbarui foto potret dengan pencahayaan lebih jelas.">Revisi Foto</button>
                        </div>
                      </div>
                      <div class="admin-field is-full">
                        <label for="reg-admin-note">Catatan Verifikasi</label>
                        <textarea id="reg-admin-note" name="reviewerNote" rows="2" placeholder="Catatan singkat untuk pendaftar...">${escapeHtml(selected.reviewerNote || '')}</textarea>
                      </div>
                    </div>

                    <div class="admin-sticky-actions">
                      <button type="button" class="admin-btn admin-btn--ghost" data-reg-decide="pending">Antrean</button>
                      <button type="button" class="admin-btn admin-btn--soft" data-reg-decide="revision">Minta Revisi</button>
                      <button type="button" class="admin-btn admin-btn--danger-soft" data-reg-decide="rejected">Tolak</button>
                      <button type="button" class="admin-btn admin-btn--primary" data-reg-decide="approved">Sahkan Finalis 2027</button>
                    </div>
                  </form>
                `
            }
          </div>
        </div>
      </div>

      ${
        zoomRegPhoto
          ? `<div class="admin-lightbox" data-reg-zoom-close>
              <div class="admin-lightbox-box">
                <div class="admin-lightbox-head">
                  <strong>${escapeHtml(zoomRegPhoto.title)}</strong>
                  <button type="button" class="admin-icon-close" data-reg-zoom-close aria-label="Tutup">×</button>
                </div>
                <img src="${escapeHtml(zoomRegPhoto.src)}" alt="${escapeHtml(zoomRegPhoto.title)}">
              </div>
            </div>`
          : ''
      }
    `;
  };

  /* ============================================================================
     TAB 3: CATALOG (Katalog Duta Uda & Uni)
     ============================================================================ */

  const renderCatalogTab = (state: CmsState): string => {
    const yearObj = state.catalogYears.find((y) => y.year === selectedYear) ?? state.catalogYears[0];
    if (yearObj) selectedYear = yearObj.year;

    const list: AmbassadorBio[] = yearObj ? (selectedRole === 'uda' ? yearObj.uda : yearObj.uni) : [];
    if (selectedSlotIndex >= list.length) selectedSlotIndex = 0;

    const q = catalogQuery.trim().toLowerCase();
    const filteredList = list
      .map((person, idx) => ({person, idx}))
      .filter(({person}) => {
        if (!q) return true;
        return (
          person.fullName.toLowerCase().includes(q) ||
          person.shortName.toLowerCase().includes(q) ||
          person.region.toLowerCase().includes(q) ||
          person.rankLabel.toLowerCase().includes(q)
        );
      });

    const person = list[selectedSlotIndex];
    const photoUrl = person?.photo?.thumb ? resolveCmsImageUrl(person.photo.thumb) : '';

    const allYearParticipants = yearObj ? [...yearObj.uda, ...yearObj.uni] : [];
    const udaCount = yearObj?.uda.length ?? 0;
    const uniCount = yearObj?.uni.length ?? 0;
    const totalCount = allYearParticipants.length;
    const photoCount = allYearParticipants.filter((p) => Boolean(p.photo?.thumb)).length;
    const bioCount = allYearParticipants.filter(
      (p) => Boolean(p.fullName.trim() && p.region.trim() && p.bio.trim()),
    ).length;
    const canPreviewOrPublish = udaCount > 0 && uniCount > 0;
    const allPhotosReady = totalCount > 0 && photoCount === totalCount;
    const allBiosReady = totalCount > 0 && bioCount === totalCount;
    const readinessLabel =
      yearObj?.status === 'published'
        ? 'Tayang di Hero'
        : canPreviewOrPublish && allPhotosReady
          ? 'Siap Tayang di Hero'
          : canPreviewOrPublish
            ? `${totalCount - photoCount} foto belum lengkap`
            : 'Menunggu Uda & Uni';
    const readinessTone =
      yearObj?.status === 'published' || (canPreviewOrPublish && allPhotosReady)
        ? 'is-ready'
        : canPreviewOrPublish
          ? 'is-warn'
          : 'is-muted';

    return `
      <div class="admin-module-stack">
        <div class="admin-page-bar">
          <div class="admin-year-bar">
            <h2>Katalog Duta</h2>
            <div class="admin-seg-pills">
              ${state.catalogYears
                .map(
                  (yr) => `
                    <button type="button" class="admin-seg-pill ${yr.year === selectedYear ? 'is-active' : ''}" data-cat-year="${escapeHtml(yr.year)}">
                      ${escapeHtml(yr.year)}${yr.status === 'draft' ? ' · Draft' : ''}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>
          <div class="admin-page-actions">
            <button type="button" class="admin-btn admin-btn--soft" data-cat-toggle-new-year>+ Tahun</button>
            ${
              yearObj && yearObj.status === 'draft' && canPreviewOrPublish
                ? `<button type="button" class="admin-btn admin-btn--soft" data-cat-preview-hero>Pratinjau Hero</button>`
                : ''
            }
            ${
              yearObj
                ? `<button type="button" class="admin-btn admin-btn--soft" data-cat-toggle-year-status>
                    ${yearObj.status === 'published' ? 'Status: Tayang' : 'Status: Draft'}
                  </button>`
                : ''
            }
            ${
              yearObj
                ? `<button type="button" class="admin-btn admin-btn--soft" data-cat-export-year-json>Paket Rilis JSON</button>`
                : ''
            }
            <button type="button" class="admin-btn admin-btn--dark" data-action="export-csv">Ekspor CSV</button>
          </div>
        </div>

        ${
          yearObj
            ? `<div class="admin-card admin-readiness-bar">
                <div class="admin-readiness-item ${canPreviewOrPublish ? 'is-ok' : 'is-warn'}">
                  <span class="admin-readiness-dot" aria-hidden="true"></span>
                  <span><strong>Utusan ${escapeHtml(yearObj.year)}:</strong> ${udaCount} Uda · ${uniCount} Uni</span>
                </div>
                <div class="admin-readiness-item ${allPhotosReady ? 'is-ok' : 'is-warn'}">
                  <span class="admin-readiness-dot" aria-hidden="true"></span>
                  <span><strong>Foto Potret:</strong> ${photoCount}/${totalCount} terpasang</span>
                </div>
                <div class="admin-readiness-item ${allBiosReady ? 'is-ok' : 'is-warn'}">
                  <span class="admin-readiness-dot" aria-hidden="true"></span>
                  <span><strong>Biodata:</strong> ${bioCount}/${totalCount} lengkap</span>
                </div>
                <span class="admin-readiness-badge ${readinessTone}">${escapeHtml(readinessLabel)}</span>
              </div>`
            : ''
        }

        ${
          newYearMode
            ? `<form class="admin-card admin-inline-form" data-cat-add-year-form>
                <input name="year" type="text" pattern="\\d{4}" maxlength="4" placeholder="Contoh: 2028" required class="admin-input-sm">
                <button type="submit" class="admin-btn admin-btn--primary">Buat Angkatan</button>
                <button type="button" class="admin-btn admin-btn--ghost" data-cat-cancel-new-year>Batal</button>
              </form>`
            : ''
        }

        <div class="admin-split-grid">
          <div class="admin-card admin-list-card">
            <div class="admin-list-toolbar">
              <div class="admin-role-switch">
                <button type="button" class="${selectedRole === 'uda' ? 'is-active' : ''}" data-cat-role="uda">Uda (${yearObj?.uda.length ?? 0})</button>
                <button type="button" class="${selectedRole === 'uni' ? 'is-active' : ''}" data-cat-role="uni">Uni (${yearObj?.uni.length ?? 0})</button>
              </div>
              <input type="search" class="admin-input-sm" placeholder="Cari nama atau daerah..." value="${escapeHtml(catalogQuery)}" data-cat-search>
              ${
                yearObj
                  ? `<div class="admin-list-actions-row">
                      <button type="button" class="admin-btn admin-btn--soft" data-cat-add-person>
                        + Tambah ${selectedRole === 'uda' ? 'Uda' : 'Uni'}
                      </button>
                      ${
                        list.length >= 2
                          ? `<button type="button" class="admin-btn admin-btn--ghost" data-cat-sort-finalist title="Urutkan daftar berdasarkan Nomor Finalis">
                              Urutkan No.
                            </button>`
                          : ''
                      }
                    </div>`
                  : ''
              }
            </div>

            <div class="admin-list-scroll">
              ${
                list.length === 0
                  ? `<div class="admin-empty-compact">
                      <p>Belum ada ${selectedRole === 'uda' ? 'Uda' : 'Uni'} yang terdaftar untuk angkatan ${escapeHtml(selectedYear)}.</p>
                    </div>`
                  : filteredList.length === 0
                    ? `<div class="admin-empty-compact">
                        <p>Tidak ada peserta yang cocok dengan pencarian.</p>
                      </div>`
                    : filteredList
                        .map(({person: p, idx}) => {
                          const thumb = p.photo?.thumb ? resolveCmsImageUrl(p.photo.thumb) : '';
                          const isSel = idx === selectedSlotIndex;
                          const badgeNum = p.finalistNumber || String(idx + 1).padStart(2, '0');
                          return `
                            <button type="button" class="admin-list-item ${isSel ? 'is-active' : ''}" data-cat-slot="${idx}">
                              <span class="admin-avatar-sm">
                                ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : escapeHtml(badgeNum)}
                              </span>
                              <span class="admin-list-item-body">
                                <strong>${escapeHtml(p.fullName || p.shortName)}</strong>
                                <small>${escapeHtml(p.region || '-')} · ${escapeHtml(p.rankLabel || '-')}${p.finalistNumber ? ` · #${escapeHtml(p.finalistNumber)}` : ''}</small>
                              </span>
                            </button>
                          `;
                        })
                        .join('')
              }
            </div>
          </div>

          <div class="admin-card admin-editor-card admin-split-editor">
            ${
              !person
                ? `<div class="admin-empty-compact">
                    <p>${
                      list.length === 0
                        ? `Daftar ${selectedRole === 'uda' ? 'Uda' : 'Uni'} angkatan ${escapeHtml(selectedYear)} masih kosong. Hanya utusan yang sudah mendaftar dan disahkan (atau ditambahkan manual) yang tampil di sini.`
                        : 'Pilih peserta di sebelah kiri untuk mengedit profil.'
                    }</p>
                    ${
                      yearObj
                        ? `<div class="admin-action-row">
                            ${
                              selectedYear === '2027'
                                ? `<button type="button" class="admin-btn admin-btn--dark" data-admin-tab="registrations">Buka Pendaftar 2027</button>`
                                : ''
                            }
                            <button type="button" class="admin-btn admin-btn--soft" data-cat-add-person>+ Tambah ${selectedRole === 'uda' ? 'Uda' : 'Uni'}</button>
                          </div>`
                        : ''
                    }
                  </div>`
                : `
                  <div class="admin-editor-head">
                    <div>
                      <h3>${escapeHtml(person.fullName || person.shortName)}</h3>
                      <p class="admin-subline">Angkatan ${escapeHtml(selectedYear)} · ${selectedRole === 'uda' ? 'Uda' : 'Uni'} · Urutan #${selectedSlotIndex + 1}${person.finalistNumber ? ` · No. Finalis ${escapeHtml(person.finalistNumber)}` : ''}</p>
                    </div>
                    <div class="admin-order-controls">
                      ${
                        list.length > 1
                          ? `<button type="button" class="admin-icon-chip" data-cat-move="up" ${selectedSlotIndex === 0 ? 'disabled' : ''} title="Naikkan urutan tampil">↑</button>
                             <button type="button" class="admin-icon-chip" data-cat-move="down" ${selectedSlotIndex >= list.length - 1 ? 'disabled' : ''} title="Turunkan urutan tampil">↓</button>
                             <button type="button" class="admin-btn admin-btn--soft admin-btn--xs" data-cat-move="top" ${selectedSlotIndex === 0 ? 'disabled' : ''} title="Pindahkan ke posisi pertama (tengah Hero Section)">Jadikan #1</button>`
                          : ''
                      }
                      <button type="button" class="admin-btn admin-btn--ghost is-danger admin-btn--xs" data-cat-delete-person>Hapus</button>
                    </div>
                  </div>

                  ${
                    pendingConfirm?.key === `del-cat-${selectedYear}-${selectedRole}-${selectedSlotIndex}`
                      ? `<div class="admin-confirm-bar">
                          <span>${escapeHtml(pendingConfirm.label)}</span>
                          <div>
                            <button type="button" class="admin-btn admin-btn--ghost" data-confirm-cancel>Batal</button>
                            <button type="button" class="admin-btn admin-btn--danger" data-confirm-proceed>Ya, Hapus</button>
                          </div>
                        </div>`
                      : ''
                  }

                  <!-- Photo Upload Strip -->
                  <div class="admin-media-strip">
                    <div class="admin-media-thumb is-portrait">
                      ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(person.shortName)}">` : `<span>Belum ada foto</span>`}
                    </div>
                    <div class="admin-media-controls">
                      <div class="admin-media-btns">
                        <label class="admin-btn admin-btn--soft">
                          Unggah Foto
                          <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-cat-upload-photo>
                        </label>
                        ${
                          photoUrl
                            ? `<button type="button" class="admin-btn admin-btn--ghost" data-cat-reset-photo>Hapus Foto</button>`
                            : ''
                        }
                      </div>
                      <small class="admin-upload-hint">Disarankan foto full-body PNG/WebP latar transparan agar berdiri sejajar rapi di Hero Section.</small>
                      ${uploadStatNote ? `<small class="admin-upload-note">${escapeHtml(uploadStatNote)}</small>` : ''}
                    </div>
                  </div>

                  <form class="admin-form-body" data-cat-save-form>
                    <div class="admin-form-grid-2">
                      <div class="admin-field">
                        <label>Nama Lengkap</label>
                        <input name="fullName" type="text" value="${escapeHtml(person.fullName)}" required>
                      </div>
                      <div class="admin-field">
                        <label>Nama Panggilan / Tampil</label>
                        <input name="shortName" type="text" value="${escapeHtml(person.shortName)}" required>
                      </div>
                      <div class="admin-field">
                        <label>Predikat / Gelar</label>
                        <input name="rankLabel" type="text" value="${escapeHtml(person.rankLabel)}">
                      </div>
                      <div class="admin-field">
                        <label>Utusan Kab/Kota</label>
                        <input name="region" type="text" value="${escapeHtml(person.region)}">
                      </div>
                      <div class="admin-field">
                        <label>No. Finalis</label>
                        <input name="finalistNumber" type="text" maxlength="2" value="${escapeHtml(person.finalistNumber || '')}" placeholder="01 / 02">
                      </div>
                      <div class="admin-field">
                        <label>Usia</label>
                        <input name="age" type="text" value="${escapeHtml(person.age || '')}" placeholder="Opsional">
                      </div>
                      <div class="admin-field">
                        <label>Pendidikan</label>
                        <input name="education" type="text" value="${escapeHtml(person.education)}">
                      </div>
                      <div class="admin-field">
                        <label>Profesi</label>
                        <input name="profession" type="text" value="${escapeHtml(person.profession)}">
                      </div>
                      <div class="admin-field is-full">
                        <label>Advokasi</label>
                        <input name="advocacy" type="text" value="${escapeHtml(person.advocacy)}">
                      </div>
                      <div class="admin-field is-full">
                        <label>Ringkasan Prestasi</label>
                        <input name="achievement" type="text" value="${escapeHtml(person.achievement)}">
                      </div>
                      <div class="admin-field is-full">
                        <label>Daftar Prestasi (1 per baris)</label>
                        <textarea name="achievementsText" rows="3">${escapeHtml((person.achievements || []).join('\n'))}</textarea>
                      </div>
                      <div class="admin-field is-full">
                        <label>Biodata Singkat</label>
                        <textarea name="bio" rows="3">${escapeHtml(person.bio)}</textarea>
                      </div>
                    </div>

                    <div class="admin-sticky-actions">
                      <button type="submit" class="admin-btn admin-btn--primary">Simpan Perubahan</button>
                    </div>
                  </form>
                `
            }
          </div>
        </div>
      </div>
    `;
  };

  /* ============================================================================
     TAB 4: EVENTS (Berita & Agenda)
     ============================================================================ */

  const renderEventsTab = (state: CmsState): string => {
    const events = state.events;
    const selected: CmsEventItem | undefined = events.find((e) => e.id === selectedEventId) ?? events[0];
    if (selected) selectedEventId = selected.id;

    const photoUrl = selected?.photo ? resolveCmsImageUrl(selected.photo) : '';

    return `
      <div class="admin-module-stack">
        <div class="admin-page-bar">
          <h2>Berita &amp; Agenda</h2>
          <div class="admin-page-actions">
            <button type="button" class="admin-btn admin-btn--dark" data-ev-add>+ Tambah Kegiatan</button>
          </div>
        </div>

        <div class="admin-split-grid">
          <div class="admin-card admin-list-card">
            <div class="admin-list-head">
              <strong>Daftar Kegiatan</strong>
              <span class="is-tabular">${events.length}</span>
            </div>
            <div class="admin-list-scroll">
              ${events
                .map((ev, idx) => {
                  const isSel = ev.id === selected?.id;
                  const thumb = ev.photo ? resolveCmsImageUrl(ev.photo) : '';
                  return `
                    <div class="admin-list-row-wrap ${isSel ? 'is-active' : ''}">
                      <button type="button" class="admin-list-item ${isSel ? 'is-active' : ''}" data-ev-select="${escapeHtml(ev.id)}">
                        <span class="admin-avatar-sm is-sq">
                          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : `${idx + 1}`}
                        </span>
                        <span class="admin-list-item-body">
                          <strong>${escapeHtml(ev.title)}</strong>
                          <small>${escapeHtml(ev.category)} · ${ev.status === 'published' ? 'Tayang' : 'Draft'}</small>
                        </span>
                      </button>
                      <div class="admin-order-btns">
                        <button type="button" data-ev-id="${escapeHtml(ev.id)}" data-ev-move="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Naik">↑</button>
                        <button type="button" data-ev-id="${escapeHtml(ev.id)}" data-ev-move="1" ${idx === events.length - 1 ? 'disabled' : ''} aria-label="Turun">↓</button>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <div class="admin-card admin-editor-card admin-split-editor">
            ${
              !selected
                ? `<div class="admin-empty-compact"><p>Pilih kegiatan untuk mulai mengedit.</p></div>`
                : `
                  <div class="admin-editor-head">
                    <div>
                      <h3>${escapeHtml(selected.title)}</h3>
                      <p class="admin-subline">${escapeHtml(selected.category)} · ${selected.status === 'published' ? 'Tayang' : 'Draft'}</p>
                    </div>
                    <button type="button" class="admin-btn admin-btn--danger-soft" data-ev-delete="${escapeHtml(selected.id)}">Hapus</button>
                  </div>

                  <div class="admin-media-strip">
                    <div class="admin-media-thumb is-landscape">
                      ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(selected.title)}">` : `<span>Belum ada foto</span>`}
                    </div>
                    <div class="admin-media-controls">
                      <label class="admin-btn admin-btn--soft">
                        Ganti Foto Kegiatan
                        <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-ev-upload-photo>
                      </label>
                      ${uploadStatNote ? `<small class="admin-upload-note">${escapeHtml(uploadStatNote)}</small>` : ''}
                    </div>
                  </div>

                  <form class="admin-form-body" data-ev-save-form>
                    <div class="admin-form-grid-2">
                      <div class="admin-field">
                        <label>Judul Kegiatan</label>
                        <input name="title" type="text" value="${escapeHtml(selected.title)}" required>
                      </div>
                      <div class="admin-field">
                        <label>Status Publikasi</label>
                        <select name="status">
                          <option value="published" ${selected.status === 'published' ? 'selected' : ''}>Tayang</option>
                          <option value="draft" ${selected.status === 'draft' ? 'selected' : ''}>Draft</option>
                        </select>
                      </div>
                      <div class="admin-field">
                        <label>Kategori</label>
                        <input name="category" type="text" value="${escapeHtml(selected.category)}">
                      </div>
                      <div class="admin-field">
                        <label>Label Pop-up (Kicker)</label>
                        <input name="modalKicker" type="text" value="${escapeHtml(selected.modalKicker)}">
                      </div>
                      <div class="admin-field is-full">
                        <label>Fokus / Tagline</label>
                        <input name="focusLine" type="text" value="${escapeHtml(selected.focusLine)}">
                      </div>
                      <div class="admin-field is-full">
                        <label>Ringkasan Kartu</label>
                        <textarea name="cardSummary" rows="2">${escapeHtml(selected.cardSummary)}</textarea>
                      </div>
                      <div class="admin-field is-full">
                        <label>Deskripsi Lengkap</label>
                        <textarea name="detailSummary" rows="3">${escapeHtml(selected.detailSummary)}</textarea>
                      </div>
                    </div>

                    <div class="admin-sub-section">
                      <h4>3 Angka Sorotan</h4>
                      <div class="admin-form-grid-3">
                        ${[0, 1, 2]
                          .map((idx) => {
                            const m = selected.metrics[idx] || {value: '', label: ''};
                            return `
                              <div class="admin-mini-group">
                                <input name="metricVal_${idx}" type="text" value="${escapeHtml(m.value)}" placeholder="Angka">
                                <input name="metricLabel_${idx}" type="text" value="${escapeHtml(m.label)}" placeholder="Label">
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                    </div>

                    <div class="admin-sub-section">
                      <h4>3 Poin Rincian</h4>
                      <div class="admin-form-grid-3">
                        ${[0, 1, 2]
                          .map((idx) => {
                            const d = selected.details[idx] || {label: '', text: ''};
                            return `
                              <div class="admin-mini-group">
                                <input name="detailLabel_${idx}" type="text" value="${escapeHtml(d.label)}" placeholder="Judul poin">
                                <textarea name="detailText_${idx}" rows="2" placeholder="Keterangan">${escapeHtml(d.text)}</textarea>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                    </div>

                    <div class="admin-sticky-actions">
                      <button type="submit" class="admin-btn admin-btn--primary">Simpan Kegiatan</button>
                    </div>
                  </form>
                `
            }
          </div>
        </div>
      </div>
    `;
  };

  /* ============================================================================
     TAB 5: BOARD (Kepengurusan 2027)
     ============================================================================ */

  const renderBoardTab = (state: CmsState): string => {
    const members = state.boardMembers;
    const selected: CmsBoardMember | undefined = members.find((m) => m.id === selectedBoardId) ?? members[0];
    if (selected) selectedBoardId = selected.id;

    const photoUrl = selected?.photo ? resolveCmsImageUrl(selected.photo) : '';

    return `
      <div class="admin-module-stack">
        <div class="admin-page-bar">
          <h2>Pengurus 2027</h2>
          <div class="admin-page-actions">
            <button type="button" class="admin-btn admin-btn--dark" data-bd-add>+ Tambah Pengurus</button>
          </div>
        </div>

        <!-- Compact Summary Numbers Strip -->
        <form class="admin-card admin-board-summary-card" data-bd-summary-form>
          <div class="admin-card-head">
            <h3>Ringkasan Angka Kepengurusan</h3>
            <button type="submit" class="admin-btn admin-btn--soft">Simpan Ringkasan</button>
          </div>
          <div class="admin-form-grid-3">
            ${state.boardSummary
              .map(
                (item, idx) => `
                  <div class="admin-mini-group">
                    <input name="sumLabel_${idx}" type="text" value="${escapeHtml(item.label)}" placeholder="Label">
                    <div class="admin-inline-pair">
                      <input name="sumVal_${idx}" type="text" value="${escapeHtml(item.value)}" placeholder="Angka">
                      <input name="sumUnit_${idx}" type="text" value="${escapeHtml(item.unit)}" placeholder="Satuan">
                    </div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </form>

        <div class="admin-split-grid">
          <div class="admin-card admin-list-card">
            <div class="admin-list-head">
              <strong>Struktur Pengurus</strong>
              <span class="is-tabular">${members.length}</span>
            </div>
            <div class="admin-list-scroll">
              ${members
                .map((m, idx) => {
                  const isSel = m.id === selected?.id;
                  const thumb = m.photo ? resolveCmsImageUrl(m.photo) : '';
                  return `
                    <div class="admin-list-row-wrap ${isSel ? 'is-active' : ''}">
                      <button type="button" class="admin-list-item ${isSel ? 'is-active' : ''}" data-bd-select="${escapeHtml(m.id)}">
                        <span class="admin-avatar-sm">
                          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="">` : escapeHtml(getInitials(m.cardName || m.name))}
                        </span>
                        <span class="admin-list-item-body">
                          <strong>${escapeHtml(m.cardName || m.name)}</strong>
                          <small>${escapeHtml(m.role)}</small>
                        </span>
                      </button>
                      <div class="admin-order-btns">
                        <button type="button" data-bd-id="${escapeHtml(m.id)}" data-bd-move="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Naik">↑</button>
                        <button type="button" data-bd-id="${escapeHtml(m.id)}" data-bd-move="1" ${idx === members.length - 1 ? 'disabled' : ''} aria-label="Turun">↓</button>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <div class="admin-card admin-editor-card admin-split-editor">
            ${
              !selected
                ? `<div class="admin-empty-compact"><p>Pilih pengurus untuk mengedit.</p></div>`
                : `
                  <div class="admin-editor-head">
                    <div>
                      <h3>${escapeHtml(selected.name)}</h3>
                      <p class="admin-subline">${escapeHtml(selected.role)} · ${selected.status === 'published' ? 'Tayang' : 'Draft'}</p>
                    </div>
                    <button type="button" class="admin-btn admin-btn--danger-soft" data-bd-delete="${escapeHtml(selected.id)}">Hapus</button>
                  </div>

                  <div class="admin-media-strip">
                    <div class="admin-media-thumb is-portrait">
                      ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(selected.name)}">` : `<span>Belum ada foto</span>`}
                    </div>
                    <div class="admin-media-controls">
                      <label class="admin-btn admin-btn--soft">
                        Unggah Foto Pengurus
                        <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-bd-upload-photo>
                      </label>
                      ${uploadStatNote ? `<small class="admin-upload-note">${escapeHtml(uploadStatNote)}</small>` : ''}
                    </div>
                  </div>

                  <form class="admin-form-body" data-bd-save-form>
                    <div class="admin-form-grid-2">
                      <div class="admin-field">
                        <label>Nama Lengkap</label>
                        <input name="name" type="text" value="${escapeHtml(selected.name)}" required>
                      </div>
                      <div class="admin-field">
                        <label>Nama Singkat Kartu</label>
                        <input name="cardName" type="text" value="${escapeHtml(selected.cardName)}" required>
                      </div>
                      <div class="admin-field">
                        <label>Jabatan Lengkap</label>
                        <input name="role" type="text" value="${escapeHtml(selected.role)}" required>
                      </div>
                      <div class="admin-field">
                        <label>Divisi</label>
                        <select name="divisionKey">
                          <option value="inti" ${selected.divisionKey === 'inti' ? 'selected' : ''}>Pengurus Inti</option>
                          <option value="budaya" ${selected.divisionKey === 'budaya' ? 'selected' : ''}>Budaya &amp; Pariwisata</option>
                          <option value="promosi" ${selected.divisionKey === 'promosi' ? 'selected' : ''}>Promosi &amp; Digital</option>
                          <option value="kemitraan" ${selected.divisionKey === 'kemitraan' ? 'selected' : ''}>Kemitraan &amp; Humas</option>
                        </select>
                      </div>
                      <div class="admin-field">
                        <label>Status</label>
                        <select name="status">
                          <option value="published" ${selected.status === 'published' ? 'selected' : ''}>Tayang</option>
                          <option value="draft" ${selected.status === 'draft' ? 'selected' : ''}>Draft</option>
                        </select>
                      </div>
                      <div class="admin-field">
                        <label>Label Divisi</label>
                        <input name="division" type="text" value="${escapeHtml(selected.division)}">
                      </div>
                      <div class="admin-field">
                        <label>Prefix Peran Kartu</label>
                        <input name="cardRolePrefix" type="text" value="${escapeHtml(selected.cardRolePrefix)}">
                      </div>
                      <div class="admin-field">
                        <label>Sub-Peran Kartu</label>
                        <input name="cardRoleCopy" type="text" value="${escapeHtml(selected.cardRoleCopy)}">
                      </div>
                      <div class="admin-field">
                        <label>Asal Daerah</label>
                        <input name="origin" type="text" value="${escapeHtml(selected.origin)}">
                      </div>
                      <div class="admin-field">
                        <label>Angkatan</label>
                        <input name="cohortYear" type="text" value="${escapeHtml(selected.cohortYear)}">
                      </div>
                      <div class="admin-field is-full">
                        <label>Badge</label>
                        <input name="badge" type="text" value="${escapeHtml(selected.badge)}">
                      </div>
                      <div class="admin-field is-full">
                        <label>Ringkasan Profil</label>
                        <textarea name="summary" rows="3">${escapeHtml(selected.summary)}</textarea>
                      </div>
                    </div>

                    <div class="admin-sub-section">
                      <h4>3 Tugas Utama</h4>
                      <div class="admin-form-grid-1">
                        ${[0, 1, 2]
                          .map((i) => `<input name="task_${i}" type="text" value="${escapeHtml(selected.tasks[i] || '')}" placeholder="Tugas ${i + 1}">`)
                          .join('')}
                      </div>
                    </div>

                    <div class="admin-sticky-actions">
                      <button type="submit" class="admin-btn admin-btn--primary">Simpan Pengurus</button>
                    </div>
                  </form>
                `
            }
          </div>
        </div>
      </div>
    `;
  };

  /* ============================================================================
     TAB 6: SETTINGS (Visi & Misi + Backup & Keamanan — Clean 2-Subtab Switch)
     ============================================================================ */

  const renderVisiMisiTab = (state: CmsState): string => {
    const vm = state.visimisi;

    const renderGroupRows = (prefix: string, title: string, items: CmsMisiEntry[]) => `
      <div class="admin-sub-section">
        <h4>${title}</h4>
        <div class="admin-form-grid-2">
          ${items
            .map(
              (item, idx) => `
                <div class="admin-mini-group">
                  <div class="admin-inline-pair">
                    <input name="${prefix}_idx_${idx}" type="text" value="${escapeHtml(item.indexLabel)}" placeholder="01" class="admin-input-tiny">
                    <input name="${prefix}_title_${idx}" type="text" value="${escapeHtml(item.title)}" placeholder="Judul">
                  </div>
                  <textarea name="${prefix}_desc_${idx}" rows="2" placeholder="Uraian">${escapeHtml(item.description)}</textarea>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `;

    return `
      <div class="admin-module-stack">
        <div class="admin-page-bar">
          <h2>Pengaturan</h2>
          <div class="admin-seg-pills">
            <button type="button" class="admin-seg-pill ${settingsSubTab === 'visimisi' ? 'is-active' : ''}" data-settings-subtab="visimisi">Visi &amp; Misi</button>
            <button type="button" class="admin-seg-pill ${settingsSubTab === 'backup' ? 'is-active' : ''}" data-settings-subtab="backup">Backup &amp; Keamanan</button>
          </div>
        </div>

        ${
          settingsSubTab === 'visimisi'
            ? `
              <form class="admin-card admin-editor-card" data-vm-save-form>
                <div class="admin-form-grid-2">
                  <div class="admin-field">
                    <label>Label Bagian (Eyebrow)</label>
                    <input name="eyebrow" type="text" value="${escapeHtml(vm.eyebrow)}">
                  </div>
                  <div class="admin-field">
                    <label>Label Stempel</label>
                    <input name="sealLabel" type="text" value="${escapeHtml(vm.sealLabel)}">
                  </div>
                  <div class="admin-field is-full">
                    <label>Tag Utama (pisahkan dengan koma)</label>
                    <input name="chips" type="text" value="${escapeHtml(vm.chips.join(', '))}">
                  </div>
                  <div class="admin-field">
                    <label>Kutipan Visi (Utama)</label>
                    <textarea name="visiQuoteLead" rows="2">${escapeHtml(vm.visiQuoteLead)}</textarea>
                  </div>
                  <div class="admin-field">
                    <label>Kutipan Visi (Lanjutan)</label>
                    <textarea name="visiQuoteMuted" rows="2">${escapeHtml(vm.visiQuoteMuted)}</textarea>
                  </div>
                  <div class="admin-field is-full">
                    <label>Uraian Visi</label>
                    <textarea name="visiDesc" rows="2">${escapeHtml(vm.visiDesc)}</textarea>
                  </div>
                </div>

                ${renderGroupRows('misi', 'Misi Strategis', vm.misiItems)}
                ${renderGroupRows('sebaran', 'Sebaran 19 Kab/Kota', vm.sebaranItems)}
                ${renderGroupRows('komitmen', 'Komitmen Sapta Pesona', vm.komitmenItems)}

                <div class="admin-sticky-actions">
                  <button type="submit" class="admin-btn admin-btn--primary">Simpan Visi &amp; Misi</button>
                </div>
              </form>
            `
            : `
              <div class="admin-settings-grid">
                <div class="admin-card admin-settings-card">
                  <h3>Cadangan &amp; Ekspor Data</h3>
                  <div class="admin-tool-stack">
                    <button type="button" class="admin-btn admin-btn--dark admin-btn--full" data-action="export-json">Unduh Backup JSON</button>
                    <label class="admin-btn admin-btn--soft admin-btn--full">
                      Impor Backup JSON
                      <input type="file" accept="application/json" hidden data-action-import-json>
                    </label>
                    <button type="button" class="admin-btn admin-btn--soft admin-btn--full" data-action="download-repomix">Unduh Repomix (.txt)</button>
                  </div>
                </div>

                <div class="admin-card admin-settings-card">
                  <h3>Ubah Kata Sandi</h3>
                  <form class="admin-form-body" data-passcode-form>
                    <div class="admin-field">
                      <label>Sandi Saat Ini</label>
                      <input name="currentPasscode" type="password" required autocomplete="current-password">
                    </div>
                    <div class="admin-field">
                      <label>Sandi Baru</label>
                      <input name="newPasscode" type="password" minlength="4" required autocomplete="new-password">
                    </div>
                    <button type="submit" class="admin-btn admin-btn--primary admin-btn--full">Perbarui Sandi</button>
                  </form>
                </div>

                <div class="admin-card admin-settings-card is-span-2">
                  <h3>Pulihkan Data ke Bawaan</h3>
                  <div class="admin-reset-row">
                    <button type="button" class="admin-btn admin-btn--soft" data-reset-mod="catalog">Reset Katalog</button>
                    <button type="button" class="admin-btn admin-btn--soft" data-reset-mod="events">Reset Berita</button>
                    <button type="button" class="admin-btn admin-btn--soft" data-reset-mod="board">Reset Pengurus</button>
                    <button type="button" class="admin-btn admin-btn--soft" data-reset-mod="visimisi">Reset Visi &amp; Misi</button>
                    <button type="button" class="admin-btn admin-btn--danger-soft" data-reset-mod="all">Reset Semua</button>
                  </div>
                </div>
              </div>
            `
        }
      </div>
    `;
  };

  /* ============================================================================
     GLOBAL SEARCH HITS
     ============================================================================ */

  const buildGlobalSearchHits = (state: CmsState, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: Array<{
      label: string;
      sub: string;
      tab: AdminTab;
      regId?: string;
      year?: string;
      role?: RoleFilter;
      slot?: number;
      eventId?: string;
      boardId?: string;
    }> = [];

    for (const r of state.registrations2027 || []) {
      if (r.fullName.toLowerCase().includes(q) || r.region.toLowerCase().includes(q) || r.regCode.toLowerCase().includes(q)) {
        hits.push({label: r.fullName || r.shortName, sub: `Pendaftar · ${r.region}`, tab: 'registrations', regId: r.id});
      }
    }
    for (const yr of state.catalogYears) {
      for (const role of ['uda', 'uni'] as RoleFilter[]) {
        yr[role].forEach((p, idx) => {
          if (p.fullName.toLowerCase().includes(q) || p.shortName.toLowerCase().includes(q) || p.region.toLowerCase().includes(q)) {
            hits.push({label: p.fullName || p.shortName, sub: `Katalog ${yr.year} · ${p.region}`, tab: 'catalog', year: yr.year, role, slot: idx});
          }
        });
      }
    }
    for (const ev of state.events) {
      if (ev.title.toLowerCase().includes(q) || ev.category.toLowerCase().includes(q)) {
        hits.push({label: ev.title, sub: 'Berita & Agenda', tab: 'events', eventId: ev.id});
      }
    }
    for (const bd of state.boardMembers) {
      if (bd.name.toLowerCase().includes(q) || bd.role.toLowerCase().includes(q)) {
        hits.push({label: bd.name, sub: `Pengurus · ${bd.role}`, tab: 'board', boardId: bd.id});
      }
    }
    return hits.slice(0, 7);
  };

  /* ============================================================================
     MAIN WORKSPACE RENDERER (Compact Reference Sidebar + Soft Canvas)
     ============================================================================ */

  const renderWorkspace = () => {
    const state = getCmsState();
    const pendingRegs = (state.registrations2027 || []).filter((r) => r.status === 'pending' || r.status === 'revision');
    const pendingCount = pendingRegs.length;
    const searchHits = buildGlobalSearchHits(state, globalSearchQuery);

    const navItems: Array<{id: AdminTab; label: string; badge?: number; icon: string}> = [
      {
        id: 'overview',
        label: 'Ringkasan',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
      },
      {
        id: 'registrations',
        label: 'Pendaftar 2027',
        badge: pendingCount > 0 ? pendingCount : undefined,
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>',
      },
      {
        id: 'catalog',
        label: 'Katalog Duta',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      },
      {
        id: 'events',
        label: 'Berita & Agenda',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      },
      {
        id: 'board',
        label: 'Pengurus 2027',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
      },
      {
        id: 'visimisi',
        label: 'Pengaturan',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
      },
    ];

    const preserveScroll = lastRenderedTab === activeTab;
    const prevContentScroll = preserveScroll ? (dialog.querySelector<HTMLElement>('.admin-content')?.scrollTop ?? 0) : 0;
    const prevListScroll = preserveScroll ? (dialog.querySelector<HTMLElement>('.admin-list-scroll')?.scrollTop ?? 0) : 0;
    const prevShellScroll = preserveScroll ? (dialog.querySelector<HTMLElement>('.admin-shell')?.scrollTop ?? 0) : 0;
    const prevDialogScroll = preserveScroll ? dialog.scrollTop : 0;

    let tabHtml = '';
    if (activeTab === 'overview') tabHtml = renderOverviewTab(state);
    else if (activeTab === 'registrations') tabHtml = renderRegistrationsTab(state);
    else if (activeTab === 'catalog') tabHtml = renderCatalogTab(state);
    else if (activeTab === 'events') tabHtml = renderEventsTab(state);
    else if (activeTab === 'board') tabHtml = renderBoardTab(state);
    else tabHtml = renderVisiMisiTab(state);

    dialog.innerHTML = `
      <div class="admin-shell">
        <!-- Compact Pure-White Left Sidebar (Jobgio Reference Pattern) -->
        <aside class="admin-sidebar">
          <div class="admin-brand">
            <img src="/assets/aistudio/logo_uda_uni_2027_a45f5678.png" width="32" height="32" alt="Uda &amp; Uni">
            <span>Uda &amp; Uni</span>
          </div>

          <nav class="admin-nav" aria-label="Menu Admin">
            ${navItems
              .map(
                (item) => `
                  <button type="button" class="admin-nav-btn ${activeTab === item.id ? 'is-active' : ''}" data-admin-tab="${item.id}">
                    <span class="admin-nav-ico">${item.icon}</span>
                    <span class="admin-nav-lbl">${item.label}</span>
                    ${item.badge ? `<span class="admin-nav-count is-tabular">${item.badge}</span>` : ''}
                  </button>
                `,
              )
              .join('')}
          </nav>

          <div class="admin-sidebar-profile">
            <div class="admin-profile-avatar">
              <span>${escapeHtml(getInitials(session?.operatorName || 'Admin'))}</span>
              ${pendingCount > 0 ? `<em class="is-tabular">${pendingCount}</em>` : ''}
            </div>
            <strong>${escapeHtml(session?.operatorName || 'Admin')}</strong>
            <button type="button" class="admin-logout-link" data-admin-logout>Keluar</button>
          </div>
        </aside>

        <!-- Main Soft-Gray Canvas -->
        <div class="admin-main">
          <header class="admin-topbar">
            <div class="admin-search-box">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" placeholder="Cari peserta, pendaftar, agenda..." value="${escapeHtml(globalSearchQuery)}" data-admin-global-search>
              ${globalSearchQuery ? `<button type="button" class="admin-search-clear" data-admin-clear-search aria-label="Bersihkan">×</button>` : ''}
              ${
                searchHits.length > 0
                  ? `<div class="admin-search-dropdown">
                      ${searchHits
                        .map(
                          (hit, i) => `
                            <button type="button" class="admin-search-hit" data-global-hit-idx="${i}" data-hit-tab="${hit.tab}" ${hit.regId ? `data-hit-reg-id="${escapeHtml(hit.regId)}"` : ''} ${hit.year ? `data-hit-year="${escapeHtml(hit.year)}"` : ''} ${hit.role ? `data-hit-role="${hit.role}"` : ''} ${hit.slot !== undefined ? `data-hit-slot="${hit.slot}"` : ''} ${hit.eventId ? `data-hit-event-id="${escapeHtml(hit.eventId)}"` : ''} ${hit.boardId ? `data-hit-board-id="${escapeHtml(hit.boardId)}"` : ''}>
                              <strong>${escapeHtml(hit.label)}</strong>
                              <small>${escapeHtml(hit.sub)}</small>
                            </button>
                          `,
                        )
                        .join('')}
                    </div>`
                  : ''
              }
            </div>

            <div class="admin-topbar-actions">
              <button type="button" class="admin-top-icon-btn" data-action="export-json" title="Unduh Backup JSON" aria-label="Unduh Backup JSON">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>

              <div class="admin-notif-wrap">
                <button type="button" class="admin-top-icon-btn" data-admin-notif-toggle title="Antrean Verifikasi" aria-label="Antrean Verifikasi">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  ${pendingCount > 0 ? `<i class="admin-notif-dot"></i>` : ''}
                </button>
                ${
                  notifPopoverOpen
                    ? `<div class="admin-notif-popover">
                        <div class="admin-notif-head">
                          <strong>Antrean Verifikasi</strong>
                          <span class="is-tabular">${pendingCount}</span>
                        </div>
                        ${
                          pendingRegs.length === 0
                            ? `<p class="admin-notif-empty">Semua berkas telah diproses.</p>`
                            : pendingRegs
                                .slice(0, 5)
                                .map(
                                  (r) => `
                                    <button type="button" class="admin-notif-item" data-overview-open-row data-overview-target-tab="registrations" data-overview-reg-id="${escapeHtml(r.id)}">
                                      <strong>${escapeHtml(r.fullName || r.shortName)}</strong>
                                      <small>${escapeHtml(r.region)} · ${getRegStatusLabel(r.status)}</small>
                                    </button>
                                  `,
                                )
                                .join('')
                        }
                      </div>`
                    : ''
                }
              </div>

              <button type="button" class="admin-top-icon-btn admin-mobile-only" data-admin-logout title="Keluar" aria-label="Keluar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>

              <button type="button" class="admin-top-icon-btn" data-admin-close title="Tutup Panel Admin" aria-label="Tutup Panel Admin">×</button>
            </div>
          </header>

          ${
            toastMessage
              ? `<div class="admin-toast is-${toastType}" data-admin-toast>${escapeHtml(toastMessage)}</div>`
              : ''
          }

          ${
            pendingConfirm
              ? `<div class="admin-confirm-bar">
                  <span>${escapeHtml(pendingConfirm.label)}</span>
                  <div class="admin-confirm-btns">
                    <button type="button" class="admin-btn admin-btn--ghost" data-confirm-cancel>Batal</button>
                    <button type="button" class="admin-btn admin-btn--danger" data-confirm-proceed>Ya, Lanjutkan</button>
                  </div>
                </div>`
              : ''
          }

          <main class="admin-content">
            ${tabHtml}
          </main>
        </div>
      </div>
    `;

    lastRenderedTab = activeTab;
    if (preserveScroll) {
      const nextContent = dialog.querySelector<HTMLElement>('.admin-content');
      const nextList = dialog.querySelector<HTMLElement>('.admin-list-scroll');
      const nextShell = dialog.querySelector<HTMLElement>('.admin-shell');
      if (nextContent) nextContent.scrollTop = prevContentScroll;
      if (nextList) nextList.scrollTop = prevListScroll;
      if (nextShell) nextShell.scrollTop = prevShellScroll;
      dialog.scrollTop = prevDialogScroll;
    }

    bindWorkspaceEvents();
  };

  const render = () => {
    if (isRendering) return;
    isRendering = true;
    try {
      if (!session) {
        renderLoginScreen();
      } else {
        renderWorkspace();
      }
    } finally {
      isRendering = false;
    }
  };

  const scrollToMobileSection = (selector: string) => {
    if (window.innerWidth > 820) return;
    window.requestAnimationFrame(() => {
      const target = dialog.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  };

  const bindWorkspaceEvents = () => {
    const skipTitleNames = new Set([
      'email',
      'year',
      'finalistNumber',
      'currentPasscode',
      'newPasscode',
      'operatorName',
    ]);
    dialog
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        '.admin-form-body input[type="text"], .admin-form-body textarea',
      )
      .forEach((fieldEl) => {
        if (skipTitleNames.has(fieldEl.name)) return;
        fieldEl.addEventListener('input', (ev) => {
          if ((ev as InputEvent).isComposing) return;
          const nextVal = toTitleCaseLive(fieldEl.value);
          if (fieldEl.value !== nextVal) {
            const start = fieldEl.selectionStart;
            const end = fieldEl.selectionEnd;
            fieldEl.value = nextVal;
            if (start !== null && end !== null) {
              try {
                fieldEl.setSelectionRange(start, end);
              } catch {
                // ignore
              }
            }
          }
        });
        fieldEl.addEventListener('blur', () => {
          if (!fieldEl.value.trim()) return;
          if (fieldEl.tagName === 'TEXTAREA') {
            fieldEl.value = fieldEl.value
              .split(/\r?\n/)
              .map((line) => toTitleCaseWords(line))
              .join('\n');
          } else {
            fieldEl.value = toTitleCaseWords(fieldEl.value);
          }
        });
      });

    dialog.querySelectorAll('[data-admin-close]').forEach((btn) => {
      btn.addEventListener('click', () => dialog.close());
    });

    dialog.querySelectorAll('[data-admin-logout]').forEach((btn) => {
      btn.addEventListener('click', () => {
        clearAdminSession();
        session = null;
        pendingConfirm = null;
        render();
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-admin-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = (btn.dataset.adminTab as AdminTab) || 'overview';
        activeTab = nextTab;
        pendingConfirm = null;
        openRowMenuId = null;
        notifPopoverOpen = false;
        uploadStatNote = '';
        render();
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-settings-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        settingsSubTab = (btn.dataset.settingsSubtab as SettingsSubTab) || 'visimisi';
        pendingConfirm = null;
        render();
      });
    });

    const globalSearchInput = dialog.querySelector<HTMLInputElement>('[data-admin-global-search]');
    globalSearchInput?.addEventListener('input', () => {
      globalSearchQuery = globalSearchInput.value;
      const caret = globalSearchInput.selectionStart ?? globalSearchQuery.length;
      render();
      const restored = dialog.querySelector<HTMLInputElement>('[data-admin-global-search]');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(caret, caret);
      }
    });

    dialog.querySelector('[data-admin-clear-search]')?.addEventListener('click', () => {
      globalSearchQuery = '';
      render();
    });

    dialog.querySelectorAll<HTMLElement>('[data-global-hit-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hitTab = (btn.dataset.hitTab as AdminTab) || 'overview';
        activeTab = hitTab;
        if (btn.dataset.hitRegId) selectedRegId = btn.dataset.hitRegId;
        if (btn.dataset.hitYear) selectedYear = btn.dataset.hitYear;
        if (btn.dataset.hitRole) selectedRole = btn.dataset.hitRole as RoleFilter;
        if (btn.dataset.hitSlot !== undefined) selectedSlotIndex = Number(btn.dataset.hitSlot) || 0;
        if (btn.dataset.hitEventId) selectedEventId = btn.dataset.hitEventId;
        if (btn.dataset.hitBoardId) selectedBoardId = btn.dataset.hitBoardId;
        globalSearchQuery = '';
        notifPopoverOpen = false;
        openRowMenuId = null;
        render();
      });
    });

    dialog.querySelector('[data-admin-notif-toggle]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPopoverOpen = !notifPopoverOpen;
      openRowMenuId = null;
      render();
    });

    if (openRowMenuId || notifPopoverOpen) {
      dialog.querySelector('.admin-shell')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (target.closest('.admin-row-actions') || target.closest('.admin-notif-wrap')) return;
        openRowMenuId = null;
        notifPopoverOpen = false;
        render();
      });
    }

    // 3D Bar Chart interactive selection
    dialog.querySelectorAll<Element>('[data-bar-group]').forEach((el) => {
      const selectBar = () => {
        const idx = Number((el as HTMLElement).dataset.barGroup);
        if (!Number.isNaN(idx)) {
          overviewBarFocusIdx = idx;
          render();
        }
      };
      el.addEventListener('click', selectBar);
      el.addEventListener('keydown', (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' || ke.key === ' ') {
          ke.preventDefault();
          selectBar();
        }
      });
    });

    dialog.querySelector<HTMLSelectElement>('[data-overview-filter]')?.addEventListener('change', (e) => {
      overviewActivityFilter = ((e.currentTarget as HTMLSelectElement).value as typeof overviewActivityFilter) || 'all';
      openRowMenuId = null;
      render();
    });

    dialog.querySelector('[data-overview-sort]')?.addEventListener('click', () => {
      overviewSortOrder = overviewSortOrder === 'newest' ? 'oldest' : 'newest';
      openRowMenuId = null;
      render();
    });

    dialog.querySelectorAll<HTMLElement>('[data-overview-dots]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.overviewDots || null;
        openRowMenuId = openRowMenuId === uid ? null : uid;
        notifPopoverOpen = false;
        render();
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-overview-close-menu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openRowMenuId = null;
        render();
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-overview-open-row]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = (btn.dataset.overviewTargetTab as AdminTab) || 'overview';
        const regId = btn.dataset.overviewRegId;
        activeTab = targetTab;
        if (regId) selectedRegId = regId;
        openRowMenuId = null;
        notifPopoverOpen = false;
        render();
      });
    });

    // Export & Repomix
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
      showToast('Katalog Uda & Uni diekspor ke CSV.', 'success');
    });

    dialog.querySelector('[data-action="export-reg-csv"]')?.addEventListener('click', () => {
      const dateTag = new Date().toISOString().slice(0, 10);
      downloadTextFile(`pendaftar-2027-${dateTag}.csv`, exportRegistrations2027Csv(), 'text/csv;charset=utf-8');
      showToast('Data pendaftar 2027 diekspor ke CSV.', 'success');
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

    // Registrations 2027 bindings
    dialog.querySelectorAll<Element>('[data-reg-filter]').forEach((el) => {
      const applyFilter = () => {
        const nextFilter = (el as HTMLElement).dataset.regFilter as typeof regFilterStatus;
        regFilterStatus = regFilterStatus === nextFilter && nextFilter !== 'all' ? 'all' : nextFilter || 'all';
        previewRegDocOpen = false;
        zoomRegPhoto = null;
        render();
      };
      el.addEventListener('click', applyFilter);
      if (el.tagName.toLowerCase() === 'path') {
        el.addEventListener('keydown', (e: Event) => {
          const ke = e as KeyboardEvent;
          if (ke.key === 'Enter' || ke.key === ' ') {
            ke.preventDefault();
            applyFilter();
          }
        });
      }
    });

    dialog.querySelector<HTMLSelectElement>('[data-reg-role-filter]')?.addEventListener('change', (e) => {
      regFilterRole = ((e.currentTarget as HTMLSelectElement).value as typeof regFilterRole) || 'all';
      previewRegDocOpen = false;
      zoomRegPhoto = null;
      render();
    });

    dialog.querySelector<HTMLSelectElement>('[data-reg-region-filter]')?.addEventListener('change', (e) => {
      regFilterRegion = (e.currentTarget as HTMLSelectElement).value || 'all';
      previewRegDocOpen = false;
      zoomRegPhoto = null;
      render();
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-reset-filters]').forEach((btn) => {
      btn.addEventListener('click', () => {
        regFilterStatus = 'all';
        regFilterRole = 'all';
        regFilterRegion = 'all';
        regQuery = '';
        previewRegDocOpen = false;
        zoomRegPhoto = null;
        render();
      });
    });

    const regSearchInput = dialog.querySelector<HTMLInputElement>('[data-reg-search]');
    regSearchInput?.addEventListener('input', () => {
      regQuery = regSearchInput.value;
      const caret = regSearchInput.selectionStart ?? regQuery.length;
      render();
      const restored = dialog.querySelector<HTMLInputElement>('[data-reg-search]');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(caret, caret);
      }
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRegId = btn.dataset.regSelect || selectedRegId;
        previewRegDocOpen = false;
        zoomRegPhoto = null;
        render();
        scrollToMobileSection('.admin-split-editor');
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-copy-code]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.regCopyCode || '';
        if (!code) return;
        try {
          await navigator.clipboard.writeText(code);
          showToast(`Kode ${code} disalin.`, 'success');
        } catch {
          showToast(`Kode: ${code}`, 'info');
        }
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-copy-wa]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const wa = btn.dataset.regCopyWa || '';
        if (!wa) return;
        try {
          await navigator.clipboard.writeText(wa);
          showToast(`WhatsApp ${wa} disalin.`, 'success');
        } catch {
          showToast(`WhatsApp: ${wa}`, 'info');
        }
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-zoom-photo]').forEach((fig) => {
      fig.addEventListener('click', () => {
        const src = fig.dataset.regZoomPhoto || '';
        const title = fig.dataset.regZoomTitle || 'Foto Peserta';
        if (!src) return;
        zoomRegPhoto = {src, title};
        render();
      });
    });

    dialog.querySelectorAll('[data-reg-zoom-close]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target === e.currentTarget || (e.currentTarget as HTMLElement).tagName === 'BUTTON') {
          zoomRegPhoto = null;
          render();
        }
      });
    });

    dialog.querySelector<HTMLButtonElement>('[data-reg-toggle-doc]')?.addEventListener('click', (e) => {
      e.preventDefault();
      const btn = e.currentTarget as HTMLButtonElement;
      const section = btn.closest<HTMLElement>('[data-reg-doc-section]');
      const slot = section?.querySelector<HTMLElement>('[data-reg-doc-slot]');
      const docUrlVal = section?.dataset.regDocUrl || '';
      const docMime = section?.dataset.regDocMime || '';
      previewRegDocOpen = !previewRegDocOpen;

      if (slot && docUrlVal) {
        btn.textContent = previewRegDocOpen ? 'Tutup Pratinjau' : 'Pratinjau';
        if (previewRegDocOpen) {
          slot.innerHTML = docMime.startsWith('image/')
            ? `<div class="admin-doc-preview"><img src="${escapeHtml(docUrlVal)}" alt="Surat Rekomendasi"></div>`
            : `<div class="admin-doc-preview"><iframe src="${escapeHtml(docUrlVal)}" title="Pratinjau Surat Rekomendasi"></iframe></div>`;
        } else {
          slot.innerHTML = '';
        }
        return;
      }
      render();
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-note-preset]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const noteEl = dialog.querySelector<HTMLTextAreaElement>('#reg-admin-note');
        const text = chip.dataset.regNotePreset || '';
        if (noteEl && text) {
          noteEl.value = text;
          noteEl.focus();
        }
      });
    });

    dialog.querySelector('[data-reg-jump-catalog]')?.addEventListener('click', () => {
      const current = (getCmsState().registrations2027 || []).find((r) => r.id === selectedRegId);
      if (!current) return;
      activeTab = 'catalog';
      selectedYear = '2027';
      selectedRole = current.role;
      selectedSlotIndex = current.assignedSlotIndex ?? 0;
      render();
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-decide]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = btn.dataset.regDecide as RegistrationStatus;
        const formEl = dialog.querySelector<HTMLFormElement>('[data-reg-decision-form]');
        if (!formEl || !selectedRegId || !status) return;
        const fd = new FormData(formEl);
        const reviewerNote = String(fd.get('reviewerNote') || '').trim();
        const finalistNumber = String(fd.get('finalistNumber') || '').trim();
        const fallbackNotes: Record<RegistrationStatus, string> = {
          pending: 'Menunggu verifikasi berkas oleh Panitia.',
          revision: 'Mohon periksa kembali kejelasan Surat Rekomendasi Kab/Kota atau foto potret.',
          approved: 'Berkas & Surat Rekomendasi terverifikasi sah sebagai Finalis Pemilihan 2027.',
          rejected: 'Berkas belum memenuhi persyaratan administratif utusan Kabupaten/Kota.',
        };

        const executeDecision = () => {
          const res = reviewRegistration2027(selectedRegId, {
            status,
            reviewerNote: reviewerNote || fallbackNotes[status],
            finalistNumber,
            operatorName: session?.operatorName,
          });
          if (!res.ok) {
            showToast(res.error, 'error');
            return;
          }
          if (status === 'approved') {
            showToast(`Berkas disahkan! Masuk ke Katalog 2027 (No. ${res.registration.finalistNumber ?? '-'}).`, 'success');
          } else if (status === 'revision') {
            showToast('Status diubah menjadi Perlu Revisi.', 'info');
          } else if (status === 'pending') {
            showToast('Dikembalikan ke antrean menunggu.', 'info');
          } else {
            showToast('Berkas pendaftar ditolak.', 'info');
          }
        };

        if (status === 'rejected') {
          const target = (getCmsState().registrations2027 || []).find((r) => r.id === selectedRegId);
          pendingConfirm = {
            key: `reject-reg-${selectedRegId}`,
            label: `Tolak berkas pendaftar ${target?.regCode ?? ''} (${target?.shortName ?? ''})?`,
            onConfirm: executeDecision,
          };
          render();
          return;
        }

        executeDecision();
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-reg-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.regDelete;
        const target = (getCmsState().registrations2027 || []).find((r) => r.id === id);
        if (!id || !target) return;
        pendingConfirm = {
          key: `del-reg-${id}`,
          label: `Hapus permanen berkas ${target.regCode} (${target.shortName})?`,
          onConfirm: () => {
            deleteRegistration2027(id, session?.operatorName);
            selectedRegId = getCmsState().registrations2027[0]?.id ?? '';
            previewRegDocOpen = false;
            zoomRegPhoto = null;
            showToast('Berkas pendaftar dihapus.', 'info');
          },
        };
        render();
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
      next.catalogYears.unshift(createTemplateYearLineup(yearStr, 'draft'));
      next.catalogYears.sort((a, b) => Number(b.year) - Number(a.year));
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Katalog',
        action: 'Tambah Tahun Angkatan',
        summary: `Menambahkan angkatan ${yearStr} (Draft, daftar kosong siap diisi peserta terdaftar).`,
      });
      newYearMode = false;
      selectedYear = yearStr;
      selectedSlotIndex = 0;
      showToast(`Angkatan ${yearStr} dibuat (status Draft). Daftar akan terisi sesuai peserta yang terdaftar.`, 'success');
    });

    dialog.querySelector('[data-cat-toggle-year-status]')?.addEventListener('click', () => {
      const next = cloneState();
      const target = next.catalogYears.find((y) => y.year === selectedYear);
      if (!target) return;
      if (target.status === 'draft' && (target.uda.length === 0 || target.uni.length === 0)) {
        const missing =
          target.uda.length === 0 && target.uni.length === 0
            ? 'Uda dan Uni'
            : target.uda.length === 0
              ? 'Uda'
              : 'Uni';
        showToast(
          `Angkatan ${target.year} belum bisa ditayangkan: daftar ${missing} masih kosong. Sahkan pendaftar atau tambahkan peserta terlebih dahulu.`,
          'error',
        );
        return;
      }
      target.status = target.status === 'published' ? 'draft' : 'published';
      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Katalog',
        action: 'Ubah Status Angkatan',
        summary: `Angkatan ${target.year} → ${target.status === 'published' ? 'Tayang' : 'Draft'}.`,
      });
      showToast(
        target.status === 'published'
          ? `Angkatan ${target.year} ditampilkan di halaman publik (Tayang).`
          : `Angkatan ${target.year} disembunyikan dari halaman publik (Draft).`,
        'success',
      );
    });

    dialog.querySelectorAll<HTMLElement>('[data-cat-add-person]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = cloneState();
        const yearObj = next.catalogYears.find((y) => y.year === selectedYear);
        if (!yearObj) return;
        const list = selectedRole === 'uda' ? yearObj.uda : yearObj.uni;
        const usedRegions = new Set(list.map((p) => p.region.toLowerCase()));
        const nextRegion =
          SUMBAR_REGIONS.find((r) => !usedRegions.has(r.toLowerCase())) ?? SUMBAR_REGIONS[0];
        const created = createEmptyCatalogParticipant(selectedYear, selectedRole, list.length, nextRegion);
        list.push(created);
        saveCmsState(next, {
          operator: session?.operatorName,
          module: 'Katalog',
          action: 'Tambah Peserta Katalog',
          summary: `Menambahkan ${created.shortName} (${created.region}) pada angkatan ${selectedYear}.`,
        });
        selectedSlotIndex = list.length - 1;
        uploadStatNote = '';
        showToast(`Peserta ${selectedRole === 'uda' ? 'Uda' : 'Uni'} ditambahkan ke angkatan ${selectedYear}.`, 'success');
      });
    });

    dialog.querySelector('[data-cat-delete-person]')?.addEventListener('click', () => {
      const state = getCmsState();
      const yearObj = state.catalogYears.find((y) => y.year === selectedYear);
      const list = selectedRole === 'uda' ? yearObj?.uda : yearObj?.uni;
      const target = list?.[selectedSlotIndex];
      if (!yearObj || !target) return;

      pendingConfirm = {
        key: `del-cat-${selectedYear}-${selectedRole}-${selectedSlotIndex}`,
        label: `Hapus ${target.shortName || target.fullName} dari Katalog ${selectedYear}?`,
        onConfirm: () => {
          const next = cloneState();
          const nextYear = next.catalogYears.find((y) => y.year === selectedYear);
          if (!nextYear) return;
          const roleKey = selectedRole;
          const removed = nextYear[roleKey][selectedSlotIndex];
          nextYear[roleKey] = nextYear[roleKey]
            .filter((_, idx) => idx !== selectedSlotIndex)
            .map((p, idx) => ({...p, slotIndex: idx}));

          if (nextYear.uda.length === 0 || nextYear.uni.length === 0) {
            nextYear.status = 'draft';
          }

          if (selectedYear === '2027' && removed) {
            for (const reg of next.registrations2027 || []) {
              if (reg.role !== roleKey) continue;
              if (removed.sourceRegistrationId && reg.id === removed.sourceRegistrationId) {
                delete reg.assignedSlotIndex;
              } else if (reg.status === 'approved') {
                const idx = nextYear[roleKey].findIndex((p) => p.sourceRegistrationId === reg.id);
                if (idx >= 0) reg.assignedSlotIndex = idx;
                else delete reg.assignedSlotIndex;
              }
            }
          }

          selectedSlotIndex = Math.max(0, Math.min(selectedSlotIndex, nextYear[roleKey].length - 1));
          uploadStatNote = '';
          saveCmsState(next, {
            operator: session?.operatorName,
            module: 'Katalog',
            action: 'Hapus Peserta Katalog',
            summary: `Menghapus ${target.shortName || target.fullName} (${target.region}) dari angkatan ${selectedYear}.`,
          });
          showToast('Peserta dihapus dari katalog.', 'info');
        },
      };
      render();
    });

    dialog.querySelector('[data-cat-preview-hero]')?.addEventListener('click', () => {
      const yearObj = getCmsState().catalogYears.find((y) => y.year === selectedYear);
      if (!yearObj || yearObj.uda.length === 0 || yearObj.uni.length === 0) {
        showToast('Minimal harus ada 1 Uda dan 1 Uni untuk pratinjau di Hero Section.', 'error');
        return;
      }
      setDraftPreviewYear(selectedYear);
      dialog.close();
      const runwayEl = document.querySelector<HTMLElement & {setYear?: (y: string, r?: boolean, i?: boolean) => void}>('runway-section');
      runwayEl?.setYear?.(selectedYear, true, true);
      window.scrollTo({top: 0, behavior: 'smooth'});
      syncDraftPreviewBanner();
    });

    dialog.querySelector('[data-cat-export-year-json]')?.addEventListener('click', () => {
      const jsonStr = exportCatalogYearPackageJson(selectedYear);
      downloadTextFile(`katalog-${selectedYear}-rilis.json`, jsonStr, 'application/json');
      showToast(`Paket rilis statis katalog-${selectedYear}-rilis.json diunduh.`, 'success');
    });

    dialog.querySelector('[data-cat-sort-finalist]')?.addEventListener('click', () => {
      const changed = sortCatalogByFinalistNumber(selectedYear, selectedRole, session?.operatorName);
      if (changed) {
        selectedSlotIndex = 0;
        showToast(`Daftar ${selectedRole === 'uda' ? 'Uda' : 'Uni'} diurutkan berdasarkan nomor finalis.`, 'success');
      }
    });

    dialog.querySelectorAll<HTMLElement>('[data-cat-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.catMove;
        const targetIdx =
          dir === 'top' ? 0 : dir === 'up' ? selectedSlotIndex - 1 : selectedSlotIndex + 1;
        const nextIdx = reorderCatalogParticipant(
          selectedYear,
          selectedRole,
          selectedSlotIndex,
          targetIdx,
          session?.operatorName,
        );
        if (nextIdx !== selectedSlotIndex) {
          selectedSlotIndex = nextIdx;
          showToast(
            nextIdx === 0
              ? 'Dipindahkan ke urutan #1 (posisi tengah saat Hero Section dibuka).'
              : `Dipindahkan ke urutan #${nextIdx + 1}.`,
            'success',
          );
        }
      });
    });

    dialog.querySelector<HTMLInputElement>('[data-cat-upload-photo]')?.addEventListener('change', async (e) => {
      const file = (e.currentTarget as HTMLInputElement).files?.[0];
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
          summary: `${person.shortName} (${selectedYear}) — ${formatBytesCompact(res.compressedBytes)}.`,
        });
        const bgNote = res.hasTransparency
          ? 'Latar transparan ✓'
          : 'Latar belakang masih solid (disarankan PNG/WebP transparan)';
        uploadStatNote = `${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)} (${res.width}×${res.height}px) · ${bgNote}`;
        showToast(
          res.hasTransparency
            ? 'Foto transparan berhasil disimpan & dioptimalkan.'
            : 'Foto disimpan (disarankan versi transparan agar menyatu rapi di Hero).',
          'success',
        );
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
        action: 'Hapus Foto Duta',
        summary: `Menghapus foto ${person.shortName} (${selectedYear}).`,
      });
      showToast('Foto peserta dihapus.', 'info');
    });

    dialog.querySelector<HTMLFormElement>('[data-cat-save-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const next = cloneState();
      const yearObj = next.catalogYears.find((y) => y.year === selectedYear);
      const list = selectedRole === 'uda' ? yearObj?.uda : yearObj?.uni;
      const person = list?.[selectedSlotIndex];
      if (!person) return;

      person.fullName = toTitleCaseWords(String(fd.get('fullName') || person.fullName));
      person.shortName = toTitleCaseWords(String(fd.get('shortName') || person.shortName));
      person.rankLabel = toTitleCaseWords(String(fd.get('rankLabel') || person.rankLabel));
      person.region = toTitleCaseWords(String(fd.get('region') || person.region));
      const finalistNumber = normalizeTwoDigitFinalistNumber(String(fd.get('finalistNumber') || ''));
      if (finalistNumber) person.finalistNumber = finalistNumber;
      else delete person.finalistNumber;
      const age = String(fd.get('age') || '').trim();
      if (age) person.age = age;
      else delete person.age;
      person.education = toTitleCaseWords(String(fd.get('education') || ''));
      person.profession = toTitleCaseWords(String(fd.get('profession') || ''));
      person.advocacy = toTitleCaseWords(String(fd.get('advocacy') || ''));
      const achievementsList = String(fd.get('achievementsText') || '')
        .split(/\r?\n/)
        .map((line) => toTitleCaseWords(line))
        .filter(Boolean);
      const singleAchievement = toTitleCaseWords(String(fd.get('achievement') || ''));
      if (achievementsList.length > 0) {
        person.achievements = achievementsList;
        person.achievement = singleAchievement || achievementsList.join(' · ');
      } else {
        delete person.achievements;
        person.achievement = singleAchievement;
      }
      person.bio = toTitleCaseWords(String(fd.get('bio') || ''));

      saveCmsState(next, {
        operator: session?.operatorName,
        module: 'Katalog',
        action: 'Perbarui Profil Duta',
        summary: `${person.fullName || person.shortName} (${person.region}, ${selectedYear}).`,
      });
      showToast(`Profil ${person.fullName || person.shortName} tersimpan.`, 'success');
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
        action: 'Tambah Kegiatan',
        summary: `Menambahkan "${created.title}".`,
      });
      selectedEventId = created.id;
      showToast('Kegiatan baru ditambahkan.', 'info');
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
          action: 'Urutkan Kegiatan',
          summary: `"${item.title}" → #${targetIdx + 1}.`,
        });
        showToast('Urutan kegiatan diperbarui.', 'success');
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-ev-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.evDelete;
        const target = getCmsState().events.find((ev) => ev.id === id);
        if (!id || !target) return;
        pendingConfirm = {
          key: `del-ev-${id}`,
          label: `Hapus kegiatan "${target.title}"?`,
          onConfirm: () => {
            const next = cloneState();
            next.events = next.events.filter((ev) => ev.id !== id);
            saveCmsState(next, {
              operator: session?.operatorName,
              module: 'Event',
              action: 'Hapus Kegiatan',
              summary: `Menghapus "${target.title}".`,
            });
            selectedEventId = next.events[0]?.id ?? '';
            showToast('Kegiatan dihapus.', 'info');
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
          action: 'Unggah Foto Kegiatan',
          summary: `"${ev.title}" (${formatBytesCompact(res.compressedBytes)}).`,
        });
        uploadStatNote = `${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)} (${res.width}×${res.height}px)`;
        showToast('Foto kegiatan diperbarui.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memproses foto.', 'error');
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
        action: 'Simpan Kegiatan',
        summary: `"${ev.title}" (${ev.status === 'published' ? 'Tayang' : 'Draft'}).`,
      });
      showToast(`Kegiatan "${ev.title}" tersimpan.`, 'success');
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
        summary: items.map((i) => `${i.label}: ${i.value}`).join(', '),
      });
      showToast('Ringkasan angka diperbarui.', 'success');
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
        action: 'Tambah Pengurus',
        summary: `Menambahkan "${created.cardName}".`,
      });
      selectedBoardId = created.id;
      showToast('Pengurus baru ditambahkan.', 'info');
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
          summary: `"${item.cardName}" → #${targetIdx + 1}.`,
        });
        showToast('Urutan pengurus diperbarui.', 'success');
      });
    });

    dialog.querySelectorAll<HTMLElement>('[data-bd-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.bdDelete;
        const target = getCmsState().boardMembers.find((m) => m.id === id);
        if (!id || !target) return;
        pendingConfirm = {
          key: `del-bd-${id}`,
          label: `Hapus pengurus "${target.name}"?`,
          onConfirm: () => {
            const next = cloneState();
            next.boardMembers = next.boardMembers.filter((m) => m.id !== id);
            saveCmsState(next, {
              operator: session?.operatorName,
              module: 'Pengurus',
              action: 'Hapus Pengurus',
              summary: `Menghapus "${target.name}".`,
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
          summary: `"${member.cardName}" (${formatBytesCompact(res.compressedBytes)}).`,
        });
        uploadStatNote = `${formatBytesCompact(res.originalBytes)} → ${formatBytesCompact(res.compressedBytes)} (${res.width}×${res.height}px)`;
        showToast('Foto pengurus diperbarui.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memproses foto.', 'error');
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
        summary: `"${member.name}" (${member.status === 'published' ? 'Tayang' : 'Draft'}).`,
      });
      showToast(`Profil ${member.cardName} tersimpan.`, 'success');
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
        summary: 'Memperbarui Visi, Misi, Sebaran & Sapta Pesona.',
      });
      showToast('Visi & Misi tersimpan.', 'success');
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
        showToast('Backup JSON berhasil diimpor.', 'success');
      } catch {
        showToast('Gagal membaca file JSON.', 'error');
      }
    });

    dialog.querySelectorAll<HTMLElement>('[data-reset-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.resetMod as 'catalog' | 'events' | 'board' | 'visimisi' | 'all';
        const labelMap: Record<typeof mod, string> = {
          catalog: 'Pulihkan Katalog Uda & Uni ke data bawaan?',
          events: 'Pulihkan Berita & Agenda ke data bawaan?',
          board: 'Pulihkan Pengurus 2027 ke data bawaan?',
          visimisi: 'Pulihkan Visi & Misi ke data bawaan?',
          all: 'Pulihkan seluruh data portal ke setelan bawaan?',
        };
        pendingConfirm = {
          key: `reset-${mod}`,
          label: labelMap[mod],
          onConfirm: () => {
            const updated = resetCmsModule(mod, session?.operatorName);
            selectedYear = updated.catalogYears[0]?.year ?? '2024';
            selectedEventId = updated.events[0]?.id ?? '';
            selectedBoardId = updated.boardMembers[0]?.id ?? '';
            showToast('Data dipulihkan ke bawaan.', 'info');
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
      showToast('Kata sandi admin berhasil diperbarui.', 'success');
    });
  };

  subscribeCmsChange(() => {
    if (!dialog.open || !session || isRendering) return;
    if (dialog.querySelector('input:focus, textarea:focus, select:focus')) return;
    if (activeTab === 'registrations' || activeTab === 'overview') {
      render();
    }
  });
}
