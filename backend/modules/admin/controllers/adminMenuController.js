import Restaurant from "../../restaurant/models/Restaurant.js";
import { errorResponse } from "../../../shared/utils/response.js";
import asyncHandler from "../../../shared/middleware/asyncHandler.js";
import { updateMenu as updateRestaurantMenu } from "../../restaurant/controllers/menuController.js";

/**
 * Admin: Update a specific restaurant menu using existing restaurant menu logic.
 * PUT /api/admin/restaurants/:id/menu
 */
export const updateRestaurantMenuAsAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const restaurant = await Restaurant.findById(id);
  if (!restaurant) {
    return errorResponse(res, 404, "Restaurant not found");
  }

  // Reuse existing menu update behavior by attaching target restaurant context.
  req.restaurant = restaurant;
  return updateRestaurantMenu(req, res, next);
});

