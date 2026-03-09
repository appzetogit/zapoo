import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { getMyChallengeProgress } from '../../order/services/challengeEngineService.js';

export const getMyChallenges = asyncHandler(async (req, res) => {
  const restaurant = req.restaurant;
  if (!restaurant?._id) return errorResponse(res, 400, 'Restaurant not found');

  const challenges = await getMyChallengeProgress({
    userId: restaurant._id,
    userType: 'restaurant'
  });

  return successResponse(res, 200, 'Challenges fetched successfully', { challenges });
});

