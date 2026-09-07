/**
 * Curated destination image overrides for places where Wikipedia's auto-
 * resolved image isn't accurate enough (map of a city, a corporate logo,
 * etc.). Edit slug → image URL here and re-run `scripts/fetch-destination-images.ts`
 * to apply; the script also falls back to this map at runtime via the
 * resolve-image endpoint.
 */
export const WIKI_IMAGE_OVERRIDES: Record<string, string> = {
  // Ba Na Hills — Golden Bridge (Da Nang) — the actual landmark, not a cityscape.
  'ba-na-hills': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/C%C3%A2y_c%E1%BA%A7u_v%C3%A0ng_tay_Golden_Bridge%2C_B%C3%A0_N%C3%A1_Hills.jpg/1280px-C%C3%A2y_c%E1%BA%A7u_v%C3%A0ng_tay_Golden_Bridge%2C_B%C3%A0_N%C3%A1_Hills.jpg',
  // Temple of Literature (Hanoi) — actual temple courtyard photo.
  'van-mieu-quoc-tu-giam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/V%C4%83n_Mi%E1%BA%BFu_H%C3%A0_N%E1%BB%99i.jpg/1280px-V%C4%83n_Mi%E1%BA%BFu_H%C3%A0_N%E1%BB%99i.jpg',
  // Vinpearl Nha Trang resort (not the parent-corporation logo).
  'vinpearl-nha-trang': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Vinpearl_Resort_Nha_Trang.jpg/1280px-Vinpearl_Resort_Nha_Trang.jpg',
  // Also cover the OSM-map fallback for the temple if a curated photo is missing.
  'nha-hat-lon-ha-noi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Nh%C3%A0_h%C3%A1t_l%E1%BB%9Bn_H%C3%A0_N%E1%BB%99i.jpg/1280px-Nh%C3%A1_h%C3%A1t_l%E1%BB%9Dn_H%C3%A0_N%E1%BB%99i.jpg',
};

export async function loadOverrideMap(): Promise<Record<string, string>> {
  return { ...WIKI_IMAGE_OVERRIDES };
}
