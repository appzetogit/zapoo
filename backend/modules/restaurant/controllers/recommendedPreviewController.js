import mongoose from 'mongoose';
import Menu from '../models/Menu.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';

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

function computeFinalPrice(item) {
  const base = Number(item.originalPrice ?? item.price ?? 0);
  const discountAmount = Number(item.discountAmount ?? 0);
  const discountType = item.discountType || 'Percent';
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(discountAmount) || discountAmount <= 0) return Math.round(base);

  if (discountType === 'Fixed') {
    return Math.max(0, Math.round(base - discountAmount));
  }
  // Percent
  return Math.max(0, Math.round(base * (1 - discountAmount / 100)));
}

function getItemImage(item) {
  if (Array.isArray(item.images) && item.images.length > 0 && item.images[0]) return item.images[0];
  if (typeof item.image === 'string' && item.image.trim()) return item.image.trim();
  // Legacy/alternate shapes (some data stores image as { url } or { secure_url })
  if (item.image && typeof item.image === 'object') {
    const url = item.image.url || item.image.secure_url || item.image.path;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return '';
}

/**
 * POST /api/restaurant/recommended-preview
 * Body: { restaurantIds: string[] }
 * Returns: { previews: { [restaurantId]: [{ itemId, name, price, originalPrice, image }] } }
 */
export async function getRecommendedPreview(req, res) {
  const { restaurantIds } = req.body || {};
  if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
    return errorResponse(res, 400, 'restaurantIds (non-empty array) is required');
  }

  const uniqueIds = [...new Set(restaurantIds.map(String))];
  const validObjectIds = uniqueIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id) && id.length === 24)
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validObjectIds.length === 0) {
    return errorResponse(res, 400, 'restaurantIds must contain at least one valid Mongo ObjectId');
  }

  const menus = await Menu.find({
    restaurant: { $in: validObjectIds },
    isActive: true
  }).select('restaurant sections').lean();

  const previews = {};
  for (const oid of validObjectIds) {
    previews[oid.toString()] = [];
  }

  for (const menu of menus || []) {
    const rid = menu.restaurant?.toString?.() || String(menu.restaurant);
    const items = flattenMenuItems(menu.sections || []);

    const recommended = items
      .filter((it) => {
        if (!it) return false;
        const status = it.recommendationStatus;
        const pendingSpecial =
          it.isRecommendationRequest === true &&
          (status === "pending" || status === "approved");

        // Recommended shown for:
        // - admin-approved specials (`isRecommended === true`)
        // - restaurant special requests that are still pending/approved
        return it.isRecommended === true || pendingSpecial;
      })
      .filter((it) => it.isAvailable !== false)
      .filter((it) => (it.approvalStatus === 'approved' || !it.approvalStatus))
      .slice(0, 50) // safety cap before mapping/slicing to limit
      .map((it) => {
        const originalPrice = Number(it.originalPrice ?? it.price ?? 0) || 0;
        const computed = computeFinalPrice(it);
        const price = Number.isFinite(computed) && computed > 0 ? computed : originalPrice;
        return {
          itemId: String(it.id || ''),
          name: it.name || '',
          price,
          originalPrice,
          image: getItemImage(it)
        };
      })
      .filter((it) => it.itemId && it.name)
      .slice(0, 5);

    previews[rid] = recommended;
  }

  return successResponse(res, 200, 'Recommended preview retrieved successfully', { previews });
}

