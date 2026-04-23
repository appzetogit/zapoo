import PrivacyPolicy from '../models/PrivacyPolicy.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText, toLocalizedText } from '../../../shared/i18n/localizedText.js';
import { buildContentModuleQuery, parseContentModuleFromRequest } from '../utils/contentModule.js';

const DEFAULT_TITLE = 'Privacy Policy';
const DEFAULT_CONTENT = '<p>No privacy policy available at the moment.</p>';

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

/**
 * Get Privacy Policy (Public)
 * GET /api/privacy/public
 */
export const getPrivacyPublic = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }

    const locale = resolveLocaleFromRequest(req);
    const privacy = await PrivacyPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!privacy) {
      return successResponse(res, 200, 'Privacy policy retrieved successfully', {
        title: DEFAULT_TITLE,
        content: DEFAULT_CONTENT
      });
    }

    return successResponse(res, 200, 'Privacy policy retrieved successfully', {
      ...privacy,
      title: resolveLocalizedText(privacy.localizedTitle, locale, privacy.title || DEFAULT_TITLE),
      content: resolveLocalizedText(privacy.localizedContent, locale, privacy.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
    return errorResponse(res, 500, 'Failed to fetch privacy policy');
  }
});

/**
 * Get Privacy Policy (Admin)
 * GET /api/admin/privacy
 */
export const getPrivacy = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }

    let privacy = await PrivacyPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    }).lean();

    if (!privacy) {
      privacy = await PrivacyPolicy.create({
        title: DEFAULT_TITLE,
        localizedTitle: toLocalizedText(DEFAULT_TITLE, DEFAULT_TITLE),
        content: '<p>StackFood is a complete Multi-vendor Food delivery system developed with powerful admin panel will help you to control your business smartly.</p>',
        localizedContent: toLocalizedText(
          '<p>StackFood is a complete Multi-vendor Food delivery system developed with powerful admin panel will help you to control your business smartly.</p>',
          ''
        ),
        targetModule,
        updatedBy: req.admin._id
      });
      privacy = privacy.toObject();
    }

    return successResponse(res, 200, 'Privacy policy retrieved successfully', {
      ...privacy,
      title: resolveLocalizedText(privacy.localizedTitle, 'en', privacy.title || DEFAULT_TITLE),
      content: resolveLocalizedText(privacy.localizedContent, 'en', privacy.content || DEFAULT_CONTENT),
      localizedTitle: mergeLocalizedValue(privacy.localizedTitle, null, privacy.title || DEFAULT_TITLE),
      localizedContent: mergeLocalizedValue(privacy.localizedContent, null, privacy.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
    return errorResponse(res, 500, 'Failed to fetch privacy policy');
  }
});

/**
 * Update Privacy Policy
 * PUT /api/admin/privacy
 */
export const updatePrivacy = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }

    const { title, content, localizedTitle, localizedContent, locale, autoTranslate = true } = req.body;
    const sourceLocale = normalizeLocale(locale || 'en');

    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    let privacy = await PrivacyPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    });

    if (!privacy) {
      privacy = new PrivacyPolicy({
        title: DEFAULT_TITLE,
        content,
        targetModule,
        updatedBy: req.admin._id
      });
    }

    let nextLocalizedTitle = mergeLocalizedValue(privacy.localizedTitle, localizedTitle, privacy.title || DEFAULT_TITLE);
    let nextLocalizedContent = mergeLocalizedValue(privacy.localizedContent, localizedContent, privacy.content || DEFAULT_CONTENT);

    if (typeof title === 'string') {
      nextLocalizedTitle[sourceLocale] = title;
    }
    if (typeof content === 'string') {
      nextLocalizedContent[sourceLocale] = content;
    }

    if (!nextLocalizedTitle.en) {
      nextLocalizedTitle.en = privacy.title || DEFAULT_TITLE;
    }
    if (!nextLocalizedContent.en) {
      nextLocalizedContent.en = privacy.content || content || DEFAULT_CONTENT;
    }

    if (sourceLocale === 'en' && autoTranslate) {
      try {
        const translatedTitle = await buildLocalizedText(nextLocalizedTitle.en);
        if (!localizedTitle?.hi) nextLocalizedTitle.hi = translatedTitle.hi || nextLocalizedTitle.hi;
        if (!localizedTitle?.bn) nextLocalizedTitle.bn = translatedTitle.bn || nextLocalizedTitle.bn;
      } catch (error) {
        console.warn(`[i18n] Privacy title translation failed: ${error.message}`);
      }
      try {
        const translatedContent = await buildLocalizedText(nextLocalizedContent.en);
        if (!localizedContent?.hi) nextLocalizedContent.hi = translatedContent.hi || nextLocalizedContent.hi;
        if (!localizedContent?.bn) nextLocalizedContent.bn = translatedContent.bn || nextLocalizedContent.bn;
      } catch (error) {
        console.warn(`[i18n] Privacy content translation failed: ${error.message}`);
      }
    }

    privacy.title = nextLocalizedTitle.en;
    privacy.content = nextLocalizedContent.en;
    privacy.localizedTitle = nextLocalizedTitle;
    privacy.localizedContent = nextLocalizedContent;
    privacy.targetModule = targetModule;
    privacy.updatedBy = req.admin._id;

    await privacy.save();

    return successResponse(res, 200, 'Privacy policy updated successfully', {
      ...privacy.toObject(),
      title: privacy.title,
      content: privacy.content
    });
  } catch (error) {
    console.error('Error updating privacy policy:', error);
    return errorResponse(res, 500, 'Failed to update privacy policy');
  }
});
