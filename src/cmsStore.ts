export type RoleFilter = 'uda' | 'uni';
export type PublishStatus = 'published' | 'draft';

export interface CohortPhoto {
  thumb: string;
  full: string;
}

export interface AmbassadorBio {
  role: RoleFilter;
  slotIndex: number;
  rankLabel: string;
  fullName: string;
  shortName: string;
  titleBadge: string;
  region: string;
  age?: string;
  finalistNumber?: string;
  education: string;
  profession: string;
  bio: string;
  advocacy: string;
  achievement: string;
  achievements?: string[];
  photo?: CohortPhoto;
}

export interface YearLineup {
  year: string;
  status: PublishStatus;
  uda: AmbassadorBio[];
  uni: AmbassadorBio[];
}

export interface CmsEventMetric {
  value: string;
  label: string;
}

export interface CmsEventDetail {
  label: string;
  text: string;
}

export interface CmsEventItem {
  id: string;
  status: PublishStatus;
  category: string;
  modalKicker: string;
  title: string;
  focusLine: string;
  cardSummary: string;
  detailSummary: string;
  photo: string;
  photoAlt: string;
  metrics: CmsEventMetric[];
  details: CmsEventDetail[];
}

export interface CmsBoardSummaryItem {
  id: string;
  label: string;
  value: string;
  unit: string;
}

export interface CmsBoardMember {
  id: string;
  status: PublishStatus;
  isCore: boolean;
  divisionKey: 'inti' | 'budaya' | 'promosi' | 'kemitraan';
  name: string;
  cardName: string;
  cardRolePrefix: string;
  cardRoleCopy: string;
  role: string;
  division: string;
  badge: string;
  cohortYear: string;
  origin: string;
  photo: string;
  photoAlt: string;
  summary: string;
  tasks: string[];
}

export interface CmsMisiEntry {
  indexLabel: string;
  title: string;
  description: string;
}

export interface CmsVisiMisiData {
  eyebrow: string;
  visiMutedTitle: string;
  chips: string[];
  visiQuoteLead: string;
  visiQuoteMuted: string;
  visiDesc: string;
  misiMutedTitle: string;
  misiItems: CmsMisiEntry[];
  sebaranItems: CmsMisiEntry[];
  komitmenItems: CmsMisiEntry[];
  sealLabel: string;
}

export interface CmsActivityEntry {
  id: string;
  timestamp: string;
  operator: string;
  module: 'Katalog' | 'Event' | 'Pengurus' | 'Visi & Misi' | 'Sistem';
  action: string;
  summary: string;
}

export interface CmsState {
  version: number;
  updatedAt: string;
  catalogYears: YearLineup[];
  events: CmsEventItem[];
  boardSummary: CmsBoardSummaryItem[];
  boardMembers: CmsBoardMember[];
  visimisi: CmsVisiMisiData;
  activityLog: CmsActivityEntry[];
}

export interface AdminSession {
  operatorName: string;
  roleLabel: string;
  loggedInAt: string;
}

export interface CompressedUploadResult {
  refUrl: string;
  objectUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  mimeType: string;
}

export const SUMBAR_REGIONS = [
  'Kota Padang',
  'Kota Bukittinggi',
  'Kota Payakumbuh',
  'Kota Padang Panjang',
  'Kota Pariaman',
  'Kota Sawahlunto',
  'Kota Solok',
  'Kab. Agam',
  'Kab. Tanah Datar',
  'Kab. Lima Puluh Kota',
  'Kab. Padang Pariaman',
  'Kab. Pesisir Selatan',
  'Kab. Solok',
  'Kab. Solok Selatan',
  'Kab. Sijunjung',
  'Kab. Dharmasraya',
  'Kab. Pasaman',
  'Kab. Pasaman Barat',
  'Kab. Kep. Mentawai',
] as const;

export const RANK_LABELS = ['Utama', 'Wakil I', 'Wakil II', 'Intelegensia', 'Berbakat', 'Favorit'] as const;

export const UDA_PHOTOS: CohortPhoto[] = [
  {
    thumb: '/assets/placeholders/silhouette-uda.svg',
    full: '/assets/placeholders/silhouette-uda.svg',
  },
];

export const UNI_PHOTOS: CohortPhoto[] = [
  {
    thumb: '/assets/placeholders/silhouette-uni.svg',
    full: '/assets/placeholders/silhouette-uni.svg',
  },
];

const PHOTO_2024_VER = '?v=2024-r2';

const PHOTOS_2024_BY_ROLE: Record<RoleFilter, Record<string, CohortPhoto>> = {
  uda: {
    'Kab. Agam': {
      thumb: `/assets/uda-uni-2024/uda-agam-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-agam-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Dharmasraya': {
      thumb: `/assets/uda-uni-2024/uda-dharmasraya-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-dharmasraya-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Lima Puluh Kota': {
      thumb: `/assets/uda-uni-2024/uda-lima-puluh-kota-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-lima-puluh-kota-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Padang Pariaman': {
      thumb: `/assets/uda-uni-2024/uda-padang-pariaman-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-padang-pariaman-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Pasaman': {
      thumb: `/assets/uda-uni-2024/uda-pasaman-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-pasaman-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Pesisir Selatan': {
      thumb: `/assets/uda-uni-2024/uda-pesisir-selatan-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-pesisir-selatan-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Sijunjung': {
      thumb: `/assets/uda-uni-2024/uda-sijunjung-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-sijunjung-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Solok': {
      thumb: `/assets/uda-uni-2024/uda-kabupaten-solok-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-kabupaten-solok-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Solok Selatan': {
      thumb: `/assets/uda-uni-2024/uda-solok-selatan-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-solok-selatan-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Tanah Datar': {
      thumb: `/assets/uda-uni-2024/uda-tanah-datar-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-tanah-datar-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Bukittinggi': {
      thumb: `/assets/uda-uni-2024/uda-bukittinggi-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-bukittinggi-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Padang': {
      thumb: `/assets/uda-uni-2024/uda-padang-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-padang-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Padang Panjang': {
      thumb: `/assets/uda-uni-2024/uda-padang-panjang-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-padang-panjang-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Pariaman': {
      thumb: `/assets/uda-uni-2024/uda-pariaman-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-pariaman-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Payakumbuh': {
      thumb: `/assets/uda-uni-2024/uda-payakumbuh-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-payakumbuh-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Solok': {
      thumb: `/assets/uda-uni-2024/uda-solok-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uda-solok-1080.webp${PHOTO_2024_VER}`,
    },
  },
  uni: {
    'Kab. Agam': {
      thumb: `/assets/uda-uni-2024/uni-agam-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-agam-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Dharmasraya': {
      thumb: `/assets/uda-uni-2024/uni-dharmasraya-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-dharmasraya-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Lima Puluh Kota': {
      thumb: `/assets/uda-uni-2024/uni-lima-puluh-kota-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-lima-puluh-kota-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Padang Pariaman': {
      thumb: `/assets/uda-uni-2024/uni-padang-pariaman-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-padang-pariaman-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Pasaman': {
      thumb: `/assets/uda-uni-2024/uni-pasaman-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-pasaman-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Pesisir Selatan': {
      thumb: `/assets/uda-uni-2024/uni-pesisir-selatan-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-pesisir-selatan-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Sijunjung': {
      thumb: `/assets/uda-uni-2024/uni-sijunjung-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-sijunjung-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Solok': {
      thumb: `/assets/uda-uni-2024/uni-kabupaten-solok-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-kabupaten-solok-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Solok Selatan': {
      thumb: `/assets/uda-uni-2024/uni-solok-selatan-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-solok-selatan-1080.webp${PHOTO_2024_VER}`,
    },
    'Kab. Tanah Datar': {
      thumb: `/assets/uda-uni-2024/uni-tanah-datar-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-tanah-datar-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Bukittinggi': {
      thumb: `/assets/uda-uni-2024/uni-bukittinggi-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-bukittinggi-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Padang': {
      thumb: `/assets/uda-uni-2024/uni-padang-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-padang-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Padang Panjang': {
      thumb: `/assets/uda-uni-2024/uni-padang-panjang-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-padang-panjang-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Pariaman': {
      thumb: `/assets/uda-uni-2024/uni-pariaman-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-pariaman-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Payakumbuh': {
      thumb: `/assets/uda-uni-2024/uni-payakumbuh-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-payakumbuh-1080.webp${PHOTO_2024_VER}`,
    },
    'Kota Solok': {
      thumb: `/assets/uda-uni-2024/uni-solok-640.webp${PHOTO_2024_VER}`,
      full: `/assets/uda-uni-2024/uni-solok-1080.webp${PHOTO_2024_VER}`,
    },
  },
};

const PHOTOS_2022_BY_ROLE: Record<RoleFilter, Record<string, CohortPhoto>> = {
  uda: {
    'Kab. Dharmasraya': {
      thumb: '/assets/uda-uni-2022/uda-dharmasraya-640.webp',
      full: '/assets/uda-uni-2022/uda-dharmasraya-1080.webp',
    },
    'Kota Solok': {
      thumb: '/assets/uda-uni-2022/uda-solok-640.webp',
      full: '/assets/uda-uni-2022/uda-solok-1080.webp',
    },
    'Kab. Lima Puluh Kota': {
      thumb: '/assets/uda-uni-2022/uda-lima-puluh-kota-640.webp',
      full: '/assets/uda-uni-2022/uda-lima-puluh-kota-1080.webp',
    },
    'Kab. Pasaman': {
      thumb: '/assets/uda-uni-2022/uda-pasaman-640.webp',
      full: '/assets/uda-uni-2022/uda-pasaman-1080.webp',
    },
    'Kab. Solok': {
      thumb: '/assets/uda-uni-2022/uda-kabupaten-solok-640.webp',
      full: '/assets/uda-uni-2022/uda-kabupaten-solok-1080.webp',
    },
    'Kab. Sijunjung': {
      thumb: '/assets/uda-uni-2022/uda-sijunjung-640.webp',
      full: '/assets/uda-uni-2022/uda-sijunjung-1080.webp',
    },
    'Kab. Solok Selatan': {
      thumb: '/assets/uda-uni-2022/uda-solok-selatan-640.webp',
      full: '/assets/uda-uni-2022/uda-solok-selatan-1080.webp',
    },
    'Kota Bukittinggi': {
      thumb: '/assets/uda-uni-2022/uda-bukittinggi-640.webp',
      full: '/assets/uda-uni-2022/uda-bukittinggi-1080.webp',
    },
    'Kota Sawahlunto': {
      thumb: '/assets/uda-uni-2022/uda-sawahlunto-640.webp',
      full: '/assets/uda-uni-2022/uda-sawahlunto-1080.webp',
    },
    'Kota Padang': {
      thumb: '/assets/uda-uni-2022/uda-padang-640.webp',
      full: '/assets/uda-uni-2022/uda-padang-1080.webp',
    },
    'Kab. Pesisir Selatan': {
      thumb: '/assets/uda-uni-2022/uda-pesisir-selatan-640.webp',
      full: '/assets/uda-uni-2022/uda-pesisir-selatan-1080.webp',
    },
    'Kab. Agam': {
      thumb: '/assets/uda-uni-2022/uda-agam-640.webp',
      full: '/assets/uda-uni-2022/uda-agam-1080.webp',
    },
    'Kab. Tanah Datar': {
      thumb: '/assets/uda-uni-2022/uda-tanah-datar-640.webp',
      full: '/assets/uda-uni-2022/uda-tanah-datar-1080.webp',
    },
    'Kab. Padang Pariaman': {
      thumb: '/assets/uda-uni-2022/uda-padang-pariaman-640.webp',
      full: '/assets/uda-uni-2022/uda-padang-pariaman-1080.webp',
    },
    'Kab. Kep. Mentawai': {
      thumb: '/assets/uda-uni-2022/uda-mentawai-640.webp',
      full: '/assets/uda-uni-2022/uda-mentawai-1080.webp',
    },
    'Kota Payakumbuh': {
      thumb: '/assets/uda-uni-2022/uda-payakumbuh-640.webp',
      full: '/assets/uda-uni-2022/uda-payakumbuh-1080.webp',
    },
  },
  uni: {
    'Kab. Dharmasraya': {
      thumb: '/assets/uda-uni-2022/uni-dharmasraya-640.webp',
      full: '/assets/uda-uni-2022/uni-dharmasraya-1080.webp',
    },
    'Kota Solok': {
      thumb: '/assets/uda-uni-2022/uni-solok-640.webp',
      full: '/assets/uda-uni-2022/uni-solok-1080.webp',
    },
    'Kab. Lima Puluh Kota': {
      thumb: '/assets/uda-uni-2022/uni-lima-puluh-kota-640.webp',
      full: '/assets/uda-uni-2022/uni-lima-puluh-kota-1080.webp',
    },
    'Kab. Pasaman': {
      thumb: '/assets/uda-uni-2022/uni-pasaman-640.webp',
      full: '/assets/uda-uni-2022/uni-pasaman-1080.webp',
    },
    'Kab. Solok': {
      thumb: '/assets/uda-uni-2022/uni-kabupaten-solok-640.webp',
      full: '/assets/uda-uni-2022/uni-kabupaten-solok-1080.webp',
    },
    'Kab. Sijunjung': {
      thumb: '/assets/uda-uni-2022/uni-sijunjung-640.webp',
      full: '/assets/uda-uni-2022/uni-sijunjung-1080.webp',
    },
    'Kab. Solok Selatan': {
      thumb: '/assets/uda-uni-2022/uni-solok-selatan-640.webp',
      full: '/assets/uda-uni-2022/uni-solok-selatan-1080.webp',
    },
    'Kota Bukittinggi': {
      thumb: '/assets/uda-uni-2022/uni-bukittinggi-640.webp',
      full: '/assets/uda-uni-2022/uni-bukittinggi-1080.webp',
    },
    'Kota Sawahlunto': {
      thumb: '/assets/uda-uni-2022/uni-sawahlunto-640.webp',
      full: '/assets/uda-uni-2022/uni-sawahlunto-1080.webp',
    },
    'Kota Padang': {
      thumb: '/assets/uda-uni-2022/uni-padang-640.webp',
      full: '/assets/uda-uni-2022/uni-padang-1080.webp',
    },
    'Kab. Pesisir Selatan': {
      thumb: '/assets/uda-uni-2022/uni-pesisir-selatan-640.webp',
      full: '/assets/uda-uni-2022/uni-pesisir-selatan-1080.webp',
    },
    'Kab. Agam': {
      thumb: '/assets/uda-uni-2022/uni-agam-640.webp',
      full: '/assets/uda-uni-2022/uni-agam-1080.webp',
    },
    'Kab. Tanah Datar': {
      thumb: '/assets/uda-uni-2022/uni-tanah-datar-640.webp',
      full: '/assets/uda-uni-2022/uni-tanah-datar-1080.webp',
    },
    'Kab. Padang Pariaman': {
      thumb: '/assets/uda-uni-2022/uni-padang-pariaman-640.webp',
      full: '/assets/uda-uni-2022/uni-padang-pariaman-1080.webp',
    },
    'Kab. Kep. Mentawai': {
      thumb: '/assets/uda-uni-2022/uni-mentawai-640.webp',
      full: '/assets/uda-uni-2022/uni-mentawai-1080.webp',
    },
    'Kota Payakumbuh': {
      thumb: '/assets/uda-uni-2022/uni-payakumbuh-640.webp',
      full: '/assets/uda-uni-2022/uni-payakumbuh-1080.webp',
    },
  },
};


interface Official2024Seed {
  finalistNumber: string;
  fullName: string;
  rankLabel: string;
  region: string;
  age: string;
  education: string;
  achievements: string[];
}

const OFFICIAL_2024_UDA: Official2024Seed[] = [
  {
    finalistNumber: '01',
    fullName: 'Alfatih Zoumi',
    rankLabel: 'Uda Kab. Pasaman',
    region: 'Kab. Pasaman',
    age: '18 tahun',
    education: 'Ex. Pelajar',
    achievements: [
      'Paskibraka Kab. Pasaman 2022',
      'Ketua OSIS SMA 3 Sumbar (2022–2023)',
      'Penegak Bantara Dewan Ambalan Gudep SMA 3 Sumbar (2022–2023)',
      'Sekretaris Dewan Ambalan Gudep SMA 3 Sumbar (2022–2023)',
      'Uda Duta Wisata Kab. Pasaman 2024',
    ],
  },
  {
    finalistNumber: '03',
    fullName: 'Farrel Zaidan Nafisa',
    rankLabel: 'Cik Ajo Kota Pariaman',
    region: 'Kota Pariaman',
    age: '21 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Juara 1 Taekwondo under 58 kg Pekan Olahraga Mahasiswa Nasional (POMNAS XVII) di Sumatera Barat 2022',
      'Juara 3 Taekwondo pada Seleksi Nasional Tim Sea Games Kamboja Taekwondo Indonesia di Jakarta (2022)',
      'Juara 3 Taekwondo under 58 kg Pekan Olahraga Mahasiswa Nasional (POMNAS XVIII) di Kalimantan Selatan 2023',
      'The Winner Cik Ajo Kota Pariaman 2024',
    ],
  },
  {
    finalistNumber: '05',
    fullName: 'Margiono Saputra',
    rankLabel: 'Uda Kab. Solok Selatan',
    region: 'Kab. Solok Selatan',
    age: '19 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Ketua MPK Smantri 2021–2022',
      'Duta Kemenhub SMAN 3 Solok Selatan 2022',
      'Duta GenRe Kab. Solok Selatan 2022',
      'Uda Kab. Solok Selatan 2024',
    ],
  },
  {
    finalistNumber: '07',
    fullName: 'Fernanda Putri Armei',
    rankLabel: 'Bujang Kota Bukittinggi',
    region: 'Kota Bukittinggi',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Anggota Paskibraka Kota Lubuk Linggau 2021',
      'Peserta Terbaik 6 Diklat Kepemimpinan Siswa Tingkat Sekolah Kota Lubuk Linggau tahun 2019–2021',
      'Bujang Kota Bukittinggi 2024',
    ],
  },
  {
    finalistNumber: '09',
    fullName: 'M. Yusuf Afif Ali',
    rankLabel: 'Uda Kota Payakumbuh',
    region: 'Kota Payakumbuh',
    age: '18 tahun',
    education: 'Pelajar',
    achievements: [
      'Juara 2 Kompetisi Debat Pelajar Rancangan Kota Masa Depan Kementerian PUPR Tingkat Nasional 2024',
      'Juara 1 Kompetisi Debat Pelajar Rancangan Kota Masa Depan Kementerian PUPR Tingkat Sumatera 2024',
      'Juara 1 Kompetisi Debat Bahasa Indonesia Management Festival Tingkat Provinsi 2024',
      'Uda Kota Payakumbuh 2024',
    ],
  },
  {
    finalistNumber: '11',
    fullName: 'Muhammad Ridho Arraafi',
    rankLabel: 'Uda Kab. Dharmasraya',
    region: 'Kab. Dharmasraya',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Juara 5 Duta GenRe Sumatera Barat 2022',
      'Juara 1 Duta GenRe Kab. Dharmasraya 2022',
      'Juara 1 Lomba Tari Kreasi Tingkat Provinsi Sumatera Barat, Riau dan Jambi di Universitas Dharma Indonesia',
    ],
  },
  {
    finalistNumber: '13',
    fullName: 'Adrean Muhammad Irvan',
    rankLabel: 'Uda Kab. Agam',
    region: 'Kab. Agam',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Juara 1 Cultural Immersion Sumatera Barat GenRe Award 2024',
      'Juara 1 Lomba Debat Konstitusi Sumbar yang diadakan Universitas PGRI Sumbar 2023',
      'Juara 1 Speech Contest Kota Padang Panjang 2023',
      'Top 5 Duta Harmoni Indonesia Putra 2022',
      'Duta GenRe Intelegensia Putra Kota Padang Panjang 2021',
      'Juara 1 Nasional Lomba Cipta Karya Surat untuk Guru 2021',
    ],
  },
  {
    finalistNumber: '15',
    fullName: 'Michel Putra',
    rankLabel: 'Bujang Kab. Solok',
    region: 'Kab. Solok',
    age: '24 tahun',
    education: 'Mahasiswa',
    achievements: [
      '5th Runner Up Putra Pariwisata Sumatera Barat 2023',
      'Putra Pariwisata Sumbar Talented 2023',
      'Pengurus HMJ Akuntansi UBH 2022–2023',
      'Penerima Beasiswa Bank Indonesia 2024–2025',
    ],
  },
  {
    finalistNumber: '17',
    fullName: 'Viagi Anfasini',
    rankLabel: 'Uda Kota Padang Panjang',
    region: 'Kota Padang Panjang',
    age: '19 tahun',
    education: 'Freelancer',
    achievements: [
      'Desain Grafis Muda',
      'Juara 2 Cabang Renang (50 m Gaya Dada Putra) Olimpiade Olahraga Siswa Nasional (O2SN) Tingkat Provinsi Sumatera Barat',
      'Uda Kota Padang Panjang 2024',
    ],
  },
  {
    finalistNumber: '19',
    fullName: 'Dody M. Nur Hayatullah',
    rankLabel: 'Cik Ajo Kab. Padang Pariaman',
    region: 'Kab. Padang Pariaman',
    age: '22 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Juara 1 Menggambar Bercerita FLS2N 2014',
      'Juara 1 Lomba Baca Puisi Tingkat Kota Pariaman 2016',
      'Top 23 Esai Inspiratif YBM BRILiaN',
    ],
  },
  {
    finalistNumber: '21',
    fullName: 'Hikmal Akbar',
    rankLabel: 'Uda Kab. Pesisir Selatan',
    region: 'Kab. Pesisir Selatan',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Peserta Pertukaran Mahasiswa Merdeka 3 (PMM3) di Politeknik Negeri Bali',
      'Peserta Eight Days International Online Program with ECC Kokusai College Japan 2023',
      'Pemateri dalam kegiatan GenRe Live on Instagram yang diadakan oleh PIK R ADULT SMAN 1 Linggo Sari Baganti 2022',
      'RU 2 Duta GenRe Kab. Pesisir Selatan 2022',
    ],
  },
  {
    finalistNumber: '23',
    fullName: 'Ahmad Arif Maulana',
    rankLabel: 'Uda Kota Padang',
    region: 'Kota Padang',
    age: '21 tahun',
    education: 'Wiraswasta',
    achievements: [
      'Koordinator Kaderisasi HMD FIK UNP',
      'Koordinator Humas UNP Aquatic',
      'Perwakilan Mahasiswa UNP Latsitardanus 2023',
      'Panitia Renang Riau Open Swimming 2023',
      'Uda Kota Padang 2024',
    ],
  },
  {
    finalistNumber: '25',
    fullName: 'Dzikri Pratama Putra Ameri',
    rankLabel: 'Uda Kab. Sijunjung',
    region: 'Kab. Sijunjung',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Anggota UKM Protokoler dan Pengembangan Diri',
      'Anggota HMPS-SI',
      'Anggota MPK MAN 2 Sijunjung',
      'Top 7 Duta GenRe Kab. Sijunjung 2021',
    ],
  },
  {
    finalistNumber: '27',
    fullName: 'Hardika Yami Jefisano',
    rankLabel: 'Uda Kota Solok',
    region: 'Kota Solok',
    age: '23 tahun',
    education: 'Freelance',
    achievements: ['Uda Kota Solok 2024'],
  },
  {
    finalistNumber: '29',
    fullName: 'Ibnu Affan Arrasyid',
    rankLabel: 'Uda Kab. Tanah Datar',
    region: 'Kab. Tanah Datar',
    age: '23 tahun',
    education: 'Fresh Graduate',
    achievements: [
      'Kepala Bidang Humas UKM Seni UIN Mahmud Yunus Batusangkar 2021',
      'Ketua Panitia Lomba Akustik Religi Se-Sumbar 2021',
      'Dewan Pertimbangan Organisasi UKM Seni UIN',
    ],
  },
  {
    finalistNumber: '31',
    fullName: 'Muhammad Lutfan Rais',
    rankLabel: 'Uda Kab. Lima Puluh Kota',
    region: 'Kab. Lima Puluh Kota',
    age: '22 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Delegasi Summer Course INTI International University Malaysia',
      'Finalis Pilmapres UNP Padang 2024',
      'Indonesia Delegation International Scout Jamboree di Malaysia 2016',
      'Finalis Duta GenRe Kab. Lima Puluh Kota 2020',
      'Uda Persahabatan Kab. Lima Puluh Kota',
    ],
  },
];

const OFFICIAL_2024_UNI: Official2024Seed[] = [
  {
    finalistNumber: '02',
    fullName: 'Fitriatul Fadhilah',
    rankLabel: 'Uni Kab. Pasaman',
    region: 'Kab. Pasaman',
    age: '21 tahun',
    education: 'Fresh Graduate',
    achievements: [
      'Juara 1 MSQ Tingkat Kabupaten',
      'MSQ Tingkat Provinsi Sumbar',
      'Juara 3 MSQ se-Sumatera Barat dalam perlombaan Haflah VII UIN Imam Bonjol Padang (2023)',
      'Finalis Tari Kreasi IB-Fest UIN Imam Bonjol 2023',
      'Uni Pasaman 2024',
    ],
  },
  {
    finalistNumber: '04',
    fullName: 'Rima Syukhria',
    rankLabel: 'Cik Uniang Kota Pariaman',
    region: 'Kota Pariaman',
    age: '24 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Narasumber Seminar Beasiswa Dalam dan Luar Negeri di Kota Kediri 2023',
      'Relawan Kesehatan pada kegiatan Sobat Indonesia Batch 5 di Banten 2021',
      'Relawan Mengajar di Banten 2021',
      'Cik Uniang Kota Pariaman 2024',
    ],
  },
  {
    finalistNumber: '06',
    fullName: 'Novia Apriana Nengsih',
    rankLabel: 'Uni Kab. Solok Selatan',
    region: 'Kab. Solok Selatan',
    age: '21 tahun',
    education: 'Mahasiswa',
    achievements: [
      'MC MTQ Nasional XL Tingkat Provinsi 2023',
      'Pemegang Baki Paskibra 2019',
      'Pemegang Carano Gubernur Cup 2022',
      'Duta Kampus 2024',
      'Uni Kab. Solok Selatan 2024',
    ],
  },
  {
    finalistNumber: '08',
    fullName: 'Khanza Shadiqa Ighfirly',
    rankLabel: 'Gadih Kota Bukittinggi',
    region: 'Kota Bukittinggi',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Peserta MMC dan IDCC dalam berbagai bidang nasional dan Marching Band',
      'Gadih Kota Bukittinggi 2024',
    ],
  },
  {
    finalistNumber: '10',
    fullName: 'Stefina Lora Lorenza',
    rankLabel: 'Uni Kota Payakumbuh',
    region: 'Kota Payakumbuh',
    age: '23 tahun',
    education: 'Freelance',
    achievements: [
      'Uni Best Project Kota Payakumbuh 2024',
      'Juara 2 Pemilihan Brand Ambassador Minsu Skin Payakumbuh 2023',
      'Medali Emas Popda Cabor Basket 2018',
      'Pasukan 17 Paskibraka Kota Payakumbuh 2017',
      'Top 10 Top Model Sumbar 2016',
      'Uni Kota Payakumbuh 2024',
    ],
  },
  {
    finalistNumber: '12',
    fullName: 'Eliza Trianasari',
    rankLabel: 'Uni Kab. Dharmasraya',
    region: 'Kab. Dharmasraya',
    age: '21 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Juara 1 Catur Putri se-Kab. Dharmasraya 2017',
      "Juara 1 UNDHARI Birthday's Festival Lomba Fashion Show Busana Unik Daur Ulang 2018",
      'Top 10 Duta GenRe Dharmasraya 2020',
      'Uni Kab. Dharmasraya 2024',
    ],
  },
  {
    finalistNumber: '14',
    fullName: 'Nabilla Andini',
    rankLabel: 'Uni Kab. Agam',
    region: 'Kab. Agam',
    age: '23 tahun',
    education: 'Freelance',
    achievements: [
      'Anggota Pemantau Pemilu 2024 Lembaga Pemantau Pusat Studi Konstitusi Fakultas Hukum UNAND 2024',
      'Paskibra Kab. Agam 2018',
      'Volunteer Merah Mengabdi 2023',
      'Juara II Ganda Putri Fun Sport Eksternal Perhimpunan Mahasiswa Tata Negara Fakultas Hukum UNAND 2023',
    ],
  },
  {
    finalistNumber: '16',
    fullName: 'Arini Mahclania',
    rankLabel: 'Gadih Kab. Solok',
    region: 'Kab. Solok',
    age: '21 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Top 3 Uda Uni Fakultas Ekonomi dan Bisnis UNP 2023',
      'Internship Program di PT. Astra Daihatsu Padang',
      'Panitia Accounting Vibes Tingkat Nasional',
      'Relawan Pajak untuk Negeri 2024 oleh Direktorat Jenderal Pajak Indonesia 2024',
      'Anggota Treat Radio 2023',
    ],
  },
  {
    finalistNumber: '18',
    fullName: 'Febriani Aulia Rahmi',
    rankLabel: 'Uni Kota Padang Panjang',
    region: 'Kota Padang Panjang',
    age: '22 tahun',
    education: 'Fresh Graduate',
    achievements: [
      'Juara 2 Lomba Karya Tulis Ilmiah dalam acara Pekan Konstitusi XII 2019',
      'Anggota Hubungan Masyarakat Sosiologi Fair I 2021 Tingkat Nasional',
      'Koordinator Hubungan Masyarakat Sosiologi Fair I 2022 Tingkat Nasional',
      'Steering Committee Sosiologi Fair I 2022 Tingkat Nasional',
    ],
  },
  {
    finalistNumber: '20',
    fullName: 'Ricci Purnama Sari',
    rankLabel: 'Cik Uniang Kab. Padang Pariaman',
    region: 'Kab. Padang Pariaman',
    age: '21 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Harapan 3 Olimpiade Matematika Provinsi Sumatera Barat 2022',
      'Peringkat 6 Olimpiade Kimia Tingkat SMA 2022',
      'Pemenang Campaign Competition oleh Digital Savvy Indonesia 2023',
      'Peraih Peserta Magang Terbaik HIMA IKM KM FKM UNAND',
      'Cik Uniang Wakil II Padang Pariaman',
    ],
  },
  {
    finalistNumber: '22',
    fullName: 'Kamiliya Salsabila',
    rankLabel: 'Uni Kab. Pesisir Selatan',
    region: 'Kab. Pesisir Selatan',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Uni Kab. Pesisir Selatan 2024',
      'RU 1 Duta GenRe Kab. Pesisir Selatan 2022',
      'Paskibra Kecamatan IV Jurai',
      'Juara 1 Festival Bahari Mandeh',
    ],
  },
  {
    finalistNumber: '24',
    fullName: 'Dila Sofira',
    rankLabel: 'Uni Kota Padang',
    region: 'Kota Padang',
    age: '23 tahun',
    education: 'Mahasiswa UNP',
    achievements: [
      'Uni Kota Padang 2024',
      'Bintang Aktivis Kampus 2023 Universitas Negeri Padang 2023',
      'RU 4 Duta GenRe Kota Padang 2022',
      'Juri Posko Kepribadian Organisasi Pemilihan Duta GenRe Kota Padang 2023',
      'Sekretaris Umum Unit Kegiatan Komunikasi dan Penyiaran Kampus UNP 2022',
      'Panitia Pemilihan Duta GenRe 2023',
    ],
  },
  {
    finalistNumber: '26',
    fullName: 'Nisa Cahaya Tari Farsia',
    rankLabel: 'Uni Kab. Sijunjung',
    region: 'Kab. Sijunjung',
    age: '22 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Anggota Paskibraka HUT RI ke-73 Kab. Sijunjung 2018',
      'Juara 1 Festival dan Lomba Seni Siswa Nasional (FLS2N) Tingkat Kabupaten 2019 cabang Solo Song Putri',
    ],
  },
  {
    finalistNumber: '28',
    fullName: 'Rika Putri Kemuning',
    rankLabel: 'Uni Kota Solok',
    region: 'Kota Solok',
    age: '23 tahun',
    education: 'Mahasiswa',
    achievements: ['Uni Kota Solok 2024', 'Winner Putri Duta Kampus UMMY 2023'],
  },
  {
    finalistNumber: '30',
    fullName: 'Fiya Amanda',
    rankLabel: 'Uni Kab. Tanah Datar',
    region: 'Kab. Tanah Datar',
    age: '22 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Juara 1 AKSIOMA-KSM cabang Lomba Hadroh Tk. Provinsi Sumbar 2017',
      'Juara 1 MTQ Nasional Tk. Kecamatan Batipuh Selatan cabang Lomba Tartil Umum 2020',
      'Juara 1 MTQ Nasional Tk. Kecamatan Batipuh Selatan cabang Lomba Tartil Umum 2021',
      'Best Presenter kegiatan Seminar Nasional Biologi di UIN Raden Fattah Palembang 2023',
    ],
  },
  {
    finalistNumber: '32',
    fullName: 'Mutiara Huzaifah',
    rankLabel: 'Uni Kab. Lima Puluh Kota',
    region: 'Kab. Lima Puluh Kota',
    age: '23 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Juara 2 Pi Solo Song Festival Lomba Seni Siswa Nasional (FLS2N) tingkat SMA se-Kab. Lima Puluh Kota 2018',
      'Peserta Festival Lagu Minang tingkat pelajar se-Sumatera Barat ke-3 OSIS SMKN 1 Payakumbuh 2015',
      'Juara 2 Lomba Festival Akustik Religi Mesjid Baiturrahmah Tabing Ranah 2022',
    ],
  },
];

const OFFICIAL_2022_UDA: Official2024Seed[] = [
  {
    finalistNumber: '01',
    fullName: 'Abdan Ferio Putra',
    rankLabel: 'Uda Kab. Dharmasraya',
    region: 'Kab. Dharmasraya',
    age: '20 tahun',
    education: 'Wiraswasta',
    achievements: ['Paskibraka 2018', 'Uda Duta Pendidikan 2019', 'Uda Dharmasraya 2022'],
  },
  {
    finalistNumber: '03',
    fullName: 'Dwiki Madiya Febrian',
    rankLabel: 'Uda Kota Solok',
    region: 'Kota Solok',
    age: '23 tahun',
    education: 'Mahasiswa Fakultas Ilmu Budaya Universitas Bung Hatta / Videographer & Editor Freelancer',
    achievements: ['High Score Public Speaking di English Class Universitas Bung Hatta'],
  },
  {
    finalistNumber: '05',
    fullName: 'Fajri Ahmad Syafril',
    rankLabel: 'Uda Kab. Lima Puluh Kota',
    region: 'Kab. Lima Puluh Kota',
    age: '19 tahun',
    education: 'Mahasiswa Prodi D-4 Teknologi Rekayasa Sistem Elektronika',
    achievements: [
      'Finalis Lomba Selekda ASC Provinsi Riau 2022',
      '10 Besar Finalis Lomba Gagasan dan Rancangan Kreatif 2022 (Lograk 2022)',
    ],
  },
  {
    finalistNumber: '07',
    fullName: 'Foby Williando',
    rankLabel: 'Uda Kab. Pasaman',
    region: 'Kab. Pasaman',
    age: '23 tahun',
    education: 'D4 Teknologi Rekayasa Informasi Pemerintahan IPDN / BKPSDM Kabupaten Pasaman',
    achievements: [
      'Juara 2 Turnamen Nasional Bridge A_94 ke-II Tahun 2018',
      'Koordinator Dana Usaha Expo IPDN Kampus Sumatera Barat Tahun 2020',
      'Kartika Adhi Mahottama I Tahun 2020',
    ],
  },
  {
    finalistNumber: '09',
    fullName: 'Muhamad Fadillah',
    rankLabel: 'Uda Kab. Solok',
    region: 'Kab. Solok',
    age: '20 tahun',
    education: 'Mahasiswa',
    achievements: ['Delegasi RPLF Ismafarsi Jilid 2', 'Delegasi Muswil Ismafarsi', 'Duta BPOM 2022'],
  },
  {
    finalistNumber: '11',
    fullName: 'Sukri Darmiki',
    rankLabel: 'Uda Kab. Sijunjung',
    region: 'Kab. Sijunjung',
    age: '22 tahun',
    education: 'S1 PAI / Asisten Rumah Dinas Wakil Bupati Sijunjung',
    achievements: ['Juara 2 O2SN Tingkat Provinsi Sumatera Barat Cabang Volley Ball'],
  },
  {
    finalistNumber: '13',
    fullName: 'Wahyuda Aldi',
    rankLabel: 'Uda Kab. Solok Selatan',
    region: 'Kab. Solok Selatan',
    age: '23 tahun',
    education: 'S1 Sistem Informasi',
    achievements: ['Duta Anak Sumbar 2016', 'Juara 1 Krya Putra Solok Selatan 2017', 'Duta Lantas Solok Selatan 2016'],
  },
  {
    finalistNumber: '15',
    fullName: 'Fiego Firman Shah',
    rankLabel: 'Bujang Kota Bukittinggi',
    region: 'Kota Bukittinggi',
    age: '19 tahun',
    education: 'Mahasiswa',
    achievements: [
      'Uda Duta Remaja Berbakat Sumatera Barat 2019',
      'Duta Pelajar Indonesia Sumatera Barat 2019',
      'Duta Pelajar Indonesia Berbakat 2019',
    ],
  },
  {
    finalistNumber: '17',
    fullName: 'Riski Dwiyanto',
    rankLabel: 'Uda Kota Sawahlunto',
    region: 'Kota Sawahlunto',
    age: '22 tahun',
    education: 'Mahasiswa UNP Jurusan Manajemen',
    achievements: [
      'Juara 1 FLS2N Desain Poster Tahun 2014 Tingkat Kota',
      'Juara 2 FLS2N Desain Poster Tahun 2015 Tingkat Provinsi',
      'Juara 3 KEJURDA Tarung Derajat Tahun 2013',
    ],
  },
  {
    finalistNumber: '19',
    fullName: 'Muhammad Fakhri',
    rankLabel: 'Uda Kota Padang',
    region: 'Kota Padang',
    age: '22 tahun',
    education: 'Mahasiswa Universitas Ekasakti (UNES) Padang',
    achievements: ['Duta Fakultas Ekonomi UNES 2019'],
  },
  {
    finalistNumber: '21',
    fullName: 'Rhazza Reva',
    rankLabel: 'Uda Kab. Pesisir Selatan',
    region: 'Kab. Pesisir Selatan',
    age: '22 tahun',
    education: 'Mahasiswa',
    achievements: ['Purna Paskibraka Kab. Pesisir Selatan 2016', 'Ketua UMKM Bazar Ecofair 2020', 'Ketua Umum HMI 2021'],
  },
  {
    finalistNumber: '23',
    fullName: 'Arif Maulana',
    rankLabel: 'Uda Kab. Agam',
    region: 'Kab. Agam',
    age: '21 tahun',
    education: 'Mahasiswa Universitas Andalas',
    achievements: [
      'Duta GenRe Inovator Kota Bukittinggi 2019',
      'Juara P2MW (Pendanaan Mahasiswa Wirausaha) Tingkat Nasional 2022',
    ],
  },
  {
    finalistNumber: '25',
    fullName: 'Fauzi Wirahadi',
    rankLabel: 'Uda Kab. Tanah Datar',
    region: 'Kab. Tanah Datar',
    age: '20 tahun',
    education: 'Mahasiswa UIN Mahmud Yunus Batusangkar',
    achievements: ['Juara 1 MTQ Tilawah Remaja 2021', 'Rang Mudo Duta Budaya Kabupaten Tanah Datar 2019'],
  },
  {
    finalistNumber: '27',
    fullName: 'Fauzi Alfiandri',
    rankLabel: 'Cik Ajo Kab. Padang Pariaman',
    region: 'Kab. Padang Pariaman',
    age: '22 tahun',
    education: 'Mahasiswa D4 Manajemen Perhotelan, Fakultas Pariwisata dan Perhotelan, Universitas Negeri Padang',
    achievements: [
      'Juara 1 LKS (Lomba Kompetensi Siswa) Tingkat Provinsi Bidang Perhotelan 2017',
      'Juara 1 Lomba Dekan Cup FPP UNP Bidang Restaurant Service 2017',
    ],
  },
  {
    finalistNumber: '29',
    fullName: 'Albertus Janang Saabbangan',
    rankLabel: 'Silainge Kab. Kep. Mentawai',
    region: 'Kab. Kep. Mentawai',
    age: '24 tahun',
    education: 'Mahasiswa Universitas Tamansiswa Padang',
    achievements: ['Paskibra 2017'],
  },
  {
    finalistNumber: '31',
    fullName: 'Aqil Rahman',
    rankLabel: 'Uda Kota Payakumbuh',
    region: 'Kota Payakumbuh',
    age: '21 tahun',
    education: 'D-IV Teknik Informatika / Software Engineer',
    achievements: [
      'Duta Budaya Rang Mudo Kota Payakumbuh 2018',
      'Peserta Pertukaran Pelajar Program BUMN Siswa Mengenal Nusantara Sumatera Barat x Sulawesi Selatan 2018',
      'Juara 3 Information Technology Competition Tingkat Sumatera Tahun 2018',
    ],
  },
];

const OFFICIAL_2022_UNI: Official2024Seed[] = [
  {
    finalistNumber: '02',
    fullName: 'Fiya Amanda',
    rankLabel: 'Uni Kab. Dharmasraya',
    region: 'Kab. Dharmasraya',
    age: '20 tahun',
    education: 'Mahasiswa UNP',
    achievements: ['Uni Kab. Dharmasraya 2022'],
  },
  {
    finalistNumber: '04',
    fullName: 'Rizka Dwi Putri',
    rankLabel: 'Uni Kota Solok',
    region: 'Kota Solok',
    age: '22 tahun',
    education: 'Banker',
    achievements: ['Koordinator Acara Seminar dan Workshop Competition Penggunaan Sistem Cerdas di Era Evolution 4.0'],
  },
  {
    finalistNumber: '06',
    fullName: 'Elva Yuliati',
    rankLabel: 'Uni Kab. Lima Puluh Kota',
    region: 'Kab. Lima Puluh Kota',
    age: '23 tahun',
    education: 'S1 Ekonomi Universitas Andalas / Protokoler Pj. Walikota Payakumbuh & Asisten Dosen Jurusan Manajemen FEB Universitas Andalas',
    achievements: [
      'Lulusan Terbaik FEB Universitas Andalas pada Wisuda 3 Tahun 2022',
      'Bintang Aktivis Fakultas pada Wisuda 3 Tahun 2022',
    ],
  },
  {
    finalistNumber: '08',
    fullName: 'Monica Putri',
    rankLabel: 'Uni Kab. Pasaman',
    region: 'Kab. Pasaman',
    age: '22 tahun',
    education: 'S1 Ekonomi Pembangunan',
    achievements: ['Piagam Penghargaan dari Museum Adityawarman'],
  },
  {
    finalistNumber: '10',
    fullName: 'Utari Sri Rahmi',
    rankLabel: 'Uni Kab. Solok',
    region: 'Kab. Solok',
    age: '20 tahun',
    education: 'Mahasiswi',
    achievements: [
      'Perwakilan Kab. Solok dalam Ajang Festival Minangkabau di JCC',
      'Juara 1 Uni Kabupaten Solok 2022',
    ],
  },
  {
    finalistNumber: '12',
    fullName: 'Fanesa Dwiliyanti Putri',
    rankLabel: 'Uni Kab. Sijunjung',
    region: 'Kab. Sijunjung',
    age: '24 tahun',
    education: 'Sarjana Terapan Pekerjaan Sosial / Dinas Sosial PPrPA Kabupaten Sijunjung',
    achievements: [
      'Duta Remaja Provinsi Sumatera Barat Tahun 2015',
      'Penerima Beasiswa Prestasi Kementerian Sosial RI, Politeknik Kesejahteraan Sosial Bandung Tahun 2016–2020',
    ],
  },
  {
    finalistNumber: '14',
    fullName: 'Sarah Kamilah Alfadli',
    rankLabel: 'Uni Kab. Solok Selatan',
    region: 'Kab. Solok Selatan',
    age: '20 tahun',
    education: 'Mahasiswa Universitas Negeri Padang Jurusan Sendratasik',
    achievements: [
      'Juara 1 Lomba Busana Baju Kuruang Basiba Tingkat Sumbar di Pagaruyuang',
      'Juara Solo Song',
      'Runner Up 2 Duta GenRe 2017',
    ],
  },
  {
    finalistNumber: '16',
    fullName: 'Restuti Yuneka',
    rankLabel: 'Gadih Kota Bukittinggi',
    region: 'Kota Bukittinggi',
    age: '22 tahun',
    education: 'Fresh Graduate Poltekkes Kemenkes Padang Jurusan Kebidanan',
    achievements: ['Lulus Kuliah Tepat Waktu dengan IPK 3,76', 'Top 25 Putri Hijab Sumatera Barat 2021'],
  },
  {
    finalistNumber: '18',
    fullName: 'Atika Yasmin',
    rankLabel: 'Uni Kota Sawahlunto',
    region: 'Kota Sawahlunto',
    age: '20 tahun',
    education: 'Mahasiswa S1 Biologi, Universitas Andalas',
    achievements: ['Juara 2 Olimpiade Sains Tingkat Provinsi 2015', 'Purna Paskibraka Kota Sawahlunto 2018'],
  },
  {
    finalistNumber: '20',
    fullName: 'Laila Mufita',
    rankLabel: 'Uni Kota Padang',
    region: 'Kota Padang',
    age: '24 tahun',
    education: 'S1 FKM UI / Pegawai BUMN',
    achievements: [
      'Duta Lalu Lintas Kota Padang 2015',
      'Semifinalis Abang None Jakarta Timur 2020',
      'Duta Humas UI 2019/2020',
    ],
  },
  {
    finalistNumber: '22',
    fullName: 'Ike Erlanda Putri',
    rankLabel: 'Uni Kab. Pesisir Selatan',
    region: 'Kab. Pesisir Selatan',
    age: '21 tahun',
    education: 'Mahasiswa / Model',
    achievements: [
      'The Winner Duta Gemarikan Sumbar 2019',
      'Runner Up 3 Miss HTT Kota Padang 2022',
      'Putra Putri Tenun Songket Indonesia 2022',
    ],
  },
  {
    finalistNumber: '24',
    fullName: 'Aulia Rahmi',
    rankLabel: 'Uni Kab. Agam',
    region: 'Kab. Agam',
    age: '22 tahun',
    education: 'Fresh Graduate S1 Kimia',
    achievements: [
      'Juara 3 Duta Bahasa Provinsi Bengkulu 2020',
      'Juara 2 Business Plan Entrepreneurship Expo GenBI Bengkulu 2021',
      'Juara 1 MTQ Mahasiswa Universitas Bengkulu 2022',
    ],
  },
  {
    finalistNumber: '26',
    fullName: 'Uni Kab. Tanah Datar 2022',
    rankLabel: 'Uni Kab. Tanah Datar',
    region: 'Kab. Tanah Datar',
    age: '',
    education: 'Finalis Utusan Kabupaten Tanah Datar (biodata lengkap menunggu pembaruan)',
    achievements: ['Uni Kab. Tanah Datar 2022'],
  },
  {
    finalistNumber: '28',
    fullName: 'Debby Noviana Rifani',
    rankLabel: 'Cik Uniang Kab. Padang Pariaman',
    region: 'Kab. Padang Pariaman',
    age: '21 tahun',
    education: 'Mahasiswa S1 Sastra Inggris, Fakultas Ilmu Budaya, Universitas Andalas',
    achievements: [
      'Duta GenRe Fotogenic Kab. Padang Pariaman 2017',
      'Terbaik III Mahasiswa Berprestasi Fakultas Ilmu Budaya 2021',
    ],
  },
  {
    finalistNumber: '30',
    fullName: 'Deby Abigael Sababalat',
    rankLabel: 'Siokko Kab. Kep. Mentawai',
    region: 'Kab. Kep. Mentawai',
    age: '19 tahun',
    education: 'Mahasiswa UNISBAR Prodi D3 Keperawatan',
    achievements: ['Mengikuti Kegiatan Fondasi Hidup', 'Siokko Kab. Kep. Mentawai 2022'],
  },
  {
    finalistNumber: '32',
    fullName: 'Siti Indhira Rahmadani',
    rankLabel: 'Uni Kota Payakumbuh',
    region: 'Kota Payakumbuh',
    age: '21 tahun',
    education: 'Mahasiswa Universitas Padjadjaran',
    achievements: ['Purna Paskibraka Indonesia 2017'],
  },
];

function getCohortPhoto(year: string, role: RoleFilter, region: string): CohortPhoto | undefined {
  if (year === '2024') {
    return PHOTOS_2024_BY_ROLE[role][region];
  }
  if (year === '2022') {
    return PHOTOS_2022_BY_ROLE[role][region];
  }
  return undefined;
}

export function getRegionalHonorific(role: RoleFilter, region: string): string {
  const normalized = region.trim().toLowerCase();
  if (normalized === 'kota bukittinggi') {
    return role === 'uda' ? 'Bujang' : 'Gadih';
  }
  if (normalized === 'kota pariaman' || normalized === 'kab. padang pariaman') {
    return role === 'uda' ? 'Cik Ajo' : 'Cik Uniang';
  }
  return role === 'uda' ? 'Uda' : 'Uni';
}

export function formatParticipantNameWithHonorific(
  rawName: string,
  role: RoleFilter,
  region: string,
): string {
  const trimmed = rawName.trim();
  if (!trimmed) return trimmed;
  const stripped = trimmed.replace(/^(?:uda|uni|bujang|gadih|cik\s+ajo|cik\s+uniang)\s+/i, '').trim();
  const prefix = getRegionalHonorific(role, region);
  return stripped ? `${prefix} ${stripped}` : prefix;
}

function buildOfficialCohortBio(
  year: string,
  role: RoleFilter,
  slotIndex: number,
  seed: Official2024Seed,
): AmbassadorBio {
  const leadAchievement = seed.achievements[0] ?? `${seed.rankLabel} ${year}`;
  const ageSegment = seed.age ? ` (${seed.age})` : '';
  const displayName = formatParticipantNameWithHonorific(seed.fullName, role, seed.region);
  return {
    role,
    slotIndex,
    rankLabel: seed.rankLabel,
    fullName: displayName,
    shortName: displayName,
    titleBadge: `Finalis No. ${seed.finalistNumber} · ${seed.rankLabel} ${year}`,
    region: seed.region,
    age: seed.age,
    finalistNumber: seed.finalistNumber,
    education: seed.education,
    profession: `Finalis Duta Wisata Sumbar ${year} · ${seed.education}`,
    bio: `${displayName}${ageSegment} adalah finalis nomor ${seed.finalistNumber} utusan resmi ${seed.region} dengan predikat ${seed.rankLabel} pada ajang Pemilihan Uda & Uni Duta Wisata Provinsi Sumatera Barat ${year}. Rekam jejak prestasinya antara lain ${leadAchievement}.`,
    advocacy: '',
    achievement: seed.achievements.join(' · '),
    achievements: [...seed.achievements],
    photo: getCohortPhoto(year, role, seed.region),
  };
}

function buildOfficial2024Lineup(): YearLineup {
  return {
    year: '2024',
    status: 'published',
    uda: OFFICIAL_2024_UDA.map((seed, idx) => buildOfficialCohortBio('2024', 'uda', idx, seed)),
    uni: OFFICIAL_2024_UNI.map((seed, idx) => buildOfficialCohortBio('2024', 'uni', idx, seed)),
  };
}

function buildOfficial2022Lineup(): YearLineup {
  return {
    year: '2022',
    status: 'published',
    uda: OFFICIAL_2022_UDA.map((seed, idx) => buildOfficialCohortBio('2022', 'uda', idx, seed)),
    uni: OFFICIAL_2022_UNI.map((seed, idx) => buildOfficialCohortBio('2022', 'uni', idx, seed)),
  };
}

function buildDefaultCatalogYears(): YearLineup[] {
  return [buildOfficial2024Lineup(), buildOfficial2022Lineup()];
}

function buildDefaultEvents(): CmsEventItem[] {
  return [
    {
      id: 'evt-nagari-pokdarwis',
      status: 'published',
      category: 'ADVOKASI DAERAH',
      modalKicker: 'Advokasi Daerah · Desa Wisata',
      title: 'Gerakan Nagari Sadar Wisata & Pokdarwis',
      focusLine: 'Fokus: Generasi Muda & Pokdarwis Pesisir / Nagari',
      cardSummary:
        'Edukasi Kelompok Sadar Wisata pesisir dan nagari, pelestarian ekosistem pantai, serta pendampingan destinasi berkelanjutan di Sumatera Barat.',
      detailSummary:
        'Edukasi Kelompok Sadar Wisata pesisir dan nagari, pelestarian ekosistem pantai serta cagar budaya, dan pendampingan destinasi ramah lingkungan di Sumatera Barat.',
      photo: '/assets/aistudio/IMG_0178_0bfa93da.jpg',
      photoAlt: 'Kawasan wisata bahari dan aktivitas Pokdarwis pesisir Sumatera Barat',
      metrics: [
        {value: '19', label: 'Kabupaten & Kota'},
        {value: '45+', label: 'Nagari Binaan'},
        {value: '3x', label: 'Jangkauan Edukasi'},
      ],
      details: [
        {
          label: 'Pelaksanaan',
          text: 'Lokakarya Sapta Pesona dan tata kelola wisata bahari maupun nagari bersama pengurus Pokdarwis setempat.',
        },
        {
          label: 'Cakupan Wilayah',
          text: 'Pendampingan langsung di destinasi unggulan pesisir selatan hingga dataran tinggi di 19 kabupaten/kota.',
        },
        {
          label: 'Fokus Utama',
          text: 'Pembinaan pemandu wisata muda berwawasan adat Minangkabau, kebersihan pantai, serta konservasi ekosistem pesisir.',
        },
      ],
    },
    {
      id: 'evt-diplomasi-wastra',
      status: 'published',
      category: 'PROMOSI GLOBAL',
      modalKicker: 'Promosi Global · Wastra & Pusaka',
      title: 'Misi Budaya & Diplomasi Wastra Songket',
      focusLine: 'Fokus: Misi Budaya & Pasar Mancanegara',
      cardSummary:
        'Representasi resmi duta wisata Sumatera Barat pada bursa pariwisata dunia, diplomasi kuliner, serta pameran tenun songket dan warisan Pagaruyung.',
      detailSummary:
        'Representasi resmi duta wisata Sumatera Barat pada bursa pariwisata dunia, diplomasi kuliner Minangkabau, serta pameran tenun songket dan warisan pusaka Pagaruyung di kancah global.',
      photo: '/assets/aistudio/_MG_7229_58acf679.jpg',
      photoAlt: 'Istano Basa Pagaruyung sebagai pusat diplomasi budaya dan wastra Minangkabau',
      metrics: [
        {value: '12', label: 'Misi Internasional'},
        {value: '35+', label: 'Pameran Wastra'},
        {value: '4x', label: 'Eksposur Global'},
      ],
      details: [
        {
          label: 'Diplomasi Wastra',
          text: 'Pameran busana adat dan tenun songket Pandai Sikek serta Silungkang di forum budaya nasional dan mancanegara.',
        },
        {
          label: 'Promosi Kuliner',
          text: 'Presentasi gastronomi Rendang dan kopi spesialti Ranah Minang pada bursa pariwisata dunia.',
        },
        {
          label: 'Mandat Duta',
          text: 'Memperkenalkan narasi Visit Beautiful West Sumatra kepada mitra industri perjalanan internasional.',
        },
      ],
    },
    {
      id: 'evt-festival-danau',
      status: 'published',
      category: 'EKONOMI KREATIF',
      modalKicker: 'Ekonomi Kreatif · Kriya & Danau',
      title: 'Festival Danau & Pemberdayaan Kriya Lokal',
      focusLine: 'Fokus: Pelaku Kriya, UMKM Kuliner & Masyarakat Danau',
      cardSummary:
        'Kolaborasi bersama pengrajin tenun Pandai Sikek dan Silungkang, komunitas perikanan danau tradisional, serta pelaku UMKM kuliner destinasi.',
      detailSummary:
        'Kolaborasi bersama pengrajin tenun Pandai Sikek, Silungkang, dan Kubang, komunitas perikanan tradisional kawasan danau, serta pendampingan UMKM kuliner di sekitar destinasi unggulan.',
      photo: '/assets/aistudio/IMG_8806_c256be4b.jpg',
      photoAlt: 'Pesisir danau Sumatera Barat dengan perahu kayu dan alat tangkap tradisional',
      metrics: [
        {value: '80+', label: 'Pengrajin Kriya'},
        {value: '25+', label: 'UMKM Kuliner'},
        {value: '100%', label: 'Karya Daerah'},
      ],
      details: [
        {
          label: 'Pendampingan UMKM',
          text: 'Kurasi kemasan produk oleh-oleh, narasi cerita produk, dan pemasaran digital bagi pengrajin kriya daerah.',
        },
        {
          label: 'Kawasan Danau',
          text: 'Aktivasi festival rakyat dan bakti sosial bersama komunitas nelayan tradisional di danau-danau Sumatera Barat.',
        },
        {
          label: 'Sinergi Karya',
          text: 'Menghubungkan wisatawan langsung dengan sentra tenun, sulaman, dan kuliner autentik nagari.',
        },
      ],
    },
    {
      id: 'evt-pemilihan-duta',
      status: 'published',
      category: 'KADERISASI DUTA',
      modalKicker: 'Kaderisasi Duta · Mandat Provinsi',
      title: 'Pemilihan & Pembekalan Uda Uni Sumbar',
      focusLine: 'Fokus: Kaderisasi Putra-Putri Terbaik 19 Daerah',
      cardSummary:
        'Panggung kaderisasi putra-putri terbaik Sumatera Barat yang berkarakter adat basandi syarak, cakap berkomunikasi, serta siap bertugas di ajang provinsi.',
      detailSummary:
        'Panggung kaderisasi putra-putri terbaik Sumatera Barat yang berkarakter adat basandi syarak, cakap berkomunikasi lintas bahasa, serta siap mengemban tugas duta di tingkat provinsi.',
      photo: '/assets/aistudio/IMG_8549_060e4743.jpg',
      photoAlt: 'Kawasan Jam Gadang Bukittinggi saat senja sebagai ikon pariwisata Sumatera Barat',
      metrics: [
        {value: '200+', label: 'Alumni Lintas Tahun'},
        {value: '19', label: 'Utusan Daerah'},
        {value: '6', label: 'Gelar Kehormatan'},
      ],
      details: [
        {
          label: 'Tahap Karantina',
          text: 'Pembekalan intensif wawasan adat Minangkabau, sejarah daerah, keprotokolan, dan komunikasi publik pariwisata.',
        },
        {
          label: 'Utusan Daerah',
          text: 'Menghimpun delegasi terpilih dari seluruh 19 kabupaten dan kota di Provinsi Sumatera Barat.',
        },
        {
          label: 'Penugasan Resmi',
          text: 'Finalis dan pemenang bertugas sebagai juru bicara resmi pariwisata daerah di tingkat provinsi hingga nasional.',
        },
      ],
    },
    {
      id: 'evt-geowisata-hijau',
      status: 'published',
      category: 'GEOWISATA HIJAU',
      modalKicker: 'Geowisata Hijau · Konservasi Alam',
      title: 'Eksplorasi Geowisata & Ekowisata Hijau',
      focusLine: 'Fokus: Pelestarian Bentang Karst & Geopark',
      cardSummary:
        'Kampanye pelestarian bentang alam karst, hutan lindung, dan jalur wisata pegunungan Ranah Minang berstandar pariwisata hijau berkelanjutan.',
      detailSummary:
        'Kampanye pelestarian kawasan perbukitan karst, hutan lindung, dan jalur wisata pegunungan Ranah Minang berstandar pariwisata hijau berkelanjutan.',
      photo: '/assets/aistudio/IMG_9182_8f43eb2e.jpg',
      photoAlt: 'Panorama perbukitan karst dan senja dataran tinggi Sumatera Barat',
      metrics: [
        {value: '15+', label: 'Situs Geopark'},
        {value: '30+', label: 'Jalur Ekowisata'},
        {value: '19', label: 'Sinergi Daerah'},
      ],
      details: [
        {
          label: 'Kampanye Hijau',
          text: 'Edukasi pengurangan plastik sekali pakai dan etika berkunjung pada kawasan cagar alam serta lembah karst.',
        },
        {
          label: 'Pemetaan Jalur',
          text: 'Dokumentasi jalur pendakian dan situs geopark Sumatera Barat secara informatif bagi wisatawan minat khusus.',
        },
        {
          label: 'Kolaborasi Daerah',
          text: 'Bersinergi dengan pengelola geopark dan komunitas pecinta alam di kabupaten/kota Sumatera Barat.',
        },
      ],
    },
  ];
}

function buildDefaultBoardSummary(): CmsBoardSummaryItem[] {
  return [
    {id: 'utusan-daerah', label: 'Utusan Daerah', value: '19', unit: 'Kab/Kota'},
    {id: 'bidang-kerja', label: 'Bidang Kerja', value: '4', unit: 'Divisi Aktif'},
    {id: 'masa-bakti', label: 'Masa Bakti', value: '2027', unit: ''},
  ];
}

function buildDefaultBoardMembers(): CmsBoardMember[] {
  return [
    {
      id: 'riky-pratama',
      status: 'published',
      isCore: true,
      divisionKey: 'inti',
      name: 'Uda Riky Pratama, S.T.',
      cardName: 'Uda Riky Pratama, S.T.',
      cardRolePrefix: 'Ketua Umum 2027',
      cardRoleCopy: 'Memimpin arah kebijakan strategis ikatan serta koordinasi forum daerah dan nasional.',
      role: 'Ketua Umum · Masa Bakti 2027',
      division: 'Pengurus Inti · Masa Bakti 2027',
      badge: 'Uda Utama 2024',
      cohortYear: '2024',
      origin: 'Utusan Kota Bukittinggi',
      photo: '/src/assets/images/board_uda_ketua_1794975241989.jpg',
      photoAlt: 'Uda Riky Pratama, S.T. — Ketua Umum Ikatan Uda & Uni Sumbar 2027',
      summary:
        'Memimpin arah kebijakan strategis Ikatan Uda & Uni Duta Wisata Provinsi Sumatera Barat, mengoordinasikan sinergi dengan pemerintah provinsi, dan mewakili organisasi pada forum nasional.',
      tasks: [
        'Menetapkan rencana strategis organisasi dan peta jalan promosi pariwisata tahunan 2027.',
        'Mengoordinasikan audiensi lintas lembaga bersama Dinas Pariwisata Provinsi Sumatera Barat dan mitra daerah.',
        'Memimpin delegasi resmi Uda & Uni Sumbar pada ajang duta wisata tingkat nasional.',
      ],
    },
    {
      id: 'mutiara-khairunnisa',
      status: 'published',
      isCore: true,
      divisionKey: 'inti',
      name: 'Uni Mutiara Khairunnisa, S.E.',
      cardName: 'Uni Mutiara Khairunnisa',
      cardRolePrefix: 'Wakil Ketua Umum 2027',
      cardRoleCopy: 'Mengawal tata kelola lintas bidang serta pembinaan 19 ikatan kabupaten/kota.',
      role: 'Wakil Ketua Umum · Masa Bakti 2027',
      division: 'Pengurus Inti · Masa Bakti 2027',
      badge: 'Uni Utama 2024',
      cohortYear: '2024',
      origin: 'Utusan Kota Padang',
      photo: '/src/assets/images/board_uni_wakil_1794975243590.jpg',
      photoAlt: 'Uni Mutiara Khairunnisa, S.E. — Wakil Ketua Umum Ikatan Uda & Uni Sumbar 2027',
      summary:
        'Mengawal tata kelola program kerja lintas bidang, pembinaan ikatan Uda & Uni di 19 kabupaten/kota, serta evaluasi dampak kegiatan tahunan.',
      tasks: [
        'Menyelaraskan agenda bidang advokasi, promosi digital, riset budaya, dan kemitraan.',
        'Mendampingi pembinaan dan standarisasi peran Uda & Uni di seluruh kabupaten/kota Sumatera Barat.',
        'Melakukan evaluasi berkala capaian indikator keberhasilan program kerja ikatan.',
      ],
    },
    {
      id: 'aulia-rahmadani',
      status: 'published',
      isCore: true,
      divisionKey: 'inti',
      name: 'Uni Aulia Rahmadani, S.I.Kom.',
      cardName: 'Uni Aulia Rahmadani',
      cardRolePrefix: 'Sekretaris Umum 2027',
      cardRoleCopy: 'Mengelola kesekretariatan, direktori alumni 19 daerah, dan dokumentasi resmi.',
      role: 'Sekretaris Umum · Masa Bakti 2027',
      division: 'Pengurus Inti · Masa Bakti 2027',
      badge: 'Uni Utama 2023',
      cohortYear: '2023',
      origin: 'Utusan Kota Padang Panjang',
      photo: '/src/assets/images/board_uni_budaya_1794975244190.jpg',
      photoAlt: 'Uni Aulia Rahmadani, S.I.Kom. — Sekretaris Umum Ikatan Uda & Uni Sumbar 2027',
      summary:
        'Mengelola administrasi kesekretariatan, pemutakhiran basis data alumni lintas angkatan, dokumentasi resmi, serta korespondensi kelembagaan.',
      tasks: [
        'Menyusun notulensi rapat pengurus inti, surat-menyurat resmi, dan arsip keputusan organisasi.',
        'Memelihara direktori keanggotaan aktif Uda & Uni Duta Wisata di 19 kabupaten/kota.',
        'Mengatur jadwal tugas keprotokolan dan penugasan resmi duta di tingkat provinsi.',
      ],
    },
    {
      id: 'fikri-ramadhan',
      status: 'published',
      isCore: true,
      divisionKey: 'inti',
      name: 'Uda Fikri Ramadhan, S.Ak.',
      cardName: 'Uda Fikri Ramadhan, S.Ak.',
      cardRolePrefix: 'Bendahara Umum 2027',
      cardRoleCopy: 'Mengawal perencanaan anggaran dan tata kelola pendanaan program secara akuntabel.',
      role: 'Bendahara Umum · Masa Bakti 2027',
      division: 'Pengurus Inti · Masa Bakti 2027',
      badge: 'Uda Utama 2024',
      cohortYear: '2024',
      origin: 'Utusan Kab. Tanah Datar',
      photo: '/src/assets/images/board_uda_koor_1794975243438.jpg',
      photoAlt: 'Uda Fikri Ramadhan, S.Ak. — Bendahara Umum Ikatan Uda & Uni Sumbar 2027',
      summary:
        'Bertanggung jawab atas perencanaan anggaran, tata kelola keuangan organisasi yang transparan dan akuntabel, serta pelaporan pendanaan program kerja.',
      tasks: [
        'Menyusun Rencana Anggaran Biaya tahunan seluruh bidang kerja periode 2027.',
        'Mengelola pencatatan kas, dukungan sponsor kemitraan, dan audit internal berkala.',
        'Menyajikan laporan pertanggungjawaban keuangan setiap akhir triwulan.',
      ],
    },
    {
      id: 'farhan-maulana',
      status: 'published',
      isCore: false,
      divisionKey: 'budaya',
      name: 'Uda Farhan Maulana, S.H.',
      cardName: 'Uda Farhan Maulana, S.H.',
      cardRolePrefix: 'Koord. Advokasi & Budaya',
      cardRoleCopy: 'Menggerakkan edukasi sadar wisata, pelestarian cagar budaya, dan Pokdarwis.',
      role: 'Koordinator Advokasi & Budaya · 2027',
      division: 'Bidang Advokasi & Budaya · 2027',
      badge: 'Uda Utama 2023',
      cohortYear: '2023',
      origin: 'Utusan Kota Padang',
      photo: '/src/assets/images/board_uda_ketua_1794975241989.jpg',
      photoAlt: 'Uda Farhan Maulana, S.H. — Koordinator Advokasi & Budaya 2027',
      summary:
        'Menggerakkan edukasi sadar wisata, pelestarian cagar budaya, serta pembinaan Kelompok Sadar Wisata (Pokdarwis) dan generasi muda sadar adat di nagari.',
      tasks: [
        'Menyelenggarakan lokakarya Sapta Pesona bagi pengelola desa wisata di berbagai nagari.',
        'Mengawal kampanye pelestarian situs cagar budaya dan warisan sejarah Ranah Minang.',
        'Mendorong lahirnya inisiatif ekowisata berkelanjutan berbasis komunitas lokal.',
      ],
    },
    {
      id: 'zahra-nabila',
      status: 'published',
      isCore: false,
      divisionKey: 'budaya',
      name: 'Uni Zahra Nabila Putri, S.Hum.',
      cardName: 'Uni Zahra Nabila Putri',
      cardRolePrefix: 'Koord. Riset & Kurasi Adat',
      cardRoleCopy: 'Menyusun kurasi busana adat, sejarah nagari, dan standar pengetahuan budaya.',
      role: 'Koordinator Riset & Kurasi Adat · 2027',
      division: 'Bidang Advokasi & Budaya · 2027',
      badge: 'Uni Utama 2024',
      cohortYear: '2024',
      origin: 'Utusan Kab. Agam',
      photo: '/src/assets/images/board_uni_budaya_1794975244190.jpg',
      photoAlt: 'Uni Zahra Nabila Putri, S.Hum. — Koordinator Riset & Kurasi Adat 2027',
      summary:
        'Menyusun materi kurasi busana adat, dokumentasi sejarah nagari, serta standar pengetahuan kebudayaan Minangkabau untuk pembekalan duta wisata.',
      tasks: [
        'Menyusun modul pengetahuan adat basandi syarak, sastra lisan, dan tata busana Minangkabau.',
        'Melakukan verifikasi narasi budaya untuk setiap materi publikasi resmi ikatan.',
        'Menjadi narasumber pembekalan finalis Uda & Uni kabupaten/kota dan provinsi.',
      ],
    },
    {
      id: 'hafiz-alfaruq',
      status: 'published',
      isCore: false,
      divisionKey: 'promosi',
      name: 'Uda Hafiz Al-Faruq, S.Kom.',
      cardName: 'Uda Hafiz Al-Faruq, S.Kom.',
      cardRolePrefix: 'Koord. Promosi & Media',
      cardRoleCopy: 'Mengelola kampanye digital destinasi Sumatera Barat serta arsip direktori resmi.',
      role: 'Koordinator Promosi & Media Digital · 2027',
      division: 'Bidang Promosi & Media · 2027',
      badge: 'Uda Utama 2022',
      cohortYear: '2022',
      origin: 'Utusan Kota Payakumbuh',
      photo: '/src/assets/images/board_uda_koor_1794975243438.jpg',
      photoAlt: 'Uda Hafiz Al-Faruq, S.Kom. — Koordinator Promosi & Media Digital 2027',
      summary:
        'Mengelola kampanye digital destinasi Sumatera Barat, produksi konten dokumenter wisata, dan pengembangan arsip direktori resmi ikatan.',
      tasks: [
        'Memproduksi seri dokumenter visual destinasi unggulan di 19 kabupaten/kota.',
        'Mengembangkan kanal digital dan katalog resmi alumni Uda & Uni Sumbar.',
        'Mengelola strategi komunikasi media sosial untuk menjangkau wisatawan muda.',
      ],
    },
    {
      id: 'nabila-syafitri',
      status: 'published',
      isCore: false,
      divisionKey: 'promosi',
      name: 'Uni Nabila Syafitri, S.Par.',
      cardName: 'Uni Nabila Syafitri, S.Par.',
      cardRolePrefix: 'Koord. Diplomasi & Publikasi',
      cardRoleCopy: 'Mengawal keprotokolan tugas duta serta misi budaya antarprovinsi dan global.',
      role: 'Koordinator Diplomasi & Publikasi · 2027',
      division: 'Bidang Promosi & Media · 2027',
      badge: 'Uni Utama 2022',
      cohortYear: '2022',
      origin: 'Utusan Kab. Pesisir Selatan',
      photo: '/src/assets/images/board_uni_wakil_1794975243590.jpg',
      photoAlt: 'Uni Nabila Syafitri, S.Par. — Koordinator Diplomasi & Publikasi 2027',
      summary:
        'Mengoordinasikan keprotokolan tugas duta wisata, juru bicara agenda promosi antarprovinsi, dan delegasi misi budaya mancanegara.',
      tasks: [
        'Menjadi penghubung resmi misi promosi pariwisata bersama pemangku kepentingan nasional & global.',
        'Mengatur standar keprotokolan dan tata wicara duta pada ajang resmi kepariwisataan.',
        'Mengawal publikasi siaran pers dan kemitraan media nasional maupun internasional.',
      ],
    },
    {
      id: 'salsabila-azzahra',
      status: 'published',
      isCore: false,
      divisionKey: 'kemitraan',
      name: 'Uni Salsabila Azzahra, S.Sos.',
      cardName: 'Uni Salsabila Azzahra',
      cardRolePrefix: 'Koord. Kemitraan & Sosial',
      cardRoleCopy: 'Bermitra dengan pengrajin kriya tenun serta menggerakkan aksi sosial daerah.',
      role: 'Koordinator Kemitraan & Sosial · 2027',
      division: 'Bidang Kemitraan & Sosial · 2027',
      badge: 'Uni Utama 2021',
      cohortYear: '2021',
      origin: 'Utusan Kota Pariaman',
      photo: '/src/assets/images/board_uni_promosi_1794975242886.jpg',
      photoAlt: 'Uni Salsabila Azzahra, S.Sos. — Koordinator Kemitraan & Sosial 2027',
      summary:
        'Menjalin kemitraan bersama pengrajin kriya tenun dan UMKM kuliner serta menggerakkan program bakti sosial dan aksi tanggap bencana daerah.',
      tasks: [
        'Memfasilitasi pameran kriya tenun songket, sulaman tradisional, dan UMKM ekonomi kreatif nagari.',
        'Menggerakkan relawan alumni untuk aksi kemanusiaan dan tanggap darurat bencana di Sumatera Barat.',
        'Membangun kolaborasi program tanggung jawab sosial bersama mitra swasta dan komunitas.',
      ],
    },
  ];
}

function buildDefaultVisiMisi(): CmsVisiMisiData {
  return {
    eyebrow: 'Visi & Misi · Ikatan Uda & Uni Sumbar',
    visiMutedTitle: 'Ikatan Uda & Uni',
    chips: [
      'Adat Basandi Syarak',
      '19 Kabupaten & Kota',
      'Promosi Berbudaya',
      'Ekonomi Kreatif',
      'Mandat 2020–2027',
    ],
    visiQuoteLead:
      'Terwujudnya Ikatan Uda dan Uni Duta Wisata Sumatera Barat yang berintegritas adat, progresif dalam karya,',
    visiQuoteMuted:
      'serta menjadi garda terdepan promosi pariwisata berbudaya dan berkelanjutan di tingkat nasional maupun global.',
    visiDesc:
      'Menghimpun duta terpilih dari 19 kabupaten dan kota lintas angkatan dalam memuliakan budaya Minangkabau dan menggerakkan ekonomi kreatif nagari.',
    misiMutedTitle: 'Empat Pilar Strategis',
    misiItems: [
      {
        indexLabel: '01 · Adat & Budaya',
        title: 'Pelestarian Adat & Identitas Minangkabau',
        description:
          'Merawat nilai adat, seni pertunjukan, kuliner otentik, dan wastra tenun songket daerah bagi generasi muda.',
      },
      {
        indexLabel: '02 · Diplomasi',
        title: 'Promosi Destinasi & Diplomasi Wisata',
        description:
          'Menghadirkan narasi pariwisata Sumatera Barat yang berkelas melalui kanal digital, forum budaya, dan pameran.',
      },
      {
        indexLabel: '03 · Nagari',
        title: 'Advokasi Desa Wisata & Pokdarwis',
        description:
          'Mendampingi pengelola destinasi nagari di 19 kabupaten dan kota menuju wisata ramah lingkungan.',
      },
      {
        indexLabel: '04 · Kaderisasi',
        title: 'Kaderisasi & Kolaborasi Lintas Angkatan',
        description:
          'Membangun sinergi aktif pengurus, alumni, pemerintah daerah, dan pelaku ekonomi kreatif Sumatera Barat.',
      },
    ],
    sebaranItems: [
      {
        indexLabel: 'Darek · Luhak Nan Tigo',
        title: 'Agam, Tanah Datar, Lima Puluh Kota, Bukittinggi & Payakumbuh',
        description:
          'Menguatkan literasi sejarah tambo, cagar budaya istana dan ngarai, serta kurasi wisata budaya dataran tinggi.',
      },
      {
        indexLabel: 'Pasisia · Kawasan Maritim',
        title: 'Padang, Pariaman, Pesisir Selatan & Kepulauan Mentawai',
        description:
          'Mendorong ekowisata bahari berkelanjutan, festival tradisi Tabuik, serta konservasi ekosistem pesisir.',
      },
      {
        indexLabel: 'Selatan & Tambang Warisan',
        title: 'Sawahlunto, Kota Solok, Kab. Solok, Solok Selatan & Sijunjung',
        description:
          'Mengangkat warisan tambang UNESCO, kawasan Seribu Rumah Gadang, geowisata, dan perkampungan adat.',
      },
      {
        indexLabel: 'Utara & Lintas Timur',
        title: 'Padang Panjang, Padang Pariaman, Pasaman, Pasaman Barat & Dharmasraya',
        description:
          'Memperluas jejaring sadar wisata lintas kabupaten lewat pembinaan Pokdarwis muda dan ekonomi kreatif.',
      },
    ],
    komitmenItems: [
      {
        indexLabel: 'Pilar 01 · Integritas Adat',
        title: 'Sopan Santun, Aman, Tertib & Ramah',
        description:
          'Menjadikan kearifan lokal Minangkabau sebagai standar keramahtamahan duta wisata dalam menyambut wisatawan.',
      },
      {
        indexLabel: 'Pilar 02 · Daya Tarik Alami',
        title: 'Bersih, Sejuk, Indah & Berkelanjutan',
        description:
          'Mengampanyekan pariwisata hijau di seluruh destinasi unggulan, danau vulkanik, hingga pesisir Sumatera Barat.',
      },
      {
        indexLabel: 'Pilar 03 · Kenangan Bermakna',
        title: 'Ekonomi Kreatif, Kriya & Wastra Lokal',
        description:
          'Menghubungkan wisatawan dengan pengrajin tenun songket, sulaman tradisional, dan UMKM kuliner autentik.',
      },
    ],
    sealLabel: 'Mandat Resmi 2020–2027',
  };
}

const CMS_SCHEMA_VERSION = 7;

export function createDefaultCmsState(): CmsState {
  return {
    version: CMS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    catalogYears: buildDefaultCatalogYears(),
    events: buildDefaultEvents(),
    boardSummary: buildDefaultBoardSummary(),
    boardMembers: buildDefaultBoardMembers(),
    visimisi: buildDefaultVisiMisi(),
    activityLog: [
      {
        id: 'log-seed-init',
        timestamp: new Date().toISOString(),
        operator: 'Sistem Bawaan',
        module: 'Sistem',
        action: 'Inisialisasi Data',
        summary: 'Data portal dimuat dalam mode penyimpanan lokal (termasuk profil resmi finalis 2024 dan 2022).',
      },
    ],
  };
}

const CMS_STORAGE_KEY = 'uda-uni:cms-state:v1';
const ADMIN_AUTH_KEY = 'uda-uni:cms-auth:v1';
const ADMIN_SESSION_KEY = 'uda-uni:admin-session:v1';
const DEFAULT_PASSCODE_SALT = 'uda-uni-sumbar-2027';
const DEFAULT_PASSCODE = 'sumbar2027';
const IDB_NAME = 'uda-uni-cms-db';
const IDB_STORE = 'media';

const resolvedMediaUrls = new Map<string, string>();
const listeners = new Set<(state: CmsState) => void>();

let cachedState: CmsState | null = null;
let idbPromise: Promise<IDBDatabase | null> | null = null;

function cloneJson<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

function mergeCatalogDefaults(savedYears: YearLineup[] | undefined, defaults: YearLineup[]): YearLineup[] {
  if (!Array.isArray(savedYears) || savedYears.length === 0) return defaults;
  return savedYears
    .filter((y) => y && typeof y.year === 'string' && Array.isArray(y.uda) && Array.isArray(y.uni))
    .map((y) => ({
      year: y.year,
      status: (y.status === 'draft' ? 'draft' : 'published') as PublishStatus,
      uda: y.uda.map((p, idx) => ({
        ...p,
        role: 'uda' as const,
        slotIndex: typeof p.slotIndex === 'number' ? p.slotIndex : idx,
      })),
      uni: y.uni.map((p, idx) => ({
        ...p,
        role: 'uni' as const,
        slotIndex: typeof p.slotIndex === 'number' ? p.slotIndex : idx,
      })),
    }))
    .sort((a, b) => Number(b.year) - Number(a.year));
}

export function loadCmsState(): CmsState {
  if (cachedState) return cachedState;
  const defaults = createDefaultCmsState();
  try {
    const raw = window.localStorage.getItem(CMS_STORAGE_KEY);
    if (!raw) {
      cachedState = defaults;
      return cachedState;
    }
    const parsed = JSON.parse(raw) as Partial<CmsState>;
    if (!parsed || typeof parsed !== 'object') {
      cachedState = defaults;
      return cachedState;
    }

    let catalogYears = mergeCatalogDefaults(parsed.catalogYears, defaults.catalogYears);
    const savedVersion = typeof parsed.version === 'number' ? parsed.version : 1;
    let migrated = false;

    if (savedVersion < 2) {
      const official2024 = defaults.catalogYears.find((y) => y.year === '2024');
      if (official2024) {
        const without2024 = catalogYears.filter((y) => y.year !== '2024');
        catalogYears = [...without2024, official2024].sort((a, b) => Number(b.year) - Number(a.year));
        migrated = true;
      }
    }
    if (savedVersion < 3) {
      const year2024 = catalogYears.find((y) => y.year === '2024');
      if (year2024) {
        for (const p of [...year2024.uda, ...year2024.uni]) {
          if (!p.photo || p.photo.thumb.includes('silhouette-')) {
            const cohortPhoto = getCohortPhoto('2024', p.role, p.region);
            if (cohortPhoto) {
              p.photo = cohortPhoto;
              migrated = true;
            }
          }
        }
      }
    }
    if (savedVersion < 4) {
      const official2022 = defaults.catalogYears.find((y) => y.year === '2022');
      if (official2022) {
        const without2022 = catalogYears.filter((y) => y.year !== '2022');
        catalogYears = [...without2022, official2022].sort((a, b) => Number(b.year) - Number(a.year));
        migrated = true;
      }
    }
    if (savedVersion < 5) {
      for (const yearLineup of catalogYears) {
        for (const p of [...yearLineup.uda, ...yearLineup.uni]) {
          const prevFull = p.fullName;
          const nextFull = formatParticipantNameWithHonorific(p.fullName, p.role, p.region);
          const nextShort = formatParticipantNameWithHonorific(p.shortName || p.fullName, p.role, p.region);
          if (nextFull !== p.fullName || nextShort !== p.shortName) {
            if (prevFull && p.bio?.startsWith(prevFull)) {
              p.bio = nextFull + p.bio.slice(prevFull.length);
            }
            p.fullName = nextFull;
            p.shortName = nextShort;
            migrated = true;
          }
        }
      }
    }
    if (savedVersion < 6) {
      const year2024 = catalogYears.find((y) => y.year === '2024');
      if (year2024) {
        for (const p of [...year2024.uda, ...year2024.uni]) {
          const cohortPhoto = getCohortPhoto('2024', p.role, p.region);
          if (cohortPhoto) {
            p.photo = cohortPhoto;
            migrated = true;
          }
        }
      }
    }
    if (savedVersion < 7) {
      const filtered = catalogYears.filter((y) => y.year !== '2025' && y.year !== '2026');
      if (filtered.length !== catalogYears.length) {
        catalogYears = filtered.length > 0 ? filtered : defaults.catalogYears;
        migrated = true;
      }
    }

    cachedState = {
      version: CMS_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : defaults.updatedAt,
      catalogYears,
      events:
        Array.isArray(parsed.events) && parsed.events.length > 0
          ? parsed.events
          : defaults.events,
      boardSummary:
        Array.isArray(parsed.boardSummary) && parsed.boardSummary.length > 0
          ? parsed.boardSummary
          : defaults.boardSummary,
      boardMembers:
        Array.isArray(parsed.boardMembers) && parsed.boardMembers.length > 0
          ? parsed.boardMembers
          : defaults.boardMembers,
      visimisi:
        parsed.visimisi && typeof parsed.visimisi === 'object'
          ? {...defaults.visimisi, ...parsed.visimisi}
          : defaults.visimisi,
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog.slice(0, 80) : defaults.activityLog,
    };

    if (migrated) {
      try {
        window.localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(cachedState));
      } catch {
        // ignore quota error during migration
      }
    }

    return cachedState;
  } catch {
    cachedState = defaults;
    return cachedState;
  }
}

export function getCmsState(): CmsState {
  return loadCmsState();
}

export function subscribeCmsChange(listener: (state: CmsState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyCmsChange(state: CmsState): void {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      // ignore subscriber render error
    }
  });
}

export function saveCmsState(
  next: CmsState,
  logInfo?: {
    operator?: string;
    module: CmsActivityEntry['module'];
    action: string;
    summary: string;
  },
): CmsState {
  const updated: CmsState = cloneJson(next);
  updated.version = CMS_SCHEMA_VERSION;
  updated.updatedAt = new Date().toISOString();

  if (logInfo) {
    const entry: CmsActivityEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: updated.updatedAt,
      operator: logInfo.operator?.trim() || getAdminSession()?.operatorName || 'Admin Lokal',
      module: logInfo.module,
      action: logInfo.action,
      summary: logInfo.summary,
    };
    updated.activityLog = [entry, ...(updated.activityLog || [])].slice(0, 80);
  }

  cachedState = updated;
  try {
    window.localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // quota fallback — still keep updated in-memory
  }
  notifyCmsChange(updated);
  return updated;
}

export function getPublishedCatalogYears(): YearLineup[] {
  const state = loadCmsState();
  const published = state.catalogYears.filter((y) => y.status !== 'draft');
  return published.length > 0 ? published : state.catalogYears;
}

export function getPublishedEvents(): CmsEventItem[] {
  const state = loadCmsState();
  const published = state.events.filter((e) => e.status !== 'draft');
  return published.length > 0 ? published : state.events;
}

export function getPublishedBoardMembers(): CmsBoardMember[] {
  const state = loadCmsState();
  const published = state.boardMembers.filter((m) => m.status !== 'draft');
  return published.length > 0 ? published : state.boardMembers;
}

export function createTemplateYearLineup(yearStr: string, status: PublishStatus = 'published'): YearLineup {
  const buildSlots = (role: RoleFilter): AmbassadorBio[] =>
    SUMBAR_REGIONS.map((region, idx) => {
      const prefix = role === 'uda' ? 'Uda' : 'Uni';
      const honorific = getRegionalHonorific(role, region);
      const rank = RANK_LABELS[idx] ?? 'Utusan';
      const rankLabel = idx === 0 ? `${prefix} Utama` : `${prefix} ${rank}`;
      const shortName = `${honorific} Utusan ${region.replace(/^(Kota|Kab\.)\s+/, '')}`;
      return {
        role,
        slotIndex: idx,
        rankLabel,
        fullName: shortName,
        shortName,
        titleBadge: `${rankLabel} Duta Wisata Sumbar ${yearStr}`,
        region,
        education: 'Sarjana — Perguruan Tinggi',
        profession: `${rankLabel} Sumatera Barat ${yearStr} · Duta Wisata ${region}`,
        bio: `Delegasi resmi ${region} pada Pemilihan Uda & Uni Duta Wisata Provinsi Sumatera Barat angkatan ${yearStr}.`,
        advocacy: `Promosi destinasi wisata unggulan dan pelestarian budaya di ${region}.`,
        achievement: `${rankLabel} Duta Wisata Sumatera Barat ${yearStr} · Utusan ${region}`,
      };
    });

  return {
    year: yearStr,
    status,
    uda: buildSlots('uda'),
    uni: buildSlots('uni'),
  };
}

export function createEmptyEvent(): CmsEventItem {
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    id: `evt-${Date.now()}-${suffix}`,
    status: 'draft',
    category: 'PROGRAM BARU',
    modalKicker: 'Program Kerja · Ikatan Uda & Uni',
    title: 'Program & Kegiatan Unggulan Baru',
    focusLine: 'Fokus: Promosi Wisata & Pemberdayaan Masyarakat',
    cardSummary: 'Deskripsi singkat agenda program unggulan yang tampil pada kartu depan.',
    detailSummary: 'Uraian lengkap agenda program kerja dan pelibatan duta wisata Sumatera Barat.',
    photo: '/assets/aistudio/IMG_0178_0bfa93da.jpg',
    photoAlt: 'Dokumentasi kegiatan Ikatan Uda & Uni Sumatera Barat',
    metrics: [
      {value: '19', label: 'Kabupaten & Kota'},
      {value: '10+', label: 'Mitra Lokal'},
      {value: '100%', label: 'Kolaborasi'},
    ],
    details: [
      {label: 'Pelaksanaan', text: 'Detail pelaksanaan kegiatan di lapangan.'},
      {label: 'Cakupan Wilayah', text: 'Lingkup daerah sasaran dan pemangku kepentingan.'},
      {label: 'Fokus Utama', text: 'Luaran utama bagi pariwisata dan budaya Sumatera Barat.'},
    ],
  };
}

export function createEmptyBoardMember(): CmsBoardMember {
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    id: `pengurus-${Date.now()}-${suffix}`,
    status: 'draft',
    isCore: false,
    divisionKey: 'budaya',
    name: 'Uda / Uni Nama Lengkap, S.Par.',
    cardName: 'Uda / Uni Nama Lengkap',
    cardRolePrefix: 'Koordinator Bidang · 2027',
    cardRoleCopy: 'Mengawal mandat program kerja bidang dan sinergi antar daerah.',
    role: 'Koordinator Bidang · Masa Bakti 2027',
    division: 'Bidang Advokasi & Budaya · 2027',
    badge: 'Uda / Uni Utama',
    cohortYear: '2024',
    origin: 'Utusan Kota Padang',
    photo: '/src/assets/images/board_uda_koor_1794975243438.jpg',
    photoAlt: 'Foto profil pengurus Ikatan Uda & Uni 2027',
    summary:
      'Ringkasan peran strategis dan tanggung jawab pengurus pada struktur Ikatan Uda & Uni Duta Wisata Provinsi Sumatera Barat masa bakti 2027.',
    tasks: [
      'Menyusun rencana kerja tahunan sesuai mandat bidang kerja.',
      'Mengoordinasikan pelaksanaan program lintas kabupaten/kota.',
      'Melaporkan capaian program secara berkala kepada pengurus inti.',
    ],
  };
}

export function resetCmsModule(
  module: 'catalog' | 'events' | 'board' | 'visimisi' | 'all',
  operatorName?: string,
): CmsState {
  const defaults = createDefaultCmsState();
  const current = cloneJson(loadCmsState());

  if (module === 'catalog') {
    current.catalogYears = defaults.catalogYears;
    return saveCmsState(current, {
      operator: operatorName,
      module: 'Katalog',
      action: 'Reset Modul',
      summary: 'Mengembalikan data Katalog Uda & Uni ke data bawaan awal.',
    });
  }
  if (module === 'events') {
    current.events = defaults.events;
    return saveCmsState(current, {
      operator: operatorName,
      module: 'Event',
      action: 'Reset Modul',
      summary: 'Mengembalikan data Berita dan Program Kegiatan ke data bawaan awal.',
    });
  }
  if (module === 'board') {
    current.boardSummary = defaults.boardSummary;
    current.boardMembers = defaults.boardMembers;
    return saveCmsState(current, {
      operator: operatorName,
      module: 'Pengurus',
      action: 'Reset Modul',
      summary: 'Mengembalikan struktur Kepengurusan 2027 & angka ringkasan ke data bawaan.',
    });
  }
  if (module === 'visimisi') {
    current.visimisi = defaults.visimisi;
    return saveCmsState(current, {
      operator: operatorName,
      module: 'Visi & Misi',
      action: 'Reset Modul',
      summary: 'Mengembalikan data Visi, Misi, Sebaran & Sapta Pesona ke data bawaan.',
    });
  }

  return saveCmsState(defaults, {
    operator: operatorName,
    module: 'Sistem',
    action: 'Reset Total',
    summary: 'Seluruh data portal dikembalikan ke kondisi bawaan awal.',
  });
}

export function exportCmsBackupJson(): string {
  const state = loadCmsState();
  return JSON.stringify(state, null, 2);
}

export function exportCatalogCsv(): string {
  const state = loadCmsState();
  const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const headers = [
    'Tahun',
    'StatusTahun',
    'Kelompok',
    'Urutan',
    'NoFinalis',
    'Gelar',
    'NamaLengkap',
    'NamaSingkat',
    'UtusanDaerah',
    'Umur',
    'PendidikanPekerjaan',
    'Profesi',
    'FokusAdvokasi',
    'PrestasiMandat',
    'Biografi',
    'FotoThumb',
  ];
  const rows: string[] = [headers.join(',')];
  for (const yearLineup of state.catalogYears) {
    for (const person of [...yearLineup.uda, ...yearLineup.uni]) {
      const prestasiText =
        Array.isArray(person.achievements) && person.achievements.length > 0
          ? person.achievements.join(' | ')
          : person.achievement;
      rows.push(
        [
          yearLineup.year,
          yearLineup.status,
          person.role === 'uda' ? 'Uda' : 'Uni',
          String(person.slotIndex + 1),
          person.finalistNumber ?? '',
          person.rankLabel,
          person.fullName,
          person.shortName,
          person.region,
          person.age ?? '',
          person.education,
          person.profession,
          person.advocacy,
          prestasiText,
          person.bio,
          person.photo?.thumb ?? '',
        ]
          .map(escapeCsv)
          .join(','),
      );
    }
  }
  return rows.join('\r\n');
}

export function importCmsBackupJson(
  jsonText: string,
  operatorName?: string,
): {ok: true; state: CmsState} | {ok: false; error: string} {
  try {
    const parsed = JSON.parse(jsonText) as Partial<CmsState>;
    if (!parsed || typeof parsed !== 'object') {
      return {ok: false, error: 'Format file JSON tidak valid.'};
    }
    const defaults = createDefaultCmsState();
    const merged: CmsState = {
      version: CMS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      catalogYears: mergeCatalogDefaults(parsed.catalogYears, defaults.catalogYears),
      events: Array.isArray(parsed.events) && parsed.events.length ? parsed.events : defaults.events,
      boardSummary:
        Array.isArray(parsed.boardSummary) && parsed.boardSummary.length
          ? parsed.boardSummary
          : defaults.boardSummary,
      boardMembers:
        Array.isArray(parsed.boardMembers) && parsed.boardMembers.length
          ? parsed.boardMembers
          : defaults.boardMembers,
      visimisi:
        parsed.visimisi && typeof parsed.visimisi === 'object'
          ? {...defaults.visimisi, ...parsed.visimisi}
          : defaults.visimisi,
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
    };
    const saved = saveCmsState(merged, {
      operator: operatorName,
      module: 'Sistem',
      action: 'Impor Backup JSON',
      summary: `Memuat cadangan JSON (${merged.catalogYears.length} tahun, ${merged.events.length} event, ${merged.boardMembers.length} pengurus).`,
    });
    return {ok: true, state: saved};
  } catch {
    return {ok: false, error: 'File JSON gagal dibaca atau strukturnya rusak.'};
  }
}

/* ============================================================================
 * IndexedDB Compressed Media Store (Firebase Storage replacement while local)
 * ============================================================================ */

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

export async function hydrateCmsMediaUrls(): Promise<void> {
  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const key = String(cursor.key);
          const blob = cursor.value as Blob;
          if (blob instanceof Blob && blob.size > 0 && !resolvedMediaUrls.has(key)) {
            resolvedMediaUrls.set(key, URL.createObjectURL(blob));
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function resolveCmsImageUrl(src: string | undefined): string {
  if (!src) return '';
  if (src.startsWith('cms-media://')) {
    return resolvedMediaUrls.get(src) ?? '/assets/placeholders/silhouette-uda.svg';
  }
  return src;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function loadBitmapOrImage(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  return new Promise((resolve, reject) => {
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(file)
        .then((bmp) => {
          resolve({
            width: bmp.width,
            height: bmp.height,
            draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
            cleanup: () => bmp.close(),
          });
        })
        .catch(() => fallbackImg());
    } else {
      fallbackImg();
    }

    function fallbackImg() {
      const obj = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
          cleanup: () => URL.revokeObjectURL(obj),
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(obj);
        reject(new Error('Gambar tidak dapat dibaca.'));
      };
      img.src = obj;
    }
  });
}

export async function saveCompressedAdminImage(
  file: File,
  preset: 'portrait' | 'landscape',
): Promise<CompressedUploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pilih file gambar (JPG, PNG, atau WebP).');
  }

  const maxW = preset === 'portrait' ? 900 : 1280;
  const maxH = preset === 'portrait' ? 1400 : 960;
  const decoded = await loadBitmapOrImage(file);

  try {
    const scale = Math.min(1, maxW / decoded.width, maxH / decoded.height);
    const outW = Math.max(1, Math.round(decoded.width * scale));
    const outH = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser tidak mendukung kompresi kanvas.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    decoded.draw(ctx, outW, outH);

    // Keep alpha channel intact with WebP; preserve lossless PNG transparency if PNG is already compact
    let mimeType = 'image/webp';
    let blob = await canvasToBlob(canvas, 'image/webp', 0.82);
    if (!blob || blob.size === 0) {
      mimeType = 'image/jpeg';
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.84);
    }

    if (!blob) {
      throw new Error('Gagal mengompresi foto.');
    }

    const mediaKey = `cms-media://img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const db = await openMediaDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(blob!, mediaKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new Error('Gagal menyimpan foto ke IndexedDB.'));
      });
    }

    const objectUrl = URL.createObjectURL(blob);
    resolvedMediaUrls.set(mediaKey, objectUrl);

    return {
      refUrl: mediaKey,
      objectUrl,
      originalBytes: file.size,
      compressedBytes: blob.size,
      width: outW,
      height: outH,
      mimeType,
    };
  } finally {
    decoded.cleanup();
  }
}

/* ============================================================================
 * Local Admin Passcode Auth (Placeholder before Firebase Auth)
 * ============================================================================ */

async function hashPasscode(passcode: string): Promise<string> {
  const input = `${DEFAULT_PASSCODE_SALT}:${passcode}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}

export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  const trimmed = passcode.trim();
  if (!trimmed) return false;
  const candidateHash = await hashPasscode(trimmed);
  try {
    const storedHash = window.localStorage.getItem(ADMIN_AUTH_KEY);
    if (!storedHash) {
      const defaultHash = await hashPasscode(DEFAULT_PASSCODE);
      window.localStorage.setItem(ADMIN_AUTH_KEY, defaultHash);
      return candidateHash === defaultHash;
    }
    return candidateHash === storedHash;
  } catch {
    return trimmed === DEFAULT_PASSCODE;
  }
}

export async function updateAdminPasscode(
  currentPasscode: string,
  newPasscode: string,
): Promise<{ok: boolean; error?: string}> {
  const validCurrent = await verifyAdminPasscode(currentPasscode);
  if (!validCurrent) {
    return {ok: false, error: 'Sandi saat ini tidak sesuai.'};
  }
  if (newPasscode.trim().length < 6) {
    return {ok: false, error: 'Sandi baru minimal 6 karakter.'};
  }
  try {
    const nextHash = await hashPasscode(newPasscode.trim());
    window.localStorage.setItem(ADMIN_AUTH_KEY, nextHash);
    return {ok: true};
  } catch {
    return {ok: false, error: 'Gagal menyimpan sandi ke penyimpanan browser.'};
  }
}

export function isUsingDefaultPasscodeHint(): boolean {
  try {
    return !window.localStorage.getItem(ADMIN_AUTH_KEY);
  } catch {
    return true;
  }
}

export function getDefaultPasscodeValue(): string {
  return DEFAULT_PASSCODE;
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    return parsed && typeof parsed.operatorName === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function setAdminSession(operatorName: string, roleLabel = 'Admin Pengelola'): AdminSession {
  const session: AdminSession = {
    operatorName: operatorName.trim() || 'Admin Sekretariat',
    roleLabel,
    loggedInAt: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
  return session;
}

export function clearAdminSession(): void {
  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
