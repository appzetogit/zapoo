import RefundPolicy from '../models/RefundPolicy.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText, toLocalizedText } from '../../../shared/i18n/localizedText.js';

const DEFAULT_TITLE = 'Refund Policy';
const DEFAULT_CONTENT = '<p>No refund policy available at the moment.</p>';

function mergeLocalizedValue(existingValue, localizedOverride, fallback = '') {
  const merged = toLocalizedText(existingValue, fallback);
  if (localizedOverride && typeof localizedOverride === 'object') {
    for (const locale of ['en', 'hi', 'bn']) {
      if (typeof localizedOverride[locale] === 'string') {
        merged[locale] = localizedOverride[locale];
      }
    }
  }
  return merged;
}

export const getRefundPublic = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const refund = await RefundPolicy.findOne({ isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!refund) {
      return successResponse(res, 200, 'Refund policy retrieved successfully', {
        title: DEFAULT_TITLE,
        content: DEFAULT_CONTENT
      });
    }

    return successResponse(res, 200, 'Refund policy retrieved successfully', {
      ...refund,
      title: resolveLocalizedText(refund.localizedTitle, locale, refund.title || DEFAULT_TITLE),
      content: resolveLocalizedText(refund.localizedContent, locale, refund.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching refund policy:', error);
    return errorResponse(res, 500, 'Failed to fetch refund policy');
  }
});

export const getRefund = asyncHandler(async (req, res) => {
  try {
    let refund = await RefundPolicy.findOne({ isActive: true }).lean();

    if (!refund) {
      refund = await RefundPolicy.create({
        title: DEFAULT_TITLE,
        localizedTitle: toLocalizedText(DEFAULT_TITLE, DEFAULT_TITLE),
        content: '<p>Stack Food is a complete Multi-vendor Food products delivery system developed with powerful admin panel will help you to control your business smartly.</p>',
        localizedContent: toLocalizedText(
          '<p>Stack Food is a complete Multi-vendor Food products delivery system developed with powerful admin panel will help you to control your business smartly.</p>',
          ''
        ),
        updatedBy: req.admin._id
      });
      refund = refund.toObject();
    }

    return successResponse(res, 200, 'Refund policy retrieved successfully', {
      ...refund,
      title: resolveLocalizedText(refund.localizedTitle, 'en', refund.title || DEFAULT_TITLE),
      content: resolveLocalizedText(refund.localizedContent, 'en', refund.content || DEFAULT_CONTENT),
      localizedTitle: mergeLocalizedValue(refund.localizedTitle, null, refund.title || DEFAULT_TITLE),
      localizedContent: mergeLocalizedValue(refund.localizedContent, null, refund.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching refund policy:', error);
    return errorResponse(res, 500, 'Failed to fetch refund policy');
  }
});

export const updateRefund = asyncHandler(async (req, res) => {
  try {
    const { title, content, localizedTitle, localizedContent, locale, autoTranslate = true } = req.body;
    const sourceLocale = normalizeLocale(locale || 'en');

    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    let refund = await RefundPolicy.findOne({ isActive: true });
    if (!refund) {
      refund = new RefundPolicy({
        title: DEFAULT_TITLE,
        content,
        updatedBy: req.admin._id
      });
    }

    let nextLocalizedTitle = mergeLocalizedValue(refund.localizedTitle, localizedTitle, refund.title || DEFAULT_TITLE);
    let nextLocalizedContent = mergeLocalizedValue(refund.localizedContent, localizedContent, refund.content || DEFAULT_CONTENT);

    if (typeof title === 'string') nextLocalizedTitle[sourceLocale] = title;
    if (typeof content === 'string') nextLocalizedContent[sourceLocale] = content;

    if (!nextLocalizedTitle.en) nextLocalizedTitle.en = refund.title || DEFAULT_TITLE;
    if (!nextLocalizedContent.en) nextLocalizedContent.en = refund.content || content || DEFAULT_CONTENT;

    if (sourceLocale === 'en' && autoTranslate) {
      try {
        const translatedTitle = await buildLocalizedText(nextLocalizedTitle.en);
        if (!localizedTitle?.hi) nextLocalizedTitle.hi = translatedTitle.hi || nextLocalizedTitle.hi;
        if (!localizedTitle?.bn) nextLocalizedTitle.bn = translatedTitle.bn || nextLocalizedTitle.bn;
      } catch (error) {
        console.warn(`[i18n] Refund title translation failed: ${error.message}`);
      }
      try {
        const translatedContent = await buildLocalizedText(nextLocalizedContent.en);
        if (!localizedContent?.hi) nextLocalizedContent.hi = translatedContent.hi || nextLocalizedContent.hi;
        if (!localizedContent?.bn) nextLocalizedContent.bn = translatedContent.bn || nextLocalizedContent.bn;
      } catch (error) {
        console.warn(`[i18n] Refund content translation failed: ${error.message}`);
      }
    }

    refund.title = nextLocalizedTitle.en;
    refund.content = nextLocalizedContent.en;
    refund.localizedTitle = nextLocalizedTitle;
    refund.localizedContent = nextLocalizedContent;
    refund.updatedBy = req.admin._id;

    await refund.save();

    return successResponse(res, 200, 'Refund policy updated successfully', {
      ...refund.toObject(),
      title: refund.title,
      content: refund.content
    });
  } catch (error) {
    console.error('Error updating refund policy:', error);
    return errorResponse(res, 500, 'Failed to update refund policy');
  }
});
