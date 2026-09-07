/**
 * End-to-end check of the running API against a freshly seeded database.
 * It asserts behaviour the unit-less parts of this backend depend on: approval
 * scoping, province scoping, ownership, pricing arithmetic and the geo queries.
 *
 * `test:e2e:api` runs the isolated reset/seed/restart wrapper. This file can be
 * run directly with `test:e2e:api:raw` when a seeded API is already running.
 *
 * BASE can be overridden with API_URL.
 */
const BASE = process.env.API_URL ?? 'http://localhost:3000/api';
let pass = 0, fail = 0;
const results = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; results.push(`  PASS  ${name}`); }
  else { fail++; results.push(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`); }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json, data: json?.data };
}

async function login(email, password = 'Password@123') {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.body)}`);
  return r.data;
}

const section = (t) => results.push(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

(async () => {
  // ═══ auth ═══
  section('Auth: rotation, reuse detection, role refresh');
  const admin = await login('admin@touristmap.local', 'Admin@12345');
  const gvLan = await login('gv.lan@touristmap.local');
  const gvMinh = await login('gv.minh@touristmap.local');
  const leader1 = await login('sv.an@touristmap.local');
  const leader2 = await login('sv.binh@touristmap.local');
  const leader3 = await login('sv.chi@touristmap.local');
  const dung = await login('sv.dung@touristmap.local');   // HP1+HP2, Hà Nội
  const giang = await login('sv.giang@touristmap.local'); // HP1, Quảng Ninh
  const ha = await login('sv.ha@touristmap.local');       // HP2+HP3, Huế
  const linh = await login('sv.linh@touristmap.local');   // Khánh Hòa
  const mai = await login('user.mai@example.com');
  ok('login returns access + refresh token', !!dung.accessToken && !!dung.refreshToken);

  // Multi-device: a second login must not kill the first session.
  const dung2 = await login('sv.dung@touristmap.local');
  const stillValid = await call('GET', '/user/me', { token: dung.accessToken });
  ok('second login does not invalidate the first session', stillValid.status === 200);

  const r1 = await call('POST', '/auth/refresh', { body: { refreshToken: dung2.refreshToken } });
  ok('refresh returns a new pair', r1.status === 201 && !!r1.data?.refreshToken);
  ok('rotation issues a different refresh token', r1.data?.refreshToken !== dung2.refreshToken);

  const replay = await call('POST', '/auth/refresh', { body: { refreshToken: dung2.refreshToken } });
  ok('replaying a used refresh token is rejected', replay.status === 401, `got ${replay.status}`);

  const afterReuse = await call('POST', '/auth/refresh', { body: { refreshToken: r1.data.refreshToken } });
  ok('reuse detection revoked every session for that user', afterReuse.status === 401, `got ${afterReuse.status}`);

  // Re-login since all of sv.dung's sessions were just nuked (that is the point).
  const dungFresh = await login('sv.dung@touristmap.local');

  // ═══ nhóm 1: data leaks ═══
  section('Nhóm 1: class / hocphan no longer leak student data');
  const anonClass = await call('GET', '/class');
  ok('GET /class requires auth', anonClass.status === 401, `got ${anonClass.status}`);

  const clsAdmin = await call('GET', '/class', { token: admin.accessToken });
  const clsStudent = await call('GET', '/class', { token: dungFresh.accessToken });
  ok('admin sees every class', clsAdmin.data?.length === 3, `got ${clsAdmin.data?.length}`);
  ok('student only sees their own classes', clsStudent.data?.length === 2, `got ${clsStudent.data?.length}`);

  const lanClass = clsAdmin.data.find((c) => c.code === 'DL2601-HP1');
  const asStaff = await call('GET', `/class/${lanClass.id}`, { token: gvLan.accessToken });
  const staffHasEmail = asStaff.data?.members?.some((m) => m.user.email);
  ok('lecturer sees member emails', !!staffHasEmail);

  const targetClass = clsStudent.data.find((c) => c.code === 'DL2601-HP1');
  const asPeer = await call('GET', `/class/${targetClass.id}`, { token: dungFresh.accessToken });
  const peerHasEmail = asPeer.data?.members?.some((m) => m.user.email !== undefined);
  ok('classmate does NOT see member emails', asPeer.status === 200 && !peerHasEmail);

  const outsider = await call('GET', `/class/${clsAdmin.data.find(c => c.code === 'DL2603-HP3').id}`, { token: dungFresh.accessToken });
  ok('non-member is refused the class detail', outsider.status === 403, `got ${outsider.status}`);

  const hp = await call('GET', '/hocphan');
  ok('GET /hocphan is public but carries no roster', hp.status === 200 && !hp.data[0].enrollments);
  const hpAnon = await call('GET', `/hocphan/${hp.data[0].id}`);
  const hpStaff = await call('GET', `/hocphan/${hp.data[0].id}`, { token: gvLan.accessToken });
  ok('anonymous hocphan detail has no enrollments', !hpAnon.data?.enrollments);
  ok('staff hocphan detail has enrollments', Array.isArray(hpStaff.data?.enrollments));

  // ═══ nhóm 2: geo ═══
  section('Nhóm 2: coordinates, nearby, bbox');
  const pub = await call('GET', '/destination?limit=50');
  ok('destination list is paginated with a total', pub.data?.meta?.total === 12, `total=${pub.data?.meta?.total}`);
  ok('only published destinations are public', pub.data.data.every((d) => d.status === 'PUBLISHED'));
  const first = pub.data.data[0];
  ok('every record carries lng/lat', typeof first.lng === 'number' && typeof first.lat === 'number');
  ok('every record carries GeoJSON Point', first.location?.type === 'Point' && first.location.coordinates.length === 2);

  const nearby = await call('GET', '/destination/nearby?lng=105.8524&lat=21.0287&radius=5000');
  ok('nearby returns Hanoi centre points', nearby.data?.length === 3, `got ${nearby.data?.length}`);
  ok('nearby is sorted by distance', nearby.data[0].distanceM <= nearby.data[1].distanceM);
  ok('nearest is the query point itself (~0 m)', nearby.data[0].distanceM < 1);
  const far = await call('GET', '/destination/nearby?lng=105.8524&lat=21.0287&radius=200000');
  ok('a wider radius picks up Ha Long', far.data.some((d) => d.slug === 'vinh-ha-long'));

  const bbox = await call('GET', '/destination/bbox?minLng=105&minLat=20&maxLng=108&maxLat=22');
  ok('bbox returns the northern viewport only', bbox.data?.length === 4, `got ${bbox.data?.length}`);
  const badBbox = await call('GET', '/destination/bbox?minLng=108&minLat=20&maxLng=105&maxLat=22');
  ok('inverted bbox is rejected', badBbox.status === 400);

  const filtered = await call('GET', '/destination?category=HISTORY');
  ok('category filter works', filtered.data.data.every((d) => d.category === 'HISTORY') && filtered.data.meta.total === 4,
     `total=${filtered.data.meta.total}`);
  const searched = await call('GET', '/destination?q=hu%E1%BA%BF');
  ok('free-text search works', searched.data.meta.total >= 1, `total=${searched.data.meta.total}`);

  // ═══ nhóm 3 + 4: ownership + province scoping ═══
  section('Nhóm 3 + 4: ownership and province scoping');
  const draft = pub.data.data[0];
  const mine = await call('GET', '/destination/mine', { token: dungFresh.accessToken });
  ok('/destination/mine shows own records in any status', mine.data.meta.total === 4, `total=${mine.data.meta.total}`);

  const draftId = mine.data.data.find((d) => d.status === 'DRAFT').id;
  const anonDraft = await call('GET', `/destination/${draftId}`);
  ok('anonymous read of a draft is a 404', anonDraft.status === 404, `got ${anonDraft.status}`);
  const ownDraft = await call('GET', `/destination/${draftId}`, { token: dungFresh.accessToken });
  ok('the author can read their own draft', ownDraft.status === 200);
  const otherDraft = await call('GET', `/destination/${draftId}`, { token: giang.accessToken });
  ok('another student cannot read that draft', otherDraft.status === 404, `got ${otherDraft.status}`);

  const provinces = await call('GET', '/province');
  const hanoi = provinces.data.find((p) => p.code === '01');
  const quangninh = provinces.data.find((p) => p.code === '22');
  const khanhHoa = provinces.data.find((p) => p.code === '56');
  ok('34 provincial units seeded', provinces.data.length === 34, `got ${provinces.data.length}`);

  const created = await call('POST', '/destination', {
    token: dungFresh.accessToken,
    body: { name: 'Nhà hát Lớn Hà Nội', slug: 'nha-hat-lon-ha-noi', category: 'CULTURE', provinceId: hanoi.id, lng: 105.8577, lat: 21.0245 },
  });
  ok('student creates in their assigned province', created.status === 201, `got ${created.status} ${JSON.stringify(created.body?.error)}`);
  ok('created record comes back (not a 404)', created.data?.id && created.data.location?.type === 'Point');
  ok('created record starts as DRAFT', created.data?.status === 'DRAFT');
  const newId = created.data?.id;

  const wrongProvince = await call('POST', '/destination', {
    token: dungFresh.accessToken,
    body: { name: 'Test', slug: 'test-wrong-province', category: 'OTHER', provinceId: quangninh.id, lng: 107.04, lat: 20.91 },
  });
  ok('creating in an unassigned province is refused', wrongProvince.status === 403, `got ${wrongProvince.status}`);

  const noProvince = await call('POST', '/destination', {
    token: dungFresh.accessToken,
    body: { name: 'Test', slug: 'test-no-province', category: 'OTHER', lng: 105.85, lat: 21.02 },
  });
  ok('omitting provinceId is refused, not a bypass', noProvince.status === 403, `got ${noProvince.status}`);

  const dupSlug = await call('POST', '/destination', {
    token: dungFresh.accessToken,
    body: { name: 'Dup', slug: 'ho-hoan-kiem', category: 'OTHER', provinceId: hanoi.id, lng: 105.85, lat: 21.02 },
  });
  ok('duplicate slug is a 409, not a 500', dupSlug.status === 409, `got ${dupSlug.status}`);

  const patchOther = await call('PATCH', `/destination/${newId}`, { token: giang.accessToken, body: { name: 'Hacked' } });
  ok('another student cannot edit it', patchOther.status === 403, `got ${patchOther.status}`);

  const patchMove = await call('PATCH', `/destination/${newId}`, { token: dungFresh.accessToken, body: { provinceId: quangninh.id } });
  ok('author cannot move it to an unassigned province', patchMove.status === 403, `got ${patchMove.status}`);

  const patchOwn = await call('PATCH', `/destination/${newId}`, { token: dungFresh.accessToken, body: { name: 'Nhà hát Lớn', lng: 105.8578, lat: 21.0246 } });
  ok('author edits their own draft', patchOwn.status === 200 && patchOwn.data.name === 'Nhà hát Lớn');
  ok('moving the point updates the geometry', Math.abs(patchOwn.data.location.coordinates[0] - 105.8578) < 1e-6);

  const publishedId = pub.data.data.find((d) => d.slug === 'ho-hoan-kiem').id;
  const anonymousFavorite = await call('POST', `/favorite/${publishedId}`);
  ok('anonymous users cannot save favorites', anonymousFavorite.status === 401, `got ${anonymousFavorite.status}`);
  const addFavorite = await call('POST', `/favorite/${publishedId}`, { token: mai.accessToken });
  ok('a member can save a published destination', addFavorite.status === 201 && addFavorite.data.favorited === true);
  const favorites = await call('GET', '/favorite', { token: mai.accessToken });
  ok('favorites are stored under the member account', favorites.status === 200 && favorites.data.some((favorite) => favorite.destinationId === publishedId));
  const removeFavorite = await call('DELETE', `/favorite/${publishedId}`, { token: mai.accessToken });
  ok('a member can remove their favorite', removeFavorite.status === 200 && removeFavorite.data.favorited === false);
  const pendingRating = await call('POST', '/rating', { token: mai.accessToken, body: { destinationId: publishedId, score: 4, review: 'Đánh giá cần moderation.' } });
  ok('new ratings enter moderation as pending', pendingRating.status === 201 && pendingRating.data.moderationStatus === 'PENDING');
  const pendingComment = await call('POST', '/comment', { token: mai.accessToken, body: { destinationId: publishedId, content: 'Bình luận cần moderation.' } });
  ok('new comments enter moderation as pending', pendingComment.status === 201 && pendingComment.data.moderationStatus === 'PENDING');
  const moderationQueue = await call('GET', '/admin/moderation', { token: admin.accessToken });
  ok('admin sees pending ratings and comments', moderationQueue.status === 200 && moderationQueue.data.total >= 2);
  const approvedRating = await call('PATCH', `/admin/moderation/RATING/${pendingRating.data.id}`, { token: admin.accessToken, body: { status: 'APPROVED' } });
  const approvedComment = await call('PATCH', `/admin/moderation/COMMENT/${pendingComment.data.id}`, { token: admin.accessToken, body: { status: 'APPROVED' } });
  ok('admin can approve moderated content', approvedRating.status === 200 && approvedComment.status === 200);
  const patchPublished = await call('PATCH', `/destination/${publishedId}`, { token: dungFresh.accessToken, body: { name: 'x' } });
  ok('author cannot edit a PUBLISHED record', patchPublished.status === 403, `got ${patchPublished.status}`);
  const staffPatch = await call('PATCH', `/destination/${publishedId}`, { token: gvLan.accessToken, body: { description: 'Cập nhật bởi giảng viên.' } });
  ok('lecturer can edit any record', staffPatch.status === 200, `got ${staffPatch.status}`);

  const delUsed = await call('DELETE', `/destination/${publishedId}`, { token: admin.accessToken });
  ok('deleting a destination used by a route is a 409', delUsed.status === 409, `got ${delUsed.status}`);

  // ═══ nhóm 5: approval ═══
  section('Nhóm 5: approval ownership, scope, REVISE');
  const submitOther = await call('POST', '/approval/submit', {
    token: giang.accessToken, body: { entityType: 'DESTINATION', entityId: newId },
  });
  ok('cannot submit someone else\'s work', submitOther.status === 403, `got ${submitOther.status}`);

  const submitPublished = await call('POST', '/approval/submit', {
    token: dungFresh.accessToken, body: { entityType: 'DESTINATION', entityId: publishedId },
  });
  ok('cannot re-submit a PUBLISHED record (would unpublish it)', submitPublished.status === 409, `got ${submitPublished.status}`);

  const submitted = await call('POST', '/approval/submit', {
    token: dungFresh.accessToken, body: { entityType: 'DESTINATION', entityId: newId },
  });
  ok('author submits their own draft', submitted.status === 201 && submitted.data.status === 'PENDING_LEADER', `got ${submitted.status}`);
  const leaderNotification = await call('GET', '/notification', { token: leader1.accessToken });
  ok('submission notifies the next reviewer in-app', leaderNotification.status === 200 && leaderNotification.data.data.some((item) => item.type === 'APPROVAL'));
  const approvalId = submitted.data?.id;

  const lockedAfterSubmit = await call('PATCH', `/destination/${newId}`, { token: dungFresh.accessToken, body: { name: 'y' } });
  ok('author is locked out while in review', lockedAfterSubmit.status === 403, `got ${lockedAfterSubmit.status}`);

  const wrongLeader = await call('PATCH', `/approval/${approvalId}/review`, {
    token: leader3.accessToken, body: { action: 'APPROVE' },
  });
  ok('a leader from another group cannot review', wrongLeader.status === 403, `got ${wrongLeader.status}`);

  const selfReview = await call('PATCH', `/approval/${approvalId}/review`, {
    token: dungFresh.accessToken, body: { action: 'APPROVE' },
  });
  ok('nobody can review their own submission', selfReview.status === 403, `got ${selfReview.status}`);

  const wrongLecturer = await call('PATCH', `/approval/${approvalId}/review`, {
    token: gvLan.accessToken, body: { action: 'APPROVE' },
  });
  ok('lecturer cannot review at the leader level', wrongLecturer.status === 403, `got ${wrongLecturer.status}`);

  const queue = await call('GET', '/approval?pendingOnly=true', { token: leader1.accessToken });
  ok('leader queue is scoped to their group', queue.data.data.every((a) => a.status === 'PENDING_LEADER'));
  ok('leader queue contains the new submission', queue.data.data.some((a) => a.id === approvalId));

  const revise = await call('PATCH', `/approval/${approvalId}/review`, {
    token: leader1.accessToken, body: { action: 'REVISE', comment: 'Bổ sung mô tả chi tiết hơn.' },
  });
  ok('REVISE sends it back as DRAFT (not REJECTED)', revise.data?.status === 'DRAFT', `got ${revise.data?.status}`);
  const afterRevise = await call('GET', `/destination/${newId}`, { token: dungFresh.accessToken });
  ok('the entity itself went back to DRAFT', afterRevise.data.status === 'DRAFT', `got ${afterRevise.data.status}`);
  const editable = await call('PATCH', `/destination/${newId}`, { token: dungFresh.accessToken, body: { description: 'Đã bổ sung theo góp ý.' } });
  ok('author can edit again after being sent back', editable.status === 200, `got ${editable.status}`);

  const notif = await call('GET', '/notification', { token: dungFresh.accessToken });
  ok('the author was notified of the send-back', notif.data.unread >= 1 && notif.data.data[0].type === 'APPROVAL');
  ok('the notification carries the reviewer comment', /Bổ sung mô tả/.test(notif.data.data[0].body));

  // Full ladder: submit -> leader -> lecturer -> admin -> published
  await call('POST', '/approval/submit', { token: dungFresh.accessToken, body: { entityType: 'DESTINATION', entityId: newId } });
  await call('PATCH', `/approval/${approvalId}/review`, { token: leader1.accessToken, body: { action: 'APPROVE' } });
  const atLecturer = await call('GET', `/approval/${approvalId}`, { token: gvLan.accessToken });
  ok('leader approval moves it to the lecturer', atLecturer.data.status === 'PENDING_LECTURER', `got ${atLecturer.data.status}`);
  await call('PATCH', `/approval/${approvalId}/review`, { token: gvLan.accessToken, body: { action: 'APPROVE' } });
  const atAdmin = await call('GET', `/approval/${approvalId}`, { token: admin.accessToken });
  ok('lecturer approval moves it to the admin', atAdmin.data.status === 'PENDING_ADMIN', `got ${atAdmin.data.status}`);
  const finalApprove = await call('PATCH', `/approval/${approvalId}/review`, { token: admin.accessToken, body: { action: 'APPROVE' } });
  ok('admin approval publishes it', finalApprove.data.status === 'PUBLISHED', `got ${finalApprove.data.status}`);
  const nowPublic = await call('GET', `/destination/${newId}`);
  ok('it is now visible to anonymous visitors', nowPublic.status === 200 && nowPublic.data.status === 'PUBLISHED');
  const reReview = await call('PATCH', `/approval/${approvalId}/review`, { token: admin.accessToken, body: { action: 'APPROVE' } });
  ok('a settled approval cannot be reviewed again', reReview.status === 409, `got ${reReview.status}`);

  // ═══ nhóm 6: costing + pricing ═══
  section('Nhóm 6: suppliers, tour costs, pricing');
  const providers = await call('GET', '/provider');
  ok('provider list is paginated', providers.data.meta.total === 5, `total=${providers.data.meta.total}`);
  const newProvider = await call('POST', '/provider', {
    token: linh.accessToken, body: { name: 'Nhà hàng Yến Sào', type: 'RESTAURANT', provinceId: khanhHoa.id, phone: '0258 123 456' },
  });
  ok('an HP3 student can add a provider', newProvider.status === 201, `got ${newProvider.status}`);
  const providerWrongProvince = await call('POST', '/provider', {
    token: linh.accessToken, body: { name: 'Nhà hàng ngoài vùng', type: 'RESTAURANT', provinceId: hanoi.id },
  });
  ok('an HP3 student cannot add a provider outside their province', providerWrongProvince.status === 403, `got ${providerWrongProvince.status}`);
  const providerByOther = await call('PATCH', `/provider/${newProvider.data.id}`, { token: giang.accessToken, body: { name: 'x' } });
  ok('another student cannot edit that provider', providerByOther.status === 403, `got ${providerByOther.status}`);

  const tours = await call('GET', '/tour');
  const hanoiTour = tours.data.data.find((t) => t.code === 'HN-CITY-1D');
  const hueTour = tours.data.data.find((t) => t.code === 'HUE-DN-3D2N');
  ok('published tours are listed', tours.data.meta.total === 2, `total=${tours.data.meta.total}`);

  const p1 = await call('GET', `/tour/${hanoiTour.id}/pricing`);
  // 20 pax: (120k + 150k + 70k) * 20 = 6.8M per-person, + 1.5M guide = 8.3M
  ok('per-person vs group costs are added correctly', p1.data.costs.totalCost === 8_300_000, `got ${p1.data.costs.totalCost}`);
  ok('cost per pax is right', p1.data.costs.costPerPax === 415_000, `got ${p1.data.costs.costPerPax}`);
  ok('revenue = price x pax', p1.data.selling.totalRevenue === 15_000_000);
  ok('profit is revenue - cost', p1.data.margin.profit === 6_700_000, `got ${p1.data.margin.profit}`);
  ok('margin % is profit/revenue', p1.data.margin.marginPercent === 44.67, `got ${p1.data.margin.marginPercent}`);
  ok('markup % is profit/cost (different from margin)', p1.data.margin.markupPercent === 80.72, `got ${p1.data.margin.markupPercent}`);
  ok('a 1-day tour does not require HOTEL', !p1.data.completeness.required.includes('HOTEL'));
  ok('1-day tour costing is complete', p1.data.completeness.isComplete === true);
  ok('category shares sum to 100%', Math.abs(p1.data.costs.byCategory.reduce((s, c) => s + c.share, 0) - 100) < 0.05);

  const p2 = await call('GET', `/tour/${hueTour.id}/pricing`);
  ok('a multi-day tour does require HOTEL', p2.data.completeness.required.includes('HOTEL'));
  ok('multi-day tour costing is complete', p2.data.completeness.isComplete === true);
  ok('no peers of the same length -> NO_PEERS', p2.data.competitiveness.position === 'NO_PEERS', `got ${p2.data.competitiveness.position}`);

  const costs = await call('GET', `/tour/${hueTour.id}/costs`);
  ok('cost lines are readable with supplier names', costs.data.length === 5 && costs.data.some((c) => c.supplier?.name));
  const addCostOther = await call('POST', `/tour/${hueTour.id}/costs`, {
    token: linh.accessToken, body: { category: 'MISC', unitPrice: 1000 },
  });
  ok('cannot add a cost line to someone else\'s tour', addCostOther.status === 403, `got ${addCostOther.status}`);

  // ═══ nhóm 7: design axes + route geometry ═══
  section('Nhóm 7: design axes, route geometry');
  const byAge = await call('GET', '/tour?ageGroup=SENIOR');
  ok('filter by age group', byAge.data.meta.total === 1 && byAge.data.data[0].code === 'HUE-DN-3D2N', `total=${byAge.data.meta.total}`);
  const bySeason = await call('GET', '/tour?season=ALL_YEAR');
  ok('filter by season', bySeason.data.meta.total === 1 && bySeason.data.data[0].code === 'HN-CITY-1D');
  const byStyle = await call('GET', '/tour?travelStyle=CULTURE');
  ok('filter by travel style matches both', byStyle.data.meta.total === 2, `total=${byStyle.data.meta.total}`);
  const byDays = await call('GET', '/tour?minDays=2');
  ok('filter by duration', byDays.data.meta.total === 1 && byDays.data.data[0].days === 3);

  const routes = await call('GET', '/route');
  const hanoiRoute = routes.data.data.find((r) => r.name.includes('Hà Nội'));
  ok('routes expose a path field', 'path' in hanoiRoute);
  ok('seeded routes start with no geometry', hanoiRoute.path === null);

  const recalc = await call('POST', `/route/${hanoiRoute.id}/recalculate`, { token: dungFresh.accessToken });
  ok('recalculate succeeds even without a Mapbox token', recalc.status === 201, `got ${recalc.status}`);
  ok('it fell back to a straight line', recalc.data.source === 'STRAIGHT_LINE', `got ${recalc.data.source}`);
  ok('the fallback reports a distance', recalc.data.distanceM > 0);
  ok('the fallback reports NO duration (honest about not being road-routed)', recalc.data.durationS === null);

  const withPath = await call('GET', `/route/${hanoiRoute.id}`);
  ok('the path is stored and returned as GeoJSON', withPath.data.path?.type === 'LineString', `got ${withPath.data.path?.type}`);
  ok('the line has one vertex per stop', withPath.data.path?.coordinates.length === 3, `got ${withPath.data.path?.coordinates.length}`);

  const badRoute = await call('POST', '/route', {
    token: dungFresh.accessToken,
    body: { name: 'Tuyến dùng điểm chưa duyệt', waypoints: [{ destinationId: draftId, order: 1 }, { destinationId: publishedId, order: 2 }] },
  });
  ok('a route may not use an unpublished destination', badRoute.status === 400, `got ${badRoute.status}`);
  const crossProvinceRoute = await call('POST', '/route', {
    token: dungFresh.accessToken,
    body: { name: 'Tuyến vượt vùng', waypoints: [{ destinationId: publishedId, order: 1 }, { destinationId: pub.data.data.find((d) => d.slug === 'vinh-ha-long').id, order: 2 }] },
  });
  ok('a student cannot create a route across unassigned provinces', crossProvinceRoute.status === 403, `got ${crossProvinceRoute.status}`);
  const dupOrder = await call('POST', '/route', {
    token: dungFresh.accessToken,
    body: { name: 'Trùng thứ tự', waypoints: [{ destinationId: publishedId, order: 1 }, { destinationId: newId, order: 1 }] },
  });
  ok('duplicate stop order is a 400, not a 500', dupOrder.status === 400, `got ${dupOrder.status}`);

  const geo = await call('GET', '/mapbox/geocode?q=test');
  // Passes with a working token (200) and with a broken one (502) — what must never
  // happen is a 500 that echoes the provider's message about our credentials.
  ok('map proxy never returns a raw 500', geo.status !== 500, `got ${geo.status}`);
  ok('map proxy never leaks the provider error text', !/Invalid token/i.test(JSON.stringify(geo.body)));

  // ═══ nhóm 8: grading + admin ═══
  section('Nhóm 8: grading, admin, system lock');
  const m1 = await call('GET', '/grading/me?hocPhan=HP1', { token: giang.accessToken });
  // sv.giang: 3 destinations, all submitted; 1 published, 1 pending, 1 rejected
  ok('HP1 counts what the student created', m1.data.created === 3, `got ${m1.data.created}`);
  ok('HP1 approval rate is computed', m1.data.approvalRate === 0.3333, `got ${m1.data.approvalRate}`);
  ok('HP1 counts rejections', m1.data.rejected === 1, `got ${m1.data.rejected}`);
  ok('HP1 averages real user ratings', m1.data.averageRating === 5 && m1.data.ratingCount === 2,
     `avg=${m1.data.averageRating} n=${m1.data.ratingCount}`);

  const mHa = await call('GET', '/grading/me?hocPhan=HP1', { token: ha.accessToken });
  ok('a send-back shows up as revisionRate', mHa.data.sentBack === 1 && mHa.data.revisionRate === 0.3333,
     `sentBack=${mHa.data.sentBack} rate=${mHa.data.revisionRate}`);

  const m2 = await call('GET', '/grading/me?hocPhan=HP2', { token: ha.accessToken });
  ok('HP2 counts saved itineraries as popularity', m2.data.savedByVisitors === 2, `got ${m2.data.savedByVisitors}`);
  ok('HP2 reports design-axis coverage', m2.data.tours.designCoverage === 1, `got ${m2.data.tours.designCoverage}`);

  const m3 = await call('GET', '/grading/me?hocPhan=HP3', { token: linh.accessToken });
  // sv.linh's only tour is the deliberately under-costed one: 3 of 5 categories
  ok('HP3 flags incomplete costing', m3.data.averageCostCompleteness === 0.6, `got ${m3.data.averageCostCompleteness}`);
  ok('HP3 detects selling below cost', m3.data.toursSellingBelowCost === 1, `got ${m3.data.toursSellingBelowCost}`);

  const classBoard = await call('GET', `/grading/class/${targetClass.id}`, { token: gvLan.accessToken });
  ok('lecturer gets the whole-class board', classBoard.data.students.length === 2, `got ${classBoard.data.students?.length}`);
  const foreignBoard = await call('GET', `/grading/class/${clsAdmin.data.find(c => c.code === 'DL2603-HP3').id}`, { token: gvLan.accessToken });
  ok('lecturer cannot open another lecturer\'s class board', foreignBoard.status === 403, `got ${foreignBoard.status}`);

  const hp1Id = hp.data.find((h) => h.code === 'HP1').id;
  const grade = await call('POST', '/grading', {
    token: gvLan.accessToken, body: { studentId: giang.user?.id ?? (await call('GET', '/user/me', { token: giang.accessToken })).data.id, hocPhanId: hp1Id, score: 7.5, comment: 'Cần cải thiện tỉ lệ duyệt.' },
  });
  ok('lecturer records a final mark', grade.status === 201 && grade.data.score === 7.5, `got ${grade.status}`);
  ok('the mark snapshots the indicators', !!grade.data.metrics?.approvalRate || grade.data.metrics?.approvalRate === 0);
  const gradeForeign = await call('POST', '/grading', {
    token: gvMinh.accessToken, body: { studentId: (await call('GET', '/user/me', { token: giang.accessToken })).data.id, hocPhanId: hp1Id, score: 10 },
  });
  ok('a lecturer cannot mark another lecturer\'s student', gradeForeign.status === 403, `got ${gradeForeign.status}`);

  // ═══ nhóm 9: tasks, assignments, deadlines, progress ═══
  section('Nhóm 9: tasks, assignments, deadlines, progress');
  const classDetail = await call('GET', `/class/${targetClass.id}`, { token: admin.accessToken });
  const taskAssignees = classDetail.data.members.map((member) => member.userId);
  const task = await call('POST', '/task', {
    token: gvLan.accessToken,
    body: {
      title: 'Hoàn thiện mô tả điểm đến',
      description: 'Bổ sung nội dung lịch sử và thông tin thực tế.',
      hocPhanId: hp1Id,
      classId: targetClass.id,
      assigneeIds: taskAssignees,
      priority: 'HIGH',
      dueAt: '2030-12-31T17:00:00.000Z',
    },
  });
  ok('lecturer creates a class task', task.status === 201 && task.data.assignments.length === taskAssignees.length, `got ${task.status}`);
  ok('task exposes deadline and progress summary', task.data.deadlineStatus === 'OPEN' && task.data.progress === 0);
  const studentTasks = await call('GET', `/task?classId=${targetClass.id}`, { token: dungFresh.accessToken });
  ok('student sees assigned tasks only', studentTasks.status === 200 && studentTasks.data.data.length === 1 && studentTasks.data.data[0].assignments.length === 1);
  const ownAssignment = studentTasks.data.data[0].assignments[0];
  const progress = await call('PATCH', `/task/${task.data.id}/assignments/${ownAssignment.id}`, {
    token: dungFresh.accessToken, body: { status: 'IN_PROGRESS', progress: 60, note: 'Đã hoàn thành phần lớn nội dung.' },
  });
  ok('student updates their own task progress', progress.status === 200 && progress.data.progress === 60 && progress.data.status === 'IN_PROGRESS');
  const otherAssignment = task.data.assignments.find((assignment) => assignment.assigneeId !== dungFresh.user.id);
  const updateOther = await call('PATCH', `/task/${task.data.id}/assignments/${otherAssignment.id}`, {
    token: dungFresh.accessToken, body: { progress: 100, status: 'COMPLETED' },
  });
  ok('student cannot update another student\'s assignment', updateOther.status === 403);
  const studentCreateTask = await call('POST', '/task', {
    token: dungFresh.accessToken,
    body: { title: 'Unauthorized task', hocPhanId: hp1Id, classId: targetClass.id, assigneeIds: [dungFresh.user.id] },
  });
  ok('student cannot create tasks', studentCreateTask.status === 403);

  // ═══ nhóm 10: supplier + tour-cost approvals ═══
  section('Nhóm 10: supplier and tour-cost approvals');
  const supplierApproval = await call('POST', '/approval/submit', {
    token: linh.accessToken, body: { entityType: 'SUPPLIER', entityId: newProvider.data.id },
  });
  ok('HP3 supplier starts as a draft and can be submitted', supplierApproval.status === 201 && supplierApproval.data.status === 'PENDING_LEADER');
  const supplierAnonymous = await call('GET', `/provider/${newProvider.data.id}`);
  ok('an unpublished supplier is hidden from anonymous users', supplierAnonymous.status === 404);
  const supplierOwner = await call('GET', `/provider/${newProvider.data.id}`, { token: linh.accessToken });
  ok('the supplier owner can read their draft', supplierOwner.status === 200 && supplierOwner.data.status === 'PENDING_LEADER');
  const supplierApprovalId = supplierApproval.data.id;
  await call('PATCH', `/approval/${supplierApprovalId}/review`, { token: leader3.accessToken, body: { action: 'APPROVE' } });
  await call('PATCH', `/approval/${supplierApprovalId}/review`, { token: gvMinh.accessToken, body: { action: 'APPROVE' } });
  const supplierPublished = await call('PATCH', `/approval/${supplierApprovalId}/review`, { token: admin.accessToken, body: { action: 'APPROVE' } });
  ok('supplier uses the full approval ladder', supplierPublished.status === 200 && supplierPublished.data.status === 'PUBLISHED');

  const myTours = await call('GET', '/tour/mine', { token: linh.accessToken });
  const ownTour = myTours.data.data.find((tour) => tour.status === 'DRAFT');
  const newCost = await call('POST', `/tour/${ownTour.id}/costs`, {
    token: linh.accessToken, body: { category: 'MISC', unitPrice: 25000, quantity: 1 },
  });
  ok('HP3 student adds a draft cost line to their own draft tour', newCost.status === 201 && newCost.data.status === 'DRAFT');
  const costApproval = await call('POST', '/approval/submit', {
    token: linh.accessToken, body: { entityType: 'TOUR_COST', entityId: newCost.data.id },
  });
  ok('the cost line can be submitted for approval', costApproval.status === 201 && costApproval.data.status === 'PENDING_LEADER');
  const costApprovalId = costApproval.data.id;
  await call('PATCH', `/approval/${costApprovalId}/review`, { token: leader3.accessToken, body: { action: 'APPROVE' } });
  await call('PATCH', `/approval/${costApprovalId}/review`, { token: gvMinh.accessToken, body: { action: 'APPROVE' } });
  const costPublished = await call('PATCH', `/approval/${costApprovalId}/review`, { token: admin.accessToken, body: { action: 'APPROVE' } });
  ok('tour cost uses the full approval ladder', costPublished.status === 200 && costPublished.data.status === 'PUBLISHED');

  const overview = await call('GET', '/admin/overview', { token: admin.accessToken });
  ok('admin overview breaks users down by role', overview.data.usersByRole?.STUDENT === 6, `got ${overview.data.usersByRole?.STUDENT}`);
  ok('admin overview counts only pending approvals', overview.data.pendingApprovals === 3, `got ${overview.data.pendingApprovals}`);
  const adminReports = await call('GET', '/admin/reports', { token: admin.accessToken });
  ok('admin reports expose approval and content status counts', adminReports.status === 200 && adminReports.data.approvalsByStatus && adminReports.data.contentByStatus?.destinations);
  const adminAudit = await call('GET', '/admin/audit?limit=50', { token: admin.accessToken });
  ok('admin audit exposes recorded administrative and workflow actions', adminAudit.status === 200 && adminAudit.data.meta.total > 0 && adminAudit.data.data.some((entry) => entry.action.includes('APPROVAL')));
  const overviewAsStudent = await call('GET', '/admin/overview', { token: dungFresh.accessToken });
  ok('a student cannot see the admin overview', overviewAsStudent.status === 403, `got ${overviewAsStudent.status}`);

  const newUser = await call('POST', '/admin/users', {
    token: admin.accessToken,
    body: { email: 'sv.moi@touristmap.local', username: 'sv.moi', password: 'Password@123', fullName: 'Sinh Viên Mới', role: 'STUDENT' },
  });
  ok('admin creates a STUDENT account', newUser.status === 201 && newUser.data.role === 'STUDENT', `got ${newUser.status}`);
  const newUserLogin = await login('sv.moi@touristmap.local');
  ok('the new account can sign in', !!newUserLogin.accessToken);

  const locked = await call('PATCH', `/admin/users/${newUser.data.id}`, { token: admin.accessToken, body: { isActive: false } });
  ok('admin locks the account', locked.status === 200 && locked.data.isActive === false);
  const lockedOut = await call('GET', '/user/me', { token: newUserLogin.accessToken });
  ok('the locked account\'s access token stops working', lockedOut.status === 401, `got ${lockedOut.status}`);
  const lockedRefresh = await call('POST', '/auth/refresh', { body: { refreshToken: newUserLogin.refreshToken } });
  ok('the locked account cannot refresh either', lockedRefresh.status === 401, `got ${lockedRefresh.status}`);

  const selfLock = await call('PATCH', `/admin/users/${(await call('GET', '/user/me', { token: admin.accessToken })).data.id}`, {
    token: admin.accessToken, body: { isActive: false },
  });
  ok('admin cannot lock themselves out', selfLock.status === 400, `got ${selfLock.status}`);

  // System lock
  await call('PATCH', '/admin/system/lock', { token: admin.accessToken, body: { locked: true, message: 'Hệ thống đang khoá để chấm điểm.' } });
  await new Promise((r) => setTimeout(r, 5200)); // let the 5s settings cache expire
  const writeWhileLocked = await call('POST', '/destination', {
    token: dungFresh.accessToken,
    body: { name: 'x', slug: 'x-locked', category: 'OTHER', provinceId: hanoi.id, lng: 105.85, lat: 21.02 },
  });
  ok('writes are blocked while the system is locked', writeWhileLocked.status === 503, `got ${writeWhileLocked.status}`);
  ok('the lock message reaches the user', /chấm điểm/.test(JSON.stringify(writeWhileLocked.body)));
  const readWhileLocked = await call('GET', '/destination');
  ok('reads still work while locked', readWhileLocked.status === 200);
  const loginWhileLocked = await call('POST', '/auth/login', { body: { email: 'sv.an@touristmap.local', password: 'Password@123' } });
  ok('sign-in still works while locked (or the admin is stranded)', loginWhileLocked.status === 201, `got ${loginWhileLocked.status}`);
  const adminWriteWhileLocked = await call('PATCH', '/admin/system/lock', { token: admin.accessToken, body: { locked: false } });
  ok('the admin can unlock again', adminWriteWhileLocked.status === 200);
  await new Promise((r) => setTimeout(r, 5200));
  const writeAfterUnlock = await call('POST', '/provider', { token: linh.accessToken, body: { name: 'Sau khi mở khoá', type: 'OTHER', provinceId: khanhHoa.id } });
  ok('writes resume after unlocking', writeAfterUnlock.status === 201, `got ${writeAfterUnlock.status}`);

  console.log(results.join('\n'));
  console.log(`\n${'═'.repeat(64)}\n  ${pass} passed, ${fail} failed\n${'═'.repeat(64)}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log(results.join('\n'));
  console.error('\nHARNESS ERROR:', e.message);
  process.exit(2);
});
