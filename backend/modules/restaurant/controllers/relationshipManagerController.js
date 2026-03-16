import RelationshipRequest from '../models/RelationshipRequest.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';

/**
 * Handle relationship manager call requests
 */
export const requestRMCall = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { notes } = req.body;

    // Check if there's already a pending request
    const existingRequest = await RelationshipRequest.findOne({
      restaurantId,
      status: 'pending'
    });

    if (existingRequest) {
      return errorResponse(res, 400, 'You already have a pending call request. Our team will contact you soon.');
    }

    const newRequest = await RelationshipRequest.create({
      restaurantId,
      notes,
      time: new Date(),
      status: 'pending'
    });

    return successResponse(res, 201, 'Call request submitted successfully. Your Relationship Manager will contact you within 24 hours.', newRequest);
  } catch (error) {
    console.error('[RMController] Error requesting call:', error);
    return errorResponse(res, 500, 'Internal server error while processing your request.');
  }
};

/**
 * Get call request history for the restaurant
 */
export const getRMCallHistory = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const history = await RelationshipRequest.find({ restaurantId }).sort({ createdAt: -1 });
    return successResponse(res, 200, 'Call history retrieved successfully', history);
  } catch (error) {
    console.error('[RMController] Error fetching call history:', error);
    return errorResponse(res, 500, 'Internal server error fetching call history.');
  }
};
