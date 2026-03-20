import Menu from '../../restaurant/models/Menu.js';

function parsePrepMinutes(prepStr) {
  if (!prepStr) return null;
  const s = String(prepStr).trim();
  const match = s.match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return null;
  const minTime = Number.parseInt(match[1], 10);
  const maxTime = match[2] ? Number.parseInt(match[2], 10) : minTime;
  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) return null;
  const value = Math.max(minTime, maxTime);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function flattenMenuItems(sections = []) {
  const all = [];
  for (const section of sections || []) {
    if (Array.isArray(section.items)) all.push(...section.items);
    if (Array.isArray(section.subsections)) {
      for (const sub of section.subsections) {
        if (Array.isArray(sub.items)) all.push(...sub.items);
      }
    }
  }
  return all;
}

function computeLoadFactorMinutes(totalQty) {
  // Small, predictable load factor for larger carts.
  // Default rule: +1 min per 4 items after first 2 items.
  const qty = Math.max(0, Number(totalQty) || 0);
  if (qty <= 2) return 0;
  return Math.max(0, Math.ceil((qty - 2) / 4));
}

function computeBaselinePrepFromMenu(menuItems) {
  const minutes = (menuItems || [])
    .map((it) => parsePrepMinutes(it.preparationTime))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (minutes.length === 0) return null;

  // Median is stable against outliers.
  const mid = Math.floor(minutes.length / 2);
  return minutes.length % 2 === 1 ? minutes[mid] : Math.ceil((minutes[mid - 1] + minutes[mid]) / 2);
}

/**
 * Computes order prep time in minutes using Menu data.
 * We do NOT trust any client-supplied item preparationTime.
 *
 * @param {Object} params
 * @param {string} params.restaurantObjectId - Restaurant Mongo _id
 * @param {Array} params.items - [{ itemId, quantity, ... }]
 * @returns {Promise<{prepMinutes:number, source:string, meta?:object}>}
 */
export async function computeOrderPreparationTimeMinutes({ restaurantObjectId, items }) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalQty = safeItems.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);

  const menu = await Menu.findOne({ restaurant: restaurantObjectId }).select('sections').lean();
  const menuItems = menu ? flattenMenuItems(menu.sections) : [];

  const prepByItemId = new Map();
  for (const it of menuItems) {
    if (!it?.id) continue;
    const parsed = parsePrepMinutes(it.preparationTime);
    if (parsed !== null) {
      prepByItemId.set(String(it.id), parsed);
    }
  }

  const baseline = computeBaselinePrepFromMenu(menuItems);
  const fallbackBaseline = Number.isFinite(baseline) ? baseline : 15;

  let maxItemPrep = 0;
  let resolvedCount = 0;
  let missingCount = 0;

  for (const it of safeItems) {
    const itemId = it?.itemId ?? it?.id;
    if (!itemId) {
      missingCount += 1;
      continue;
    }
    const resolved = prepByItemId.get(String(itemId));
    if (Number.isFinite(resolved) && resolved > 0) {
      resolvedCount += 1;
      maxItemPrep = Math.max(maxItemPrep, resolved);
    } else {
      missingCount += 1;
      // If item prep is missing, treat it as baseline so we don't underestimate.
      maxItemPrep = Math.max(maxItemPrep, fallbackBaseline);
    }
  }

  const loadFactor = computeLoadFactorMinutes(totalQty);
  const prepMinutes = Math.min(180, Math.max(0, Math.ceil(maxItemPrep + loadFactor)));

  return {
    prepMinutes,
    source: menu ? 'menu' : 'fallback',
    meta: {
      totalQty,
      maxItemPrep,
      loadFactor,
      baselinePrep: fallbackBaseline,
      resolvedCount,
      missingCount
    }
  };
}

/**
 * Baseline prep time for listing (no cart items).
 * @returns {Promise<{prepMinutes:number, source:string}>}
 */
export async function computeRestaurantBaselinePreparationMinutes({ restaurantObjectId }) {
  const menu = await Menu.findOne({ restaurant: restaurantObjectId }).select('sections').lean();
  const menuItems = menu ? flattenMenuItems(menu.sections) : [];
  const baseline = computeBaselinePrepFromMenu(menuItems);
  const prepMinutes = Number.isFinite(baseline) && baseline > 0 ? baseline : 15;
  return { prepMinutes, source: menu ? 'menu_median' : 'fallback' };
}

