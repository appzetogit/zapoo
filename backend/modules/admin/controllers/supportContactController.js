import SupportContact from '../models/SupportContact.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

const DEFAULT_SUPPORT = {
  email: 'zapoosupport@gmail.com',
  phone: '8919142335',
};

function normalizePhone(phone = '') {
  return String(phone).replace(/[^0-9+]/g, '').trim();
}

function ensureValidPayload(email, phone) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailPattern.test(email)) {
    return 'Please provide a valid support email address';
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 8) {
    return 'Please provide a valid support phone number';
  }

  return null;
}

async function getOrCreateSupportContact(adminId = null) {
  let support = await SupportContact.findOne().sort({ updatedAt: -1 });

  if (!support) {
    support = await SupportContact.create({
      ...DEFAULT_SUPPORT,
      updatedBy: adminId,
    });
  }

  return support;
}

/**
 * GET /api/support/public
 */
export const getSupportPublic = asyncHandler(async (_req, res) => {
  try {
    const support = await SupportContact.findOne().sort({ updatedAt: -1 }).lean();

    return successResponse(res, 200, 'Support contact retrieved successfully', {
      email: support?.email || DEFAULT_SUPPORT.email,
      phone: support?.phone || DEFAULT_SUPPORT.phone,
    });
  } catch (error) {
    console.error('Error fetching support contact:', error);
    return errorResponse(res, 500, 'Failed to fetch support contact');
  }
});

/**
 * GET /api/admin/support
 */
export const getSupport = asyncHandler(async (req, res) => {
  try {
    const support = await getOrCreateSupportContact(req.admin?._id || null);

    return successResponse(res, 200, 'Support contact retrieved successfully', {
      email: support.email || DEFAULT_SUPPORT.email,
      phone: support.phone || DEFAULT_SUPPORT.phone,
    });
  } catch (error) {
    console.error('Error fetching support contact:', error);
    return errorResponse(res, 500, 'Failed to fetch support contact');
  }
});

/**
 * PUT /api/admin/support
 */
export const updateSupport = asyncHandler(async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = normalizePhone(req.body?.phone || '');

    const validationError = ensureValidPayload(email, phone);
    if (validationError) {
      return errorResponse(res, 400, validationError);
    }

    const support = await getOrCreateSupportContact(req.admin?._id || null);
    support.email = email;
    support.phone = phone;
    support.updatedBy = req.admin._id;
    await support.save();

    return successResponse(res, 200, 'Support contact updated successfully', {
      email: support.email,
      phone: support.phone,
    });
  } catch (error) {
    console.error('Error updating support contact:', error);
    return errorResponse(res, 500, 'Failed to update support contact');
  }
});
