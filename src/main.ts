import {
  AmbassadorBio,
  CohortPhoto,
  PublicRegistrationStatusView,
  RegistrationStatus,
  RoleFilter,
  SUMBAR_REGIONS,
  UDA_PHOTOS,
  UNI_PHOTOS,
  YearLineup,
  formatBytesCompact,
  getCmsState,
  getPublishedBoardMembers,
  getPublishedCatalogYears,
  getPublishedEvents,
  hydrateCmsMediaUrls,
  lookupRegistrationStatus,
  resolveCmsImageUrl,
  saveCompressedAdminImage,
  saveRegistrationDocument,
  submitRegistration2027,
  subscribeCmsChange,
  toTitleCaseLive,
  toTitleCaseWords,
} from './cmsStore';
import {setupAdminPanel} from './adminPanel';

const DEFAULT_CATALOG_YEAR = '2024';

function getCatalogLineups(): YearLineup[] {
  return getPublishedCatalogYears();
}

interface ClassicBodyState {
  el: HTMLElement;
  idx: number;
  x: number;
  g: number;
  v: number;
  from: number;
  goal: number;
  trip: boolean;
  w: number;
  lastBlur: string;
}

interface RingBodyState {
  el: HTMLElement;
  idx: number;
  w: number;
  lastBlur: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const MEDIA_CACHE_NAME = 'uda-uni-media-cache-v3';
const FOOT_CACHE_STORAGE_KEY = 'uda-uni:foot-offsets:v1';

const decodedImageUrls = new Set<string>();
const decodedImageRefs = new Map<string, HTMLImageElement>();
const blobUrlCache = new Map<string, string>();
const preloadImagePromises = new Map<string, Promise<void>>();
const footOffsetCache = new Map<string, string>();
const footProbePromises = new Map<string, Promise<string | null>>();

let mediaCachePromise: Promise<Cache | null> | null = null;
let footSaveTimer = 0;

function hydrateFootOffsetCache(): void {
  try {
    const raw = window.localStorage.getItem(FOOT_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.length > 0) {
        footOffsetCache.set(k, v);
      }
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

function scheduleFootOffsetPersist(): void {
  if (footSaveTimer) return;
  footSaveTimer = window.setTimeout(() => {
    footSaveTimer = 0;
    try {
      const serialized: Record<string, string> = {};
      footOffsetCache.forEach((v, k) => {
        serialized[k] = v;
      });
      window.localStorage.setItem(FOOT_CACHE_STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      // Ignore quota or privacy storage errors
    }
  }, 400);
}

hydrateFootOffsetCache();

function getMediaCache(): Promise<Cache | null> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return Promise.resolve(null);
  }
  if (!mediaCachePromise) {
    mediaCachePromise = window.caches.open(MEDIA_CACHE_NAME).catch(() => null);
  }
  return mediaCachePromise;
}

function resolveCachedMediaUrl(url: string): string {
  if (url.startsWith('cms-media://')) {
    return resolveCmsImageUrl(url);
  }
  return blobUrlCache.get(url) ?? url;
}

async function ensureBlobUrlFromCache(url: string, highPriority = false): Promise<string> {
  if (url.startsWith('cms-media://')) {
    return resolveCmsImageUrl(url);
  }
  const existingBlob = blobUrlCache.get(url);
  if (existingBlob) return existingBlob;

  try {
    const cache = await getMediaCache();
    if (cache) {
      const cachedRes = await cache.match(url);
      if (cachedRes) {
        const blob = await cachedRes.blob();
        if (blob.size > 0) {
          const objUrl = URL.createObjectURL(blob);
          blobUrlCache.set(url, objUrl);
          return objUrl;
        }
      }

      const fetchInit: RequestInit & {priority?: string} = {
        cache: 'force-cache',
      };
      if (highPriority) fetchInit.priority = 'high';

      const netRes = await fetch(url, fetchInit);
      if (netRes && netRes.ok) {
        await cache.put(url, netRes.clone());
        const blob = await netRes.blob();
        if (blob.size > 0) {
          const objUrl = URL.createObjectURL(blob);
          blobUrlCache.set(url, objUrl);
          return objUrl;
        }
      }
    }
  } catch {
    // Fallback cleanly to standard browser image loading
  }
  return url;
}

function registerMediaCacheWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const start = () => {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(() => {
      // Ignore registration error if preview environment restricts SW
    });
  };
  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, {once: true});
  }
}

function getPreferredPhotoUrl(photo: CohortPhoto): string {
  if (!photo.full || photo.full === photo.thumb) return photo.thumb;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const renderWidth = width >= 1800 ? 540 : width >= 750 ? 420 : 320;
  return renderWidth * dpr > 680 ? photo.full : photo.thumb;
}

function preloadImageUrl(url: string, highPriority = false): Promise<void> {
  if (!url) return Promise.resolve();
  if (decodedImageRefs.has(url)) {
    decodedImageUrls.add(url);
    return Promise.resolve();
  }
  const existing = preloadImagePromises.get(url);
  if (existing) return existing;

  const task = ensureBlobUrlFromCache(url, highPriority).then(
    (resolvedUrl) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        if ('fetchPriority' in img) {
          (img as HTMLImageElement & {fetchPriority?: string}).fetchPriority = highPriority ? 'high' : 'low';
        }
        const done = () => {
          decodedImageUrls.add(url);
          decodedImageRefs.set(url, img);
          resolve();
        };
        const fail = () => resolve();

        img.src = resolvedUrl;
        if (typeof img.decode === 'function') {
          img
            .decode()
            .then(done)
            .catch(() => {
              if (img.complete && img.naturalWidth > 0) done();
              else {
                img.addEventListener('load', done, {once: true});
                img.addEventListener('error', fail, {once: true});
              }
            });
        } else if (img.complete && img.naturalWidth > 0) {
          done();
        } else {
          img.addEventListener('load', done, {once: true});
          img.addEventListener('error', fail, {once: true});
        }
      }),
  );

  preloadImagePromises.set(url, task);
  return task;
}

function measureFootOffset(probeUrl: string): Promise<string | null> {
  const cached = footOffsetCache.get(probeUrl);
  if (cached !== undefined) return Promise.resolve(cached);

  const pending = footProbePromises.get(probeUrl);
  if (pending) return pending;

  const task = new Promise<string | null>((resolve) => {
    const probe = new Image();
    probe.decoding = 'async';
    if (!probeUrl.startsWith('/') && !probeUrl.startsWith('blob:') && !probeUrl.startsWith('cms-media://')) {
      probe.crossOrigin = 'anonymous';
    }
    probe.onload = () => {
      try {
        if (!probe.naturalWidth || !probe.naturalHeight) {
          resolve(null);
          return;
        }
        const w = 48;
        const h = Math.max(1, Math.round((w * probe.naturalHeight) / probe.naturalWidth));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(probe, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let lastRow = h - 1;
        let found = false;
        for (let y = h - 1; y >= 0; y--) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 40) {
              lastRow = y;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) {
          resolve(null);
          return;
        }
        const footStr = clamp((h - 1 - lastRow) / h, 0, 0.4).toFixed(4);
        footOffsetCache.set(probeUrl, footStr);
        scheduleFootOffsetPersist();
        resolve(footStr);
      } catch {
        resolve(null);
      }
    };
    probe.onerror = () => resolve(null);
    probe.src = resolveCachedMediaUrl(probeUrl);
  });

  footProbePromises.set(probeUrl, task);
  return task;
}

function decodeModelImage(img: HTMLImageElement, targetKey?: string): void {
  const show = () => {
    if (targetKey) decodedImageUrls.add(targetKey);
    img.classList.add('is-decoded');
  };
  const handleError = () => {
    const rawSrc = img.dataset.rawSrc;
    if (rawSrc && img.src !== rawSrc && !img.dataset.rawFallbackTried) {
      img.dataset.rawFallbackTried = '1';
      img.removeAttribute('srcset');
      img.src = rawSrc;
      img.addEventListener('load', show, {once: true});
      return;
    }
    show();
  };
  if (img.complete && img.naturalWidth > 0) {
    show();
    return;
  }
  if (typeof img.decode === 'function') {
    img
      .decode()
      .then(show)
      .catch(() => {
        if (img.complete && img.naturalWidth > 0) {
          show();
        } else {
          img.addEventListener('load', show, {once: true});
          img.addEventListener('error', handleError, {once: true});
        }
      });
  } else {
    img.addEventListener('load', show, {once: true});
    img.addEventListener('error', handleError, {once: true});
  }
}

class RunwaySection extends HTMLElement {
  private LOOK_COUNT: number = SUMBAR_REGIONS.length; // Dinamis sesuai jumlah utusan per tahun (mis. 16 utk 2024/2022)
  private BODY_COUNT: number = this.LOOK_COUNT * Math.ceil(8 / this.LOOK_COUNT);
  private readonly K = 95;
  private readonly C = 2 * Math.sqrt(95);

  private stage!: HTMLElement;
  private actorsEl!: HTMLElement;
  private heroesEl!: HTMLElement;
  private panelEl!: HTMLElement | null;
  private liveEl!: HTMLElement | null;
  private piecesEl!: HTMLElement | null;
  private panelTitleEl!: HTMLElement | null;
  private yearBadgeEl!: HTMLElement | null;
  private autoBtn!: HTMLButtonElement | null;
  private cursorEl!: HTMLElement | null;
  private lbEl!: HTMLElement | null;
  private lbStageEl!: HTMLElement | null;
  private lbKickerEl!: HTMLElement | null;
  private lbNameEl!: HTMLElement | null;
  private lbCloseBtn!: HTMLButtonElement | null;

  private heroes: HTMLElement[] = [];
  private ticks: HTMLButtonElement[] = [];
  private panels: HTMLElement[] = [];
  private roleButtons: HTMLButtonElement[] = [];
  private yearButtons: HTMLButtonElement[] = [];
  private ringBodies: RingBodyState[] = [];
  private classicBodies: ClassicBodyState[] = [];
  private panelCache = new Map<string, {mhead: HTMLElement; ul: HTMLElement}[]>();

  private index = 0;
  private activeYear = getCatalogLineups()[0]?.year ?? DEFAULT_CATALOG_YEAR;
  private roleFilter: RoleFilter = 'uda';
  private activePanelRole: 'uda' | 'uni' = 'uda';
  private panelOpen = false;
  private target = 0;
  private cur = 0;
  private vel = 0;
  private still = false;
  private mode: 'ring' | 'classic' = 'ring';
  private isMobile = false;

  private W = 800;
  private H = 600;
  private fs = 1.08;
  private unit = 240;
  private latchedVh = 0;
  private latchedW = 0;

  private reducedMotion = false;
  private mqlMotion!: MediaQueryList;
  private visible = true;
  private playing = false;
  private engaged = false;
  private panelHover = false;
  private zoomed = false;
  private dragging = false;

  private rafId = 0;
  private measureRaf = 0;
  private roleSwitchRaf = 0;
  private lastTs = 0;
  private lastFrameH = -1;
  private lastModelH = -1;
  private autoTimer = 0;
  private resizeTimer = 0;
  private wheelLock = 0;
  private wheelAcc = 0;
  private lbClearTimer = 0;
  private suppressClickUntil = 0;
  private preloadTimer = 0;
  private preloadIdleId = 0;
  private preloadGen = 0;
  private tickMarqueeTimer = 0;

  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTarget = 0;
  private dragActive = false;
  private dragAbandoned = false;
  private dragSamples: {x: number; time: number}[] = [];

  private cursorTargetX = 0;
  private cursorTargetY = 0;
  private cursorX = 0;
  private cursorY = 0;
  private cursorRaf = 0;
  private cursorHoverCapable = false;

  private visObserver: IntersectionObserver | null = null;
  private revealObserver: IntersectionObserver | null = null;
  private stageResizeObserver: ResizeObserver | null = null;
  private cleanups: (() => void)[] = [];

  connectedCallback(): void {
    this.stage = this.querySelector('[data-rw-stage]')!;
    this.actorsEl = this.querySelector('[data-rw-actors]')!;
    this.heroesEl = this.querySelector('[data-rw-heroes]')!;
    this.panelEl = this.querySelector('.rw__panel');
    this.liveEl = this.querySelector('[data-rw-live]');
    this.piecesEl = this.querySelector('[data-rw-pieces]');
    this.panelTitleEl = this.querySelector('[data-rw-panel-title]');
    this.yearBadgeEl = this.querySelector('[data-rw-year-badge]');
    this.autoBtn = this.querySelector('[data-rw-auto]');
    this.cursorEl = this.querySelector('[data-rw-cursor]');
    this.lbEl = this.querySelector('[data-rw-lb]');
    this.lbStageEl = this.querySelector('[data-rw-lb-stage]');
    this.lbKickerEl = this.querySelector('[data-rw-lb-kicker]');
    this.lbNameEl = this.querySelector('[data-rw-lb-name]');
    this.lbCloseBtn = this.querySelector('[data-rw-zoom-close]');

    this.renderYearButtons();
    this.syncSlotCount();
    this.ensureSlotMarkup();

    this.heroes = Array.from(this.querySelectorAll<HTMLElement>('[data-rw-hero]'));
    this.ticks = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-rw-tick]'));
    this.panels = Array.from(this.querySelectorAll<HTMLElement>('[data-rw-panel]'));
    this.roleButtons = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-rw-role]'));
    this.yearButtons = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-rw-year]'));

    this.mqlMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.mqlMotion.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      this.reducedMotion = e.matches;
      if (this.reducedMotion) {
        this.play(false);
        this.classList.add('is-revealed');
      }
    };
    this.mqlMotion.addEventListener('change', onMotionChange);
    this.cleanups.push(() => this.mqlMotion.removeEventListener('change', onMotionChange));

    this.classList.add('rw--js');

    this.renderAllPanels();
    this.syncRoleLabels();
    this.setupBodies();
    this.syncStageGroupMedia();
    this.setupImagesAndFeet();
    this.setupCursor();
    this.setupObservers();
    this.setupListeners();
    this.scheduleOppositeRolePreload();

    const startOffset = this.reducedMotion ? 0 : 1.15;
    this.index = 0;
    this.target = 0;
    this.cur = -startOffset;
    this.vel = 0;
    for (let a = 0; a < this.BODY_COUNT; a++) {
      const cb = this.classicBodies[a];
      cb.goal = a;
      cb.x = a + startOffset;
      cb.g = a + startOffset;
      cb.v = 0;
      cb.from = a + startOffset;
      cb.trip = false;
    }

    this.measure();
    this.setIndex(0, true);

    if (this.reducedMotion) {
      this.classList.add('is-revealed');
      this.cur = 0;
      this.setStill(true);
      this.renderAll();
    } else {
      this.kick();
      if (this.dataset.autoplay === 'true') {
        this.play(true);
      }
    }
  }

  disconnectedCallback(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.cursorRaf) cancelAnimationFrame(this.cursorRaf);
    if (this.measureRaf) cancelAnimationFrame(this.measureRaf);
    if (this.roleSwitchRaf) cancelAnimationFrame(this.roleSwitchRaf);
    window.clearTimeout(this.autoTimer);
    window.clearTimeout(this.resizeTimer);
    window.clearTimeout(this.wheelLock);
    window.clearTimeout(this.lbClearTimer);
    window.clearTimeout(this.preloadTimer);
    window.clearTimeout(this.tickMarqueeTimer);
    if (this.preloadIdleId && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this.preloadIdleId);
    }
    this.visObserver?.disconnect();
    this.revealObserver?.disconnect();
    this.stageResizeObserver?.disconnect();
    document.body.classList.remove('is-profile-focus');
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }

  private renderYearButtons(): void {
    const container = this.querySelector<HTMLElement>('.rw__year-pills');
    if (!container) return;

    const existingThumb = container.querySelector('.pill-3d-thumb');
    container.innerHTML = '';
    if (existingThumb) {
      container.appendChild(existingThumb);
    } else {
      const thumb = document.createElement('span');
      thumb.className = 'pill-3d-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      container.appendChild(thumb);
    }

    getCatalogLineups().forEach((lineup) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = lineup.year === this.activeYear;
      btn.className = isActive ? 'rw__year-btn is-active' : 'rw__year-btn';
      btn.dataset.rwYear = lineup.year;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.textContent = lineup.year;
      container.appendChild(btn);
    });
  }

  private ensureSlotMarkup(): void {
    const lineup = this.getActiveYearLineup();
    const list = this.roleFilter === 'uda' ? lineup.uda : lineup.uni;
    const basePhotos = this.roleFilter === 'uda' ? UDA_PHOTOS : UNI_PHOTOS;

    if (this.actorsEl) {
      this.actorsEl.innerHTML = '';
      for (let i = 0; i < this.LOOK_COUNT; i++) {
        const person = list[i];
        const photo = person?.photo ?? basePhotos[i % basePhotos.length];
        const displayName = person ? person.fullName || person.shortName : '';
        const altText = person ? `${displayName} (${person.region}) - ${lineup.year}` : `Peserta ${i + 1}`;
        const model = document.createElement('div');
        model.className = 'rw__model';
        model.setAttribute('data-rw-model', '');
        model.dataset.index = String(i);
        model.setAttribute('aria-hidden', 'true');
        const resolvedThumb = resolveCachedMediaUrl(photo.thumb);
        const resolvedFull = photo.full ? resolveCachedMediaUrl(photo.full) : '';
        const srcsetAttr =
          resolvedFull && resolvedFull !== resolvedThumb
            ? ` srcset="${resolvedThumb} 640w, ${resolvedFull} 1080w"`
            : '';
        model.innerHTML = `
          <span class="rw__shadow" aria-hidden="true"></span>
          <div class="rw__figure" style="--rw-ar:0.5625">
            <div class="rw__art">
              <img src="${resolvedThumb}" data-raw-src="${photo.thumb}"${srcsetAttr} sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px" loading="${i <= 2 || i >= this.LOOK_COUNT - 2 ? 'eager' : 'lazy'}" decoding="async" width="1100" height="1956" draggable="false" data-model-image alt="${altText}">
              <button type="button" class="rw__hit" data-rw-go="${i}" aria-label="${altText}" tabindex="-1"></button>
            </div>
          </div>
        `;
        this.actorsEl.appendChild(model);
      }
    }

    if (this.heroesEl) {
      this.heroesEl.innerHTML = '';
      for (let i = 0; i < this.LOOK_COUNT; i++) {
        const person = list[i];
        const photo = person?.photo ?? basePhotos[i % basePhotos.length];
        const displayName = person ? person.fullName || person.shortName : '';
        const altText = person ? `${displayName} (${person.region}) - ${lineup.year}` : `Peserta ${i + 1}`;
        const hero = document.createElement('div');
        hero.className = i === 0 ? 'rw__hero is-on' : 'rw__hero';
        hero.setAttribute('data-rw-hero', '');
        hero.dataset.index = String(i);
        hero.dataset.name = altText;
        hero.dataset.label = person ? `${person.rankLabel} ${lineup.year}: ${altText}` : altText;
        hero.dataset.probe = photo.thumb;
        if (i !== 0) hero.setAttribute('aria-hidden', 'true');
        const resolvedThumb = resolveCachedMediaUrl(photo.thumb);
        const resolvedFull = photo.full ? resolveCachedMediaUrl(photo.full) : '';
        const srcsetAttr =
          resolvedFull && resolvedFull !== resolvedThumb
            ? ` srcset="${resolvedThumb} 640w, ${resolvedFull} 1080w"`
            : '';
        hero.innerHTML = `
          <div class="rw__morph">
            <span class="rw__shadow" aria-hidden="true"></span>
            <div class="rw__figure" style="--rw-ar:0.5625">
              <div class="rw__art">
                <img src="${resolvedThumb}" data-raw-src="${photo.thumb}"${srcsetAttr} sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" width="1100" height="1956" draggable="false" data-model-image alt="${altText}">
                <button type="button" class="rw__zoom" data-rw-zoom aria-label="Lihat profil: ${altText}" tabindex="${i === 0 ? '0' : '-1'}"></button>
              </div>
            </div>
          </div>
        `;
        this.heroesEl.appendChild(hero);
      }
    }

    const ticksEl = this.querySelector<HTMLElement>('.rw__ticks');
    if (ticksEl) {
      ticksEl.innerHTML = '';
      for (let i = 0; i < this.LOOK_COUNT; i++) {
        const person = list[i];
        const num = String(i + 1).padStart(2, '0');
        const displayName = person ? person.fullName || person.shortName : '';
        const labelText = person ? `${displayName} · ${person.region}` : `Slot ${num}`;
        const tick = document.createElement('button');
        tick.type = 'button';
        tick.className = 'rw__tick';
        tick.dataset.rwTick = String(i);
        tick.setAttribute('aria-current', i === 0 ? 'true' : 'false');
        tick.setAttribute('aria-label', person ? `${person.rankLabel} ${lineup.year}: ${labelText}` : labelText);
        tick.innerHTML = `<span class="rw__tick-bar"></span><span class="rw__tick-label"><span class="rw__tick-track"><span class="rw__tick-copy">${num}<span class="rw__tick-name">&nbsp;&nbsp;${labelText}</span></span><span class="rw__tick-copy rw__tick-copy--dup" aria-hidden="true">${num}<span class="rw__tick-name">&nbsp;&nbsp;${labelText}</span></span></span></span>`;
        ticksEl.appendChild(tick);
      }
    }

    const panelInner = this.querySelector<HTMLElement>('.rw__panel-inner');
    if (panelInner) {
      panelInner.querySelectorAll('[data-rw-panel]').forEach((el) => el.remove());
      for (let i = 0; i < this.LOOK_COUNT; i++) {
        const panel = document.createElement('div');
        panel.className = i === 0 ? 'rw__look-panel is-in' : 'rw__look-panel';
        panel.dataset.rwPanel = String(i);
        if (i !== 0) panel.hidden = true;
        panelInner.appendChild(panel);
      }
    }
  }

  private renderBioCard(person: AmbassadorBio, cardIndex: number, year: string): HTMLElement {
    const li = document.createElement('li');
    li.className = 'rw__bio-card';
    li.dataset.rwCard = String(cardIndex);
    li.style.setProperty('--i', String(cardIndex));

    const header = document.createElement('div');
    header.className = 'rw__bio-header';

    const topRow = document.createElement('div');
    topRow.className = 'rw__bio-top';

    const badges = document.createElement('div');
    badges.className = 'rw__bio-badges';

    const pill = document.createElement('span');
    pill.className = `rw__role-pill${person.role === 'uni' ? ' is-uni' : ''}`;
    pill.textContent = person.rankLabel;

    const yearChip = document.createElement('span');
    yearChip.className = 'rw__bio-year-chip';
    yearChip.textContent = `Angkatan ${year}`;

    badges.append(pill, yearChip);

    if (person.finalistNumber) {
      const numChip = document.createElement('span');
      numChip.className = 'rw__bio-num-chip';
      numChip.textContent = `No. Finalis ${person.finalistNumber}`;
      badges.append(numChip);
    }

    topRow.append(badges);

    const nameHeading = document.createElement('h3');
    nameHeading.className = 'rw__bio-name';
    nameHeading.textContent = person.fullName;

    const roleDesc = document.createElement('p');
    roleDesc.className = 'rw__bio-role-desc';
    roleDesc.textContent = person.profession;

    header.append(topRow, nameHeading, roleDesc);

    const aboutSection = document.createElement('div');
    aboutSection.className = 'rw__bio-section';

    const aboutLabel = document.createElement('span');
    aboutLabel.className = 'rw__bio-section-label';
    aboutLabel.textContent = 'Biografi Singkat';

    const bioText = document.createElement('p');
    bioText.className = 'rw__bio-text';
    bioText.textContent = person.bio;

    aboutSection.append(aboutLabel, bioText);

    const metaCard = document.createElement('div');
    metaCard.className = 'rw__bio-meta-grid';

    const rows: {label: string; value?: string; bullets?: string[]; icon: string}[] = [
      {
        label: 'Utusan Daerah',
        value: `${person.region}, Provinsi Sumatera Barat`,
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>',
      },
    ];

    if (person.age?.trim()) {
      rows.push({
        label: 'Umur',
        value: person.age.trim(),
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
      });
    }

    if (person.education?.trim()) {
      rows.push({
        label: 'Pekerjaan / Pendidikan',
        value: person.education.trim(),
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M22 10L12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5"/></svg>',
      });
    }

    if (person.advocacy?.trim()) {
      rows.push({
        label: 'Fokus Advokasi',
        value: person.advocacy.trim(),
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m14.8 9.2-1.7 4.9-4.9 1.7 1.7-4.9 4.9-1.7Z"/></svg>',
      });
    }

    const achievementBullets = Array.isArray(person.achievements)
      ? person.achievements.map((item) => item.trim()).filter(Boolean)
      : [];

    if (achievementBullets.length > 0) {
      rows.push({
        label: 'Prestasi yang Pernah Diraih',
        bullets: achievementBullets,
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8.5" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/></svg>',
      });
    } else if (person.achievement?.trim()) {
      rows.push({
        label: 'Prestasi & Mandat',
        value: person.achievement.trim(),
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8.5" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/></svg>',
      });
    }

    for (const item of rows) {
      const row = document.createElement('div');
      row.className = 'rw__bio-meta-row';

      const iconBox = document.createElement('span');
      iconBox.className = 'rw__bio-meta-icon';
      iconBox.innerHTML = item.icon;

      const copy = document.createElement('div');
      copy.className = 'rw__bio-meta-copy';

      const span = document.createElement('span');
      span.textContent = item.label;
      copy.append(span);

      if (item.bullets && item.bullets.length > 0) {
        const list = document.createElement('ul');
        list.className = 'rw__bio-achievements';
        for (const bullet of item.bullets) {
          const itemEl = document.createElement('li');
          itemEl.textContent = bullet;
          list.appendChild(itemEl);
        }
        copy.append(list);
      } else if (item.value) {
        const strong = document.createElement('strong');
        strong.textContent = item.value;
        copy.append(strong);
      }

      row.append(iconBox, copy);
      metaCard.appendChild(row);
    }

    li.append(header, aboutSection, metaCard);
    return li;
  }

  private getActiveYearLineup(): YearLineup {
    const catalog = getCatalogLineups();
    return catalog.find((y) => y.year === this.activeYear) ?? catalog[0];
  }

  private getOrBuildPanelSet(year: string, role: 'uda' | 'uni'): {mhead: HTMLElement; ul: HTMLElement}[] {
    const cacheKey = `${year}:${role}`;
    const cached = this.panelCache.get(cacheKey);
    if (cached) return cached;

    const catalog = getCatalogLineups();
    const lineup = catalog.find((y) => y.year === year) ?? catalog[0];
    const items: {mhead: HTMLElement; ul: HTMLElement}[] = [];

    for (let i = 0; i < this.LOOK_COUNT; i++) {
      const person = role === 'uda' ? lineup.uda[i] : lineup.uni[i];
      if (!person) continue;

      const mhead = document.createElement('div');
      mhead.className = 'rw__mhead';
      const mTitle = document.createElement('span');
      mTitle.className = 'rw__mhead-title';
      mTitle.textContent = `${person.fullName || person.shortName} - ${lineup.year}`;

      const mLabel = document.createElement('span');
      mLabel.className = 'rw__label';
      mLabel.textContent = person.rankLabel;
      mhead.append(mTitle, mLabel);

      const ul = document.createElement('ul');
      ul.className = 'rw__items';
      ul.setAttribute('role', 'list');
      ul.appendChild(this.renderBioCard(person, role === 'uda' ? 1 : 2, lineup.year));

      items[i] = {mhead, ul};
    }

    this.panelCache.set(cacheKey, items);
    return items;
  }

  private renderAllPanels(): void {
    const lineup = this.getActiveYearLineup();
    const cachedSet = this.getOrBuildPanelSet(lineup.year, this.activePanelRole);

    for (let i = 0; i < this.LOOK_COUNT; i++) {
      const panel = this.panels[i];
      const entry = cachedSet[i];
      if (!panel || !entry) continue;
      panel.replaceChildren(entry.mhead, entry.ul);
    }
  }

  private syncRoleLabels(): void {
    const lineup = this.getActiveYearLineup();
    const list = this.roleFilter === 'uda' ? lineup.uda : lineup.uni;

    this.roleButtons.forEach((btn) => {
      const r = (btn.dataset.rwRole as RoleFilter) || 'uda';
      const active = r === this.roleFilter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      const countEl = btn.querySelector<HTMLElement>('.rw__role-count');
      if (countEl) {
        countEl.textContent = String(r === 'uda' ? lineup.uda.length : lineup.uni.length);
      }
    });

    const roleSwitchEl = this.querySelector<HTMLElement>('.rw__role-switch');
    if (roleSwitchEl) {
      roleSwitchEl.dataset.activeRole = this.roleFilter;
    }

    if (this.panelEl) {
      this.panelEl.dataset.panelRole = this.activePanelRole;
    }

    this.yearButtons.forEach((btn) => {
      const y = btn.dataset.rwYear || '';
      const active = y === this.activeYear;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (this.panelTitleEl) {
      this.panelTitleEl.textContent = this.activePanelRole === 'uda' ? 'Profil Uda' : 'Profil Uni';
    }

    if (this.yearBadgeEl) {
      this.yearBadgeEl.textContent = `Pemilihan ${lineup.year}`;
    }

    if (this.piecesEl) {
      this.piecesEl.textContent = `Angkatan ${lineup.year}`;
      this.piecesEl.classList.remove('is-swap');
      void this.piecesEl.offsetWidth;
      this.piecesEl.classList.add('is-swap');
    }

    this.ticks.forEach((tick, idx) => {
      const person = list[idx];
      if (!person) return;
      const displayName = person.fullName || person.shortName;
      const labelText = `${displayName} · ${person.region}`;
      tick.querySelectorAll('.rw__tick-name').forEach((nameSpan) => {
        nameSpan.innerHTML = `&nbsp;&nbsp;${labelText}`;
      });
      tick.setAttribute('aria-label', `${person.rankLabel} ${lineup.year}: ${labelText}`);
    });

    this.scheduleTickMarqueeSync();

    this.heroes.forEach((hero, idx) => {
      const person = list[idx];
      if (!person) return;
      const displayName = person.fullName || person.shortName;
      const labelText = `${displayName} (${person.region}) - ${lineup.year}`;
      hero.dataset.name = labelText;
      hero.dataset.label = `${person.rankLabel} ${lineup.year}: ${labelText}`;
    });

    if (this.zoomed && this.lbKickerEl) {
      const person = list[this.index];
      if (person) this.lbKickerEl.textContent = `${lineup.year} · ${person.rankLabel}`;
    }
    if (this.zoomed && this.lbNameEl) {
      this.lbNameEl.textContent = this.heroes[this.index]?.dataset.name || '';
    }

    this.emitStateChange();
  }

  private emitStateChange(): void {
    this.dispatchEvent(new CustomEvent('rw:statechange', {bubbles: true}));
  }

  public toggleAutoplay(): void {
    if (!this.playing) this.engaged = false;
    this.play(!this.playing);
  }

  public openActiveProfile(): void {
    this.engage();
    this.focusParticipant(this.getEffectivePanelRole());
  }

  public getActiveSummary(): {
    year: string;
    index: number;
    total: number;
    shortName: string;
    region: string;
    playing: boolean;
    zoomed: boolean;
  } {
    const lineup = this.getActiveYearLineup();
    const list = this.roleFilter === 'uda' ? lineup.uda : lineup.uni;
    const person = list[this.index] ?? list[0];
    return {
      year: lineup.year,
      index: this.index + 1,
      total: this.LOOK_COUNT,
      shortName: person?.fullName || person?.shortName || '',
      region: person?.region ?? '',
      playing: this.playing,
      zoomed: this.zoomed,
    };
  }

  private getPrioritizedSlotOrder(): number[] {
    const order: number[] = [];
    const seen = new Set<number>();
    const add = (idx: number) => {
      const norm = ((idx % this.LOOK_COUNT) + this.LOOK_COUNT) % this.LOOK_COUNT;
      if (!seen.has(norm)) {
        seen.add(norm);
        order.push(norm);
      }
    };
    add(this.index);
    for (let d = 1; d <= Math.floor(this.LOOK_COUNT / 2); d++) {
      add(this.index + d);
      add(this.index - d);
    }
    return order;
  }

  private getSlotPhoto(year: string, role: RoleFilter, idx: number, person?: AmbassadorBio): CohortPhoto {
    const catalog = getCatalogLineups();
    const lineup = catalog.find((y) => y.year === year) ?? catalog[0];
    const list = role === 'uda' ? lineup.uda : lineup.uni;
    const p = person ?? list[idx];
    const basePhotos = role === 'uda' ? UDA_PHOTOS : UNI_PHOTOS;
    const yearIdx = catalog.findIndex((y) => y.year === year);
    const offset = yearIdx >= 0 ? yearIdx : 0;
    return p?.photo ?? basePhotos[(idx + offset) % basePhotos.length] ?? basePhotos[idx % basePhotos.length];
  }

  private scheduleOppositeRolePreload(): void {
    const gen = ++this.preloadGen;
    window.clearTimeout(this.preloadTimer);
    if (this.preloadIdleId && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this.preloadIdleId);
      this.preloadIdleId = 0;
    }

    const oppRole: RoleFilter = this.roleFilter === 'uda' ? 'uni' : 'uda';
    const curRole: RoleFilter = this.roleFilter;
    const year = this.activeYear;
    const order = this.getPrioritizedSlotOrder();
    const seenUrls = new Set<string>();
    const urlsToWarm: string[] = [];
    const thumbsToMeasure: string[] = [];

    const pushPhoto = (photo: CohortPhoto) => {
      const preferred = getPreferredPhotoUrl(photo);
      if (!seenUrls.has(preferred)) {
        seenUrls.add(preferred);
        urlsToWarm.push(preferred);
      }
      if (!seenUrls.has(photo.thumb)) {
        seenUrls.add(photo.thumb);
        urlsToWarm.push(photo.thumb);
      }
      if (!footOffsetCache.has(photo.thumb)) {
        thumbsToMeasure.push(photo.thumb);
      }
    };

    // Prioritize opposite role of active year first (for instant Uda <-> Uni switching), then current role's remaining slots
    for (const idx of order) {
      pushPhoto(this.getSlotPhoto(year, oppRole, idx));
    }
    for (const idx of order) {
      pushPhoto(this.getSlotPhoto(year, curRole, idx));
    }

    // Also queue other catalog years into Cache Storage in background idle batches
    for (const contingent of getCatalogLineups()) {
      if (contingent.year === year) continue;
      for (const idx of order) {
        pushPhoto(this.getSlotPhoto(contingent.year, oppRole, idx));
        pushPhoto(this.getSlotPhoto(contingent.year, curRole, idx));
      }
    }

    const runWarmup = () => {
      if (gen !== this.preloadGen) return;

      // Pre-build opposite role DOM panel cache so Uda <-> Uni swap requires zero node creation
      this.getOrBuildPanelSet(year, oppRole);

      // Phase 1: warm up front 6 visible slots of opposite role into CacheStorage + decoded RAM immediately
      const frontUrls = urlsToWarm.slice(0, 6);
      const backUrls = urlsToWarm.slice(6);

      void Promise.all(frontUrls.map((u) => preloadImageUrl(u, true))).then(() => {
        if (gen !== this.preloadGen) return;

        // Pre-compute missing foot offsets for top opposite-role slots
        thumbsToMeasure.slice(0, 5).forEach((thumb) => {
          void measureFootOffset(thumb);
        });

        if (backUrls.length === 0) return;

        // Phase 2: warm up remaining queue into browser CacheStorage during idle time
        let cursor = 0;
        const warmNextBatch = () => {
          if (gen !== this.preloadGen) return;
          const batch = backUrls.slice(cursor, cursor + 4);
          cursor += 4;
          if (!batch.length) return;
          void Promise.all(batch.map((u) => preloadImageUrl(u, false))).then(() => {
            if (gen !== this.preloadGen || cursor >= backUrls.length) return;
            if (typeof window.requestIdleCallback === 'function') {
              this.preloadIdleId = window.requestIdleCallback(warmNextBatch, {timeout: 1200});
            } else {
              this.preloadTimer = window.setTimeout(warmNextBatch, 70);
            }
          });
        };

        if (typeof window.requestIdleCallback === 'function') {
          this.preloadIdleId = window.requestIdleCallback(warmNextBatch, {timeout: 700});
        } else {
          this.preloadTimer = window.setTimeout(warmNextBatch, 90);
        }
      });
    };

    this.preloadTimer = window.setTimeout(runWarmup, 40);
  }

  private syncStageGroupMedia(): void {
    const isUda = this.roleFilter === 'uda';
    const lineup = this.getActiveYearLineup();
    const list = isUda ? lineup.uda : lineup.uni;
    const order = this.getPrioritizedSlotOrder();

    for (let rank = 0; rank < order.length; rank++) {
      const idx = order[rank];
      const person = list[idx];
      if (!person) continue;
      const photo = this.getSlotPhoto(lineup.year, this.roleFilter, idx, person);
      const displayName = person.fullName || person.shortName;
      const altText = `${displayName} (${person.region}) - ${lineup.year}`;
      const hasDistinctFull = Boolean(photo.full && photo.full !== photo.thumb);
      const thumbSrc = resolveCachedMediaUrl(photo.thumb);
      const fullSrc = hasDistinctFull ? resolveCachedMediaUrl(photo.full!) : '';
      const srcset = hasDistinctFull ? `${thumbSrc} 640w, ${fullSrc} 1080w` : '';
      const preferredUrl = getPreferredPhotoUrl(photo);
      const alreadyDecoded =
        decodedImageUrls.has(preferredUrl) ||
        decodedImageUrls.has(photo.thumb) ||
        blobUrlCache.has(photo.thumb);
      const isFrontFive = rank < 5;

      const applyPhotoToImg = (img: HTMLImageElement, alt: string) => {
        img.alt = alt;
        img.loading = isFrontFive ? 'eager' : 'lazy';
        if ('fetchPriority' in img) {
          (img as HTMLImageElement & {fetchPriority?: string}).fetchPriority = isFrontFive
            ? 'high'
            : 'auto';
        }
        const currentRaw = img.dataset.rawSrc ?? img.getAttribute('src');
        if (currentRaw !== photo.thumb) {
          img.dataset.rawSrc = photo.thumb;
          if (alreadyDecoded) {
            img.classList.add('is-decoded');
          } else {
            img.classList.remove('is-decoded');
          }
          if (srcset) img.srcset = srcset;
          else img.removeAttribute('srcset');
          img.src = thumbSrc;
          decodeModelImage(img, preferredUrl);
        } else if (!srcset && img.hasAttribute('srcset')) {
          img.removeAttribute('srcset');
        }
      };

      const hero = this.heroes[idx];
      if (hero) {
        hero.dataset.probe = photo.thumb;
        const cachedFoot = footOffsetCache.get(photo.thumb);
        if (cachedFoot !== undefined) {
          hero.style.setProperty('--rw-foot', cachedFoot);
        }
        const img = hero.querySelector<HTMLImageElement>('[data-model-image]');
        if (img) {
          applyPhotoToImg(img, altText);
        }
        const zBtn = hero.querySelector<HTMLButtonElement>('[data-rw-zoom]');
        if (zBtn) {
          zBtn.setAttribute('aria-label', `Lihat profil: ${altText}`);
        }
      }

      this.actorsEl
        .querySelectorAll<HTMLElement>(`.rw__model[data-index="${idx}"]`)
        .forEach((modelEl) => {
          const cachedFoot = footOffsetCache.get(photo.thumb);
          if (cachedFoot !== undefined) {
            modelEl.style.setProperty('--rw-foot', cachedFoot);
          }
          const img = modelEl.querySelector<HTMLImageElement>('[data-model-image]');
          if (img) {
            applyPhotoToImg(img, altText);
          }
          const hitBtn = modelEl.querySelector<HTMLButtonElement>('[data-rw-go]');
          if (hitBtn) {
            hitBtn.setAttribute('aria-label', `${person.rankLabel} ${lineup.year}: ${altText}`);
          }
        });
    }

    if (this.zoomed && this.lbStageEl) {
      const person = list[this.index];
      const photo = this.getSlotPhoto(lineup.year, this.roleFilter, this.index, person);
      const lbImg = this.lbStageEl.querySelector<HTMLImageElement>('.rw__lb-model [data-model-image]');
      if (person && lbImg) {
        lbImg.alt = `${person.fullName || person.shortName} - ${lineup.year}`;
        const lbRaw = lbImg.dataset.rawSrc ?? lbImg.getAttribute('src');
        if (lbRaw !== photo.thumb) {
          lbImg.dataset.rawSrc = photo.thumb;
          const thumbSrc = resolveCachedMediaUrl(photo.thumb);
          if (photo.full && photo.full !== photo.thumb) {
            lbImg.srcset = `${thumbSrc} 640w, ${resolveCachedMediaUrl(photo.full)} 1080w`;
          } else {
            lbImg.removeAttribute('srcset');
          }
          lbImg.src = thumbSrc;
          decodeModelImage(lbImg, getPreferredPhotoUrl(photo));
        }
      }
    }
  }

  private getEffectivePanelRole(): 'uda' | 'uni' {
    return this.roleFilter;
  }

  public openPanel(role?: 'uda' | 'uni', syncMeasure = false): void {
    const nextRole = role ?? this.getEffectivePanelRole();
    const roleChanged = this.activePanelRole !== nextRole || this.roleFilter !== nextRole;
    this.activePanelRole = nextRole;
    this.roleFilter = nextRole;

    if (roleChanged) {
      this.renderAllPanels();
      this.syncStageGroupMedia();
      this.setupImagesAndFeet();
    }
    this.syncRoleLabels();

    if (!this.panelOpen) {
      this.panelOpen = true;
      this.classList.add('is-panel-open');
      document.body.classList.add('is-profile-focus');
      this.panelEl?.setAttribute('aria-hidden', 'false');
      if (window.scrollY > 24) {
        window.scrollTo({top: 0, behavior: 'smooth'});
      }
      if (syncMeasure) {
        this.measure();
      } else {
        this.scheduleMeasure();
      }
    }

    const activePanel = this.panels[this.index];
    if (activePanel) {
      activePanel.classList.remove('is-in');
      void activePanel.offsetWidth;
      activePanel.classList.add('is-in');
    }

    this.hot(nextRole === 'uda' ? 1 : 2, false);
  }

  public closePanel(syncMeasure = false): void {
    if (!this.panelOpen) return;
    this.panelOpen = false;
    this.classList.remove('is-panel-open');
    document.body.classList.remove('is-profile-focus');
    this.panelEl?.setAttribute('aria-hidden', 'true');
    this.hot(null);
    if (syncMeasure) {
      this.measure();
    } else {
      this.scheduleMeasure();
    }
  }

  public focusParticipant(role?: 'uda' | 'uni', fromRect?: DOMRect): void {
    const chosenRole = role ?? this.getEffectivePanelRole();
    const sourceRect =
      fromRect ??
      this.heroes[this.index]?.querySelector<HTMLElement>('.rw__figure')?.getBoundingClientRect();

    this.openPanel(chosenRole, true);
    if (!this.zoomed) {
      this.openZoom(sourceRect);
    }
    this.hot(chosenRole === 'uda' ? 1 : 2, false);
  }

  public closeProfileView(): void {
    this.closePanel(true);
    this.closeZoom();
  }

  private syncSlotCount(): boolean {
    const lineup = this.getActiveYearLineup();
    const list = this.roleFilter === 'uda' ? lineup.uda : lineup.uni;
    const nextLook = Math.max(1, list.length);
    const nextBody = nextLook * Math.ceil(8 / nextLook);
    const changed = nextLook !== this.LOOK_COUNT || nextBody !== this.BODY_COUNT;
    this.LOOK_COUNT = nextLook;
    this.BODY_COUNT = nextBody;
    return changed;
  }

  private rebuildStageSlots(resetToZero = false): void {
    this.syncSlotCount();
    this.panelCache.clear();
    this.ensureSlotMarkup();
    this.heroes = Array.from(this.querySelectorAll<HTMLElement>('[data-rw-hero]'));
    this.ticks = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-rw-tick]'));
    this.panels = Array.from(this.querySelectorAll<HTMLElement>('[data-rw-panel]'));

    const nextIdx = resetToZero ? 0 : Math.min(this.index, this.LOOK_COUNT - 1);
    this.index = nextIdx;
    this.target = nextIdx;
    this.cur = nextIdx;
    this.vel = 0;

    this.renderAllPanels();
    this.syncRoleLabels();
    this.setupBodies();

    const N = this.BODY_COUNT;
    for (let a = 0; a < N; a++) {
      const cb = this.classicBodies[a];
      const goal = (((a - nextIdx) % N) + N) % N;
      cb.goal = goal;
      cb.x = goal;
      cb.g = goal;
      cb.v = 0;
      cb.from = goal;
      cb.trip = false;
    }

    this.syncStageGroupMedia();
    this.setupImagesAndFeet();
    this.measure();
    this.setIndex(nextIdx, false);
    this.renderAll();
    this.scheduleOppositeRolePreload();
  }

  public refreshFromCms(): void {
    const catalog = getCatalogLineups();
    if (!catalog.some((y) => y.year === this.activeYear)) {
      this.activeYear = catalog[0]?.year ?? this.activeYear;
    }

    this.renderYearButtons();
    this.yearButtons = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-rw-year]'));
    this.rebuildStageSlots(false);
  }

  public setYear(year: string, resetSlot = true, immediate = false): void {
    if (!getCatalogLineups().some((y) => y.year === year)) return;
    const changed = this.activeYear !== year;
    this.activeYear = year;

    if (changed) {
      const slotsChanged = this.syncSlotCount();
      // Update pill buttons & trigger sliding thumb immediately at frame 0 (matching top-nav smoothness)
      this.yearButtons.forEach((btn) => {
        const active = (btn.dataset.rwYear || '') === this.activeYear;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      this.emitStateChange();

      const applyYearWork = () => {
        if (slotsChanged) {
          this.rebuildStageSlots(resetSlot);
        } else {
          this.renderAllPanels();
          this.syncRoleLabels();
          this.syncStageGroupMedia();
          this.setupImagesAndFeet();
          this.scheduleOppositeRolePreload();
          if (resetSlot && this.index !== 0) {
            this.go(0);
          }
        }
        this.stage?.classList.remove('is-switching');
        if (!this.reducedMotion && !this.zoomed) {
          this.stage.classList.remove('is-sweep');
          void this.stage.offsetWidth;
          this.stage.classList.add('is-sweep');
        }
      };

      if (this.roleSwitchRaf) {
        cancelAnimationFrame(this.roleSwitchRaf);
        this.roleSwitchRaf = 0;
      }

      if (immediate) {
        applyYearWork();
        return;
      }

      if (!this.reducedMotion) {
        this.stage?.classList.add('is-switching');
      }
      this.roleSwitchRaf = requestAnimationFrame(() => {
        this.roleSwitchRaf = 0;
        applyYearWork();
      });
    }
  }

  public setRoleFilter(role: RoleFilter, immediate = false): void {
    const changed = this.roleFilter !== role || this.activePanelRole !== role;
    this.roleFilter = role;
    this.activePanelRole = role;

    if (changed) {
      const roleSwitchEl = this.querySelector<HTMLElement>('.rw__role-switch');
      if (roleSwitchEl) {
        roleSwitchEl.dataset.activeRole = this.roleFilter;
      }
      this.roleButtons.forEach((btn) => {
        const active = (btn.dataset.rwRole as RoleFilter) === this.roleFilter;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      this.emitStateChange();

      const slotsChanged = this.syncSlotCount();
      const applyRoleWork = () => {
        if (slotsChanged) {
          this.rebuildStageSlots(false);
        } else {
          this.renderAllPanels();
          this.syncRoleLabels();
          this.syncStageGroupMedia();
          this.setupImagesAndFeet();
          this.scheduleOppositeRolePreload();
        }
        this.stage?.classList.remove('is-switching');
        if (!this.reducedMotion && !this.zoomed) {
          this.stage.classList.remove('is-sweep');
          void this.stage.offsetWidth;
          this.stage.classList.add('is-sweep');
        }

        if (this.panelOpen) {
          const activePanel = this.panels[this.index];
          if (activePanel) {
            activePanel.classList.remove('is-in');
            void activePanel.offsetWidth;
            activePanel.classList.add('is-in');
          }
          this.hot(this.activePanelRole === 'uda' ? 1 : 2, false);
        }
      };

      if (this.roleSwitchRaf) {
        cancelAnimationFrame(this.roleSwitchRaf);
        this.roleSwitchRaf = 0;
      }

      if (immediate) {
        applyRoleWork();
        return;
      }

      if (!this.reducedMotion) {
        this.stage?.classList.add('is-switching');
      }
      this.roleSwitchRaf = requestAnimationFrame(() => {
        this.roleSwitchRaf = 0;
        applyRoleWork();
      });
    } else if (this.panelOpen) {
      this.hot(this.activePanelRole === 'uda' ? 1 : 2, false);
    }
  }

  public goToProfile(slotIdx: number, role: RoleFilter = 'uda', year?: string): void {
    this.engage();
    if (year && year !== this.activeYear) {
      this.setYear(year, false, true);
    }
    this.setRoleFilter(role, true);
    this.go(slotIdx);
    this.focusParticipant(role);
    window.setTimeout(() => this.hot(role === 'uda' ? 1 : 2, true), 60);
  }

  private setupBodies(): void {
    const originals = Array.from(this.actorsEl.querySelectorAll<HTMLElement>('[data-rw-model]'));
    const clonesNeeded = Math.max(0, Math.ceil(8 / this.LOOK_COUNT) - 1);
    for (let c = 0; c < clonesNeeded; c++) {
      for (let i = 0; i < originals.length; i++) {
        const clone = originals[i].cloneNode(true) as HTMLElement;
        clone.setAttribute('data-rw-clone', '');
        clone.dataset.index = String(i);
        clone.querySelectorAll('img').forEach((img) => {
          img.loading = 'lazy';
        });
        this.actorsEl.appendChild(clone);
      }
    }

    const allBodies = Array.from(this.actorsEl.querySelectorAll<HTMLElement>('[data-rw-model]'));
    this.ringBodies = allBodies.map((el, a) => ({
      el,
      idx: a % this.LOOK_COUNT,
      w: 315,
      lastBlur: '',
    }));
    this.classicBodies = allBodies.map((el, a) => ({
      el,
      idx: a % this.LOOK_COUNT,
      x: a,
      g: a,
      v: 0,
      from: a,
      goal: a,
      trip: false,
      w: 315,
      lastBlur: '',
    }));
  }

  private setupImagesAndFeet(): void {
    this.querySelectorAll<HTMLImageElement>('[data-model-image]').forEach((img) => {
      decodeModelImage(img);
    });

    for (const hero of this.heroes) {
      const probeUrl = hero.dataset.probe;
      const idx = hero.dataset.index;
      if (!probeUrl || idx === undefined) continue;

      const applyFoot = (footStr: string) => {
        if (hero.dataset.probe !== probeUrl) return;
        hero.style.setProperty('--rw-foot', footStr);
        this.actorsEl
          .querySelectorAll<HTMLElement>(`.rw__model[data-index="${idx}"]`)
          .forEach((m) => m.style.setProperty('--rw-foot', footStr));
      };

      const cached = footOffsetCache.get(probeUrl);
      if (cached !== undefined) {
        applyFoot(cached);
        continue;
      }

      void measureFootOffset(probeUrl).then((footStr) => {
        if (footStr !== null) {
          applyFoot(footStr);
        }
      });
    }
  }

  private setupCursor(): void {
    this.cursorHoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!this.cursorHoverCapable) {
      this.cursorEl?.remove();
      this.cursorEl = null;
      return;
    }

    this.classList.add('rw--cursor');
    let entered = false;

    const updateHoverTargets = (target: EventTarget | null) => {
      if (!this.cursorEl) return;
      const el = target as HTMLElement | null;
      const isZoom = Boolean(!this.dragging && el?.closest('.rw__zoom'));
      const isLink = Boolean(!this.dragging && el?.closest('.rw__pin, .rw__hit'));
      this.cursorEl.classList.toggle('is-view', isZoom && !isLink);
      this.cursorEl.classList.toggle('is-link', isLink);
    };

    const stepCursor = () => {
      if (!this.cursorEl) {
        this.cursorRaf = 0;
        return;
      }
      const lerp = this.reducedMotion ? 1 : 0.18;
      this.cursorX += (this.cursorTargetX - this.cursorX) * lerp;
      this.cursorY += (this.cursorTargetY - this.cursorY) * lerp;
      this.cursorEl.style.transform = `translate3d(${this.cursorX.toFixed(2)}px, ${this.cursorY.toFixed(2)}px, 0)`;

      if (
        Math.abs(this.cursorTargetX - this.cursorX) < 0.2 &&
        Math.abs(this.cursorTargetY - this.cursorY) < 0.2
      ) {
        this.cursorX = this.cursorTargetX;
        this.cursorY = this.cursorTargetY;
        this.cursorEl.style.transform = `translate3d(${this.cursorX.toFixed(2)}px, ${this.cursorY.toFixed(2)}px, 0)`;
        this.cursorRaf = 0;
        return;
      }
      this.cursorRaf = requestAnimationFrame(stepCursor);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !this.cursorEl) return;
      const rect = this.stage.getBoundingClientRect();
      this.cursorTargetX = e.clientX - rect.left;
      this.cursorTargetY = e.clientY - rect.top;

      if (!entered) {
        entered = true;
        this.cursorX = this.cursorTargetX;
        this.cursorY = this.cursorTargetY;
        this.cursorEl.style.transform = `translate3d(${this.cursorX.toFixed(2)}px, ${this.cursorY.toFixed(2)}px, 0)`;
        this.cursorEl.classList.add('is-on');
      }

      updateHoverTargets(e.target);

      if (!this.cursorRaf) {
        this.cursorRaf = requestAnimationFrame(stepCursor);
      }
    };

    const onLeave = () => {
      entered = false;
      this.cursorEl?.classList.remove('is-on', 'is-link', 'is-view');
    };

    this.stage.addEventListener('pointermove', onMove);
    this.stage.addEventListener('pointerleave', onLeave);
    this.cleanups.push(() => {
      this.stage.removeEventListener('pointermove', onMove);
      this.stage.removeEventListener('pointerleave', onLeave);
    });
  }

  private setupObservers(): void {
    this.visObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.visible = entry.isIntersecting;
          if (this.visible) {
            this.kick();
            if (this.playing) this.scheduleAutoplay();
          } else {
            window.clearTimeout(this.autoTimer);
          }
        }
      },
      {threshold: 0},
    );
    this.visObserver.observe(this);

    if (!this.reducedMotion) {
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this.revealObserver?.unobserve(this);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                this.classList.add('is-revealed');
                this.kick();
              });
            });
          }
        },
        {threshold: 0, rootMargin: '0px 0px -22% 0px'},
      );
      this.revealObserver.observe(this);
    }

    this.stageResizeObserver = new ResizeObserver(() => {
      this.scheduleMeasure();
    });
    this.stageResizeObserver.observe(this.stage);
  }

  private scheduleMeasure(): void {
    if (this.measureRaf) return;
    this.measureRaf = requestAnimationFrame(() => {
      this.measureRaf = 0;
      this.measure();
    });
  }

  private setupListeners(): void {
    const onResize = () => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.measure(), 120);
    };
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));

    const onVisibility = () => {
      if (!document.hidden && this.visible) {
        this.lastTs = 0;
        this.kick();
        if (this.playing) this.scheduleAutoplay();
      } else {
        window.clearTimeout(this.autoTimer);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.zoomed) return;
      this.dragPointerId = e.pointerId;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartTarget = this.target;
      this.dragActive = false;
      this.dragAbandoned = false;
      this.dragSamples = [{x: e.clientX, time: performance.now()}];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (this.dragPointerId !== e.pointerId || this.dragAbandoned) return;
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        endDrag(e);
        return;
      }

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (!this.dragActive) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          this.dragAbandoned = true;
          this.dragPointerId = null;
          return;
        }
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
          this.dragActive = true;
          this.dragging = true;
          this.classList.add('is-dragging');
          this.cursorEl?.classList.remove('is-view', 'is-link');
          try {
            this.stage.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          this.setStill(false);
        } else {
          return;
        }
      }

      this.dragSamples.push({x: e.clientX, time: performance.now()});
      if (this.dragSamples.length > 6) this.dragSamples.shift();

      this.target = this.dragStartTarget - dx / this.unit;
      this.kick();
    };

    const endDrag = (e: PointerEvent) => {
      if (this.dragPointerId !== e.pointerId) return;
      this.dragPointerId = null;
      if (!this.dragActive) return;

      this.dragActive = false;
      this.dragging = false;
      this.classList.remove('is-dragging');
      this.suppressClickUntil = performance.now() + 60;

      try {
        if (this.stage.hasPointerCapture(e.pointerId)) {
          this.stage.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      const first = this.dragSamples[0];
      const last = this.dragSamples[this.dragSamples.length - 1];
      const dt = last && first ? Math.max(1, last.time - first.time) : 1;
      const vx = last && first && last !== first ? (last.x - first.x) / dt : 0;
      const dx = e.clientX - this.dragStartX;
      const from = Math.round(this.dragStartTarget);
      const sign = -1;

      if (this.isMobile) {
        if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) {
          this.moveTo(from + sign * (dx > 0 ? 1 : -1));
        } else {
          this.moveTo(from);
        }
      } else {
        let i = Math.round(this.target + (sign * vx * 160) / this.unit);
        if (i === from && Math.abs(vx) > 0.3) {
          i = from + (vx < 0 ? 1 : -1);
        }
        i = clamp(i, from - 2, from + 2);
        this.moveTo(i);
      }
    };

    this.stage.addEventListener('pointerdown', onPointerDown);
    this.stage.addEventListener('pointermove', onPointerMove);
    this.stage.addEventListener('pointerup', endDrag);
    this.stage.addEventListener('pointercancel', endDrag);
    this.cleanups.push(() => {
      this.stage.removeEventListener('pointerdown', onPointerDown);
      this.stage.removeEventListener('pointermove', onPointerMove);
      this.stage.removeEventListener('pointerup', endDrag);
      this.stage.removeEventListener('pointercancel', endDrag);
    });

    const onCaptureClick = (e: MouseEvent) => {
      if (performance.now() < this.suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    this.stage.addEventListener('click', onCaptureClick, true);
    this.cleanups.push(() => this.stage.removeEventListener('click', onCaptureClick, true));

    const onWheel = (e: WheelEvent) => {
      if (this.zoomed) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (this.wheelLock) return;
      this.wheelAcc += e.deltaX;
      if (Math.abs(this.wheelAcc) > 45) {
        if (this.wheelAcc > 0) this.next();
        else this.prev();
        this.wheelAcc = 0;
        this.wheelLock = window.setTimeout(() => {
          this.wheelLock = 0;
          this.wheelAcc = 0;
        }, 520);
      }
    };
    this.stage.addEventListener('wheel', onWheel, {passive: false});
    this.cleanups.push(() => this.stage.removeEventListener('wheel', onWheel));

    const onStageKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      }
    };
    this.stage.addEventListener('keydown', onStageKeyDown);
    this.cleanups.push(() => this.stage.removeEventListener('keydown', onStageKeyDown));

    const onSectionKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (this.zoomed || this.panelOpen)) {
        this.closeProfileView();
      }
    };
    this.addEventListener('keydown', onSectionKeyDown);
    this.cleanups.push(() => this.removeEventListener('keydown', onSectionKeyDown));

    const panel = this.querySelector<HTMLElement>('.rw__panel');
    if (panel) {
      const onPanelEnter = (e: PointerEvent) => {
        if (e.pointerType === 'mouse') {
          this.panelHover = true;
          this.restartAutoplayBar();
        }
      };
      const onPanelLeave = (e: PointerEvent) => {
        if (e.pointerType === 'mouse') {
          this.panelHover = false;
          this.restartAutoplayBar();
        }
      };
      const onPanelClick = (e: MouseEvent) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest('button, a')) {
          this.engage();
        }
      };
      const onCardOver = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-rw-card]');
        if (card?.dataset.rwCard) {
          this.hot(Number(card.dataset.rwCard), false);
        }
      };
      const onCardOut = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-rw-card]');
        if (!card) return;
        const rel = e.relatedTarget as Node | null;
        if (!rel || !card.contains(rel)) {
          this.hot(null);
        }
      };

      panel.addEventListener('pointerenter', onPanelEnter);
      panel.addEventListener('pointerleave', onPanelLeave);
      panel.addEventListener('click', onPanelClick);
      panel.addEventListener('pointerover', onCardOver);
      panel.addEventListener('pointerout', onCardOut);
      this.cleanups.push(() => {
        panel.removeEventListener('pointerenter', onPanelEnter);
        panel.removeEventListener('pointerleave', onPanelLeave);
        panel.removeEventListener('click', onPanelClick);
        panel.removeEventListener('pointerover', onCardOver);
        panel.removeEventListener('pointerout', onCardOut);
      });
    }

    const onSectionClick = (e: MouseEvent) => {
      this.handleClickTarget(e.target as HTMLElement | null, e);
    };
    this.addEventListener('click', onSectionClick);
    this.cleanups.push(() => this.removeEventListener('click', onSectionClick));

    const ticksContainer = this.querySelector<HTMLElement>('.rw__ticks');
    if (ticksContainer) {
      const onTickTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'flex-basis') {
          this.syncActiveTickMarquee();
        }
      };
      ticksContainer.addEventListener('transitionend', onTickTransitionEnd);
      this.cleanups.push(() => ticksContainer.removeEventListener('transitionend', onTickTransitionEnd));
    }
  }

  private handleClickTarget(t: HTMLElement | null, event?: MouseEvent): void {
    if (!t) return;

    // 0. stage role switcher buttons (Uda / Uni)
    const roleBtn = t.closest<HTMLButtonElement>('[data-rw-role]');
    if (roleBtn?.dataset.rwRole) {
      this.engage();
      this.setRoleFilter(roleBtn.dataset.rwRole as RoleFilter);
      return;
    }

    // 0-year. year selector pills (2024..tahun berjalan)
    const yearBtn = t.closest<HTMLButtonElement>('[data-rw-year]');
    if (yearBtn?.dataset.rwYear) {
      this.engage();
      this.setYear(yearBtn.dataset.rwYear, true);
      return;
    }

    // 0a. close panel button closes both panel & zoom back to full-width homepage
    if (t.closest('[data-rw-panel-close]')) {
      this.engage();
      this.closeProfileView();
      return;
    }

    // 1. popup close button closes both zoom & panel back to full-width homepage
    if (t.closest('[data-rw-zoom-close]')) {
      this.closeProfileView();
      return;
    }

    // 2. click on popup backdrop or stage beside model closes both zoom & panel
    if (
      this.zoomed &&
      (t === this.lbEl || t === this.lbStageEl || (t.closest('.rw__lb') && !t.closest('.rw__lb-model, .rw__lb-top')))
    ) {
      this.closeProfileView();
      return;
    }

    // 3. clicking the active participant image zooms in & opens the right detail panel
    if (t.closest('[data-rw-zoom]')) {
      this.engage();
      this.focusParticipant(this.getEffectivePanelRole());
      return;
    }

    // 4. next
    if (t.closest('[data-rw-next]')) {
      this.next();
      return;
    }

    // 5. prev
    if (t.closest('[data-rw-prev]')) {
      this.prev();
      return;
    }

    // 6. tick
    const tick = t.closest<HTMLElement>('[data-rw-tick]');
    if (tick) {
      this.go(Number(tick.dataset.rwTick));
      return;
    }

    // 7. autoplay toggle
    if (t.closest('[data-rw-auto]')) {
      if (!this.playing) this.engaged = false;
      this.play(!this.playing);
      return;
    }

    // 8. pin click zooms in (if not zoomed) & opens the clicked Uda (1) or Uni (2) profile
    const pin = t.closest<HTMLElement>('[data-rw-pin]');
    if (pin) {
      this.engage();
      const pinNum = Number(pin.dataset.rwPin);
      const pinRole: 'uda' | 'uni' = pinNum === 2 ? 'uni' : 'uda';
      if (this.zoomed) {
        this.openPanel(pinRole);
      } else {
        this.focusParticipant(pinRole);
      }
      this.hot(pinNum, true);
      return;
    }

    // 9. clicking any participant image in the ring [data-rw-go] isolates & zooms in on them + opens detail panel
    const goBtn = t.closest<HTMLElement>('[data-rw-go]');
    if (goBtn) {
      this.engage();
      const modelEl = goBtn.closest<HTMLElement>('[data-rw-model]');
      const bodyIdx = this.ringBodies.findIndex((b) => b.el === modelEl);
      if (bodyIdx !== -1) {
        const base = Math.round(this.target);
        let k = (((bodyIdx - base) % this.BODY_COUNT) + this.BODY_COUNT) % this.BODY_COUNT;
        if (k > this.BODY_COUNT / 2) k -= this.BODY_COUNT;
        if (k === 0) {
          this.focusParticipant(this.getEffectivePanelRole());
        } else if (Math.abs(k) < 6) {
          const startRect = modelEl?.querySelector<HTMLElement>('.rw__figure')?.getBoundingClientRect();
          this.moveTo(base + k);
          this.focusParticipant(this.getEffectivePanelRole(), startRect);
        }
      }
      return;
    }

    // 10. clicking bio card title / pin icon highlights corresponding pin on stage
    const focusBtn = t.closest<HTMLElement>('[data-rw-focus-card]');
    if (focusBtn) {
      event?.preventDefault();
      const card = focusBtn.closest<HTMLElement>('[data-rw-card]');
      if (card?.dataset.rwCard) {
        this.engage();
        const cardNum = Number(card.dataset.rwCard);
        this.hot(cardNum, true);
      }
    }
  }

  public goToLook(i: number): void {
    this.engage();
    this.go(i);
  }

  private measure(): void {
    this.isMobile = window.innerWidth <= 749;
    this.mode = this.isMobile ? 'classic' : 'ring';

    if (
      this.latchedVh === 0 ||
      this.latchedW !== window.innerWidth ||
      Math.abs(window.innerHeight - this.latchedVh) >= 160
    ) {
      this.latchedVh = window.innerHeight;
      this.latchedW = window.innerWidth;
    }

    let frameH: number;
    if (!this.isMobile) {
      let headerH = 0;
      document
        .querySelectorAll<HTMLElement>(
          '.shopify-section-group-header-group, #shopify-section-header, #shopify-section-announcement-bar',
        )
        .forEach((el) => {
          if (!el.contains(this) && el.offsetParent !== null) {
            headerH += el.getBoundingClientRect().height;
          }
        });
      frameH = Math.max(380, Math.round(window.innerHeight - headerH));
    } else {
      const pct = clamp(Number(this.dataset.mheightVh || 109), 50, 120);
      frameH = Math.round((this.latchedVh * pct) / 100);
    }
    if (this.lastFrameH !== frameH) {
      this.lastFrameH = frameH;
      this.style.setProperty('--rw-frame-h', `${frameH}px`);
    }

    const rect = this.stage.getBoundingClientRect();
    this.W = rect.width || this.stage.clientWidth || 800;
    this.H = rect.height || this.stage.clientHeight || 600;

    this.fs = this.mode === 'ring' ? 1.08 : 1;
    this.stage.style.setProperty('--rw-fs', String(this.fs));

    let modelH: number;
    if (this.mode === 'ring') {
      modelH = Math.max(200, Math.round((this.H - 34 - 18) / 1.08));
    } else {
      modelH = Math.max(200, Math.round(this.H - (this.isMobile ? 24 : 36) - 18));
    }
    if (this.lastModelH !== modelH) {
      this.lastModelH = modelH;
      this.stage.style.setProperty('--rw-model-h', `${modelH}px`);
    }

    let hx: number;
    let hy: number;
    if (this.mode === 'ring') {
      hx = 0.5 * this.W;
      hy = 34;
      this.unit = Math.max(this.isMobile ? 90 : 120, 0.3 * this.W);
    } else if (this.isMobile) {
      hx = 0.3 * this.W;
      hy = 22;
      this.unit = Math.max(90, this.W * 0.32 * 1.6);
    } else {
      hx = 0.4 * this.W;
      hy = 36;
      this.unit = Math.max(120, this.W * 0.125 * 1.6);
    }

    this.stage.style.setProperty('--rw-hx', `${hx.toFixed(1)}px`);
    this.stage.style.setProperty('--rw-hy', `${hy}px`);
    this.style.setProperty('--rw-ax', `${((hx / Math.max(1, this.W)) * 100).toFixed(2)}%`);

    const approxW = Math.round(modelH * 0.5625);
    for (let i = 0; i < this.BODY_COUNT; i++) {
      const w = this.ringBodies[i].el.offsetWidth || approxW;
      this.ringBodies[i].w = w;
      this.classicBodies[i].w = w;
    }

    if (this.zoomed && this.lbStageEl) {
      const lbModel = this.lbStageEl.querySelector<HTMLElement>('.rw__lb-model');
      if (lbModel) {
        const sr = this.lbStageEl.getBoundingClientRect();
        const h = Math.max(160, Math.round(Math.min(sr.height, sr.width / 0.5625)));
        lbModel.style.setProperty('--rw-model-h', `${h}px`);
        lbModel
          .querySelectorAll<HTMLImageElement>('[data-model-image]')
          .forEach((img) => (img.sizes = `${Math.round(h * 0.5625)}px`));
      }
    }

    this.renderAll();
    this.syncActiveTickMarquee();
  }

  private syncActiveTickMarquee(): void {
    const gapPx = 28;
    for (let idx = 0; idx < this.ticks.length; idx++) {
      const tick = this.ticks[idx];
      const label = tick.querySelector<HTMLElement>('.rw__tick-label');
      if (!label) continue;

      if (idx !== this.index) {
        label.classList.remove('is-marquee');
        label.style.removeProperty('--rw-marquee-shift');
        label.style.removeProperty('--rw-marquee-dur');
        continue;
      }

      const copy = label.querySelector<HTMLElement>('.rw__tick-copy:not(.rw__tick-copy--dup)');
      const availableW = label.clientWidth;
      const textW = copy ? Math.ceil(copy.getBoundingClientRect().width) : 0;

      if (availableW > 0 && textW > availableW + 2) {
        const shiftPx = textW + gapPx;
        const durSec = clamp(shiftPx / 34, 4.8, 15).toFixed(2);
        const alreadySame =
          label.classList.contains('is-marquee') &&
          label.style.getPropertyValue('--rw-marquee-shift') === `${shiftPx}px`;
        if (!alreadySame) {
          label.classList.remove('is-marquee');
          label.style.setProperty('--rw-marquee-shift', `${shiftPx}px`);
          label.style.setProperty('--rw-marquee-dur', `${durSec}s`);
          void label.offsetWidth;
          label.classList.add('is-marquee');
        }
      } else {
        label.classList.remove('is-marquee');
        label.style.removeProperty('--rw-marquee-shift');
        label.style.removeProperty('--rw-marquee-dur');
      }
    }
  }

  private scheduleTickMarqueeSync(): void {
    window.clearTimeout(this.tickMarqueeTimer);
    requestAnimationFrame(() => this.syncActiveTickMarquee());
    this.tickMarqueeTimer = window.setTimeout(() => {
      this.syncActiveTickMarquee();
    }, 840);
  }

  private setStill(v: boolean): void {
    if (this.still === v) return;
    this.still = v;
    this.classList.toggle('rw--still', v);
  }

  private put(
    s: RingBodyState | ClassicBodyState,
    x: number,
    bottom: number,
    scale: number,
    opacity: number,
    blur: number,
    z: number,
  ): void {
    let op = opacity;
    if (x + (s.w * scale) / 2 < -4 || x - (s.w * scale) / 2 > this.W + 4) {
      op = 0;
    }

    s.el.style.transform = `translate3d(${x.toFixed(2)}px, ${(-bottom).toFixed(2)}px, 0) translateX(-50%) scale(${scale.toFixed(4)})`;
    s.el.style.opacity = op.toFixed(3);
    s.el.style.zIndex = String(z);
    s.el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
    s.el.style.pointerEvents = op < 0.5 ? 'none' : 'auto';

    const blurStr = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
    if (s.lastBlur !== blurStr) {
      s.el.style.filter = blurStr;
      s.lastBlur = blurStr;
    }
  }

  private renderAll(): void {
    const W = this.W;
    const H = this.H;
    const N = this.BODY_COUNT;

    if (this.mode === 'ring') {
      const cx = 0.5 * W;
      const R = (this.isMobile ? 0.72 : 0.62) * W;
      const P = (this.isMobile ? 1.9 : 1.65) * W;
      const floor = H - 34;
      const horizon = 0.36 * H;
      const visualStep = (40 * Math.PI) / 180;

      for (let a = 0; a < N; a++) {
        const s = this.ringBodies[a];
        let delta = (a - this.cur) % N;
        while (delta <= -N / 2) delta += N;
        while (delta > N / 2) delta -= N;

        const sl = Math.abs(delta);
        const phiVis = clamp(delta, -2.65, 2.65) * visualStep;
        const zDepth = R * (1 - Math.cos(phiVis));
        const persp = P / (P + zDepth);
        const scale = persp * (1 + (this.fs - 1) * clamp(1 - sl, 0, 1));
        const x = cx + R * Math.sin(phiVis) * persp;
        const feet = horizon + (floor - horizon) * persp;
        const bottom = H - feet;

        let blur = 0;
        if (sl <= 1) {
          blur = 1.5 * sl;
        } else if (sl <= 2) {
          blur = 1.5 + 1.5 * (sl - 1);
        } else {
          blur = Math.min(3.0 + 2.4 * (sl - 2), 4.8);
        }

        let opacity = 0;
        if (sl <= 1) {
          opacity = 1 - 0.15 * sl;
        } else if (sl <= 2) {
          opacity = 0.85 - 0.43 * (sl - 1);
        } else if (sl < 2.65) {
          opacity = 0.42 * ((2.65 - sl) / 0.65);
        }

        if (this.still && sl < 0.02) opacity = 0;
        const zIdx = Math.round(scale * 1000);

        this.put(s, x, bottom, scale, opacity, blur, zIdx);
      }
      return;
    }

    const ax = this.isMobile ? 0.3 : 0.4;
    const ay = this.isMobile ? 22 : 36;
    const sx = this.isMobile ? 0.32 : 0.125;
    const sy = this.isMobile ? 22 : 58;
    const sr = 0.76;
    const ex = this.isMobile ? 0.55 : 0.38;
    const d = this.isMobile ? 4 : 5;

    for (let a = 0; a < N; a++) {
      const s = this.classicBodies[a];
      let k = s.x;
      let e = -1;

      if (s.trip) {
        const denom = Math.abs(s.goal - s.from);
        const u = denom > 1e-4 ? Math.abs(s.x - s.from) / denom : 1;
        if (s.goal > s.from) {
          if (u < 0.5) e = 2 * u * 1.4;
          else k = s.goal + 2 * (1 - u);
        } else {
          if (u < 0.5) k = s.from + 2 * u;
          else e = 2 * (1 - u) * 1.4;
        }
      } else if (k < 0) {
        e = Math.min(-k, 1.4);
      }

      if (e >= 0) {
        const x = W * (ax - ex * e);
        const bottom = ay - 22 * e;
        const scale = 1 + 0.14 * e;
        const opacity = Math.max(0, 1 - 1.05 * e);
        const blur = 4 * Math.min(e, 1);
        this.put(s, x, bottom, scale, opacity, blur, 1100);
      } else {
        const x = W * (ax + sx * k);
        const bottom = ay + sy * k;
        const scale = Math.pow(sr, k);
        let opacity =
          k <= d - 1 ? 1 - 0.13 * k : Math.max(0, (1 - 0.13 * (d - 1)) * (d - k));
        if (this.still && Math.abs(k) < 0.02) opacity = 0;
        const blur = Math.min(0.9 * k, 3.2);
        const zIdx = 1000 - Math.round(10 * k);
        this.put(s, x, bottom, scale, opacity, blur, zIdx);
      }
    }
  }

  private kick(): void {
    if (this.rafId || !this.visible || document.hidden) return;
    this.lastTs = 0;
    this.rafId = requestAnimationFrame(this.step);
  }

  private step = (ts: number): void => {
    this.rafId = 0;
    if (!this.visible || document.hidden) return;

    const dt = this.lastTs ? Math.min(0.034, (ts - this.lastTs) / 1000) : 1 / 60;
    this.lastTs = ts;

    if (this.mode === 'ring') {
      if (this.reducedMotion && !this.dragging) {
        this.cur = this.target;
        this.vel = 0;
        this.setStill(true);
        this.renderAll();
        return;
      }

      const h = dt / 3;
      for (let j = 0; j < 3; j++) {
        const acc = -this.K * (this.cur - this.target) - this.C * this.vel;
        this.vel += acc * h;
        this.cur += this.vel * h;
      }

      if (
        !this.dragging &&
        Math.abs(this.cur - this.target) <= 0.0005 &&
        Math.abs(this.vel) <= 0.0005
      ) {
        this.cur = this.target;
        this.vel = 0;
        this.setStill(true);
        this.renderAll();
        return;
      }

      this.setStill(false);
      this.renderAll();
      this.rafId = requestAnimationFrame(this.step);
      return;
    }

    const N = this.BODY_COUNT;
    const wrapN = (v: number) => ((v % N) + N) % N;
    let allSettled = true;

    for (let a = 0; a < N; a++) {
      const s = this.classicBodies[a];
      const goal = wrapN(a - this.target);
      if (Math.abs(goal - s.goal) > N / 2) {
        s.trip = true;
        s.from = s.x;
      }
      s.goal = goal;

      if (this.reducedMotion && !this.dragging) {
        s.x = goal;
        s.g = goal;
        s.v = 0;
        s.trip = false;
        continue;
      }

      const tau = this.dragging
        ? 0.016
        : s.trip
          ? 0.1
          : 0.03 + 0.04 * Math.min(goal, 4);
      s.g += (goal - s.g) * (1 - Math.exp(-dt / tau));

      const h = dt / 3;
      for (let j = 0; j < 3; j++) {
        const acc = -this.K * (s.x - s.g) - this.C * s.v;
        s.v += acc * h;
        s.x += s.v * h;
      }

      if (s.trip && Math.abs(s.x - goal) < 0.02) {
        s.trip = false;
      }

      if (
        Math.abs(s.x - goal) > 0.0006 ||
        Math.abs(s.g - goal) > 0.0006 ||
        Math.abs(s.v) > 0.0006
      ) {
        allSettled = false;
      } else {
        s.x = goal;
        s.g = goal;
        s.v = 0;
        s.trip = false;
      }
    }

    if (this.reducedMotion && !this.dragging) {
      this.setStill(true);
      this.renderAll();
      return;
    }

    if (!this.dragging && allSettled) {
      this.setStill(true);
      this.renderAll();
      return;
    }

    this.setStill(false);
    this.renderAll();
    this.rafId = requestAnimationFrame(this.step);
  };

  private setIndex(i: number, silent = false): void {
    const norm = ((i % this.LOOK_COUNT) + this.LOOK_COUNT) % this.LOOK_COUNT;
    const changed = !silent;
    this.index = norm;
    this.kick();

    const base = Math.round(this.target);
    const N = this.BODY_COUNT;
    for (let a = 0; a < N; a++) {
      const body = this.ringBodies[a].el;
      const hit = body.querySelector<HTMLButtonElement>('.rw__hit');
      let k = (((a - base) % N) + N) % N;
      let accessible = false;
      if (this.mode === 'ring') {
        if (k > N / 2) k -= N;
        accessible = k !== 0 && Math.abs(k) <= 2;
      } else {
        accessible = k !== 0 && k <= 3;
      }
      if (accessible) {
        body.removeAttribute('aria-hidden');
        if (hit) hit.tabIndex = 0;
      } else {
        body.setAttribute('aria-hidden', 'true');
        if (hit) hit.tabIndex = -1;
      }
    }

    this.style.setProperty('--rw-progress', ((norm + 1) / this.LOOK_COUNT).toFixed(3));

    if (!changed) {
      this.scheduleTickMarqueeSync();
      return;
    }

    if (this.zoomed) this.closeZoom();

    this.heroes.forEach((hero, idx) => {
      const wasOn = hero.classList.contains('is-on');
      const isNow = idx === norm;
      hero.classList.toggle('is-on', isNow);
      hero.classList.toggle('was', wasOn && !isNow);
      if (isNow) hero.removeAttribute('aria-hidden');
      else hero.setAttribute('aria-hidden', 'true');
      const zBtn = hero.querySelector<HTMLButtonElement>('[data-rw-zoom]');
      if (zBtn) zBtn.tabIndex = isNow ? 0 : -1;
    });

    if (!this.reducedMotion) {
      this.stage.classList.remove('is-sweep');
      void this.stage.offsetWidth;
      this.stage.classList.add('is-sweep');
    }

    const activeHero = this.heroes[norm];
    if (this.liveEl && activeHero?.dataset.label) {
      this.liveEl.textContent = activeHero.dataset.label;
    }

    this.ticks.forEach((tick, idx) => {
      tick.setAttribute('aria-current', idx === norm ? 'true' : 'false');
      tick.classList.toggle('is-past', idx < norm);
    });
    this.scheduleTickMarqueeSync();

    this.panels.forEach((panel, idx) => {
      panel.classList.remove('is-in');
      panel.hidden = idx !== norm;
    });

    const activePanel = this.panels[norm];
    if (activePanel) {
      void activePanel.offsetWidth;
      activePanel.classList.add('is-in');
    }

    const lineup = this.getActiveYearLineup();
    if (this.piecesEl) {
      this.piecesEl.textContent = `Angkatan ${lineup.year}`;
      this.piecesEl.classList.remove('is-swap');
      void this.piecesEl.offsetWidth;
      this.piecesEl.classList.add('is-swap');
    }

    if (this.panelOpen) {
      this.hot(this.activePanelRole === 'uda' ? 1 : 2, false);
    } else {
      this.hot(null);
    }
    this.restartAutoplayBar();
    this.emitStateChange();
  }

  private moveTo(T: number): void {
    this.target = T;
    this.setStill(false);
    this.setIndex(T, false);
  }

  private next(): void {
    this.moveTo(Math.round(this.target) + 1);
  }

  private prev(): void {
    this.moveTo(Math.round(this.target) - 1);
  }

  private go(i: number): void {
    let d = (((i - this.index) % this.LOOK_COUNT) + this.LOOK_COUNT) % this.LOOK_COUNT;
    if (d > this.LOOK_COUNT / 2) d -= this.LOOK_COUNT;
    this.moveTo(Math.round(this.target) + d);
  }

  private play(on: boolean): void {
    this.playing = on;
    this.classList.toggle('is-playing', on);
    if (this.autoBtn) {
      this.autoBtn.classList.toggle('is-playing', on);
      this.autoBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (on) {
      this.restartAutoplayBar();
    } else {
      window.clearTimeout(this.autoTimer);
      this.ticks.forEach((t) => t.classList.remove('is-run'));
    }
    this.emitStateChange();
  }

  private restartAutoplayBar(): void {
    window.clearTimeout(this.autoTimer);
    this.ticks.forEach((t) => t.classList.remove('is-run'));
    if (!this.playing) return;

    const currentTick = this.ticks[this.index];
    if (currentTick) {
      void currentTick.offsetWidth;
      if (!this.panelHover) {
        currentTick.classList.add('is-run');
      }
    }
    this.scheduleAutoplay();
  }

  private scheduleAutoplay(): void {
    window.clearTimeout(this.autoTimer);
    if (!this.playing) return;
    const speed = Number(this.dataset.speed || 5000);
    this.autoTimer = window.setTimeout(() => {
      if (
        this.playing &&
        this.visible &&
        !this.dragging &&
        !document.hidden &&
        !this.panelHover &&
        !this.zoomed &&
        !this.engaged
      ) {
        this.next();
      } else if (this.playing) {
        this.restartAutoplayBar();
      }
    }, speed);
  }

  private engage(): void {
    if (this.engaged) return;
    this.engaged = true;
    this.play(false);
  }

  private hot(n: number | null, scroll = false): void {
    this.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
    if (n === null || !Number.isFinite(n)) return;

    const pinScope = this.zoomed && this.lbStageEl ? this.lbStageEl : this.heroes[this.index];
    const pin = pinScope?.querySelector<HTMLElement>(`[data-rw-pin="${n}"]`);
    pin?.classList.add('is-hot');

    const activePanel = this.panels[this.index];
    const card = activePanel?.querySelector<HTMLElement>(`[data-rw-card="${n}"]`);
    if (!card) return;
    card.classList.add('is-hot');

    if (scroll) {
      this.revealCard(card);
    }
  }

  private revealCard(card: HTMLElement): void {
    const list = card.closest<HTMLElement>('.rw__items');
    const behavior: ScrollBehavior = this.reducedMotion ? 'auto' : 'smooth';
    if (list) {
      if (list.scrollWidth > list.clientWidth + 2) {
        const left =
          card.getBoundingClientRect().left -
          list.getBoundingClientRect().left +
          list.scrollLeft -
          18;
        list.scrollTo({left: Math.max(0, left), behavior});
        return;
      }
      if (list.scrollHeight > list.clientHeight + 2) {
        const top = card.offsetTop - list.offsetTop - 12;
        list.scrollTo({top: Math.max(0, top), behavior});
        return;
      }
    }
    const r = card.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight - 140) {
      window.scrollBy({top: r.top - 0.3 * window.innerHeight, behavior});
    }
  }

  private openZoom(fromRect?: DOMRect): void {
    this.engage();
    this.hot(null);
    window.clearTimeout(this.lbClearTimer);

    const hero = this.heroes[this.index];
    if (!hero || !this.lbEl || !this.lbStageEl) return;

    const heroFigure = hero.querySelector<HTMLElement>('.rw__figure');
    const heroShadow = hero.querySelector<HTMLElement>('.rw__shadow');
    if (!heroFigure) return;

    const a = fromRect && fromRect.height > 0 ? fromRect : heroFigure.getBoundingClientRect();

    this.lbStageEl.innerHTML = '';
    const lbModel = document.createElement('div');
    lbModel.className = 'rw__lb-model';

    if (heroShadow) {
      lbModel.appendChild(heroShadow.cloneNode(true));
    }
    const clonedFigure = heroFigure.cloneNode(true) as HTMLElement;
    clonedFigure.querySelector('[data-rw-zoom]')?.remove();
    clonedFigure.querySelectorAll<HTMLButtonElement>('[data-rw-pin]').forEach((p) => {
      p.tabIndex = 0;
    });

    const foot = hero.style.getPropertyValue('--rw-foot');
    if (foot) {
      const art = clonedFigure.querySelector<HTMLElement>('.rw__art');
      art?.style.setProperty('--rw-foot', foot);
    }

    lbModel.appendChild(clonedFigure);
    this.lbStageEl.appendChild(lbModel);

    const stageRect = this.lbStageEl.getBoundingClientRect();
    const h = Math.max(160, Math.round(Math.min(stageRect.height, stageRect.width / 0.5625)));
    lbModel.style.setProperty('--rw-model-h', `${h}px`);

    lbModel.querySelectorAll<HTMLImageElement>('[data-model-image]').forEach((img) => {
      img.loading = 'eager';
      img.sizes = `${Math.round(h * 0.5625)}px`;
      decodeModelImage(img);
    });

    const lineup = this.getActiveYearLineup();
    const list = this.roleFilter === 'uda' ? lineup.uda : lineup.uni;
    const activePerson = list[this.index];
    if (this.lbKickerEl) {
      this.lbKickerEl.textContent = activePerson
        ? `${lineup.year} · ${activePerson.rankLabel}`
        : `Angkatan ${lineup.year}`;
    }
    if (this.lbNameEl) {
      this.lbNameEl.textContent = hero.dataset.name || '';
    }

    this.zoomed = true;
    this.classList.add('rw--zoom');
    this.lbEl.setAttribute('aria-hidden', 'false');
    this.emitStateChange();

    if (!this.reducedMotion && a.height > 0) {
      const b = clonedFigure.getBoundingClientRect();
      if (b.height > 0) {
        lbModel.style.transition = 'none';
        lbModel.style.transform = `translate3d(${a.left - b.left}px, ${a.bottom - b.bottom}px, 0) scale(${a.height / b.height})`;
        void lbModel.offsetHeight;
        lbModel.style.transition = '';
        lbModel.style.transform = '';
      }
    }

    this.lbCloseBtn?.focus({preventScroll: true});
  }

  private closeZoom(): void {
    if (!this.zoomed || !this.lbEl || !this.lbStageEl) return;
    this.zoomed = false;

    const lbModel = this.lbStageEl.querySelector<HTMLElement>('.rw__lb-model');
    const lbFigure = lbModel?.querySelector<HTMLElement>('.rw__figure');
    const heroFigure = this.heroes[this.index]?.querySelector<HTMLElement>('.rw__figure');

    if (!this.reducedMotion && lbModel && lbFigure && heroFigure) {
      const a = heroFigure.getBoundingClientRect();
      const b = lbFigure.getBoundingClientRect();
      if (a.height > 0 && b.height > 0) {
        lbModel.style.transform = `translate3d(${a.left - b.left}px, ${a.bottom - b.bottom}px, 0) scale(${a.height / b.height})`;
      }
    }

    this.classList.remove('rw--zoom');
    this.lbEl.setAttribute('aria-hidden', 'true');
    this.emitStateChange();

    if (this.lbEl.contains(document.activeElement)) {
      this.stage.focus({preventScroll: true});
    }

    window.clearTimeout(this.lbClearTimer);
    this.lbClearTimer = window.setTimeout(
      () => {
        if (!this.zoomed && this.lbStageEl) {
          this.lbStageEl.innerHTML = '';
        }
      },
      this.reducedMotion ? 0 : 950,
    );
  }
}

if (!customElements.get('runway-section')) {
  customElements.define('runway-section', RunwaySection);
}

function setupSearch(): void {
  const input = document.getElementById('catalog-search') as HTMLInputElement | null;
  const clearBtn = document.getElementById('search-clear') as HTMLButtonElement | null;
  const resultsEl = document.getElementById('search-results');
  const runway = document.querySelector<RunwaySection>('runway-section');
  if (!input || !resultsEl || !runway) return;

  interface SearchRecord {
    year: string;
    person: AmbassadorBio;
    haystack: string;
  }

  const getSearchRecords = (): SearchRecord[] => {
    const allPeople: SearchRecord[] = [];
    for (const lineup of getCatalogLineups()) {
      for (const person of [...lineup.uda, ...lineup.uni]) {
        allPeople.push({
          year: lineup.year,
          person,
          haystack: [
            person.fullName,
            person.rankLabel,
            person.role,
            person.region,
            lineup.year,
            person.age ?? '',
            person.finalistNumber ?? '',
            person.education,
            person.profession,
            person.bio,
            person.advocacy,
            person.achievement,
            ...(person.achievements ?? []),
          ]
            .join(' ')
            .toLowerCase(),
        });
      }
    }
    return allPeople;
  };

  const closeResults = () => {
    resultsEl.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  const renderResults = (rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (clearBtn) clearBtn.hidden = q.length === 0;

    if (!q) {
      closeResults();
      resultsEl.innerHTML = '';
      return;
    }

    const terms = q.split(/\s+/).filter(Boolean);
    const matches = getSearchRecords().filter((rec) => terms.every((t) => rec.haystack.includes(t)));

    resultsEl.innerHTML = '';
    const meta = document.createElement('div');
    meta.className = 'search-meta';
    meta.textContent = `${matches.length} profil ditemukan`;
    resultsEl.appendChild(meta);

    if (matches.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = `Tidak ada profil Uda atau Uni yang cocok dengan "${rawQuery.trim()}".`;
      resultsEl.appendChild(empty);
    } else {
      for (const {year, person} of matches.slice(0, 24)) {
        const hit = document.createElement('button');
        hit.type = 'button';
        hit.className = 'search-hit';

        const top = document.createElement('div');
        top.className = 'search-hit-top';
        const roleTag = document.createElement('span');
        roleTag.className = `search-hit-role${person.role === 'uni' ? ' is-uni' : ''}`;
        roleTag.textContent = person.rankLabel;
        const name = document.createElement('span');
        name.className = 'search-hit-name';
        name.textContent = person.fullName;
        top.append(roleTag, name);

        const sub = document.createElement('span');
        sub.className = 'search-hit-sub';
        sub.textContent = `Angkatan ${year} · Utusan ${person.region}`;

        const snippet = document.createElement('span');
        snippet.className = 'search-hit-bio';
        snippet.textContent = person.bio;

        hit.append(top, sub, snippet);
        hit.addEventListener('click', () => {
          runway.goToProfile(person.slotIndex, person.role, year);
          closeResults();
        });
        resultsEl.appendChild(hit);
      }
    }

    resultsEl.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('focus', () => {
    if (input.value.trim()) renderResults(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeResults();
      input.blur();
    }
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    renderResults('');
    input.focus();
  });

  document.addEventListener('click', (e) => {
    const target = e.target as Node | null;
    if (target && !input.closest('.header-search')?.contains(target)) {
      closeResults();
    }
  });
}

function setupInfoDialogs(): void {
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const openBtn = target.closest<HTMLElement>('[data-open-dialog]');
    if (openBtn) {
      const targetId = openBtn.dataset.openDialog;
      if (!targetId) return;
      const dialog = document.getElementById(targetId) as HTMLDialogElement | null;
      if (!dialog) return;
      const indexRaw = openBtn.dataset.openDialogIndex;
      const requestedIndex = indexRaw ? Number(indexRaw) : 0;
      const slideIndex = Number.isFinite(requestedIndex) && requestedIndex >= 0 ? requestedIndex : 0;
      dialog.dispatchEvent(new CustomEvent('cs:reset-open', {detail: {index: slideIndex}}));
      if (!dialog.open) dialog.showModal();
      return;
    }

    const closeBtn = target.closest<HTMLElement>('[data-close-dialog]');
    if (closeBtn) {
      const parentDialog = closeBtn.closest<HTMLDialogElement>('dialog.info-dialog');
      parentDialog?.close();
    }
  });

  document.querySelectorAll<HTMLDialogElement>('dialog.info-dialog').forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      ) {
        dialog.close();
      }
    });
  });
}

interface SlidingPillController {
  update: (instant?: boolean) => void;
}

function initSlidingPill(
  container: HTMLElement | null,
  activeSelector = '.is-active',
): SlidingPillController | null {
  if (!container) return null;
  const thumb = container.querySelector<HTMLElement>('.pill-3d-thumb');
  if (!thumb) return null;

  let initialized = false;
  let animatingUntil = 0;
  let lastViewportWidth = window.innerWidth;

  const update = (instant = false) => {
    const activeEl = container.querySelector<HTMLElement>(activeSelector);
    if (!activeEl) return;

    const shouldSnap = instant || !initialized;
    if (shouldSnap) {
      container.classList.add('is-snapping');
    } else {
      container.classList.remove('is-snapping');
      animatingUntil = performance.now() + 460;
    }

    const x = activeEl.offsetLeft;
    const y = activeEl.offsetTop;
    const w = activeEl.offsetWidth;
    const h = activeEl.offsetHeight;

    thumb.style.width = `${w}px`;
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    if (!initialized) {
      container.classList.add('has-pill-thumb');
      initialized = true;
    }

    if (shouldSnap) {
      void thumb.offsetWidth;
      requestAnimationFrame(() => container.classList.remove('is-snapping'));
    }
  };

  requestAnimationFrame(() => update(true));

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => {
      if (!initialized) {
        update(true);
        return;
      }
      const isAnimating = performance.now() < animatingUntil;
      const viewportChanged = window.innerWidth !== lastViewportWidth;
      lastViewportWidth = window.innerWidth;
      update(viewportChanged && !isAnimating);
    });
    ro.observe(container);
  }
  window.addEventListener('resize', () => {
    lastViewportWidth = window.innerWidth;
    update(performance.now() >= animatingUntil);
  });

  return {update};
}

function triggerSectionCountUp(target: Element | null): void {
  target?.dispatchEvent(new CustomEvent('rw:replay-countup'));
}

function setupAnchorLinks(): void {
  const runway = document.querySelector<RunwaySection>('runway-section');
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector<HTMLElement>(hash);
      if (!target) return;
      e.preventDefault();
      runway?.closeProfileView();
      if (hash === '#galeri') {
        window.scrollTo({top: 0, behavior: 'smooth'});
      } else {
        target.scrollIntoView({behavior: 'smooth', block: 'start'});
        triggerSectionCountUp(target);
      }
    });
  });
}

function setupTopNavAndPills(): void {
  const runway = document.querySelector<RunwaySection>('runway-section');
  const yearPillCtrl = initSlidingPill(document.querySelector<HTMLElement>('.rw__year-pills'));
  const rolePillCtrl = initSlidingPill(document.querySelector<HTMLElement>('.rw__role-switch'));
  const topNavEl = document.querySelector<HTMLElement>('[data-top-nav]');
  const topNavPillCtrl = initSlidingPill(topNavEl);

  const navBtns = Array.from(topNavEl?.querySelectorAll<HTMLButtonElement>('.top-nav-btn') ?? []);
  const eventDialog = document.getElementById('kegiatan-dialog') as HTMLDialogElement | null;
  const visiMisiDialog = document.getElementById('visi-misi-dialog') as HTMLDialogElement | null;
  const regDialog = document.getElementById('pendaftaran-dialog') as HTMLDialogElement | null;

  const syncControlPills = () => {
    yearPillCtrl?.update(false);
    rolePillCtrl?.update(false);
  };

  if (runway) {
    runway.addEventListener('rw:statechange', syncControlPills);
    syncControlPills();
  }

  const setActiveNavByMatch = (predicate: (btn: HTMLButtonElement) => boolean) => {
    let changed = false;
    navBtns.forEach((btn) => {
      const match = predicate(btn);
      if (match && !btn.classList.contains('is-active')) changed = true;
      btn.classList.toggle('is-active', match);
      if (match) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    if (changed) topNavPillCtrl?.update(false);
  };

  const setActiveNavTarget = (targetHash: string) => {
    setActiveNavByMatch((btn) => btn.dataset.navTarget === targetHash);
  };

  topNavEl?.querySelectorAll<HTMLButtonElement>('[data-nav-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hash = btn.dataset.navTarget;
      if (!hash) return;
      runway?.closeProfileView();
      setActiveNavTarget(hash);
      if (hash === '#galeri') {
        window.scrollTo({top: 0, behavior: 'smooth'});
      } else {
        const target = document.querySelector<HTMLElement>(hash);
        target?.scrollIntoView({behavior: 'smooth', block: 'start'});
        triggerSectionCountUp(target);
      }
    });
  });

  topNavEl?.querySelectorAll<HTMLButtonElement>('[data-open-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveNavByMatch((item) => item === btn);
    });
  });

  // Scroll-synced active tab indicator
  const sections: {hash: string; el: HTMLElement}[] = ['#galeri', '#event', '#kepengurusan-2027']
    .map((hash) => ({hash, el: document.querySelector<HTMLElement>(hash)}))
    .filter((item): item is {hash: string; el: HTMLElement} => Boolean(item.el));

  let scrollTick = 0;
  const updateActiveByScroll = () => {
    scrollTick = 0;
    if (eventDialog?.open || visiMisiDialog?.open || regDialog?.open) return;
    if (document.body.classList.contains('is-profile-focus')) {
      setActiveNavTarget('#galeri');
      return;
    }
    const probeY = window.scrollY + window.innerHeight * 0.42;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 40;
    let current = '#galeri';
    for (const sec of sections) {
      if (sec.hash === '#galeri') continue;
      if (probeY >= sec.el.offsetTop || (atBottom && sec.hash === '#kepengurusan-2027')) {
        current = sec.hash;
      }
    }
    setActiveNavTarget(current);
  };

  eventDialog?.addEventListener('close', updateActiveByScroll);
  visiMisiDialog?.addEventListener('close', updateActiveByScroll);
  regDialog?.addEventListener('close', updateActiveByScroll);

  window.addEventListener(
    'scroll',
    () => {
      if (!scrollTick) {
        scrollTick = requestAnimationFrame(updateActiveByScroll);
      }
    },
    {passive: true},
  );
  updateActiveByScroll();
}

function createVerifiedBadgeSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const p1 = document.createElementNS(ns, 'path');
  p1.setAttribute(
    'd',
    'M12 2l2.12 1.8 2.75-.32 1.07 2.55 2.55 1.07-.32 2.75L22 12l-1.8 2.15.32 2.75-2.55 1.07-1.07 2.55-2.75-.32L12 22l-2.15-1.8-2.75.32-1.07-2.55-2.55-1.07.32-2.75L2 12l1.8-2.12-.32-2.75 2.55-1.07L7.1 3.5l2.75.32L12 2z',
  );
  p1.setAttribute('fill', '#1b8f4d');

  const p2 = document.createElementNS(ns, 'path');
  p2.setAttribute('d', 'M8.8 12.2l2.1 2.1 4.4-4.6');
  p2.setAttribute('stroke', '#ffffff');
  p2.setAttribute('stroke-width', '2.1');
  p2.setAttribute('stroke-linecap', 'round');
  p2.setAttribute('stroke-linejoin', 'round');

  svg.append(p1, p2);
  return svg;
}

function createBoardStatIcon(kind: 'year' | 'tasks'): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  if (kind === 'year') {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2');
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '12');
    c.setAttribute('cy', '7');
    c.setAttribute('r', '4');
    svg.append(p, c);
  } else {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', '8');
    r.setAttribute('y', '8');
    r.setAttribute('width', '12');
    r.setAttribute('height', '12');
    r.setAttribute('rx', '2');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2');
    svg.append(r, p);
  }
  return svg;
}

function renderEventsFromCms(): void {
  const events = getPublishedEvents();
  const track = document.querySelector<HTMLElement>('#event .showcase-track');
  const dotsWrap = document.querySelector<HTMLElement>('#event .showcase-dots');
  const modalStage = document.querySelector<HTMLElement>('#kegiatan-dialog [data-cs-stage]');
  const total = events.length;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (track) {
    track.innerHTML = '';
    events.forEach((ev, idx) => {
      const card = document.createElement('article');
      card.className = 'showcase-card';
      card.dataset.showcaseCard = String(idx);
      const pos = idx === 0 ? 'active' : idx === 1 ? 'next' : idx === total - 1 ? 'prev' : 'hidden';
      card.dataset.pos = pos;
      card.setAttribute('aria-hidden', idx === 0 ? 'false' : 'true');

      const visual = document.createElement('div');
      visual.className = 'showcase-visual';
      const img = document.createElement('img');
      img.src = resolveCmsImageUrl(ev.photo);
      img.alt = ev.photoAlt || ev.title;
      img.loading = 'lazy';
      img.draggable = false;
      img.referrerPolicy = 'no-referrer';
      const tag = document.createElement('span');
      tag.className = 'showcase-visual-tag';
      tag.textContent = `${pad(idx + 1)} / ${pad(total)}`;
      visual.append(img, tag);

      const content = document.createElement('div');
      content.className = 'showcase-content';

      const brand = document.createElement('div');
      brand.className = 'showcase-brand';
      const emblem = document.createElement('img');
      emblem.src = '/assets/aistudio/logo_uda_uni_2027_a45f5678.png';
      emblem.width = 18;
      emblem.height = 18;
      emblem.alt = '';
      emblem.setAttribute('aria-hidden', 'true');
      const catSpan = document.createElement('span');
      catSpan.textContent = ev.category;
      brand.append(emblem, catSpan);

      const h3 = document.createElement('h3');
      h3.textContent = ev.title;

      const desc = document.createElement('p');
      desc.className = 'showcase-desc';
      desc.textContent = ev.cardSummary;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'showcase-read-more';
      btn.dataset.openDialog = 'kegiatan-dialog';
      btn.dataset.openDialogIndex = String(idx);
      const btnText = document.createElement('span');
      btnText.textContent = 'Selengkapnya';
      const btnIcon = document.createElement('span');
      btnIcon.className = 'showcase-read-icon';
      btnIcon.setAttribute('aria-hidden', 'true');
      btnIcon.textContent = '→';
      btn.append(btnText, btnIcon);

      const metricsEl = document.createElement('div');
      metricsEl.className = 'showcase-metrics';
      ev.metrics.slice(0, 3).forEach((m) => {
        if (!m.value && !m.label) return;
        const metricItem = document.createElement('div');
        metricItem.className = 'showcase-metric';
        const strong = document.createElement('strong');
        strong.textContent = m.value;
        const label = document.createElement('span');
        label.textContent = m.label;
        metricItem.append(strong, label);
        metricsEl.appendChild(metricItem);
      });

      content.append(brand, h3, desc, btn, metricsEl);
      card.append(visual, content);
      track.appendChild(card);
    });
  }

  if (dotsWrap) {
    dotsWrap.innerHTML = '';
    events.forEach((_ev, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `showcase-dot${idx === 0 ? ' is-active' : ''}`;
      dot.dataset.showcaseDot = String(idx);
      dot.setAttribute('aria-label', `Program ${idx + 1}`);
      dot.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      dotsWrap.appendChild(dot);
    });
  }

  if (modalStage) {
    modalStage.innerHTML = '';
    events.forEach((ev, idx) => {
      const cardEl = document.createElement('article');
      cardEl.className = 'cs-card';
      cardEl.dataset.csCard = '';
      cardEl.dataset.csPos = idx === 0 ? 'active' : 'hidden';

      const grid = document.createElement('div');
      grid.className = 'cs-card-grid';

      const visual = document.createElement('div');
      visual.className = 'cs-card-visual cs-card-visual--photo';
      const img = document.createElement('img');
      img.className = 'cs-event-photo';
      img.src = resolveCmsImageUrl(ev.photo);
      img.alt = ev.photoAlt || ev.title;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      visual.appendChild(img);

      const body = document.createElement('div');
      body.className = 'cs-card-body';

      const top = document.createElement('div');
      top.className = 'cs-card-top';

      const brand = document.createElement('div');
      brand.className = 'cs-card-brand';
      const emblem = document.createElement('img');
      emblem.src = '/assets/aistudio/logo_uda_uni_2027_a45f5678.png';
      emblem.width = 16;
      emblem.height = 16;
      emblem.alt = '';
      emblem.setAttribute('aria-hidden', 'true');
      const kickerSpan = document.createElement('span');
      kickerSpan.textContent = ev.modalKicker || ev.category;
      brand.append(emblem, kickerSpan);

      const title = document.createElement('h3');
      title.className = 'cs-card-title';
      title.textContent = ev.title;

      const sub = document.createElement('p');
      sub.className = 'cs-card-sub';
      sub.textContent = ev.focusLine;

      const summary = document.createElement('p');
      summary.className = 'cs-card-summary';
      summary.textContent = ev.detailSummary;

      const drawer = document.createElement('div');
      drawer.className = 'cs-detail-drawer cs-detail-drawer--open';
      const ul = document.createElement('ul');
      ev.details.forEach((d) => {
        if (!d.label && !d.text) return;
        const li = document.createElement('li');
        if (d.label) {
          const strong = document.createElement('strong');
          strong.textContent = `${d.label}: `;
          li.appendChild(strong);
        }
        li.appendChild(document.createTextNode(d.text));
        ul.appendChild(li);
      });
      drawer.appendChild(ul);

      top.append(brand, title, sub, summary, drawer);
      body.appendChild(top);
      grid.append(visual, body);
      cardEl.appendChild(grid);
      modalStage.appendChild(cardEl);
    });
  }
}

function renderBoardFromCms(): void {
  const state = getCmsState();
  const strip = document.querySelector<HTMLElement>('#kepengurusan-2027 .board-summary-strip');
  const grid = document.querySelector<HTMLElement>('#kepengurusan-2027 [data-board-grid]');

  if (strip) {
    strip.innerHTML = '';
    state.boardSummary.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'board-summary-item';

      const dt = document.createElement('dt');
      dt.textContent = item.label;

      const dd = document.createElement('dd');
      const numSpan = document.createElement('span');
      numSpan.className = 'board-summary-num';
      numSpan.textContent = item.value;
      dd.appendChild(numSpan);

      if (item.unit) {
        dd.appendChild(document.createTextNode(' '));
        const unitSpan = document.createElement('span');
        unitSpan.className = 'board-summary-unit';
        unitSpan.textContent = item.unit;
        dd.appendChild(unitSpan);
      }

      wrap.append(dt, dd);
      strip.appendChild(wrap);
    });
  }

  if (grid) {
    const members = getPublishedBoardMembers();
    grid.innerHTML = '';

    members.forEach((m) => {
      const article = document.createElement('article');
      article.className = `board-card${m.isCore ? ' is-core' : ''}`;
      article.dataset.boardCard = '';
      article.dataset.boardId = m.id;
      article.dataset.division = m.divisionKey;

      const canvas = document.createElement('div');
      canvas.className = 'board-card-canvas';

      const photoUrl = resolveCmsImageUrl(m.photo);
      const photo = document.createElement('img');
      photo.className = 'board-card-photo';
      photo.src = photoUrl;
      photo.alt = m.photoAlt || m.name;
      photo.loading = 'lazy';
      photo.referrerPolicy = 'no-referrer';

      const blurImg = document.createElement('img');
      blurImg.className = 'board-card-photo-blur';
      blurImg.src = photoUrl;
      blurImg.alt = '';
      blurImg.loading = 'lazy';
      blurImg.referrerPolicy = 'no-referrer';
      blurImg.setAttribute('aria-hidden', 'true');

      const frost = document.createElement('div');
      frost.className = 'board-card-frost';
      frost.setAttribute('aria-hidden', 'true');

      const overlay = document.createElement('div');
      overlay.className = 'board-card-overlay';

      const nameRow = document.createElement('div');
      nameRow.className = 'board-name-row';
      const nameEl = document.createElement('h3');
      nameEl.className = 'board-name';
      nameEl.textContent = m.cardName || m.name;
      const verified = document.createElement('span');
      verified.className = 'board-verified';
      verified.title = 'Pengurus Resmi 2027';
      verified.setAttribute('aria-label', 'Terverifikasi');
      verified.appendChild(createVerifiedBadgeSvg());
      nameRow.append(nameEl, verified);

      const roleCopy = document.createElement('p');
      roleCopy.className = 'board-role-copy';
      const strongRole = document.createElement('strong');
      strongRole.textContent = m.cardRolePrefix;
      roleCopy.append(strongRole, document.createTextNode(m.cardRoleCopy ? ` · ${m.cardRoleCopy}` : ''));

      const foot = document.createElement('div');
      foot.className = 'board-card-foot';

      const stats = document.createElement('div');
      stats.className = 'board-stats';

      const yearStat = document.createElement('span');
      yearStat.className = 'board-stat';
      yearStat.title = 'Angkatan Utama';
      const yearLabel = document.createElement('span');
      yearLabel.textContent = m.cohortYear || '2024';
      yearStat.append(createBoardStatIcon('year'), yearLabel);

      const tasksStat = document.createElement('span');
      tasksStat.className = 'board-stat';
      tasksStat.title = 'Mandat Program Kerja';
      const tasksLabel = document.createElement('span');
      tasksLabel.textContent = String(m.tasks.length || 3);
      tasksStat.append(createBoardStatIcon('tasks'), tasksLabel);

      stats.append(yearStat, tasksStat);

      const detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'board-pill-cta';
      detailBtn.dataset.boardDetail = m.id;
      const dText = document.createElement('span');
      dText.textContent = 'Detail';
      const dPlus = document.createElement('span');
      dPlus.setAttribute('aria-hidden', 'true');
      dPlus.textContent = '+';
      detailBtn.append(dText, dPlus);

      foot.append(stats, detailBtn);
      overlay.append(nameRow, roleCopy, foot);
      canvas.append(photo, blurImg, frost, overlay);
      article.appendChild(canvas);
      grid.appendChild(article);
    });
  }
}

function renderVisiMisiFromCms(): void {
  const dialog = document.getElementById('visi-misi-dialog');
  if (!dialog) return;
  const vm = getCmsState().visimisi;

  const eyebrowEl = dialog.querySelector<HTMLElement>('.vm-eyebrow');
  if (eyebrowEl) eyebrowEl.textContent = vm.eyebrow;

  const chipsWrap = dialog.querySelector<HTMLElement>('.vm-card-chips--static');
  if (chipsWrap) {
    chipsWrap.innerHTML = '';
    vm.chips.forEach((chip) => {
      const span = document.createElement('span');
      span.className = 'vm-chip-pill';
      span.textContent = chip;
      chipsWrap.appendChild(span);
    });
  }

  const quoteEl = dialog.querySelector<HTMLElement>('.vm-visi-quote');
  if (quoteEl) {
    quoteEl.innerHTML = '';
    quoteEl.appendChild(document.createTextNode(`${vm.visiQuoteLead} `));
    const muted = document.createElement('span');
    muted.className = 'vm-visi-quote-muted';
    muted.textContent = vm.visiQuoteMuted;
    quoteEl.appendChild(muted);
  }

  const descEl = dialog.querySelector<HTMLElement>('.vm-visi-desc');
  if (descEl) descEl.textContent = vm.visiDesc;

  const sealSpan = dialog.querySelector<HTMLElement>('.vm-seal-chip span');
  if (sealSpan) sealSpan.textContent = vm.sealLabel;

  const renderPanelList = (panelName: string, items: typeof vm.misiItems) => {
    const listEl = dialog.querySelector<HTMLElement>(`[data-vm-panel="${panelName}"] .vm-dark-list`);
    if (!listEl) return;
    listEl.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'vm-dark-entry';

      const idxSpan = document.createElement('span');
      idxSpan.className = 'vm-entry-index';
      idxSpan.textContent = item.indexLabel;

      const h3 = document.createElement('h3');
      h3.textContent = item.title;

      const p = document.createElement('p');
      p.textContent = item.description;

      li.append(idxSpan, h3, p);
      listEl.appendChild(li);
    });
  };

  renderPanelList('misi', vm.misiItems);
  renderPanelList('sebaran', vm.sebaranItems);
  renderPanelList('komitmen', vm.komitmenItems);
}

let boardCardsAbortCtrl: AbortController | null = null;

function setupBoardCards3D(): void {
  boardCardsAbortCtrl?.abort();
  boardCardsAbortCtrl = new AbortController();
  const {signal} = boardCardsAbortCtrl;

  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-board-card]'));
  const stage = document.querySelector<HTMLElement>('[data-board-stage]');
  const dotsWrap = document.querySelector<HTMLElement>('[data-board-dots]');
  const indexEl = document.querySelector<HTMLElement>('[data-board-index]');
  const prevBtns = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-board-prev], [data-board-stage-prev]'),
  );
  const nextBtns = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-board-next], [data-board-stage-next]'),
  );
  const dialog = document.getElementById('board-detail-dialog') as HTMLDialogElement | null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion;

  cards.forEach((card) => {
    const canvas = card.querySelector<HTMLElement>('.board-card-canvas');
    const photo = card.querySelector<HTMLImageElement>('.board-card-photo');
    if (canvas && photo && !canvas.querySelector('.board-card-photo-blur')) {
      const blurImg = document.createElement('img');
      blurImg.className = 'board-card-photo-blur';
      blurImg.src = photo.src;
      blurImg.alt = '';
      blurImg.loading = 'lazy';
      blurImg.referrerPolicy = 'no-referrer';
      blurImg.setAttribute('aria-hidden', 'true');
      photo.insertAdjacentElement('afterend', blurImg);
    }
  });

  const getVisibleCards = () => cards.filter((card) => !card.hidden);

  let active = 0;
  let startY = 0;
  let tracking = false;
  let wheelLockUntil = 0;

  const syncDots = (total: number) => {
    if (!dotsWrap) return;
    if (total <= 1) {
      dotsWrap.innerHTML = '';
      return;
    }
    if (dotsWrap.childElementCount !== total) {
      dotsWrap.innerHTML = '';
      for (let i = 0; i < total; i += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'board-stage-dot';
        dot.setAttribute('aria-label', `Tampilkan pengurus urutan ${i + 1}`);
        dot.addEventListener('click', () => go(i), {signal});
        dotsWrap.appendChild(dot);
      }
    }
    Array.from(dotsWrap.children).forEach((el, idx) => {
      const isAct = idx === active;
      el.classList.toggle('is-active', isAct);
      el.setAttribute('aria-current', isAct ? 'true' : 'false');
    });
  };

  const renderDeck = () => {
    const visible = getVisibleCards();
    const total = visible.length;

    cards.forEach((card) => {
      if (card.hidden) {
        card.dataset.pos = 'hidden';
        card.setAttribute('aria-hidden', 'true');
      }
    });

    if (!total) {
      if (indexEl) indexEl.textContent = '00 / 00';
      prevBtns.forEach((btn) => {
        btn.disabled = true;
      });
      nextBtns.forEach((btn) => {
        btn.disabled = true;
      });
      syncDots(0);
      return;
    }

    active = ((active % total) + total) % total;

    visible.forEach((card, index) => {
      const diff = (index - active + total) % total;
      let pos: 'active' | 'next' | 'prev' | 'next-far' | 'prev-far' | 'hidden' = 'hidden';
      if (diff === 0) {
        pos = 'active';
      } else if (total === 2 && diff === 1) {
        pos = 'next';
      } else if (total === 3) {
        if (diff === 1) pos = 'next';
        else if (diff === 2) pos = 'prev';
      } else if (total === 4) {
        if (diff === 1) pos = 'next';
        else if (diff === 2) pos = 'next-far';
        else if (diff === 3) pos = 'prev';
      } else if (total >= 5) {
        if (diff === 1) pos = 'next';
        else if (diff === 2) pos = 'next-far';
        else if (diff === total - 1) pos = 'prev';
        else if (diff === total - 2) pos = 'prev-far';
      }

      card.dataset.pos = pos;
      card.setAttribute('aria-hidden', pos === 'active' ? 'false' : 'true');
    });

    const pad = (n: number) => String(n).padStart(2, '0');
    if (indexEl) indexEl.textContent = `${pad(active + 1)} / ${pad(total)}`;

    const disableNav = total <= 1;
    prevBtns.forEach((btn) => {
      btn.disabled = disableNav;
    });
    nextBtns.forEach((btn) => {
      btn.disabled = disableNav;
    });

    syncDots(total);
  };

  const go = (nextIndex: number) => {
    const visible = getVisibleCards();
    const total = visible.length;
    if (!total) return;
    active = ((nextIndex % total) + total) % total;
    renderDeck();
  };

  prevBtns.forEach((btn) => {
    btn.addEventListener('click', () => go(active - 1), {signal});
  });

  nextBtns.forEach((btn) => {
    btn.addEventListener('click', () => go(active + 1), {signal});
  });

  if (stage) {
    stage.addEventListener(
      'board:filterchange',
      () => {
        active = 0;
        renderDeck();
      },
      {signal},
    );

    stage.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          go(active + 1);
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          go(active - 1);
        }
      },
      {signal},
    );

    stage.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        const visible = getVisibleCards();
        if (visible.length <= 1 || Math.abs(e.deltaY) < 8) return;
        const goingDown = e.deltaY > 0;
        if ((goingDown && active >= visible.length - 1) || (!goingDown && active <= 0)) {
          return;
        }
        e.preventDefault();
        const now = performance.now();
        if (now < wheelLockUntil) return;
        wheelLockUntil = now + 340;
        go(goingDown ? active + 1 : active - 1);
      },
      {passive: false, signal},
    );

    stage.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        if ((e.target as HTMLElement | null)?.closest('button')) return;
        startY = e.clientY;
        tracking = true;
      },
      {signal},
    );

    stage.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        if (!tracking) return;
        tracking = false;
        const dy = e.clientY - startY;
        if (Math.abs(dy) > 40) {
          go(dy < 0 ? active + 1 : active - 1);
        }
      },
      {signal},
    );

    stage.addEventListener(
      'pointercancel',
      () => {
        tracking = false;
      },
      {signal},
    );
  }

  renderDeck();

  if (canTilt) {
    cards.forEach((card) => {
      let rafId = 0;
      let nextRx = 0;
      let nextRy = 0;
      let nextMx = '50%';
      let nextMy = '28%';

      const applyTilt = () => {
        rafId = 0;
        card.style.setProperty('--rx', `${nextRx.toFixed(2)}deg`);
        card.style.setProperty('--ry', `${nextRy.toFixed(2)}deg`);
        card.style.setProperty('--mx', nextMx);
        card.style.setProperty('--my', nextMy);
      };

      card.addEventListener(
        'pointerenter',
        () => {
          card.classList.add('is-tilting');
        },
        {signal},
      );

      card.addEventListener(
        'pointermove',
        (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          const rect = card.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
          const py = clamp((e.clientY - rect.top) / rect.height, 0, 1);

          nextRx = (0.5 - py) * 7.5;
          nextRy = (px - 0.5) * 9;
          nextMx = `${(px * 100).toFixed(1)}%`;
          nextMy = `${(py * 100).toFixed(1)}%`;

          if (!rafId) {
            rafId = requestAnimationFrame(applyTilt);
          }
        },
        {signal},
      );

      card.addEventListener(
        'pointerleave',
        () => {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
          }
          card.classList.remove('is-tilting');
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
        },
        {signal},
      );
    });
  }

  if (!dialog) return;
  const boardCarouselEl = dialog.querySelector<HTMLElement>('[data-cs-carousel="board"]');
  const boardStage = dialog.querySelector<HTMLElement>('[data-bd-stage]');
  const boardKickerEl = dialog.querySelector<HTMLElement>('[data-bd-kicker]');
  const boardTitleEl = dialog.querySelector<HTMLElement>('#board-dialog-title');
  const boardMembers = getPublishedBoardMembers();

  if (boardStage) {
    boardStage.innerHTML = '';

    boardMembers.forEach((profile, idx) => {
      const cardEl = document.createElement('article');
      cardEl.className = 'cs-card';
      cardEl.dataset.csCard = '';
      cardEl.dataset.boardProfileId = profile.id;
      cardEl.dataset.csPos = idx === 0 ? 'active' : 'hidden';

      const grid = document.createElement('div');
      grid.className = 'cs-card-grid';

      const visual = document.createElement('div');
      visual.className = 'cs-card-visual cs-card-visual--obsidian cs-card-visual--portrait';

      const img = document.createElement('img');
      img.className = 'cs-board-portrait';
      img.src = resolveCmsImageUrl(profile.photo);
      img.alt = profile.name;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';

      visual.append(img);

      const body = document.createElement('div');
      body.className = 'cs-card-body';

      const top = document.createElement('div');
      top.className = 'cs-card-top';

      const brand = document.createElement('div');
      brand.className = 'cs-card-brand';
      const emblem = document.createElement('img');
      emblem.src = '/assets/aistudio/logo_uda_uni_2027_a45f5678.png';
      emblem.width = 16;
      emblem.height = 16;
      emblem.alt = '';
      emblem.setAttribute('aria-hidden', 'true');
      const divLabel = document.createElement('span');
      divLabel.textContent = profile.division;
      brand.append(emblem, divLabel);

      const title = document.createElement('h3');
      title.className = 'cs-card-title';
      title.textContent = profile.name;

      const sub = document.createElement('p');
      sub.className = 'cs-card-sub';
      sub.textContent = `${profile.role} · ${profile.origin}`;

      const summary = document.createElement('p');
      summary.className = 'cs-card-summary';
      summary.textContent = profile.summary;

      const drawer = document.createElement('div');
      drawer.className = 'cs-detail-drawer cs-detail-drawer--open';
      const ul = document.createElement('ul');
      profile.tasks.forEach((task, taskIdx) => {
        const li = document.createElement('li');
        const label = document.createElement('strong');
        label.textContent = `Mandat ${taskIdx + 1}: `;
        li.append(label, document.createTextNode(task));
        ul.appendChild(li);
      });
      drawer.appendChild(ul);

      top.append(brand, title, sub, summary, drawer);
      body.appendChild(top);
      grid.append(visual, body);
      cardEl.appendChild(grid);
      boardStage.appendChild(cardEl);
    });
  }

  const boardCarousel = initCsCarousel(boardCarouselEl, {
    signal,
    onChange: (activeIdx) => {
      const entry = boardMembers[activeIdx];
      if (!entry) return;
      if (boardKickerEl) {
        boardKickerEl.textContent = entry.division;
      }
      if (boardTitleEl) {
        boardTitleEl.textContent = entry.name;
      }
    },
  });

  const openBoardDetail = (id: string) => {
    const idx = boardMembers.findIndex((m) => m.id === id);
    if (idx < 0) return;

    boardCarousel?.resetDetails();
    boardCarousel?.goTo(idx);
    if (boardKickerEl) {
      boardKickerEl.textContent = boardMembers[idx].division;
    }
    if (boardTitleEl) {
      boardTitleEl.textContent = boardMembers[idx].name;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  };

  const focusAndOpenBoardCard = (card: HTMLElement | null, id: string | undefined) => {
    if (card) {
      const visible = getVisibleCards();
      const visibleIdx = visible.indexOf(card);
      if (visibleIdx !== -1 && card.dataset.pos !== 'active') {
        go(visibleIdx);
      }
    }
    const targetId = id || card?.dataset.boardId;
    if (targetId) {
      openBoardDetail(targetId);
    }
  };

  document.querySelectorAll<HTMLButtonElement>('[data-board-detail]').forEach((btn) => {
    btn.addEventListener(
      'click',
      (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest<HTMLElement>('[data-board-card]');
        focusAndOpenBoardCard(card, btn.dataset.boardDetail);
      },
      {signal},
    );
  });

  cards.forEach((card) => {
    const canvas = card.querySelector<HTMLElement>('.board-card-canvas');
    if (!canvas) return;
    let downX: number | null = null;
    let downY: number | null = null;
    canvas.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
      },
      {signal},
    );
    canvas.addEventListener(
      'pointercancel',
      () => {
        downX = null;
        downY = null;
      },
      {signal},
    );
    canvas.addEventListener(
      'click',
      (e: MouseEvent) => {
        if ((e.target as HTMLElement | null)?.closest('button')) return;
        if (
          downY !== null &&
          downX !== null &&
          (Math.abs(e.clientY - downY) > 18 || Math.abs(e.clientX - downX) > 18)
        ) {
          downX = null;
          downY = null;
          return;
        }
        downX = null;
        downY = null;
        e.preventDefault();
        focusAndOpenBoardCard(card, card.dataset.boardId);
      },
      {signal},
    );
  });
}

interface CsCarouselController {
  goTo: (index: number) => void;
  resetDetails: () => void;
}

function initCsCarousel(
  shell: HTMLElement | null,
  options?: {onChange?: (activeIdx: number, activeCard: HTMLElement) => void; signal?: AbortSignal},
): CsCarouselController | null {
  if (!shell) return null;

  const cards = Array.from(shell.querySelectorAll<HTMLElement>('[data-cs-card]'));
  const parentDialog = shell.closest<HTMLDialogElement>('dialog');

  if (!cards.length) return null;

  const total = cards.length;
  let active = Math.max(
    0,
    cards.findIndex((c) => c.dataset.csPos === 'active'),
  );

  const resetDetails = () => {
    shell.querySelectorAll<HTMLButtonElement>('[data-cs-toggle-detail]').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
    shell.querySelectorAll<HTMLElement>('[data-cs-detail]').forEach((drawer) => {
      drawer.hidden = true;
    });
  };

  const render = () => {
    cards.forEach((card, i) => {
      if (i === active) {
        card.dataset.csPos = 'active';
        card.setAttribute('aria-hidden', 'false');
      } else {
        card.dataset.csPos = 'hidden';
        card.setAttribute('aria-hidden', 'true');
      }
    });

    options?.onChange?.(active, cards[active]);
  };

  const goTo = (index: number) => {
    const next = ((index % total) + total) % total;
    if (next !== active) {
      resetDetails();
      active = next;
    }
    render();
  };

  shell.querySelectorAll<HTMLButtonElement>('[data-cs-toggle-detail]').forEach((btn) => {
    btn.addEventListener(
      'click',
      (e: MouseEvent) => {
        e.stopPropagation();
        const card = btn.closest<HTMLElement>('[data-cs-card]');
        if (!card || card.dataset.csPos !== 'active') return;
        const drawer = card.querySelector<HTMLElement>('[data-cs-detail]');
        if (!drawer) return;
        const nextExpanded = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(nextExpanded));
        drawer.hidden = !nextExpanded;
      },
      {signal: options?.signal},
    );
  });

  if (parentDialog) {
    parentDialog.addEventListener(
      'cs:reset-open',
      ((e: CustomEvent<{index?: number}>) => {
        resetDetails();
        const requested = typeof e.detail?.index === 'number' ? e.detail.index : 0;
        goTo(requested);
      }) as EventListener,
      {signal: options?.signal},
    );
  }

  render();
  return {goTo, resetDetails};
}

let kegiatanAbortCtrl: AbortController | null = null;

function setupKegiatanCarousel(): void {
  kegiatanAbortCtrl?.abort();
  kegiatanAbortCtrl = new AbortController();
  const shell = document.querySelector<HTMLElement>('[data-cs-carousel="kegiatan"]');
  const kickerEl = shell?.querySelector<HTMLElement>('[data-cs-kicker]');
  const titleEl = shell?.querySelector<HTMLElement>('#kegiatan-title');
  initCsCarousel(shell, {
    signal: kegiatanAbortCtrl.signal,
    onChange: (_idx, activeCard) => {
      const brandLabel = activeCard.querySelector<HTMLElement>('.cs-card-brand span')?.textContent?.trim();
      const cardTitle = activeCard.querySelector<HTMLElement>('.cs-card-title')?.textContent?.trim();
      if (kickerEl && brandLabel) {
        kickerEl.textContent = brandLabel;
      }
      if (titleEl && cardTitle) {
        titleEl.textContent = cardTitle;
      }
    },
  });
}

const countUpRafMap = new WeakMap<HTMLElement, number>();

function prepareCountTarget(el: HTMLElement): string {
  if (el.dataset.countRaw === undefined) {
    el.dataset.countRaw = (el.textContent ?? '').trim();
  }
  return el.dataset.countRaw;
}

function animateCountUp(elements: HTMLElement[]): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  elements.forEach((el, i) => {
    const prevRaf = countUpRafMap.get(el);
    if (prevRaf) {
      cancelAnimationFrame(prevRaf);
      countUpRafMap.delete(el);
    }

    const rawText = prepareCountTarget(el);
    const match = rawText.match(/^\s*(\d+)(.*)$/);
    if (!match || reducedMotion) {
      el.textContent = rawText;
      return;
    }

    const target = Number(match[1]);
    const suffix = match[2] ?? '';
    if (!Number.isFinite(target) || target <= 1) {
      el.textContent = rawText;
      return;
    }

    const duration = target <= 10 ? 780 : target <= 120 ? 1150 : 1450;
    const delay = i * 70;
    let startTime = 0;

    el.textContent = `1${suffix}`;

    const tick = (now: number) => {
      if (!startTime) startTime = now + delay;
      if (now < startTime) {
        countUpRafMap.set(el, requestAnimationFrame(tick));
        return;
      }

      const progress = clamp((now - startTime) / duration, 0, 1);
      const power = target <= 10 ? 3 : 4;
      const eased = 1 - Math.pow(1 - progress, power);
      const value = Math.min(target, Math.max(1, Math.round(1 + (target - 1) * eased)));
      el.textContent = `${value}${suffix}`;

      if (progress < 1) {
        countUpRafMap.set(el, requestAnimationFrame(tick));
      } else {
        el.textContent = rawText;
        countUpRafMap.delete(el);
      }
    };

    countUpRafMap.set(el, requestAnimationFrame(tick));
  });
}

let showcaseTeardown: (() => void) | null = null;

function setupEventShowcase(): void {
  showcaseTeardown?.();
  const stage = document.querySelector<HTMLElement>('[data-showcase]');
  if (!stage) return;

  const ctrl = new AbortController();
  const {signal} = ctrl;
  let observer: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let wheelLock = 0;
  let rafId = 0;

  const cards = Array.from(stage.querySelectorAll<HTMLElement>('[data-showcase-card]'));
  const dots = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-showcase-dot]'));
  const prevBtn = stage.querySelector<HTMLButtonElement>('[data-showcase-prev]');
  const nextBtn = stage.querySelector<HTMLButtonElement>('[data-showcase-next]');
  const total = cards.length;
  if (total === 0) return;

  stage.classList.add('is-spring');

  cards.forEach((card) => {
    card.querySelectorAll<HTMLElement>('.showcase-metric strong').forEach(prepareCountTarget);
  });

  const section = stage.closest<HTMLElement>('#event');
  const mqlMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = mqlMotion.matches;
  const onMotionChange = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches;
    if (reducedMotion) {
      cur = target;
      vel = 0;
      renderFrame(cur);
    }
  };
  mqlMotion.addEventListener('change', onMotionChange);

  // Critically-damped spring physics matching Hero RunwaySection (K=95, C=2*sqrt(95))
  const K = 95;
  const C = 2 * Math.sqrt(K);

  let active = 0;
  let target = 0;
  let cur = 0;
  let vel = 0;
  let lastTs = 0;
  let visible = true;
  let showcaseInView = false;

  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTarget = 0;
  let dragActive = false;
  let dragAbandoned = false;
  let dragUnit = 320;
  let dragSamples: Array<{x: number; time: number}> = [];
  let suppressClickUntil = 0;
  let wheelAcc = 0;
  const lastBlurs = cards.map(() => '');

  const normIdx = (n: number) => ((Math.round(n) % total) + total) % total;

  const syncMobileHeight = () => {
    if (window.innerWidth <= 749) {
      let maxH = 0;
      cards.forEach((card) => {
        const h = card.offsetHeight;
        if (h > maxH) maxH = h;
      });
      if (maxH > 0) {
        stage.style.setProperty('--showcase-h', `${Math.ceil(maxH)}px`);
      }
    } else {
      stage.style.removeProperty('--showcase-h');
    }
  };

  const animateActiveMetrics = () => {
    const activeCard = cards[active];
    if (!activeCard) return;
    const nums = Array.from(activeCard.querySelectorAll<HTMLElement>('.showcase-metric strong'));
    animateCountUp(nums);
  };

  const syncAriaAndDots = () => {
    cards.forEach((card, index) => {
      const diff = (index - active + total) % total;
      let pos: 'active' | 'next' | 'prev' | 'hidden' = 'hidden';
      if (diff === 0) pos = 'active';
      else if (diff === 1) pos = 'next';
      else if (diff === total - 1) pos = 'prev';

      card.dataset.pos = pos;
      card.setAttribute('aria-hidden', pos === 'active' ? 'false' : 'true');
    });

    dots.forEach((dot, index) => {
      const isActive = index === active;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  };

  const renderFrame = (pos: number) => {
    const isMobile = window.innerWidth <= 749;
    const sideOpacity = isMobile ? 0.12 : 0.84;
    const visualStep = (44 * Math.PI) / 180;

    for (let i = 0; i < total; i++) {
      const card = cards[i];
      let delta = (i - pos) % total;
      while (delta <= -total / 2) delta += total;
      while (delta > total / 2) delta -= total;

      const absD = Math.abs(delta);

      let xPct: number;
      let zPx: number;
      let scale: number;
      let opacity: number;
      let blur: number;

      if (isMobile) {
        xPct = -50 + delta * 104;
        zPx = -80 * Math.min(absD, 1.5);
        scale = 1 - 0.08 * Math.min(absD, 1.5);
        opacity = absD <= 1 ? 1 - (1 - sideOpacity) * absD : Math.max(0, sideOpacity * (1.35 - absD) / 0.35);
        blur = 0;
      } else {
        const clampedD = clamp(delta, -2.15, 2.15);
        const phi = clampedD * visualStep;
        const sinP = Math.sin(phi);
        const cosP = Math.cos(phi);
        const depth = 1 - cosP;

        if (absD <= 1) {
          xPct = -50 + sinP * 63.3;
          zPx = -140 * absD;
          scale = 1 - 0.16 * absD;
          opacity = 1 - (1 - sideOpacity) * absD;
          blur = 0.65 * absD;
        } else if (absD < 2.15) {
          const t = clamp((absD - 1) / 1.15, 0, 1);
          const edgeX = delta < 0 ? -94 : -6;
          xPct = edgeX + (-50 - edgeX) * (t * 0.72);
          zPx = -140 - 130 * (depth * 0.65 + t * 0.55);
          scale = 0.84 - 0.17 * t;
          opacity = sideOpacity * (1 - t);
          blur = 0.65 + 0.95 * t;
        } else {
          xPct = -50;
          zPx = -280;
          scale = 0.66;
          opacity = 0;
          blur = 1.6;
        }
      }

      const zIdx = Math.max(1, Math.round(100 - absD * 30));
      card.style.transform = `translate3d(${xPct.toFixed(2)}%, 0, ${zPx.toFixed(1)}px) scale(${scale.toFixed(4)})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(zIdx);
      card.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
      card.style.pointerEvents = opacity < 0.18 ? 'none' : 'auto';

      const blurStr = blur > 0.04 ? `blur(${blur.toFixed(2)}px)` : '';
      if (lastBlurs[i] !== blurStr) {
        card.style.filter = blurStr;
        lastBlurs[i] = blurStr;
      }
    }
  };

  const step = (ts: number) => {
    rafId = 0;
    if (!visible || document.hidden) return;

    const dt = lastTs ? Math.min(0.034, (ts - lastTs) / 1000) : 1 / 60;
    lastTs = ts;

    if (reducedMotion && !dragActive) {
      cur = target;
      vel = 0;
      renderFrame(cur);
      return;
    }

    const h = dt / 3;
    for (let j = 0; j < 3; j++) {
      const acc = -K * (cur - target) - C * vel;
      vel += acc * h;
      cur += vel * h;
    }

    if (!dragActive && Math.abs(cur - target) <= 0.0005 && Math.abs(vel) <= 0.0005) {
      cur = target;
      vel = 0;
      renderFrame(cur);
      return;
    }

    renderFrame(cur);
    rafId = requestAnimationFrame(step);
  };

  const kick = () => {
    if (rafId || !visible || document.hidden) return;
    lastTs = 0;
    rafId = requestAnimationFrame(step);
  };

  const moveTo = (nextTarget: number, forceReplay = false) => {
    target = nextTarget;
    const resolved = normIdx(target);
    const changed = resolved !== active;
    active = resolved;
    syncAriaAndDots();
    if (changed || forceReplay) {
      animateActiveMetrics();
    }
    kick();
  };

  const go = (nextIndex: number, forceReplay = false) => {
    const resolved = normIdx(nextIndex);
    let d = (((resolved - active) % total) + total) % total;
    if (d > total / 2) d -= total;
    moveTo(Math.round(target) + d, forceReplay);
  };

  showcaseTeardown = () => {
    ctrl.abort();
    observer?.disconnect();
    resizeObserver?.disconnect();
    mqlMotion.removeEventListener('change', onMotionChange);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (wheelLock) {
      window.clearTimeout(wheelLock);
      wheelLock = 0;
    }
    stage.classList.remove('is-spring', 'is-dragging');
    stage.style.removeProperty('--showcase-h');
  };

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible = entry.isIntersecting;
          if (visible) kick();
          if (entry.intersectionRatio >= 0.15) {
            if (!showcaseInView) {
              showcaseInView = true;
              animateActiveMetrics();
            }
          } else if (!entry.isIntersecting) {
            showcaseInView = false;
          }
        }
      },
      {threshold: [0, 0.15]},
    );
    observer.observe(stage);
  } else {
    showcaseInView = true;
    animateActiveMetrics();
  }

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      syncMobileHeight();
      renderFrame(cur);
    });
    resizeObserver.observe(stage);
    cards.forEach((c) => resizeObserver?.observe(c));
  }

  window.addEventListener(
    'resize',
    () => {
      syncMobileHeight();
      renderFrame(cur);
    },
    {signal},
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (!document.hidden && visible) {
        lastTs = 0;
        kick();
      }
    },
    {signal},
  );

  section?.addEventListener(
    'rw:replay-countup',
    () => {
      showcaseInView = true;
      animateActiveMetrics();
    },
    {signal},
  );

  prevBtn?.addEventListener('click', () => moveTo(Math.round(target) - 1), {signal});
  nextBtn?.addEventListener('click', () => moveTo(Math.round(target) + 1), {signal});

  dots.forEach((dot) => {
    dot.addEventListener(
      'click',
      () => {
        const idx = Number(dot.dataset.showcaseDot);
        if (!Number.isNaN(idx)) go(idx, true);
      },
      {signal},
    );
  });

  cards.forEach((card, index) => {
    card.addEventListener(
      'click',
      (e) => {
        if (card.dataset.pos === 'prev' || card.dataset.pos === 'next') {
          e.preventDefault();
          go(index);
        }
      },
      {signal},
    );
  });

  const endDrag = (e: PointerEvent) => {
    if (dragPointerId !== e.pointerId) return;
    dragPointerId = null;
    if (!dragActive) return;

    dragActive = false;
    stage.classList.remove('is-dragging');
    suppressClickUntil = performance.now() + 80;

    try {
      if (stage.hasPointerCapture(e.pointerId)) {
        stage.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    const first = dragSamples[0];
    const last = dragSamples[dragSamples.length - 1];
    const dt = last && first ? Math.max(1, last.time - first.time) : 1;
    const vx = last && first && last !== first ? (last.x - first.x) / dt : 0;
    const dx = e.clientX - dragStartX;
    const from = Math.round(dragStartTarget);

    if (window.innerWidth <= 749) {
      if (Math.abs(dx) > 32 || Math.abs(vx) > 0.28) {
        moveTo(from + (dx > 0 ? -1 : 1));
      } else {
        moveTo(from);
      }
    } else {
      let nextT = Math.round(target + (-vx * 160) / dragUnit);
      if (nextT === from && Math.abs(vx) > 0.28) {
        nextT = from + (vx < 0 ? 1 : -1);
      }
      nextT = clamp(nextT, from - 2, from + 2);
      moveTo(nextT);
    }
  };

  stage.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as HTMLElement | null)?.closest('button, a')) return;

      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartTarget = target;
      dragActive = false;
      dragAbandoned = false;
      const activeCardWidth = cards[active]?.offsetWidth || stage.clientWidth || 720;
      dragUnit = Math.max(180, activeCardWidth * (window.innerWidth <= 749 ? 0.62 : 0.42));
      dragSamples = [{x: e.clientX, time: performance.now()}];
    },
    {signal},
  );

  stage.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (dragPointerId !== e.pointerId || dragAbandoned) return;
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        endDrag(e);
        return;
      }

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (!dragActive) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          dragAbandoned = true;
          dragPointerId = null;
          return;
        }
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
          dragActive = true;
          stage.classList.add('is-dragging');
          try {
            stage.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        } else {
          return;
        }
      }

      dragSamples.push({x: e.clientX, time: performance.now()});
      if (dragSamples.length > 6) dragSamples.shift();

      target = dragStartTarget - dx / dragUnit;
      kick();
    },
    {signal},
  );

  stage.addEventListener('pointerup', endDrag, {signal});
  stage.addEventListener('pointercancel', endDrag, {signal});

  stage.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (performance.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    {capture: true, signal},
  );

  stage.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 42) {
        moveTo(Math.round(target) + (wheelAcc > 0 ? 1 : -1));
        wheelAcc = 0;
        wheelLock = window.setTimeout(() => {
          wheelLock = 0;
          wheelAcc = 0;
        }, 440);
      }
    },
    {passive: false, signal},
  );

  stage.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveTo(Math.round(target) + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveTo(Math.round(target) - 1);
      }
    },
    {signal},
  );

  cards.forEach((card, cardIdx) => {
    const visual = card.querySelector<HTMLElement>('.showcase-visual');
    if (visual) {
      let downX = 0;
      let downY = 0;
      visual.addEventListener(
        'pointerdown',
        (e: PointerEvent) => {
          downX = e.clientX;
          downY = e.clientY;
        },
        {signal},
      );
      visual.addEventListener(
        'click',
        (e: MouseEvent) => {
          if (card.dataset.pos !== 'active') return;
          if (Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8) return;
          e.preventDefault();
          const kegiatanDialog = document.getElementById('kegiatan-dialog') as HTMLDialogElement | null;
          if (kegiatanDialog) {
            kegiatanDialog.dispatchEvent(new CustomEvent('cs:reset-open', {detail: {index: cardIdx}}));
            if (!kegiatanDialog.open) {
              kegiatanDialog.showModal();
            }
          }
        },
        {signal},
      );
    }
  });

  syncAriaAndDots();
  syncMobileHeight();
  renderFrame(cur);
}

function setupVisiMisi3D(): void {
  const frame = document.querySelector<HTMLElement>('[data-vm-frame]');
  if (!frame) return;

  const vmDialog = document.getElementById('visi-misi-dialog') as HTMLDialogElement | null;
  const stackCards = Array.from(frame.querySelectorAll<HTMLElement>('[data-vm-card]'));
  const tabs = Array.from(frame.querySelectorAll<HTMLButtonElement>('[data-vm-tab]'));
  const panels = Array.from(frame.querySelectorAll<HTMLElement>('[data-vm-panel]'));
  const nextBtn = frame.querySelector<HTMLButtonElement>('[data-vm-next-section]');

  let activeCard: 'visi' | 'misi' = 'visi';
  let animResetTimer = 0;

  const setFrontCard = (target: 'visi' | 'misi', instant = false) => {
    const changed = target !== activeCard;
    activeCard = target;
    frame.dataset.vmActive = target;

    if (animResetTimer) {
      window.clearTimeout(animResetTimer);
      animResetTimer = 0;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stackCards.forEach((card) => {
      card.removeAttribute('data-vm-anim');
    });

    if (changed && !instant && !reducedMotion) {
      void frame.offsetWidth;
    }

    stackCards.forEach((card) => {
      const role = card.dataset.vmCard === 'misi' ? 'misi' : 'visi';
      const isFront = role === target;
      card.dataset.vmPos = isFront ? 'front' : 'back';
      card.setAttribute(
        'aria-label',
        isFront
          ? `Kartu ${role === 'visi' ? 'Visi' : 'Misi'} Ikatan`
          : `Kartu ${role === 'visi' ? 'Visi' : 'Misi'} Ikatan — klik untuk menampilkan ke depan`,
      );
      if (changed && !instant && !reducedMotion) {
        card.dataset.vmAnim = isFront ? 'to-front' : 'to-back';
      }
    });

    if (changed && !instant && !reducedMotion) {
      animResetTimer = window.setTimeout(() => {
        stackCards.forEach((card) => card.removeAttribute('data-vm-anim'));
        animResetTimer = 0;
      }, 390);
    }
  };

  stackCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (card.dataset.vmPos !== 'back') return;
      if ((e.target as HTMLElement | null)?.closest('button, a')) return;
      const role = card.dataset.vmCard === 'misi' ? 'misi' : 'visi';
      setFrontCard(role, false);
    });

    card.addEventListener('keydown', (e: KeyboardEvent) => {
      if (card.dataset.vmPos !== 'back') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const role = card.dataset.vmCard === 'misi' ? 'misi' : 'visi';
        setFrontCard(role, false);
      }
    });
  });

  const activateTab = (key: string) => {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.vmTab === key;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      const isMatch = panel.dataset.vmPanel === key;
      panel.hidden = !isMatch;
      panel.classList.toggle('is-active', isMatch);
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = tab.dataset.vmTab;
      if (key) activateTab(key);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-open-dialog="visi-misi-dialog"]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      setFrontCard('visi', true);
    });
  });

  nextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const hash = nextBtn.dataset.vmNextSection;
    if (!hash) return;
    if (vmDialog?.open) vmDialog.close();
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(hash);
      target?.scrollIntoView({behavior: 'smooth', block: 'start'});
      triggerSectionCountUp(target);
    });
  });

  const canTilt =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canTilt) return;

  let rafId = 0;
  let nextRx = 0;
  let nextRy = 0;
  let nextMx = '50%';
  let nextMy = '24%';

  const applyTilt = () => {
    rafId = 0;
    frame.style.setProperty('--vm-rx', `${nextRx.toFixed(2)}deg`);
    frame.style.setProperty('--vm-ry', `${nextRy.toFixed(2)}deg`);
    frame.style.setProperty('--vm-mx', nextMx);
    frame.style.setProperty('--vm-my', nextMy);
  };

  frame.addEventListener('pointerenter', () => {
    frame.classList.add('is-tilting');
  });

  frame.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((e.clientY - rect.top) / rect.height, 0, 1);

    nextRx = (0.5 - py) * 4.2;
    nextRy = (px - 0.5) * 5.2;
    nextMx = `${(px * 100).toFixed(1)}%`;
    nextMy = `${(py * 100).toFixed(1)}%`;

    if (!rafId) {
      rafId = requestAnimationFrame(applyTilt);
    }
  });

  frame.addEventListener('pointerleave', () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    frame.classList.remove('is-tilting');
    frame.style.setProperty('--vm-rx', '0deg');
    frame.style.setProperty('--vm-ry', '0deg');
  });
}

function setupMediaViewCursor(): void {
  if (!window.matchMedia('(any-hover: hover)').matches) return;

  const targets = document.querySelectorAll<HTMLElement>(
    '.showcase-stage, .showcase-visual, .board-card-canvas',
  );
  if (!targets.length) return;

  document.body.classList.add('has-view-cursor');

  const cursor = document.createElement('div');
  cursor.className = 'view-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML =
    '<span class="view-cursor-in"><span class="view-cursor-label">Lihat</span></span>';
  document.body.appendChild(cursor);
  const labelEl = cursor.querySelector<HTMLElement>('.view-cursor-label');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId = 0;
  let visible = false;

  const setLabel = (text: string) => {
    if (labelEl && labelEl.textContent !== text) {
      labelEl.textContent = text;
    }
  };

  const step = () => {
    const lerp = reducedMotion ? 1 : 0.2;
    currentX += (targetX - currentX) * lerp;
    currentY += (targetY - currentY) * lerp;
    cursor.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;

    if (Math.abs(targetX - currentX) < 0.2 && Math.abs(targetY - currentY) < 0.2) {
      currentX = targetX;
      currentY = targetY;
      cursor.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      rafId = 0;
      return;
    }
    rafId = requestAnimationFrame(step);
  };

  const hide = () => {
    cursor.classList.remove('is-pressed', 'is-dragging');
    if (!visible) return;
    visible = false;
    cursor.classList.remove('is-on');
  };

  const updateFromPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      hide();
      return;
    }

    if (document.querySelector('dialog[open]')) {
      hide();
      return;
    }

    const isShowcaseDragging = Boolean(document.querySelector('.showcase-stage.is-dragging'));
    const el = e.target instanceof Element ? e.target : null;
    const isActiveShowcaseVisual = Boolean(
      el?.closest('.showcase-card[data-pos="active"] .showcase-visual'),
    );
    const isBoardPhoto = Boolean(el?.closest('.board-card-canvas') && !el.closest('button'));
    const isShowcaseStageArea = Boolean(el?.closest('.showcase-stage') && !el.closest('button, a'));

    if (!isShowcaseDragging && !isActiveShowcaseVisual && !isBoardPhoto && !isShowcaseStageArea) {
      hide();
      return;
    }

    if (isShowcaseDragging) {
      setLabel('Geser');
      cursor.classList.add('is-dragging');
      cursor.classList.remove('is-pressed');
    } else if (isActiveShowcaseVisual || isBoardPhoto) {
      setLabel('Lihat');
      cursor.classList.remove('is-dragging');
    } else {
      setLabel('Geser');
      cursor.classList.remove('is-dragging');
    }

    targetX = e.clientX;
    targetY = e.clientY;

    if (!visible) {
      visible = true;
      currentX = targetX;
      currentY = targetY;
      cursor.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      cursor.classList.add('is-on');
    }

    if (!rafId) {
      rafId = requestAnimationFrame(step);
    }
  };

  document.addEventListener('pointermove', updateFromPointer);
  document.addEventListener('pointerover', updateFromPointer);
  document.addEventListener('pointerdown', (e: PointerEvent) => {
    updateFromPointer(e);
    if (visible && !document.querySelector('.showcase-stage.is-dragging')) {
      cursor.classList.add('is-pressed');
    }
  });
  document.addEventListener('pointerup', (e: PointerEvent) => {
    cursor.classList.remove('is-pressed', 'is-dragging');
    updateFromPointer(e);
  });
  document.addEventListener('pointercancel', () => {
    cursor.classList.remove('is-pressed', 'is-dragging');
  });
  document.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('scroll', hide, {passive: true});
}

let boardSummaryTeardown: (() => void) | null = null;

function setupBoardSummaryCounters(): void {
  boardSummaryTeardown?.();
  const strip = document.querySelector<HTMLElement>('.board-summary-strip');
  if (!strip) return;

  const ctrl = new AbortController();
  let observer: IntersectionObserver | null = null;
  boardSummaryTeardown = () => {
    ctrl.abort();
    observer?.disconnect();
  };

  const section = strip.closest<HTMLElement>('#kepengurusan-2027');
  const counters = Array.from(strip.querySelectorAll<HTMLElement>('.board-summary-num'));
  if (!counters.length) return;

  counters.forEach((el) => {
    delete el.dataset.countRaw;
    prepareCountTarget(el);
  });

  let inView = false;

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.2) {
            if (!inView) {
              inView = true;
              animateCountUp(counters);
            }
          } else if (!entry.isIntersecting) {
            inView = false;
          }
        }
      },
      {threshold: [0, 0.2]},
    );
    observer.observe(strip);
  } else {
    inView = true;
    animateCountUp(counters);
  }

  section?.addEventListener(
    'rw:replay-countup',
    () => {
      inView = true;
      animateCountUp(counters);
    },
    {signal: ctrl.signal},
  );
}

function syncPortalFromCms(refreshRunway = true): void {
  renderEventsFromCms();
  renderBoardFromCms();
  renderVisiMisiFromCms();
  setupKegiatanCarousel();
  setupBoardCards3D();
  setupEventShowcase();
  setupBoardSummaryCounters();

  if (refreshRunway) {
    const runway = document.querySelector<RunwaySection>('runway-section');
    runway?.refreshFromCms();
  }
}

function setupMobileHeaderControls(): void {
  const header = document.querySelector<HTMLElement>('.site-header');
  const searchBtn = header?.querySelector<HTMLButtonElement>('[data-mobile-search-toggle]');
  const menuBtn = header?.querySelector<HTMLButtonElement>('[data-mobile-menu-toggle]');
  const searchInput = document.getElementById('catalog-search') as HTMLInputElement | null;
  const resultsEl = document.getElementById('search-results');
  const navEl = header?.querySelector<HTMLElement>('[data-top-nav]');
  if (!header || !searchBtn || !menuBtn) return;

  const setSearchOpen = (open: boolean) => {
    header.classList.toggle('is-mobile-search-open', open);
    searchBtn.classList.toggle('is-active', open);
    searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    searchBtn.setAttribute('aria-label', open ? 'Tutup pencarian' : 'Buka pencarian');
    if (open) {
      setMenuOpen(false);
      requestAnimationFrame(() => searchInput?.focus());
    } else if (resultsEl) {
      resultsEl.hidden = true;
      searchInput?.setAttribute('aria-expanded', 'false');
    }
  };

  const setMenuOpen = (open: boolean) => {
    header.classList.toggle('is-mobile-menu-open', open);
    menuBtn.classList.toggle('is-active', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
    if (open) {
      header.classList.remove('is-mobile-search-open');
      searchBtn.classList.remove('is-active');
      searchBtn.setAttribute('aria-expanded', 'false');
      searchBtn.setAttribute('aria-label', 'Buka pencarian');
      if (resultsEl) resultsEl.hidden = true;
    }
  };

  const closeAll = () => {
    setSearchOpen(false);
    setMenuOpen(false);
  };

  searchBtn.addEventListener('click', () => {
    setSearchOpen(!header.classList.contains('is-mobile-search-open'));
  });

  menuBtn.addEventListener('click', () => {
    setMenuOpen(!header.classList.contains('is-mobile-menu-open'));
  });

  navEl?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement | null)?.closest('.top-nav-btn')) {
      setMenuOpen(false);
    }
  });

  resultsEl?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement | null)?.closest('.search-hit')) {
      setSearchOpen(false);
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target as Node | null;
    if (!target || header.contains(target)) return;
    if (header.classList.contains('is-mobile-search-open') || header.classList.contains('is-mobile-menu-open')) {
      closeAll();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAll();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 749) {
      closeAll();
    }
  });
}

function setupRegistration2027Dialog(): void {
  const dialog = document.getElementById('pendaftaran-dialog') as HTMLDialogElement | null;
  if (!dialog) return;

  const modeBtns = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-reg-mode]'));
  const panels = Array.from(dialog.querySelectorAll<HTMLElement>('[data-reg-panel]'));
  const form = dialog.querySelector<HTMLFormElement>('[data-reg-form]');
  const pageHeadEl = dialog.querySelector<HTMLElement>('[data-reg-page-head]');
  const stepperEl = dialog.querySelector<HTMLElement>('[data-reg-stepper]');
  const stepNodes = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-reg-step-jump]'));
  const stepLines = Array.from(dialog.querySelectorAll<HTMLElement>('[data-reg-line]'));
  const stepPanes = Array.from(dialog.querySelectorAll<HTMLElement>('[data-reg-step]'));
  const prevBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-prev]');
  const nextBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-next]');
  const submitBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-submit]');
  const stepCounterEl = dialog.querySelector<HTMLElement>('[data-reg-step-counter]');

  const receiptBox = dialog.querySelector<HTMLElement>('[data-reg-receipt]');
  const receiptGreetingEl = dialog.querySelector<HTMLElement>('[data-reg-receipt-greeting]');
  const receiptCodeEl = dialog.querySelector<HTMLElement>('[data-reg-receipt-code]');
  const receiptSummaryEl = dialog.querySelector<HTMLElement>('[data-reg-receipt-summary]');
  const copyCodeBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-copy-code]');
  const resetFormBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-reset-form]');
  const goStatusBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-go-status]');
  const errorEl = dialog.querySelector<HTMLElement>('[data-reg-error]');

  const regionSelect = dialog.querySelector<HTMLSelectElement>('#reg-region');
  const rolePills = Array.from(dialog.querySelectorAll<HTMLLabelElement>('.reg-role-pill'));
  const roleInputs = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[name="role"]'));

  const achListEl = dialog.querySelector<HTMLElement>('[data-reg-achievements-list]');
  const addAchBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-add-achievement]');
  const bioInput = dialog.querySelector<HTMLTextAreaElement>('#reg-bio');
  const bioCountEl = dialog.querySelector<HTMLElement>('[data-reg-bio-count]');

  const adatInput = dialog.querySelector<HTMLInputElement>('[data-reg-photo-adat-input]');
  const adatPreview = dialog.querySelector<HTMLImageElement>('[data-reg-photo-adat-preview]');
  const adatStage = dialog.querySelector<HTMLElement>('[data-reg-photo-adat-stage]');
  const adatNote = dialog.querySelector<HTMLElement>('[data-reg-photo-adat-note]');
  const adatBadge = dialog.querySelector<HTMLElement>('[data-reg-photo-adat-badge]');
  const adatBtnLabel = dialog.querySelector<HTMLElement>('[data-reg-photo-adat-btn-label]');
  const adatClearBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-photo-adat-clear]');

  const kebesaranInput = dialog.querySelector<HTMLInputElement>('[data-reg-photo-kebesaran-input]');
  const kebesaranPreview = dialog.querySelector<HTMLImageElement>('[data-reg-photo-kebesaran-preview]');
  const kebesaranStage = dialog.querySelector<HTMLElement>('[data-reg-photo-kebesaran-stage]');
  const kebesaranNote = dialog.querySelector<HTMLElement>('[data-reg-photo-kebesaran-note]');
  const kebesaranBadge = dialog.querySelector<HTMLElement>('[data-reg-photo-kebesaran-badge]');
  const kebesaranBtnLabel = dialog.querySelector<HTMLElement>('[data-reg-photo-kebesaran-btn-label]');
  const kebesaranClearBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-photo-kebesaran-clear]');

  const extraInput = dialog.querySelector<HTMLInputElement>('[data-reg-photo-extra-input]');
  const extraListEl = dialog.querySelector<HTMLElement>('[data-reg-photo-extra-list]');

  const docInput = dialog.querySelector<HTMLInputElement>('[data-reg-doc-input]');
  const docStage = dialog.querySelector<HTMLElement>('[data-reg-doc-stage]');
  const docNameEl = dialog.querySelector<HTMLElement>('[data-reg-doc-name]');
  const docInfoEl = dialog.querySelector<HTMLElement>('[data-reg-doc-info]');
  const docBadge = dialog.querySelector<HTMLElement>('[data-reg-doc-badge]');
  const docBtnLabel = dialog.querySelector<HTMLElement>('[data-reg-doc-btn-label]');
  const docClearBtn = dialog.querySelector<HTMLButtonElement>('[data-reg-doc-clear]');

  const precheckSummaryEl = dialog.querySelector<HTMLElement>('[data-reg-precheck-summary]');

  const lookupForm = dialog.querySelector<HTMLFormElement>('[data-reg-lookup-form]');
  const lookupInput = dialog.querySelector<HTMLInputElement>('#reg-lookup-input');
  const lookupResults = dialog.querySelector<HTMLElement>('[data-reg-lookup-results]');

  if (regionSelect && regionSelect.options.length <= 1) {
    SUMBAR_REGIONS.forEach((region) => {
      const opt = document.createElement('option');
      opt.value = region;
      opt.textContent = region;
      regionSelect.appendChild(opt);
    });
  }

  let currentStep = 1;
  const TOTAL_STEPS = 4;
  const MAX_ACHIEVEMENTS = 12;
  let achievementItems: string[] = [''];
  let uploadedAdatRef = '';
  let uploadedKebesaranRef = '';
  let uploadedExtras: {label: string; ref: string; previewUrl: string}[] = [];
  let uploadedDoc: {refUrl: string; fileName: string; mimeType: string; size: number} | null = null;
  let lastCreatedCode = '';

  const showError = (msg: string) => {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
    if (msg) {
      errorEl.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }
  };

  const bindAutoLowercase = (el: HTMLInputElement | HTMLTextAreaElement) => {
    el.addEventListener('input', (e) => {
      if ((e as InputEvent).isComposing) return;
      const lower = el.value.toLowerCase();
      if (el.value !== lower) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        el.value = lower;
        if (start !== null && end !== null) {
          try {
            el.setSelectionRange(start, end);
          } catch {
            // Some input types (e.g. email) do not expose selectionRange
          }
        }
      }
    });
  };

  const bindAutoTitleCase = (el: HTMLInputElement | HTMLTextAreaElement) => {
    const apply = (val: string, preserveCaret: boolean) => {
      if (el.value !== val) {
        const start = preserveCaret ? el.selectionStart : null;
        const end = preserveCaret ? el.selectionEnd : null;
        el.value = val;
        if (start !== null && end !== null) {
          try {
            el.setSelectionRange(start, end);
          } catch {
            // ignore
          }
        }
      }
    };
    el.addEventListener('input', (e) => {
      if ((e as InputEvent).isComposing) return;
      apply(toTitleCaseLive(el.value), true);
    });
    el.addEventListener('blur', () => {
      if (!el.value.trim()) return;
      apply(toTitleCaseWords(el.value), false);
    });
  };

  if (form) {
    form
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea')
      .forEach((fieldEl) => bindAutoTitleCase(fieldEl));
    form
      .querySelectorAll<HTMLInputElement>('input[type="email"]')
      .forEach((emailEl) => bindAutoLowercase(emailEl));
  }

  const renderAchievementRows = (focusIndex?: number) => {
    if (!achListEl) return;
    if (achievementItems.length === 0) achievementItems = [''];
    achListEl.replaceChildren();

    achievementItems.forEach((val, idx) => {
      const row = document.createElement('div');
      row.className = 'reg-ach-row';

      const num = document.createElement('span');
      num.className = 'reg-ach-num is-tabular';
      num.textContent = `${idx + 1}.`;

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'reg-ach-input';
      inp.value = val ? toTitleCaseLive(val) : '';
      inp.placeholder =
        idx === 0
          ? 'Contoh: Juara 1 Uda Duta Wisata Kab. Agam 2026'
          : `Poin prestasi ke-${idx + 1}...`;
      inp.setAttribute('aria-label', `Prestasi ke-${idx + 1}`);
      bindAutoTitleCase(inp);
      inp.addEventListener('input', () => {
        achievementItems[idx] = toTitleCaseLive(inp.value);
      });
      inp.addEventListener('blur', () => {
        achievementItems[idx] = toTitleCaseWords(inp.value);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (achievementItems.length < MAX_ACHIEVEMENTS) {
            achievementItems.push('');
            renderAchievementRows(achievementItems.length - 1);
          }
        }
      });

      row.append(num, inp);

      if (achievementItems.length > 1 || val.trim().length > 0) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'reg-ach-remove';
        removeBtn.setAttribute(
          'aria-label',
          achievementItems.length > 1 ? `Hapus prestasi ke-${idx + 1}` : 'Kosongkan baris prestasi',
        );
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
          if (achievementItems.length > 1) {
            achievementItems.splice(idx, 1);
          } else {
            achievementItems[0] = '';
          }
          renderAchievementRows(Math.min(idx, achievementItems.length - 1));
        });
        row.appendChild(removeBtn);
      }

      achListEl.appendChild(row);
      if (focusIndex === idx) {
        window.requestAnimationFrame(() => inp.focus());
      }
    });

    if (addAchBtn) {
      addAchBtn.disabled = achievementItems.length >= MAX_ACHIEVEMENTS;
    }
  };

  addAchBtn?.addEventListener('click', () => {
    if (achievementItems.length >= MAX_ACHIEVEMENTS) return;
    achievementItems.push('');
    renderAchievementRows(achievementItems.length - 1);
  });

  const updateBioCounter = () => {
    if (!bioInput || !bioCountEl) return;
    const len = bioInput.value.trim().length;
    bioCountEl.textContent = `${len} / min. 20 karakter`;
    bioCountEl.classList.toggle('is-ready', len >= 20);
  };

  bioInput?.addEventListener('input', updateBioCounter);

  const renderPrecheckSummary = () => {
    if (!precheckSummaryEl || !form) return;
    const fd = new FormData(form);
    const roleLabel = fd.get('role') === 'uni' ? 'Uni (Putri)' : 'Uda (Putra)';
    const region = String(fd.get('region') || '').trim() || 'Belum dipilih';
    const fullName = String(fd.get('fullName') || '').trim() || 'Belum diisi';
    const achCount = achievementItems.map((s) => s.trim()).filter(Boolean).length;
    const photoCount =
      (uploadedAdatRef ? 1 : 0) + (uploadedKebesaranRef ? 1 : 0) + uploadedExtras.length;
    const docLabel = uploadedDoc ? uploadedDoc.fileName : 'Belum diunggah';

    precheckSummaryEl.replaceChildren();
    const items: [string, string][] = [
      ['Nama & Utusan', `${fullName} · ${roleLabel} · ${region}`],
      ['Poin Prestasi', achCount > 0 ? `${achCount} poin tercantum` : 'Tidak ada tambahan poin'],
      [
        'Foto Resmi',
        `${photoCount} foto (${uploadedAdatRef ? 'Adat ✓' : 'Adat ✗'}, ${uploadedKebesaranRef ? 'Kebesaran ✓' : 'Kebesaran ✗'}${uploadedExtras.length ? `, +${uploadedExtras.length}` : ''})`,
      ],
      ['Surat Rekomendasi', docLabel],
    ];

    items.forEach(([labelText, valueText]) => {
      const box = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = labelText;
      const dd = document.createElement('dd');
      dd.textContent = valueText;
      box.append(dt, dd);
      precheckSummaryEl.appendChild(box);
    });
  };

  const renderStepUi = () => {
    stepPanes.forEach((pane) => {
      const stepNum = Number(pane.dataset.regStep || 1);
      pane.hidden = stepNum !== currentStep;
    });

    stepNodes.forEach((node) => {
      const stepNum = Number(node.dataset.regStepJump || 1);
      const isDone = stepNum < currentStep;
      const isActive = stepNum === currentStep;
      node.classList.toggle('is-active', isActive);
      node.classList.toggle('is-done', isDone);
      if (isActive) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
      const circle = node.querySelector<HTMLElement>('.reg-step-circle');
      if (circle) {
        circle.textContent = isDone ? '✓' : String(stepNum);
      }
    });

    stepLines.forEach((line) => {
      const lineIdx = Number(line.dataset.regLine || 1);
      line.classList.toggle('is-done', lineIdx < currentStep);
    });

    if (prevBtn) prevBtn.disabled = currentStep <= 1;
    if (nextBtn) nextBtn.hidden = currentStep >= TOTAL_STEPS;
    if (submitBtn) submitBtn.hidden = currentStep < TOTAL_STEPS;
    if (stepCounterEl) stepCounterEl.textContent = `Langkah ${currentStep} dari ${TOTAL_STEPS}`;

    if (currentStep === TOTAL_STEPS) {
      renderPrecheckSummary();
    }
  };

  const validateStep = (step: number): string | null => {
    if (!form) return null;
    const fd = new FormData(form);
    if (step === 1) {
      const region = String(fd.get('region') || '').trim();
      const fullName = String(fd.get('fullName') || '').trim();
      const age = String(fd.get('age') || '').trim();
      const phone = String(fd.get('phone') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const education = String(fd.get('education') || '').trim();
      if (!region) return 'Pilih Kabupaten / Kota utusan daerah Anda.';
      if (fullName.length < 3) return 'Lengkapi nama lengkap peserta terlebih dahulu.';
      if (!age || Number(age) < 17 || Number(age) > 27) {
        return 'Masukkan usia yang valid (17–27 tahun).';
      }
      if (phone.length < 9) return 'Masukkan nomor WhatsApp aktif yang dapat dihubungi panitia.';
      if (!email || !email.includes('@')) return 'Masukkan alamat email aktif yang valid.';
      if (!education) return 'Isi pendidikan terakhir atau perguruan tinggi.';
    } else if (step === 2) {
      const advocacy = String(fd.get('advocacy') || '').trim();
      const bio = String(fd.get('bio') || '').trim();
      if (!advocacy) return 'Isi fokus advokasi pariwisata atau budaya Anda.';
      if (bio.length < 20) return 'Lengkapi biografi singkat minimal 20 karakter.';
    } else if (step === 3) {
      if (!uploadedAdatRef) {
        return 'Unggah Foto 1 menggunakan Baju Adat Daerah terlebih dahulu.';
      }
      if (!uploadedKebesaranRef) {
        return 'Unggah Foto 2 menggunakan Baju Kebesaran Duta Wisata terlebih dahulu.';
      }
    } else if (step === 4) {
      const recNumber = String(fd.get('recNumber') || '').trim();
      const recIssuer = String(fd.get('recIssuer') || '').trim();
      const recDate = String(fd.get('recDate') || '').trim();
      if (!recNumber || !recIssuer || !recDate) {
        return 'Lengkapi nomor, tanggal, dan instansi penerbit Surat Rekomendasi Kab/Kota.';
      }
      if (!uploadedDoc) {
        return 'Unggah file Surat Rekomendasi resmi dari Kabupaten/Kota (PDF/JPG/PNG).';
      }
    }
    return null;
  };

  const goToStep = (targetStep: number) => {
    const nextStep = clamp(targetStep, 1, TOTAL_STEPS);
    if (nextStep > currentStep) {
      for (let s = currentStep; s < nextStep; s += 1) {
        const err = validateStep(s);
        if (err) {
          currentStep = s;
          renderStepUi();
          showError(err);
          return;
        }
      }
    }
    showError('');
    currentStep = nextStep;
    renderStepUi();
  };

  nextBtn?.addEventListener('click', () => goToStep(currentStep + 1));
  prevBtn?.addEventListener('click', () => goToStep(currentStep - 1));
  stepNodes.forEach((node) => {
    node.addEventListener('click', () => {
      const targetStep = Number(node.dataset.regStepJump || 1);
      goToStep(targetStep);
    });
  });

  const switchMode = (mode: 'form' | 'status') => {
    modeBtns.forEach((btn) => {
      const active = btn.dataset.regMode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const match = panel.dataset.regPanel === mode;
      panel.hidden = !match;
    });
  };

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.regMode === 'status' ? 'status' : 'form';
      switchMode(mode);
    });
  });

  const getRoleFallbackSvg = () => {
    const checkedRole = roleInputs.find((inp) => inp.checked)?.value === 'uni' ? 'uni' : 'uda';
    return checkedRole === 'uni'
      ? '/assets/placeholders/silhouette-uni.svg'
      : '/assets/placeholders/silhouette-uda.svg';
  };

  const syncRoleVisual = () => {
    const fallbackSrc = getRoleFallbackSvg();
    rolePills.forEach((pill) => {
      const inp = pill.querySelector<HTMLInputElement>('input[name="role"]');
      pill.classList.toggle('is-selected', Boolean(inp?.checked));
    });
    if (!uploadedAdatRef && adatPreview) adatPreview.src = fallbackSrc;
    if (!uploadedKebesaranRef && kebesaranPreview) kebesaranPreview.src = fallbackSrc;
  };

  roleInputs.forEach((inp) => {
    inp.addEventListener('change', syncRoleVisual);
  });

  const bindStageTrigger = (stage: HTMLElement | null, input: HTMLInputElement | null) => {
    if (!stage || !input) return;
    stage.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, label')) return;
      input.click();
    });
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
  };

  bindStageTrigger(adatStage, adatInput);
  bindStageTrigger(kebesaranStage, kebesaranInput);
  bindStageTrigger(docStage, docInput);

  const clearAdatPhoto = () => {
    uploadedAdatRef = '';
    if (adatInput) adatInput.value = '';
    if (adatPreview) adatPreview.src = getRoleFallbackSvg();
    adatStage?.classList.remove('has-file');
    if (adatNote) adatNote.textContent = 'Klik area ini untuk memilih foto';
    if (adatBadge) {
      adatBadge.textContent = 'Wajib';
      adatBadge.classList.remove('is-done');
    }
    if (adatBtnLabel) adatBtnLabel.textContent = 'Pilih Foto Baju Adat';
    if (adatClearBtn) adatClearBtn.hidden = true;
  };

  const clearKebesaranPhoto = () => {
    uploadedKebesaranRef = '';
    if (kebesaranInput) kebesaranInput.value = '';
    if (kebesaranPreview) kebesaranPreview.src = getRoleFallbackSvg();
    kebesaranStage?.classList.remove('has-file');
    if (kebesaranNote) kebesaranNote.textContent = 'Klik area ini untuk memilih foto';
    if (kebesaranBadge) {
      kebesaranBadge.textContent = 'Wajib';
      kebesaranBadge.classList.remove('is-done');
    }
    if (kebesaranBtnLabel) kebesaranBtnLabel.textContent = 'Pilih Foto Baju Kebesaran';
    if (kebesaranClearBtn) kebesaranClearBtn.hidden = true;
  };

  const clearDocFile = () => {
    uploadedDoc = null;
    if (docInput) docInput.value = '';
    docStage?.classList.remove('has-file');
    if (docNameEl) docNameEl.textContent = 'Klik area ini untuk memilih file surat rekomendasi';
    if (docInfoEl) docInfoEl.textContent = 'Format PDF, JPG, atau PNG · Maksimal 5 MB';
    if (docBadge) {
      docBadge.textContent = 'Wajib · PDF/JPG/PNG';
      docBadge.classList.remove('is-done');
    }
    if (docBtnLabel) docBtnLabel.textContent = 'Pilih File Surat';
    if (docClearBtn) docClearBtn.hidden = true;
    renderPrecheckSummary();
  };

  adatClearBtn?.addEventListener('click', clearAdatPhoto);
  kebesaranClearBtn?.addEventListener('click', clearKebesaranPhoto);
  docClearBtn?.addEventListener('click', clearDocFile);

  adatInput?.addEventListener('change', async () => {
    const file = adatInput.files?.[0];
    if (!file) return;
    showError('');
    try {
      const res = await saveCompressedAdminImage(file, 'portrait');
      uploadedAdatRef = res.refUrl;
      if (adatPreview) adatPreview.src = res.objectUrl;
      adatStage?.classList.add('has-file');
      if (adatNote) {
        adatNote.textContent = `${res.width}×${res.height}px · ${formatBytesCompact(res.compressedBytes)}`;
      }
      if (adatBadge) {
        adatBadge.textContent = 'Terunggah';
        adatBadge.classList.add('is-done');
      }
      if (adatBtnLabel) adatBtnLabel.textContent = 'Ganti Foto';
      if (adatClearBtn) adatClearBtn.hidden = false;
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal memproses foto baju adat.');
    }
  });

  kebesaranInput?.addEventListener('change', async () => {
    const file = kebesaranInput.files?.[0];
    if (!file) return;
    showError('');
    try {
      const res = await saveCompressedAdminImage(file, 'portrait');
      uploadedKebesaranRef = res.refUrl;
      if (kebesaranPreview) kebesaranPreview.src = res.objectUrl;
      kebesaranStage?.classList.add('has-file');
      if (kebesaranNote) {
        kebesaranNote.textContent = `${res.width}×${res.height}px · ${formatBytesCompact(res.compressedBytes)}`;
      }
      if (kebesaranBadge) {
        kebesaranBadge.textContent = 'Terunggah';
        kebesaranBadge.classList.add('is-done');
      }
      if (kebesaranBtnLabel) kebesaranBtnLabel.textContent = 'Ganti Foto';
      if (kebesaranClearBtn) kebesaranClearBtn.hidden = false;
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal memproses foto baju kebesaran.');
    }
  });

  const renderExtraPhotoThumbs = () => {
    if (!extraListEl) return;
    extraListEl.replaceChildren();
    extraListEl.hidden = uploadedExtras.length === 0;
    uploadedExtras.forEach((item, idx) => {
      const chip = document.createElement('div');
      chip.className = 'reg-extra-chip';
      const img = document.createElement('img');
      img.src = item.previewUrl;
      img.alt = item.label;
      const meta = document.createElement('span');
      meta.textContent = item.label;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'reg-extra-remove';
      del.setAttribute('aria-label', `Hapus ${item.label}`);
      del.textContent = '×';
      del.addEventListener('click', () => {
        uploadedExtras = uploadedExtras.filter((_, i) => i !== idx);
        renderExtraPhotoThumbs();
      });
      chip.append(img, meta, del);
      extraListEl.appendChild(chip);
    });
  };

  extraInput?.addEventListener('change', async () => {
    const files = Array.from(extraInput.files ?? []);
    if (!files.length) return;
    showError('');
    for (const file of files) {
      try {
        const res = await saveCompressedAdminImage(file, 'portrait');
        const label = file.name.replace(/\.[^.]+$/, '').slice(0, 26) || `Foto Tambahan ${uploadedExtras.length + 1}`;
        uploadedExtras.push({label, ref: res.refUrl, previewUrl: res.objectUrl});
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Sebagian foto tambahan gagal diproses.');
      }
    }
    extraInput.value = '';
    renderExtraPhotoThumbs();
  });

  docInput?.addEventListener('change', async () => {
    const file = docInput.files?.[0];
    if (!file) return;
    showError('');
    try {
      const res = await saveRegistrationDocument(file);
      uploadedDoc = res;
      docStage?.classList.add('has-file');
      if (docNameEl) docNameEl.textContent = res.fileName;
      if (docInfoEl) {
        const typeLabel = res.mimeType.includes('pdf') ? 'PDF Resmi' : 'Scan Gambar';
        docInfoEl.textContent = `${typeLabel} · ${formatBytesCompact(res.size)} · Tersimpan aman`;
      }
      if (docBadge) {
        docBadge.textContent = 'Terunggah';
        docBadge.classList.add('is-done');
      }
      if (docBtnLabel) docBtnLabel.textContent = 'Ganti File';
      if (docClearBtn) docClearBtn.hidden = false;
      renderPrecheckSummary();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal mengunggah surat rekomendasi.');
    }
  });

  const resetRegistrationState = () => {
    form?.reset();
    currentStep = 1;
    achievementItems = [''];
    renderAchievementRows();
    updateBioCounter();
    uploadedExtras = [];
    renderExtraPhotoThumbs();
    clearAdatPhoto();
    clearKebesaranPhoto();
    clearDocFile();
    showError('');

    syncRoleVisual();
    renderStepUi();
    if (pageHeadEl) pageHeadEl.hidden = false;
    if (stepperEl) stepperEl.hidden = false;
    if (form) form.hidden = false;
    if (receiptBox) receiptBox.hidden = true;
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    for (let s = 1; s <= TOTAL_STEPS; s += 1) {
      const err = validateStep(s);
      if (err) {
        currentStep = s;
        renderStepUi();
        showError(err);
        return;
      }
    }

    if (!uploadedDoc) return;
    const fd = new FormData(form);
    const role: RoleFilter = fd.get('role') === 'uni' ? 'uni' : 'uda';
    const region = String(fd.get('region') || '').trim();
    const fullName = toTitleCaseWords(String(fd.get('fullName') || ''));
    const shortName = toTitleCaseWords(String(fd.get('shortName') || ''));
    const age = String(fd.get('age') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const education = toTitleCaseWords(String(fd.get('education') || ''));
    const profession = toTitleCaseWords(String(fd.get('profession') || ''));
    const advocacy = toTitleCaseWords(String(fd.get('advocacy') || ''));
    const achievementsText = achievementItems
      .map((item) => toTitleCaseWords(item))
      .filter(Boolean)
      .join('\n');
    const bio = toTitleCaseWords(String(fd.get('bio') || ''));
    const recNumber = toTitleCaseWords(String(fd.get('recNumber') || ''));
    const recIssuer = toTitleCaseWords(String(fd.get('recIssuer') || ''));
    const recDate = String(fd.get('recDate') || '').trim();

    showError('');
    const created = submitRegistration2027({
      role,
      region,
      fullName,
      shortName: shortName || fullName,
      age,
      phone,
      email,
      education,
      profession,
      advocacy,
      achievementsText,
      bio,
      photoAdatRef: uploadedAdatRef,
      photoKebesaranRef: uploadedKebesaranRef,
      extraPhotos: uploadedExtras.map(({label, ref}) => ({label, ref})),
      recLetterRef: uploadedDoc.refUrl,
      recLetterName: uploadedDoc.fileName,
      recLetterMime: uploadedDoc.mimeType,
      recLetterSize: uploadedDoc.size,
      recNumber,
      recIssuer,
      recDate,
    });

    lastCreatedCode = created.regCode;
    if (receiptCodeEl) receiptCodeEl.textContent = created.regCode;
    if (receiptGreetingEl) {
      receiptGreetingEl.textContent = `Selamat, ${created.fullName}! Berkas pendaftaran Anda sebagai utusan ${created.region} telah berhasil dikirim dan tercatat di sistem Panitia Pemilihan Uda & Uni Duta Wisata Sumatera Barat 2027.`;
    }
    if (receiptSummaryEl) {
      receiptSummaryEl.replaceChildren();
      const totalPhotos = 2 + (created.extraPhotos?.length ?? 0);
      const totalAch = created.achievementsText
        ? created.achievementsText.split(/\r?\n/).filter((l) => l.trim()).length
        : 0;
      const rows: [string, string][] = [
        ['Nama Peserta', created.fullName],
        ['Utusan Daerah', `${created.role === 'uda' ? 'Uda' : 'Uni'} · ${created.region}`],
        ['Foto Resmi', `${totalPhotos} Foto (Baju Adat Daerah, Baju Kebesaran${totalPhotos > 2 ? ' + Tambahan' : ''})`],
        ['Prestasi & Surat', `${totalAch} Poin Prestasi · Surat ${created.recNumber}`],
      ];
      rows.forEach(([dtText, ddText]) => {
        const wrap = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = dtText;
        const dd = document.createElement('dd');
        dd.textContent = ddText;
        wrap.append(dt, dd);
        receiptSummaryEl.appendChild(wrap);
      });
    }

    if (pageHeadEl) pageHeadEl.hidden = true;
    if (stepperEl) stepperEl.hidden = true;
    form.hidden = true;
    if (receiptBox) receiptBox.hidden = false;
    dialog.scrollTo({top: 0, behavior: 'smooth'});
  });

  copyCodeBtn?.addEventListener('click', async () => {
    const code = receiptCodeEl?.textContent?.trim() || lastCreatedCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      copyCodeBtn.textContent = 'Tersalin!';
      window.setTimeout(() => {
        copyCodeBtn.textContent = 'Salin Kode';
      }, 2200);
    } catch {
      copyCodeBtn.textContent = code;
    }
  });

  resetFormBtn?.addEventListener('click', resetRegistrationState);

  const renderLookupResults = (query: string) => {
    if (!lookupResults) return;
    lookupResults.replaceChildren();
    const matches: PublicRegistrationStatusView[] = lookupRegistrationStatus(query);
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'reg-lookup-empty-light';
      empty.textContent = query.trim()
        ? `Tidak ditemukan berkas dengan kata kunci "${query.trim()}". Pastikan nomor urut, kode pendaftaran, atau nama sesuai.`
        : 'Masukkan nomor pendaftaran (misal 01 atau 01-KSL-UDA-2027) untuk memantau hasil verifikasi panitia.';
      lookupResults.appendChild(empty);
      return;
    }

    const statusMeta: Record<RegistrationStatus, {label: string; cls: string}> = {
      pending: {label: 'Menunggu Verifikasi Panitia', cls: 'is-pending'},
      revision: {label: 'Perlu Perbaikan Berkas', cls: 'is-revision'},
      approved: {label: 'Disahkan sebagai Finalis 2027', cls: 'is-approved'},
      rejected: {label: 'Belum Memenuhi Syarat', cls: 'is-rejected'},
    };

    matches.forEach((item) => {
      const meta = statusMeta[item.status];
      const card = document.createElement('div');
      card.className = 'reg-status-card-light';

      const head = document.createElement('div');
      head.className = 'reg-status-head';

      const idWrap = document.createElement('div');
      const codeBadge = document.createElement('span');
      codeBadge.className = 'reg-status-code-light is-tabular';
      codeBadge.textContent = item.regCode;
      const nameEl = document.createElement('h4');
      nameEl.textContent = item.fullName;
      const subEl = document.createElement('p');
      subEl.textContent = `${item.role === 'uda' ? 'Uda' : 'Uni'} · ${item.region}${
        item.finalistNumber ? ` · No. Finalis #${item.finalistNumber}` : ''
      }`;
      idWrap.append(codeBadge, nameEl, subEl);

      const pill = document.createElement('span');
      pill.className = `reg-status-pill-light ${meta.cls}`;
      pill.textContent = meta.label;

      head.append(idWrap, pill);

      const metaRow = document.createElement('div');
      metaRow.className = 'reg-status-chips-light';
      const recChip = document.createElement('span');
      recChip.className = 'reg-mini-chip';
      recChip.textContent = `Surat Rekomendasi: ${item.recNumber}`;
      const photoChip = document.createElement('span');
      photoChip.className = 'reg-mini-chip';
      photoChip.textContent = `${item.photoCount} Foto Terlampir`;
      const docChip = document.createElement('span');
      docChip.className = 'reg-mini-chip';
      docChip.textContent = item.hasRecLetter ? 'Surat Daerah Lengkap' : 'Surat Belum Lengkap';
      metaRow.append(recChip, photoChip, docChip);

      const noteBox = document.createElement('div');
      noteBox.className = 'reg-status-note-light';
      const noteLabel = document.createElement('strong');
      noteLabel.textContent = 'Catatan Panitia Verifikasi';
      const noteText = document.createElement('p');
      noteText.textContent = item.reviewerNote || 'Berkas sedang dalam peninjauan tim verifikasi.';
      noteBox.append(noteLabel, noteText);

      card.append(head, metaRow, noteBox);
      lookupResults.appendChild(card);
    });
  };

  goStatusBtn?.addEventListener('click', () => {
    switchMode('status');
    if (lookupInput && lastCreatedCode) {
      lookupInput.value = lastCreatedCode;
      renderLookupResults(lastCreatedCode);
    }
  });

  lookupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    renderLookupResults(lookupInput?.value || '');
  });

  dialog.addEventListener('cs:reset-open', () => {
    switchMode('form');
    if (form && receiptBox && !receiptBox.hidden) {
      resetRegistrationState();
    } else {
      renderStepUi();
    }
  });

  subscribeCmsChange(() => {
    if (dialog.open && lookupInput?.value.trim()) {
      renderLookupResults(lookupInput.value);
    }
  });

  renderAchievementRows();
  updateBioCounter();
  renderStepUi();
}

async function bootstrapPortal(): Promise<void> {
  registerMediaCacheWorker();
  setupSearch();
  setupInfoDialogs();
  setupAnchorLinks();
  setupVisiMisi3D();
  setupRegistration2027Dialog();
  setupMediaViewCursor();
  setupTopNavAndPills();
  setupMobileHeaderControls();

  await hydrateCmsMediaUrls();
  syncPortalFromCms(true);
  setupAdminPanel();

  subscribeCmsChange(() => {
    syncPortalFromCms(true);
  });
}

void bootstrapPortal();
