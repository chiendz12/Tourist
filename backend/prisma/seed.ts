/**
 * Seed a complete, walkable dataset: accounts for every role, classes with groups,
 * province assignments, destinations at every approval stage, routes, priced tours,
 * public engagement, and the approval history the grading indicators feed on.
 *
 * Idempotent — every write is an upsert keyed on a fixed id, so re-running refreshes
 * the demo data instead of duplicating it.
 *
 *   npx prisma migrate dev      # the schema must be applied first
 *   npm run db:seed
 */
import {
  AgeGroup,
  ApprovalAction,
  ApprovalLevel,
  ApprovalStatus,
  CostCategory,
  DestinationCategory,
  EntityType,
  HocPhanCode,
  PrismaClient,
  Role,
  Season,
  SupplierType,
  TravelStyle,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PROVINCES, PROVINCE_BY_CODE } from './data/provinces';

const prisma = new PrismaClient();

/** One password for every seeded account except the admin — development only. */
const DEMO_PASSWORD = 'Password@123';
const ADMIN_PASSWORD = 'Admin@12345';

const uuid = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const HOCPHAN_ID = {
  HP1: uuid('b', 1),
  HP2: uuid('b', 2),
  HP3: uuid('b', 3),
};

// ── Học phần ──────────────────────────────────────────────────────
async function seedHocPhan() {
  const items = [
    { id: HOCPHAN_ID.HP1, code: HocPhanCode.HP1, name: 'Nhập môn ngành & Quản lý điểm đến', description: 'Nhập dữ liệu điểm đến theo tỉnh được phân công.' },
    { id: HOCPHAN_ID.HP2, code: HocPhanCode.HP2, name: 'Tuyến điểm du lịch', description: 'Kết nối điểm đến thành tuyến và thiết kế chương trình tour.' },
    { id: HOCPHAN_ID.HP3, code: HocPhanCode.HP3, name: 'Quản lý & Điều hành tour', description: 'Chọn nhà cung cấp, cấu hình chi phí và tính giá bán.' },
  ];
  for (const item of items) {
    await prisma.hocPhan.upsert({
      where: { code: item.code },
      update: { name: item.name, description: item.description },
      create: item,
    });
  }
}

// ── Tỉnh / thành ──────────────────────────────────────────────────
async function seedProvinces() {
  for (const province of PROVINCES) {
    await prisma.province.upsert({
      where: { code: province.code },
      update: { name: province.name, region: province.region },
      create: {
        id: province.id,
        code: province.code,
        name: province.name,
        region: province.region,
      },
    });
    // `centroid` is an Unsupported() geometry column, so it needs raw SQL.
    await prisma.$executeRaw`
      UPDATE "Province"
      SET "centroid" = ST_SetSRID(ST_MakePoint(${province.lng}::float8, ${province.lat}::float8), 4326)
      WHERE "code" = ${province.code}
    `;
  }
}

// ── Tài khoản ─────────────────────────────────────────────────────
type UserSeed = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: Role;
  password?: string;
};

const USERS = {
  admin: { id: uuid('c', 1), email: 'admin@touristmap.local', username: 'superadmin', fullName: 'Nguyễn Quản Trị', role: Role.SUPER_ADMIN, password: ADMIN_PASSWORD },
  lecturer1: { id: uuid('c', 2), email: 'gv.lan@touristmap.local', username: 'gv.lan', fullName: 'Trần Thị Lan', role: Role.LECTURER },
  lecturer2: { id: uuid('c', 3), email: 'gv.minh@touristmap.local', username: 'gv.minh', fullName: 'Phạm Văn Minh', role: Role.LECTURER },

  leader1: { id: uuid('c', 10), email: 'sv.an@touristmap.local', username: 'sv.an', fullName: 'Lê Hoàng An', role: Role.LEADER },
  leader2: { id: uuid('c', 11), email: 'sv.binh@touristmap.local', username: 'sv.binh', fullName: 'Vũ Thanh Bình', role: Role.LEADER },
  leader3: { id: uuid('c', 12), email: 'sv.chi@touristmap.local', username: 'sv.chi', fullName: 'Đỗ Ngọc Chi', role: Role.LEADER },

  student1: { id: uuid('c', 20), email: 'sv.dung@touristmap.local', username: 'sv.dung', fullName: 'Nguyễn Tiến Dũng', role: Role.STUDENT },
  student2: { id: uuid('c', 21), email: 'sv.giang@touristmap.local', username: 'sv.giang', fullName: 'Hoàng Thu Giang', role: Role.STUDENT },
  student3: { id: uuid('c', 22), email: 'sv.ha@touristmap.local', username: 'sv.ha', fullName: 'Bùi Thu Hà', role: Role.STUDENT },
  student4: { id: uuid('c', 23), email: 'sv.khoa@touristmap.local', username: 'sv.khoa', fullName: 'Đặng Anh Khoa', role: Role.STUDENT },
  student5: { id: uuid('c', 24), email: 'sv.linh@touristmap.local', username: 'sv.linh', fullName: 'Mai Khánh Linh', role: Role.STUDENT },
  student6: { id: uuid('c', 25), email: 'sv.nam@touristmap.local', username: 'sv.nam', fullName: 'Trịnh Hoài Nam', role: Role.STUDENT },

  member1: { id: uuid('c', 30), email: 'user.mai@example.com', username: 'user.mai', fullName: 'Nguyễn Thị Mai', role: Role.MEMBER },
  member2: { id: uuid('c', 31), email: 'user.phuc@example.com', username: 'user.phuc', fullName: 'Lý Hồng Phúc', role: Role.MEMBER },
  member3: { id: uuid('c', 32), email: 'user.quan@example.com', username: 'user.quan', fullName: 'Trương Minh Quân', role: Role.MEMBER },
} satisfies Record<string, UserSeed>;

async function seedUsers() {
  for (const user of Object.values(USERS) as UserSeed[]) {
    const passwordHash = await bcrypt.hash(user.password ?? DEMO_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { fullName: user.fullName, role: user.role, isActive: true },
      create: {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash,
        fullName: user.fullName,
        role: user.role,
        emailVerified: true,
      },
    });
  }
}

// ── Ghi danh học phần ─────────────────────────────────────────────
const ENROLMENTS: [string, string][] = [
  [USERS.leader1.id, HOCPHAN_ID.HP1],
  [USERS.student1.id, HOCPHAN_ID.HP1],
  [USERS.student2.id, HOCPHAN_ID.HP1],
  [USERS.leader2.id, HOCPHAN_ID.HP2],
  [USERS.student3.id, HOCPHAN_ID.HP2],
  [USERS.student4.id, HOCPHAN_ID.HP2],
  [USERS.leader3.id, HOCPHAN_ID.HP3],
  [USERS.student5.id, HOCPHAN_ID.HP3],
  [USERS.student6.id, HOCPHAN_ID.HP3],
  // A few students carry on into the next module.
  [USERS.student1.id, HOCPHAN_ID.HP2],
  [USERS.student3.id, HOCPHAN_ID.HP3],
  // Every author below owns data that the API would gate behind a học phần, so the
  // seeded state stays reproducible through the endpoints rather than only via SQL:
  // student5/student6 authored destinations (HP1) and student5 authored a route (HP2).
  [USERS.student5.id, HOCPHAN_ID.HP1],
  [USERS.student5.id, HOCPHAN_ID.HP2],
  [USERS.student6.id, HOCPHAN_ID.HP1],
];

async function seedEnrolments() {
  for (const [userId, hocPhanId] of ENROLMENTS) {
    await prisma.hocPhanEnrollment.upsert({
      where: { userId_hocPhanId: { userId, hocPhanId } },
      update: {},
      create: { userId, hocPhanId },
    });
  }
}

// ── Phân vùng địa lý (mục V) ──────────────────────────────────────
const PROVINCE_ASSIGNMENTS: [string, string][] = [
  [USERS.leader1.id, '01'], [USERS.leader1.id, '22'],
  [USERS.student1.id, '01'],
  [USERS.student2.id, '22'],
  [USERS.leader2.id, '46'], [USERS.leader2.id, '48'],
  [USERS.student3.id, '46'],
  [USERS.student4.id, '48'],
  [USERS.leader3.id, '56'], [USERS.leader3.id, '68'],
  [USERS.student5.id, '56'],
  [USERS.student6.id, '79'],
];

async function seedProvinceAssignments() {
  for (const [userId, code] of PROVINCE_ASSIGNMENTS) {
    const provinceId = PROVINCE_BY_CODE[code].id;
    await prisma.userProvince.upsert({
      where: { userId_provinceId: { userId, provinceId } },
      update: {},
      create: { userId, provinceId },
    });
  }
}

// ── Lớp học phần, nhóm, thành viên ────────────────────────────────
const CLASSES = [
  { id: uuid('d', 1), code: 'DL2601-HP1', name: 'Nhập môn ngành – K26 (Nhóm A)', hocPhanId: HOCPHAN_ID.HP1, lecturerId: USERS.lecturer1.id, provinceCode: '01' },
  { id: uuid('d', 2), code: 'DL2602-HP2', name: 'Tuyến điểm du lịch – K26', hocPhanId: HOCPHAN_ID.HP2, lecturerId: USERS.lecturer1.id, provinceCode: '48' },
  { id: uuid('d', 3), code: 'DL2603-HP3', name: 'Điều hành tour – K26', hocPhanId: HOCPHAN_ID.HP3, lecturerId: USERS.lecturer2.id, provinceCode: '56' },
];

const GROUPS = [
  { id: uuid('e', 1), classId: CLASSES[0].id, name: 'Nhóm 1 – Bắc Bộ' },
  { id: uuid('e', 2), classId: CLASSES[1].id, name: 'Nhóm 2 – Miền Trung' },
  { id: uuid('e', 3), classId: CLASSES[2].id, name: 'Nhóm 3 – Điều hành' },
];

/** The leader of each group is the ClassMember with isLeader — this is what scopes review. */
const MEMBERSHIPS = [
  { classId: CLASSES[0].id, userId: USERS.leader1.id, groupId: GROUPS[0].id, isLeader: true },
  { classId: CLASSES[0].id, userId: USERS.student1.id, groupId: GROUPS[0].id, isLeader: false },
  { classId: CLASSES[0].id, userId: USERS.student2.id, groupId: GROUPS[0].id, isLeader: false },

  { classId: CLASSES[1].id, userId: USERS.leader2.id, groupId: GROUPS[1].id, isLeader: true },
  { classId: CLASSES[1].id, userId: USERS.student3.id, groupId: GROUPS[1].id, isLeader: false },
  { classId: CLASSES[1].id, userId: USERS.student4.id, groupId: GROUPS[1].id, isLeader: false },
  { classId: CLASSES[1].id, userId: USERS.student1.id, groupId: GROUPS[1].id, isLeader: false },

  { classId: CLASSES[2].id, userId: USERS.leader3.id, groupId: GROUPS[2].id, isLeader: true },
  { classId: CLASSES[2].id, userId: USERS.student5.id, groupId: GROUPS[2].id, isLeader: false },
  { classId: CLASSES[2].id, userId: USERS.student6.id, groupId: GROUPS[2].id, isLeader: false },
  { classId: CLASSES[2].id, userId: USERS.student3.id, groupId: GROUPS[2].id, isLeader: false },
];

async function seedClasses() {
  for (const klass of CLASSES) {
    await prisma.class.upsert({
      where: { code: klass.code },
      update: { name: klass.name, lecturerId: klass.lecturerId },
      create: {
        id: klass.id,
        code: klass.code,
        name: klass.name,
        hocPhanId: klass.hocPhanId,
        lecturerId: klass.lecturerId,
        provinceId: PROVINCE_BY_CODE[klass.provinceCode].id,
        startDate: new Date('2026-09-07'),
        endDate: new Date('2026-12-18'),
      },
    });
  }
  for (const group of GROUPS) {
    await prisma.studentGroup.upsert({
      where: { id: group.id },
      update: { name: group.name },
      create: group,
    });
  }
  for (const member of MEMBERSHIPS) {
    await prisma.classMember.upsert({
      where: { classId_userId: { classId: member.classId, userId: member.userId } },
      update: { groupId: member.groupId, isLeader: member.isLeader },
      create: member,
    });
  }
}

// ── Nhà cung cấp (HP3) ────────────────────────────────────────────
const SUPPLIERS = [
  { id: uuid('f', 1), name: 'Khách sạn Mường Thanh Huế', type: SupplierType.HOTEL, phone: '0234 3936 666', address: '38 Lê Lợi, Huế', provinceId: PROVINCE_BY_CODE['46'].id, status: ApprovalStatus.PUBLISHED, rating: 4.3, createdById: USERS.student5.id },
  { id: uuid('f', 2), name: 'Nhà hàng Ngon Đà Nẵng', type: SupplierType.RESTAURANT, phone: '0236 3888 999', address: '271 Nguyễn Chí Thanh, Đà Nẵng', provinceId: PROVINCE_BY_CODE['48'].id, status: ApprovalStatus.PUBLISHED, rating: 4.1, createdById: USERS.student5.id },
  { id: uuid('f', 3), name: 'Vận chuyển Phương Trang', type: SupplierType.TRANSPORT, phone: '1900 6067', address: 'TP. Hồ Chí Minh', provinceId: PROVINCE_BY_CODE['79'].id, status: ApprovalStatus.PUBLISHED, rating: 4.0, createdById: USERS.student6.id },
  { id: uuid('f', 4), name: 'HDV Nguyễn Văn Sơn', type: SupplierType.GUIDE, phone: '0905 123 456', address: 'Đà Nẵng', provinceId: PROVINCE_BY_CODE['48'].id, status: ApprovalStatus.PUBLISHED, rating: 4.7, createdById: USERS.student6.id },
  { id: uuid('f', 5), name: 'Khách sạn Hanoi Pearl', type: SupplierType.HOTEL, phone: '024 3938 1188', address: '6 Bảo Khánh, Hà Nội', provinceId: PROVINCE_BY_CODE['01'].id, status: ApprovalStatus.PUBLISHED, rating: 4.4, createdById: USERS.leader3.id },
];

async function seedSuppliers() {
  for (const supplier of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      update: { name: supplier.name, rating: supplier.rating, provinceId: supplier.provinceId, status: supplier.status },
      create: supplier,
    });
  }
}

// ── Điểm đến (HP1) ────────────────────────────────────────────────
type DestinationSeed = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: DestinationCategory;
  address: string;
  provinceCode: string;
  lng: number;
  lat: number;
  ticketPrice: number;
  status: ApprovalStatus;
  createdById: string;
};

const DESTINATIONS: DestinationSeed[] = [
  { id: uuid('1', 1), name: 'Hồ Hoàn Kiếm', slug: 'ho-hoan-kiem', description: 'Hồ nước trung tâm phố cổ Hà Nội, gắn với truyền thuyết vua Lê trả gươm.', category: DestinationCategory.CULTURE, address: 'Hàng Trống, Hoàn Kiếm, Hà Nội', provinceCode: '01', lng: 105.8524, lat: 21.0287, ticketPrice: 0, status: ApprovalStatus.PUBLISHED, createdById: USERS.student1.id },
  { id: uuid('1', 2), name: 'Văn Miếu – Quốc Tử Giám', slug: 'van-mieu-quoc-tu-giam', description: 'Trường đại học đầu tiên của Việt Nam, xây dựng năm 1070.', category: DestinationCategory.HISTORY, address: '58 Quốc Tử Giám, Đống Đa, Hà Nội', provinceCode: '01', lng: 105.8355, lat: 21.0284, ticketPrice: 70000, status: ApprovalStatus.PUBLISHED, createdById: USERS.student1.id },
  { id: uuid('1', 3), name: 'Lăng Chủ tịch Hồ Chí Minh', slug: 'lang-chu-tich-ho-chi-minh', description: 'Công trình tưởng niệm tại Quảng trường Ba Đình.', category: DestinationCategory.HISTORY, address: 'Ba Đình, Hà Nội', provinceCode: '01', lng: 105.8347, lat: 21.0367, ticketPrice: 0, status: ApprovalStatus.PUBLISHED, createdById: USERS.student1.id },
  { id: uuid('1', 4), name: 'Chợ Đồng Xuân', slug: 'cho-dong-xuan', description: 'Chợ đầu mối lâu đời nhất Hà Nội.', category: DestinationCategory.CUISINE, address: 'Đồng Xuân, Hoàn Kiếm, Hà Nội', provinceCode: '01', lng: 105.8497, lat: 21.0382, ticketPrice: 0, status: ApprovalStatus.DRAFT, createdById: USERS.student1.id },

  { id: uuid('1', 5), name: 'Vịnh Hạ Long', slug: 'vinh-ha-long', description: 'Di sản thiên nhiên thế giới với hơn 1.600 hòn đảo đá vôi.', category: DestinationCategory.NATURE, address: 'TP. Hạ Long, Quảng Ninh', provinceCode: '22', lng: 107.0448, lat: 20.9101, ticketPrice: 290000, status: ApprovalStatus.PUBLISHED, createdById: USERS.student2.id },
  { id: uuid('1', 6), name: 'Đảo Cô Tô', slug: 'dao-co-to', description: 'Quần đảo biển xanh cát trắng phía đông bắc.', category: DestinationCategory.NATURE, address: 'Huyện Cô Tô, Quảng Ninh', provinceCode: '22', lng: 107.7667, lat: 20.9833, ticketPrice: 10000, status: ApprovalStatus.PENDING_LECTURER, createdById: USERS.student2.id },
  { id: uuid('1', 7), name: 'Chùa Ba Vàng', slug: 'chua-ba-vang', description: 'Ngôi chùa lớn trên núi Thành Đẳng.', category: DestinationCategory.RELIGION, address: 'TP. Uông Bí, Quảng Ninh', provinceCode: '22', lng: 106.7692, lat: 21.0525, ticketPrice: 0, status: ApprovalStatus.REJECTED, createdById: USERS.student2.id },

  { id: uuid('1', 8), name: 'Đại Nội Huế', slug: 'dai-noi-hue', description: 'Hoàng thành triều Nguyễn, di sản văn hoá thế giới.', category: DestinationCategory.HISTORY, address: 'Phú Hậu, TP. Huế', provinceCode: '46', lng: 107.5776, lat: 16.4698, ticketPrice: 200000, status: ApprovalStatus.PUBLISHED, createdById: USERS.student3.id },
  { id: uuid('1', 9), name: 'Chùa Thiên Mụ', slug: 'chua-thien-mu', description: 'Ngôi chùa cổ bên bờ sông Hương, biểu tượng của Huế.', category: DestinationCategory.RELIGION, address: 'Hương Long, TP. Huế', provinceCode: '46', lng: 107.5450, lat: 16.4536, ticketPrice: 0, status: ApprovalStatus.PUBLISHED, createdById: USERS.student3.id },
  { id: uuid('1', 10), name: 'Lăng Khải Định', slug: 'lang-khai-dinh', description: 'Lăng mộ pha trộn kiến trúc Đông – Tây.', category: DestinationCategory.HISTORY, address: 'Thủy Bằng, TP. Huế', provinceCode: '46', lng: 107.5776, lat: 16.3997, ticketPrice: 150000, status: ApprovalStatus.DRAFT, createdById: USERS.student3.id },

  { id: uuid('1', 11), name: 'Cầu Rồng', slug: 'cau-rong', description: 'Cây cầu biểu tượng phun lửa và nước vào cuối tuần.', category: DestinationCategory.ENTERTAINMENT, address: 'Hải Châu, Đà Nẵng', provinceCode: '48', lng: 108.2270, lat: 16.0614, ticketPrice: 0, status: ApprovalStatus.PUBLISHED, createdById: USERS.student4.id },
  { id: uuid('1', 12), name: 'Bà Nà Hills', slug: 'ba-na-hills', description: 'Khu du lịch trên núi với Cầu Vàng nổi tiếng.', category: DestinationCategory.ENTERTAINMENT, address: 'Hòa Vang, Đà Nẵng', provinceCode: '48', lng: 107.9880, lat: 15.9950, ticketPrice: 900000, status: ApprovalStatus.PUBLISHED, createdById: USERS.student4.id },
  { id: uuid('1', 13), name: 'Ngũ Hành Sơn', slug: 'ngu-hanh-son', description: 'Cụm núi đá vôi với hệ thống hang động và chùa chiền.', category: DestinationCategory.NATURE, address: 'Ngũ Hành Sơn, Đà Nẵng', provinceCode: '48', lng: 108.2620, lat: 16.0028, ticketPrice: 40000, status: ApprovalStatus.PENDING_LEADER, createdById: USERS.student4.id },

  { id: uuid('1', 14), name: 'Vinpearl Nha Trang', slug: 'vinpearl-nha-trang', description: 'Khu vui chơi trên đảo Hòn Tre, có cáp treo vượt biển.', category: DestinationCategory.ENTERTAINMENT, address: 'Hòn Tre, Nha Trang, Khánh Hòa', provinceCode: '56', lng: 109.2480, lat: 12.2170, ticketPrice: 880000, status: ApprovalStatus.PUBLISHED, createdById: USERS.student5.id },
  { id: uuid('1', 15), name: 'Tháp Bà Ponagar', slug: 'thap-ba-ponagar', description: 'Quần thể đền tháp Chăm thế kỷ VIII.', category: DestinationCategory.CULTURE, address: '2 Tháng 4, Nha Trang, Khánh Hòa', provinceCode: '56', lng: 109.1955, lat: 12.2653, ticketPrice: 30000, status: ApprovalStatus.PUBLISHED, createdById: USERS.student5.id },

  { id: uuid('1', 16), name: 'Chợ Bến Thành', slug: 'cho-ben-thanh', description: 'Chợ trung tâm, biểu tượng thương mại của Sài Gòn.', category: DestinationCategory.CUISINE, address: 'Bến Thành, Quận 1, TP. HCM', provinceCode: '79', lng: 106.6981, lat: 10.7725, ticketPrice: 0, status: ApprovalStatus.PUBLISHED, createdById: USERS.student6.id },
  { id: uuid('1', 17), name: 'Dinh Độc Lập', slug: 'dinh-doc-lap', description: 'Di tích lịch sử quốc gia đặc biệt giữa trung tâm thành phố.', category: DestinationCategory.HISTORY, address: '135 Nam Kỳ Khởi Nghĩa, Quận 1, TP. HCM', provinceCode: '79', lng: 106.6957, lat: 10.7770, ticketPrice: 65000, status: ApprovalStatus.PUBLISHED, createdById: USERS.student6.id },
];

// Accurate, free-licensed representative photos resolved from Wikipedia/Wikimedia
// for each seeded destination. Re-run `scripts/fetch-destination-images.ts` to
// refresh these from the latest API responses.
const IMAGE_OVERRIDES: Record<string, string> = {
  "ho-hoan-kiem": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Hoan_Kiem_10082026.jpg/1280px-Hoan_Kiem_10082026.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "van-mieu-quoc-tu-giam": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Hanoi_location_map_%282025%29.svg/langvi-330px-Hanoi_location_map_%282025%29.svg.png?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "lang-chu-tich-ho-chi-minh": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/L%C4%83ng_B%C3%A1c_-_NKS.jpg/1280px-L%C4%83ng_B%C3%A1c_-_NKS.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "cho-dong-xuan": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Ch%E1%BB%A3_%C4%90%E1%BB%93ng_Xu%C3%A2n_-_NKS.jpg/1280px-Ch%E1%BB%A3_%C4%90%E1%BB%93ng_Xu%C3%A2n_-_NKS.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "vinh-ha-long": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/V%E1%BB%8Bnh_H%E1%BA%A1_Long_-_NKS.jpg/1280px-V%E1%BB%8Bnh_H%E1%BA%A1_Long_-_NKS.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "dao-co-to": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/%C3%82u_c%E1%BA%A3ng.jpg/1280px-%C3%82u_c%E1%BA%A3ng.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "chua-ba-vang": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Ch%C3%B9a_Ba_V%C3%A0ng.jpg/1280px-Ch%C3%B9a_Ba_V%C3%A0ng.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "dai-noi-hue": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/%C4%90%E1%BA%A1i_n%E1%BB%99i.jpg/1280px-%C4%90%E1%BA%A1i_n%E1%BB%99i.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "chua-thien-mu": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/ThienMuPagoda.jpg/1280px-ThienMuPagoda.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "lang-khai-dinh": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Khai_Dinh_tomb_Hue_%2827767136409%29.jpg/1280px-Khai_Dinh_tomb_Hue_%2827767136409%29.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "cau-rong": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Dragon_bridge_from_above.png/1280px-Dragon_bridge_from_above.png?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "ba-na-hills": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Panoramic_View.jpg/1280px-Panoramic_View.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "ngu-hanh-son": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Ngu_hanh_son_toan_canh.jpg/1280px-Ngu_hanh_son_toan_canh.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "vinpearl-nha-trang": "https://upload.wikimedia.org/wikipedia/vi/thumb/9/98/Vingroup_logo.svg/langvi-330px-Vingroup_logo.svg.png?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "thap-ba-ponagar": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Th%C3%A1p_B%C3%A0_PONAGAR_-_panoramio.jpg/1280px-Th%C3%A1p_B%C3%A0_PONAGAR_-_panoramio.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "cho-ben-thanh": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Ben_Thanh_market_2.jpg/1280px-Ben_Thanh_market_2.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "dinh-doc-lap": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Dinh_%C4%90%E1%BB%99c_L%E1%BA%ADp_v%C3%A0o_n%C3%A0m_2024.jpg/1280px-Dinh_%C4%90%E1%BB%99c_L%E1%BA%ADp_v%C3%A0o_n%C3%A0m_2024.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
  "nha-hat-lon-ha-noi": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Hanoi_Opera_House_1.jpg/1280px-Hanoi_Opera_House_1.jpg?utm_source=vi.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
};

async function seedDestinations() {
  for (const item of DESTINATIONS) {
    const provinceId = PROVINCE_BY_CODE[item.provinceCode].id;
    const override = IMAGE_OVERRIDES[item.slug];
    const images = JSON.stringify(
      override
        ? [override]
        : [`https://picsum.photos/seed/${item.slug}/800/600`],
    );
    // `location` is an Unsupported() geometry column — Prisma's query builder cannot write it.
    await prisma.$executeRaw`
      INSERT INTO "Destination"
        ("id","name","slug","description","category","address","provinceId","location","images","ticketPrice","status","createdById","createdAt","updatedAt")
      VALUES (
        ${item.id}, ${item.name}, ${item.slug}, ${item.description},
        ${item.category}::"DestinationCategory", ${item.address}, ${provinceId},
        ST_SetSRID(ST_MakePoint(${item.lng}::float8, ${item.lat}::float8), 4326),
        ${images}::jsonb, ${item.ticketPrice}::numeric,
        ${item.status}::"ApprovalStatus", ${item.createdById}, NOW(), NOW()
      )
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name", "slug" = EXCLUDED."slug", "description" = EXCLUDED."description",
        "category" = EXCLUDED."category", "address" = EXCLUDED."address",
        "provinceId" = EXCLUDED."provinceId", "location" = EXCLUDED."location",
        "images" = EXCLUDED."images", "ticketPrice" = EXCLUDED."ticketPrice",
        "status" = EXCLUDED."status", "updatedAt" = NOW()
    `;
  }
}

// ── Tuyến (HP2) ───────────────────────────────────────────────────
const ROUTES = [
  {
    id: uuid('2', 1),
    name: 'Hà Nội – Phố cổ & di tích 1 ngày',
    description: 'Tuyến đi bộ kết hợp xe điện quanh khu trung tâm Hà Nội.',
    createdById: USERS.student1.id,
    status: ApprovalStatus.PUBLISHED,
    stops: [
      { destinationId: uuid('1', 1), order: 1, stayMinutes: 60 },
      { destinationId: uuid('1', 2), order: 2, stayMinutes: 90 },
      { destinationId: uuid('1', 3), order: 3, stayMinutes: 75 },
    ],
  },
  {
    id: uuid('2', 2),
    name: 'Di sản miền Trung: Huế – Đà Nẵng',
    description: 'Tuyến 3 ngày nối hoàng thành Huế với các điểm nhấn Đà Nẵng.',
    createdById: USERS.student3.id,
    status: ApprovalStatus.PUBLISHED,
    stops: [
      { destinationId: uuid('1', 8), order: 1, stayMinutes: 150 },
      { destinationId: uuid('1', 9), order: 2, stayMinutes: 60 },
      { destinationId: uuid('1', 11), order: 3, stayMinutes: 45 },
      { destinationId: uuid('1', 12), order: 4, stayMinutes: 300 },
    ],
  },
  {
    id: uuid('2', 3),
    name: 'Nha Trang biển đảo 2 ngày',
    description: 'Bản đang chờ trưởng nhóm duyệt.',
    createdById: USERS.student5.id,
    status: ApprovalStatus.PENDING_LEADER,
    stops: [
      { destinationId: uuid('1', 14), order: 1, stayMinutes: 480 },
      { destinationId: uuid('1', 15), order: 2, stayMinutes: 60 },
    ],
  },
];

async function seedRoutes() {
  for (const route of ROUTES) {
    const { stops, ...data } = route;
    await prisma.route.upsert({
      where: { id: route.id },
      update: { name: data.name, description: data.description, status: data.status },
      create: data,
    });
    // Replace the stop list wholesale, exactly like RouteService.update does.
    await prisma.routeWaypoint.deleteMany({ where: { routeId: route.id } });
    await prisma.routeWaypoint.createMany({
      data: stops.map((stop) => ({ routeId: route.id, ...stop })),
    });
  }
  // `path` / `distanceM` / `durationS` are deliberately left empty: they come from
  // Mapbox Directions. Call POST /api/route/:id/recalculate once the API is running.
}

// ── Tour + chi phí (HP2 thiết kế, HP3 định giá) ───────────────────
const TOURS = [
  {
    id: uuid('3', 1),
    code: 'HN-CITY-1D',
    name: 'Hà Nội City Tour 1 ngày',
    description: 'Khám phá phố cổ và các di tích trung tâm Hà Nội trong một ngày.',
    routeId: uuid('2', 1),
    days: 1,
    paxCount: 20,
    basePrice: 750_000,
    status: ApprovalStatus.PUBLISHED,
    createdById: USERS.student1.id,
    targetAgeGroups: [AgeGroup.ADULT, AgeGroup.FAMILY],
    travelStyles: [TravelStyle.CULTURE, TravelStyle.CUISINE],
    seasons: [Season.ALL_YEAR],
    costs: [
      { category: CostCategory.TRANSPORT, supplierId: uuid('f', 3), unitPrice: 120_000, quantity: 1, isPerPerson: true },
      { category: CostCategory.MEAL, supplierId: null, unitPrice: 150_000, quantity: 1, isPerPerson: true },
      { category: CostCategory.TICKET, supplierId: null, unitPrice: 70_000, quantity: 1, isPerPerson: true },
      { category: CostCategory.GUIDE, supplierId: uuid('f', 4), unitPrice: 1_500_000, quantity: 1, isPerPerson: false },
    ],
  },
  {
    id: uuid('3', 2),
    code: 'HUE-DN-3D2N',
    name: 'Huế – Đà Nẵng 3 ngày 2 đêm',
    description: 'Hành trình di sản miền Trung dành cho nhóm khách gia đình.',
    routeId: uuid('2', 2),
    days: 3,
    paxCount: 15,
    basePrice: 4_950_000,
    status: ApprovalStatus.PUBLISHED,
    createdById: USERS.student3.id,
    targetAgeGroups: [AgeGroup.FAMILY, AgeGroup.SENIOR],
    travelStyles: [TravelStyle.CULTURE, TravelStyle.RELAX],
    seasons: [Season.SPRING, Season.AUTUMN],
    costs: [
      { category: CostCategory.HOTEL, supplierId: uuid('f', 1), unitPrice: 550_000, quantity: 2, isPerPerson: true },
      { category: CostCategory.MEAL, supplierId: uuid('f', 2), unitPrice: 180_000, quantity: 5, isPerPerson: true },
      { category: CostCategory.TRANSPORT, supplierId: uuid('f', 3), unitPrice: 9_000_000, quantity: 1, isPerPerson: false },
      { category: CostCategory.TICKET, supplierId: null, unitPrice: 1_100_000, quantity: 1, isPerPerson: true },
      { category: CostCategory.GUIDE, supplierId: uuid('f', 4), unitPrice: 1_800_000, quantity: 3, isPerPerson: false },
    ],
  },
  {
    // Deliberately wrong in two ways, so the HP3 indicators have something to flag:
    // costing is incomplete (no GUIDE, no TICKET) and the price is below cost —
    // 10 pax × (700k hotel + 600k meals) + 4M coach = 17M cost against 15M revenue.
    id: uuid('3', 3),
    code: 'NT-BEACH-2D',
    name: 'Nha Trang biển đảo 2 ngày',
    description: 'Bản nháp chưa tính đủ chi phí, giá bán đang thấp hơn giá vốn.',
    routeId: uuid('2', 3),
    days: 2,
    paxCount: 10,
    basePrice: 1_500_000,
    status: ApprovalStatus.DRAFT,
    createdById: USERS.student5.id,
    targetAgeGroups: [AgeGroup.TEEN, AgeGroup.ADULT],
    travelStyles: [TravelStyle.RELAX],
    seasons: [Season.SUMMER],
    costs: [
      { category: CostCategory.HOTEL, supplierId: null, unitPrice: 700_000, quantity: 1, isPerPerson: true },
      { category: CostCategory.TRANSPORT, supplierId: uuid('f', 3), unitPrice: 4_000_000, quantity: 1, isPerPerson: false },
      { category: CostCategory.MEAL, supplierId: null, unitPrice: 200_000, quantity: 3, isPerPerson: true },
    ],
  },
];

async function seedTours() {
  for (const tour of TOURS) {
    const { costs, ...data } = tour;
    await prisma.tour.upsert({
      where: { code: tour.code },
      update: {
        name: data.name,
        basePrice: data.basePrice,
        paxCount: data.paxCount,
        status: data.status,
        targetAgeGroups: { set: data.targetAgeGroups },
        travelStyles: { set: data.travelStyles },
        seasons: { set: data.seasons },
      },
      create: data,
    });
    await prisma.tourCost.deleteMany({ where: { tourId: tour.id } });
    await prisma.tourCost.createMany({
      data: costs.map((cost) => ({
        tourId: tour.id,
        status: tour.status === ApprovalStatus.PUBLISHED ? ApprovalStatus.PUBLISHED : ApprovalStatus.DRAFT,
        ...cost,
      })),
    });
  }
}

// ── Luồng duyệt + lịch sử ─────────────────────────────────────────
type FlowShape = 'PUBLISHED' | 'PENDING_LEADER' | 'PENDING_LECTURER' | 'REJECTED' | 'SENT_BACK';
type Flow = { entityType: EntityType; entityId: string; submittedById: string; shape: FlowShape };

/**
 * Approval rows carry the history the real flow would have produced, so "% được duyệt"
 * and "% bị sửa" have something meaningful to compute from on day one.
 */
const FLOWS: Flow[] = [
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 1), submittedById: USERS.student1.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 2), submittedById: USERS.student1.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 3), submittedById: USERS.student1.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 5), submittedById: USERS.student2.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 6), submittedById: USERS.student2.id, shape: 'PENDING_LECTURER' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 7), submittedById: USERS.student2.id, shape: 'REJECTED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 8), submittedById: USERS.student3.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 9), submittedById: USERS.student3.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 10), submittedById: USERS.student3.id, shape: 'SENT_BACK' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 11), submittedById: USERS.student4.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 12), submittedById: USERS.student4.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 13), submittedById: USERS.student4.id, shape: 'PENDING_LEADER' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 14), submittedById: USERS.student5.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 15), submittedById: USERS.student5.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 16), submittedById: USERS.student6.id, shape: 'PUBLISHED' },
  { entityType: EntityType.DESTINATION, entityId: uuid('1', 17), submittedById: USERS.student6.id, shape: 'PUBLISHED' },

  { entityType: EntityType.ROUTE, entityId: uuid('2', 1), submittedById: USERS.student1.id, shape: 'PUBLISHED' },
  { entityType: EntityType.ROUTE, entityId: uuid('2', 2), submittedById: USERS.student3.id, shape: 'PUBLISHED' },
  { entityType: EntityType.ROUTE, entityId: uuid('2', 3), submittedById: USERS.student5.id, shape: 'PENDING_LEADER' },

  { entityType: EntityType.TOUR, entityId: uuid('3', 1), submittedById: USERS.student1.id, shape: 'PUBLISHED' },
  { entityType: EntityType.TOUR, entityId: uuid('3', 2), submittedById: USERS.student3.id, shape: 'PUBLISHED' },
];

/** Who reviews whom, mirroring the group/class scoping the API enforces. */
const LEADER_OF: Record<string, string> = {
  [USERS.student1.id]: USERS.leader1.id,
  [USERS.student2.id]: USERS.leader1.id,
  [USERS.student3.id]: USERS.leader2.id,
  [USERS.student4.id]: USERS.leader2.id,
  [USERS.student5.id]: USERS.leader3.id,
  [USERS.student6.id]: USERS.leader3.id,
};

const LECTURER_OF: Record<string, string> = {
  [USERS.student1.id]: USERS.lecturer1.id,
  [USERS.student2.id]: USERS.lecturer1.id,
  [USERS.student3.id]: USERS.lecturer1.id,
  [USERS.student4.id]: USERS.lecturer1.id,
  [USERS.student5.id]: USERS.lecturer2.id,
  [USERS.student6.id]: USERS.lecturer2.id,
};

function historyFor(flow: Flow) {
  const leader = LEADER_OF[flow.submittedById];
  const lecturer = LECTURER_OF[flow.submittedById];
  const submit = {
    actorId: flow.submittedById,
    level: ApprovalLevel.LEADER,
    action: ApprovalAction.SUBMIT,
    comment: null as string | null,
  };

  switch (flow.shape) {
    case 'PENDING_LEADER':
      return { status: ApprovalStatus.PENDING_LEADER, currentLevel: ApprovalLevel.LEADER, history: [submit] };
    case 'PENDING_LECTURER':
      return {
        status: ApprovalStatus.PENDING_LECTURER,
        currentLevel: ApprovalLevel.LECTURER,
        history: [
          submit,
          { actorId: leader, level: ApprovalLevel.LEADER, action: ApprovalAction.APPROVE, comment: 'Dữ liệu đầy đủ, chuyển giảng viên.' },
        ],
      };
    case 'REJECTED':
      return {
        status: ApprovalStatus.REJECTED,
        currentLevel: ApprovalLevel.LEADER,
        history: [
          submit,
          { actorId: leader, level: ApprovalLevel.LEADER, action: ApprovalAction.REJECT, comment: 'Thiếu nguồn tham khảo, toạ độ chưa chính xác.' },
        ],
      };
    case 'SENT_BACK':
      return {
        status: ApprovalStatus.DRAFT,
        currentLevel: ApprovalLevel.LEADER,
        history: [
          submit,
          { actorId: leader, level: ApprovalLevel.LEADER, action: ApprovalAction.REVISE, comment: 'Bổ sung giờ mở cửa và giá vé rồi nộp lại.' },
        ],
      };
    default:
      return {
        status: ApprovalStatus.PUBLISHED,
        currentLevel: ApprovalLevel.LECTURER,
        history: [
          submit,
          { actorId: leader, level: ApprovalLevel.LEADER, action: ApprovalAction.APPROVE, comment: 'Duyệt cấp nhóm.' },
          { actorId: lecturer, level: ApprovalLevel.LECTURER, action: ApprovalAction.APPROVE, comment: 'Duyệt cấp giảng viên (publish).' },
        ],
      };
  }
}

async function seedApprovals() {
  for (const flow of FLOWS) {
    const { status, currentLevel, history } = historyFor(flow);
    const approval = await prisma.approval.upsert({
      where: { entityType_entityId: { entityType: flow.entityType, entityId: flow.entityId } },
      update: { status, currentLevel, submittedById: flow.submittedById },
      create: {
        entityType: flow.entityType,
        entityId: flow.entityId,
        submittedById: flow.submittedById,
        status,
        currentLevel,
      },
    });
    // Rebuild the trail so re-running the seed does not stack duplicates.
    await prisma.approvalHistory.deleteMany({ where: { approvalId: approval.id } });
    for (const entry of history) {
      await prisma.approvalHistory.create({ data: { approvalId: approval.id, ...entry } });
    }
  }
}

// ── Tương tác công khai: rating, comment, lộ trình đã lưu ──────────
const RATINGS = [
  { userId: USERS.member1.id, destinationId: uuid('1', 1), score: 5, review: 'Không gian đẹp, buổi sáng rất yên bình.' },
  { userId: USERS.member2.id, destinationId: uuid('1', 1), score: 4, review: 'Đông vào cuối tuần nhưng vẫn đáng đi.' },
  { userId: USERS.member3.id, destinationId: uuid('1', 2), score: 5, review: 'Rất giàu giá trị lịch sử.' },
  { userId: USERS.member1.id, destinationId: uuid('1', 5), score: 5, review: 'Cảnh quan xứng đáng là di sản thế giới.' },
  { userId: USERS.member2.id, destinationId: uuid('1', 5), score: 5, review: 'Nên đi tour ngủ đêm trên vịnh.' },
  { userId: USERS.member3.id, destinationId: uuid('1', 8), score: 4, review: 'Cần thêm biển chỉ dẫn tiếng Anh.' },
  { userId: USERS.member1.id, destinationId: uuid('1', 12), score: 3, review: 'Giá vé khá cao so với thời gian tham quan.' },
  { userId: USERS.member2.id, destinationId: uuid('1', 14), score: 4, review: 'Phù hợp cho gia đình có trẻ nhỏ.' },
  { userId: USERS.member3.id, destinationId: uuid('1', 16), score: 4, review: 'Ăn uống ngon, nên đi buổi tối.' },
];

/** Parents first — the reply references its parent by id. */
const COMMENTS = [
  { id: uuid('4', 1), userId: USERS.member1.id, destinationId: uuid('1', 1), content: 'Gửi xe ở đâu thuận tiện nhất mọi người?', parentId: null as string | null },
  { id: uuid('4', 3), userId: USERS.member3.id, destinationId: uuid('1', 5), content: 'Mùa nào đi Hạ Long đẹp nhất ạ?', parentId: null },
  { id: uuid('4', 4), userId: USERS.member1.id, destinationId: uuid('1', 8), content: 'Nên thuê hướng dẫn viên tại chỗ, thuyết minh rất hay.', parentId: null },
  { id: uuid('4', 2), userId: USERS.member2.id, destinationId: uuid('1', 1), content: 'Bạn gửi ở phố Lê Thái Tổ nhé, đi bộ ra hồ 2 phút.', parentId: uuid('4', 1) },
];

const ITINERARIES = [
  { id: uuid('5', 1), userId: USERS.member1.id, tourId: uuid('3', 1), name: 'Cuối tuần ở Hà Nội' },
  { id: uuid('5', 2), userId: USERS.member2.id, tourId: uuid('3', 1), name: 'Dẫn bố mẹ đi Hà Nội' },
  { id: uuid('5', 3), userId: USERS.member3.id, tourId: uuid('3', 1), name: 'Hà Nội 1 ngày' },
  { id: uuid('5', 4), userId: USERS.member1.id, tourId: uuid('3', 2), name: 'Nghỉ lễ miền Trung' },
  { id: uuid('5', 5), userId: USERS.member3.id, tourId: uuid('3', 2), name: 'Huế – Đà Nẵng tháng 4' },
];

async function seedEngagement() {
  for (const rating of RATINGS) {
    await prisma.rating.upsert({
      where: { userId_destinationId: { userId: rating.userId, destinationId: rating.destinationId } },
      update: { score: rating.score, review: rating.review },
      create: rating,
    });
  }
  for (const comment of COMMENTS) {
    await prisma.comment.upsert({
      where: { id: comment.id },
      update: { content: comment.content },
      create: comment,
    });
  }
  for (const itinerary of ITINERARIES) {
    await prisma.itinerary.upsert({
      where: { id: itinerary.id },
      update: { name: itinerary.name },
      create: {
        ...itinerary,
        payload: { note: 'Lộ trình lưu từ tour công khai', days: [] },
      },
    });
  }
}

// ── Trạng thái hệ thống ───────────────────────────────────────────
async function seedSystemSettings() {
  await prisma.systemSetting.upsert({
    where: { key: 'system.lock' },
    update: {},
    create: { key: 'system.lock', value: { locked: false, message: null, lockedAt: null } },
  });
}

async function main() {
  // Order matters: every step depends on the ones above it.
  await seedHocPhan();
  await seedProvinces();
  await seedUsers();
  await seedEnrolments();
  await seedProvinceAssignments();
  await seedClasses();
  await seedSuppliers();
  await seedDestinations();
  await seedRoutes();
  await seedTours();
  await seedApprovals();
  await seedEngagement();
  await seedSystemSettings();

  console.log(`
Seed completed.

  Admin       admin@touristmap.local    / ${ADMIN_PASSWORD}
  Giảng viên  gv.lan@touristmap.local   (HP1 + HP2, lớp DL2601 & DL2602)
              gv.minh@touristmap.local  (HP3, lớp DL2603)
  Leader      sv.an@touristmap.local    (Nhóm 1 – Hà Nội, Quảng Ninh)
              sv.binh@touristmap.local  (Nhóm 2 – Huế, Đà Nẵng)
              sv.chi@touristmap.local   (Nhóm 3 – Khánh Hòa, Lâm Đồng)
  Sinh viên   sv.dung · sv.giang · sv.ha · sv.khoa · sv.linh · sv.nam @touristmap.local
  Member      user.mai · user.phuc · user.quan @example.com

  Mật khẩu chung (trừ admin): ${DEMO_PASSWORD}

  ${PROVINCES.length} tỉnh · ${DESTINATIONS.length} điểm đến · ${ROUTES.length} tuyến · ${TOURS.length} tour · ${SUPPLIERS.length} nhà cung cấp · ${FLOWS.length} hồ sơ duyệt

  Tuyến chưa có hình học: gọi POST /api/route/:id/recalculate (cần MAPBOX_TOKEN)
  để Mapbox Directions sinh path / distanceM / durationS.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
