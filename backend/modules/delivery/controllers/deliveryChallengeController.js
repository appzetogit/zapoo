import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { getMyChallengeProgress } from '../../order/services/challengeEngineService.js';

export const getMyChallenges = asyncHandler(async (req, res) => {
  const delivery = req.delivery;
  if (!delivery?._id) return errorResponse(res, 400, 'Delivery partner not found');

  const challenges = await getMyChallengeProgress({
    userId: delivery._id,
    userType: 'delivery_partner'
  });

  return successResponse(res, 200, 'Challenges fetched successfully', { challenges });
});

