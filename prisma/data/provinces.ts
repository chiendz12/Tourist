/**
 * The 34 provincial-level units of Vietnam after the 2025 reorganisation
 * (6 centrally-governed cities + 28 provinces), effective 1 July 2025.
 *
 * This replaces the 63-province list that `ARCHITECTURE.md` still refers to; that
 * arrangement no longer matches the administrative map.
 *
 * ⚠️ Two things to verify against your institution's official list before using this
 * for "phân vùng địa lý cho SV":
 *   - `code` reuses the legacy GSO two-digit code carried over by the surviving unit.
 *     If your curriculum uses the new official codes, replace them here — everything
 *     else in the seed keys off `code`, so it is the only place that needs editing.
 *   - `merged` records which former provinces were absorbed, for the UI to explain
 *     where an old name went. It is documentation, not data the API reads.
 *
 * `centroid` is the administrative centre, precise enough to centre a map on, not a
 * true polygon centroid.
 */
export type ProvinceSeed = {
  id: string;
  code: string;
  name: string;
  region: 'North' | 'Central' | 'South';
  /** true = thành phố trực thuộc trung ương */
  isCity?: boolean;
  /** Former units absorbed in 2025; empty when the unit was left unchanged. */
  merged?: string[];
  lng: number;
  lat: number;
};

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const PROVINCES: ProvinceSeed[] = [
  // ── Bắc Bộ ──────────────────────────────────────────────────────
  { id: id(1),  code: '01', name: 'Hà Nội',            region: 'North',   isCity: true,  lng: 105.8342, lat: 21.0278 },
  { id: id(2),  code: '04', name: 'Cao Bằng',          region: 'North',   lng: 106.2522, lat: 22.6657 },
  { id: id(3),  code: '08', name: 'Tuyên Quang',       region: 'North',   merged: ['Hà Giang'], lng: 105.2280, lat: 21.8180 },
  { id: id(4),  code: '10', name: 'Lào Cai',           region: 'North',   merged: ['Yên Bái'], lng: 103.9750, lat: 22.4850 },
  { id: id(5),  code: '11', name: 'Điện Biên',         region: 'North',   lng: 103.0160, lat: 21.3860 },
  { id: id(6),  code: '12', name: 'Lai Châu',          region: 'North',   lng: 103.4700, lat: 22.3960 },
  { id: id(7),  code: '14', name: 'Sơn La',            region: 'North',   lng: 103.9190, lat: 21.3270 },
  { id: id(8),  code: '19', name: 'Thái Nguyên',       region: 'North',   merged: ['Bắc Kạn'], lng: 105.8480, lat: 21.5940 },
  { id: id(9),  code: '20', name: 'Lạng Sơn',          region: 'North',   lng: 106.7610, lat: 21.8530 },
  { id: id(10), code: '22', name: 'Quảng Ninh',        region: 'North',   lng: 107.0448, lat: 20.9101 },
  { id: id(11), code: '25', name: 'Phú Thọ',           region: 'North',   merged: ['Vĩnh Phúc', 'Hòa Bình'], lng: 105.4020, lat: 21.3230 },
  { id: id(12), code: '27', name: 'Bắc Ninh',          region: 'North',   merged: ['Bắc Giang'], lng: 106.0760, lat: 21.1860 },
  { id: id(13), code: '31', name: 'Hải Phòng',         region: 'North',   isCity: true,  merged: ['Hải Dương'], lng: 106.6822, lat: 20.8561 },
  { id: id(14), code: '33', name: 'Hưng Yên',          region: 'North',   merged: ['Thái Bình'], lng: 106.0510, lat: 20.6460 },
  { id: id(15), code: '37', name: 'Ninh Bình',         region: 'North',   merged: ['Hà Nam', 'Nam Định'], lng: 105.9750, lat: 20.2506 },

  // ── Trung Bộ ────────────────────────────────────────────────────
  { id: id(16), code: '38', name: 'Thanh Hóa',         region: 'Central', lng: 105.7780, lat: 19.8070 },
  { id: id(17), code: '40', name: 'Nghệ An',           region: 'Central', lng: 105.6813, lat: 18.6796 },
  { id: id(18), code: '42', name: 'Hà Tĩnh',           region: 'Central', lng: 105.9060, lat: 18.3560 },
  { id: id(19), code: '45', name: 'Quảng Trị',         region: 'Central', merged: ['Quảng Bình'], lng: 107.0970, lat: 16.8160 },
  { id: id(20), code: '46', name: 'Huế',               region: 'Central', isCity: true,  lng: 107.5847, lat: 16.4637 },
  { id: id(21), code: '48', name: 'Đà Nẵng',           region: 'Central', isCity: true,  merged: ['Quảng Nam'], lng: 108.2208, lat: 16.0471 },
  { id: id(22), code: '51', name: 'Quảng Ngãi',        region: 'Central', merged: ['Kon Tum'], lng: 108.8000, lat: 15.1214 },
  { id: id(23), code: '64', name: 'Gia Lai',           region: 'Central', merged: ['Bình Định'], lng: 108.0000, lat: 13.9830 },
  { id: id(24), code: '66', name: 'Đắk Lắk',           region: 'Central', merged: ['Phú Yên'], lng: 108.0500, lat: 12.6660 },
  { id: id(25), code: '56', name: 'Khánh Hòa',         region: 'Central', merged: ['Ninh Thuận'], lng: 109.1967, lat: 12.2388 },
  { id: id(26), code: '68', name: 'Lâm Đồng',          region: 'Central', merged: ['Đắk Nông', 'Bình Thuận'], lng: 108.4419, lat: 11.9404 },

  // ── Nam Bộ ──────────────────────────────────────────────────────
  { id: id(27), code: '75', name: 'Đồng Nai',          region: 'South',   merged: ['Bình Phước'], lng: 106.8240, lat: 10.9570 },
  { id: id(28), code: '72', name: 'Tây Ninh',          region: 'South',   merged: ['Long An'], lng: 106.1000, lat: 11.3100 },
  { id: id(29), code: '79', name: 'TP. Hồ Chí Minh',   region: 'South',   isCity: true,  merged: ['Bình Dương', 'Bà Rịa – Vũng Tàu'], lng: 106.7009, lat: 10.7769 },
  { id: id(30), code: '87', name: 'Đồng Tháp',         region: 'South',   merged: ['Tiền Giang'], lng: 105.6330, lat: 10.4590 },
  { id: id(31), code: '89', name: 'An Giang',          region: 'South',   merged: ['Kiên Giang'], lng: 105.4359, lat: 10.3860 },
  { id: id(32), code: '86', name: 'Vĩnh Long',         region: 'South',   merged: ['Bến Tre', 'Trà Vinh'], lng: 105.9720, lat: 10.2530 },
  { id: id(33), code: '92', name: 'Cần Thơ',           region: 'South',   isCity: true,  merged: ['Sóc Trăng', 'Hậu Giang'], lng: 105.7852, lat: 10.0341 },
  { id: id(34), code: '96', name: 'Cà Mau',            region: 'South',   merged: ['Bạc Liêu'], lng: 105.1504, lat: 9.1769 },
];

export const PROVINCE_BY_CODE = Object.fromEntries(
  PROVINCES.map((province) => [province.code, province]),
) as Record<string, ProvinceSeed>;
