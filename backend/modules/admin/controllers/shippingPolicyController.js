import ShippingPolicy from '../models/ShippingPolicy.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText, toLocalizedText } from '../../../shared/i18n/localizedText.js';
import { buildContentModuleQuery, parseContentModuleFromRequest } from '../utils/contentModule.js';

const DEFAULT_TITLE = 'Shipping Policy';
const DEFAULT_CONTENT = '<p>No shipping policy available at the moment.</p>';
const SHIPPING_MODULE = 'user';

function ensureUserShippingModule(targetModule, res) {
  if (targetModule !== SHIPPING_MODULE) {
    errorResponse(res, 400, 'Shipping policy is only available for user module');
    return false;
  }
  return true;
}

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

export const getShippingPublic = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureUserShippingModule(targetModule, res)) return;

    const locale = resolveLocaleFromRequest(req);
    const shipping = await ShippingPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!shipping) {
      return successResponse(res, 200, 'Shipping policy retrieved successfully', {
        title: DEFAULT_TITLE,
        content: DEFAULT_CONTENT
      });
    }

    return successResponse(res, 200, 'Shipping policy retrieved successfully', {
      ...shipping,
      title: resolveLocalizedText(shipping.localizedTitle, locale, shipping.title || DEFAULT_TITLE),
      content: resolveLocalizedText(shipping.localizedContent, locale, shipping.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching shipping policy:', error);
    return errorResponse(res, 500, 'Failed to fetch shipping policy');
  }
});

export const getShipping = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureUserShippingModule(targetModule, res)) return;

    let shipping = await ShippingPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    }).lean();

    if (!shipping) {
      shipping = await ShippingPolicy.create({
        title: DEFAULT_TITLE,
        localizedTitle: toLocalizedText(DEFAULT_TITLE, DEFAULT_TITLE),
        content: '<p>This is a demo shipping policy. Please update with your actual shipping terms and conditions.</p>',
        localizedContent: toLocalizedText(
          '<p>This is a demo shipping policy. Please update with your actual shipping terms and conditions.</p>',
          ''
        ),
        targetModule,
        updatedBy: req.admin._id
      });
      shipping = shipping.toObject();
    }

    return successResponse(res, 200, 'Shipping policy retrieved successfully', {
      ...shipping,
      title: resolveLocalizedText(shipping.localizedTitle, 'en', shipping.title || DEFAULT_TITLE),
      content: resolveLocalizedText(shipping.localizedContent, 'en', shipping.content || DEFAULT_CONTENT),
      localizedTitle: mergeLocalizedValue(shipping.localizedTitle, null, shipping.title || DEFAULT_TITLE),
      localizedContent: mergeLocalizedValue(shipping.localizedContent, null, shipping.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching shipping policy:', error);
    return errorResponse(res, 500, 'Failed to fetch shipping policy');
  }
});

export const updateShipping = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureUserShippingModule(targetModule, res)) return;

    const { title, content, localizedTitle, localizedContent, locale, autoTranslate = true } = req.body;
    const sourceLocale = normalizeLocale(locale || 'en');

    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    let shipping = await ShippingPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    });
    if (!shipping) {
      shipping = new ShippingPolicy({
        title: DEFAULT_TITLE,
        content,
        targetModule,
        updatedBy: req.admin._id
      });
    }

    let nextLocalizedTitle = mergeLocalizedValue(shipping.localizedTitle, localizedTitle, shipping.title || DEFAULT_TITLE);
    let nextLocalizedContent = mergeLocalizedValue(shipping.localizedContent, localizedContent, shipping.content || DEFAULT_CONTENT);

    if (typeof title === 'string') nextLocalizedTitle[sourceLocale] = title;
    if (typeof content === 'string') nextLocalizedContent[sourceLocale] = content;

    if (!nextLocalizedTitle.en) nextLocalizedTitle.en = shipping.title || DEFAULT_TITLE;
    if (!nextLocalizedContent.en) nextLocalizedContent.en = shipping.content || content || DEFAULT_CONTENT;

    if (sourceLocale === 'en' && autoTranslate) {
      try {
        const translatedTitle = await buildLocalizedText(nextLocalizedTitle.en);
        if (!localizedTitle?.hi) nextLocalizedTitle.hi = translatedTitle.hi || nextLocalizedTitle.hi;
        if (!localizedTitle?.bn) nextLocalizedTitle.bn = translatedTitle.bn || nextLocalizedTitle.bn;
      } catch (error) {
        console.warn(`[i18n] Shipping title translation failed: ${error.message}`);
      }
      try {
        const translatedContent = await buildLocalizedText(nextLocalizedContent.en);
        if (!localizedContent?.hi) nextLocalizedContent.hi = translatedContent.hi || nextLocalizedContent.hi;
        if (!localizedContent?.bn) nextLocalizedContent.bn = translatedContent.bn || nextLocalizedContent.bn;
      } catch (error) {
        console.warn(`[i18n] Shipping content translation failed: ${error.message}`);
      }
    }

    shipping.title = nextLocalizedTitle.en;
    shipping.content = nextLocalizedContent.en;
    shipping.localizedTitle = nextLocalizedTitle;
    shipping.localizedContent = nextLocalizedContent;
    shipping.targetModule = targetModule;
    shipping.updatedBy = req.admin._id;

    await shipping.save();

    return successResponse(res, 200, 'Shipping policy updated successfully', {
      ...shipping.toObject(),
      title: shipping.title,
      content: shipping.content
    });
  } catch (error) {
    console.error('Error updating shipping policy:', error);
    return errorResponse(res, 500, 'Failed to update shipping policy');
  }
});
