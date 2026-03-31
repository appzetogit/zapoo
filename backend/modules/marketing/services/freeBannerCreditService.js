import mongoose from 'mongoose';
import FreeBannerCredit from '../models/FreeBannerCredit.js';

export const createFreeBannerCredit = async ({
  restaurantId,
  challengeId = null,
  challengeProgressId
}) => {
  if (!restaurantId || !challengeProgressId) {
    throw new Error('restaurantId and challengeProgressId are required');
  }

  return FreeBannerCredit.findOneAndUpdate(
    { challengeProgressId },
    {
      $setOnInsert: {
        restaurant: restaurantId,
        challengeId,
        status: 'available',
        earnedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );
};

export const countAvailableFreeBannerCredits = async (restaurantId) => {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
    return 0;
  }

  return FreeBannerCredit.countDocuments({
    restaurant: restaurantId,
    status: 'available'
  });
};

export const reserveOldestAvailableFreeBannerCredit = async ({
  restaurantId,
  adRequestId
}) => {
  if (!restaurantId || !adRequestId) {
    return null;
  }

  return FreeBannerCredit.findOneAndUpdate(
    {
      restaurant: restaurantId,
      status: 'available'
    },
    {
      $set: {
        status: 'reserved',
        reservedAt: new Date(),
        reservedForAdRequest: adRequestId
      }
    },
    {
      new: true,
      sort: { earnedAt: 1, createdAt: 1 }
    }
  );
};

export const markReservedCreditAsConsumed = async ({
  creditId,
  adRequestId
}) => {
  if (!creditId || !adRequestId) {
    return null;
  }

  return FreeBannerCredit.findOneAndUpdate(
    {
      _id: creditId,
      reservedForAdRequest: adRequestId,
      status: { $in: ['available', 'reserved'] }
    },
    {
      $set: {
        status: 'consumed',
        consumedAt: new Date(),
        consumedByAdRequest: adRequestId
      }
    },
    { new: true }
  );
};

export const releaseReservedFreeBannerCredit = async ({
  creditId,
  adRequestId
}) => {
  if (!creditId || !adRequestId) {
    return null;
  }

  return FreeBannerCredit.findOneAndUpdate(
    {
      _id: creditId,
      reservedForAdRequest: adRequestId,
      status: 'reserved'
    },
    {
      $set: {
        status: 'available',
        reservedAt: null,
        reservedForAdRequest: null
      }
    },
    { new: true }
  );
};
