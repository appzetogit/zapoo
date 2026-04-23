import CancellationPolicy from '../models/CancellationPolicy.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText, toLocalizedText } from '../../../shared/i18n/localizedText.js';
import { buildContentModuleQuery, parseContentModuleFromRequest } from '../utils/contentModule.js';

const DEFAULT_TITLE = 'Cancellation Policy';
const DEFAULT_CONTENT = '<p>No cancellation policy available at the moment.</p>';
const CANCELLATION_MODULE = 'user';

function ensureUserCancellationModule(targetModule, res) {
  if (targetModule !== CANCELLATION_MODULE) {
    errorResponse(res, 400, 'Cancellation policy is only available for user module');
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

export const getCancellationPublic = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureUserCancellationModule(targetModule, res)) return;

    const locale = resolveLocaleFromRequest(req);
    const cancellation = await CancellationPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!cancellation) {
      return successResponse(res, 200, 'Cancellation policy retrieved successfully', {
        title: DEFAULT_TITLE,
        content: DEFAULT_CONTENT
      });
    }

    return successResponse(res, 200, 'Cancellation policy retrieved successfully', {
      ...cancellation,
      title: resolveLocalizedText(cancellation.localizedTitle, locale, cancellation.title || DEFAULT_TITLE),
      content: resolveLocalizedText(cancellation.localizedContent, locale, cancellation.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching cancellation policy:', error);
    return errorResponse(res, 500, 'Failed to fetch cancellation policy');
  }
});

export const getCancellation = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureUserCancellationModule(targetModule, res)) return;

    let cancellation = await CancellationPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    }).lean();

    if (!cancellation) {
      cancellation = await CancellationPolicy.create({
        title: DEFAULT_TITLE,
        localizedTitle: toLocalizedText(DEFAULT_TITLE, DEFAULT_TITLE),
        content: '<p>This is a demo cancellation policy. Please update with your actual cancellation terms and conditions.</p>',
        localizedContent: toLocalizedText(
          '<p>This is a demo cancellation policy. Please update with your actual cancellation terms and conditions.</p>',
          ''
        ),
        targetModule,
        updatedBy: req.admin._id
      });
      cancellation = cancellation.toObject();
    }

    return successResponse(res, 200, 'Cancellation policy retrieved successfully', {
      ...cancellation,
      title: resolveLocalizedText(cancellation.localizedTitle, 'en', cancellation.title || DEFAULT_TITLE),
      content: resolveLocalizedText(cancellation.localizedContent, 'en', cancellation.content || DEFAULT_CONTENT),
      localizedTitle: mergeLocalizedValue(cancellation.localizedTitle, null, cancellation.title || DEFAULT_TITLE),
      localizedContent: mergeLocalizedValue(cancellation.localizedContent, null, cancellation.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching cancellation policy:', error);
    return errorResponse(res, 500, 'Failed to fetch cancellation policy');
  }
});

export const updateCancellation = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureUserCancellationModule(targetModule, res)) return;

    const { title, content, localizedTitle, localizedContent, locale, autoTranslate = true } = req.body;
    const sourceLocale = normalizeLocale(locale || 'en');

    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    let cancellation = await CancellationPolicy.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    });
    if (!cancellation) {
      cancellation = new CancellationPolicy({
        title: DEFAULT_TITLE,
        content,
        targetModule,
        updatedBy: req.admin._id
      });
    }

    let nextLocalizedTitle = mergeLocalizedValue(cancellation.localizedTitle, localizedTitle, cancellation.title || DEFAULT_TITLE);
    let nextLocalizedContent = mergeLocalizedValue(cancellation.localizedContent, localizedContent, cancellation.content || DEFAULT_CONTENT);

    if (typeof title === 'string') nextLocalizedTitle[sourceLocale] = title;
    if (typeof content === 'string') nextLocalizedContent[sourceLocale] = content;

    if (!nextLocalizedTitle.en) nextLocalizedTitle.en = cancellation.title || DEFAULT_TITLE;
    if (!nextLocalizedContent.en) nextLocalizedContent.en = cancellation.content || content || DEFAULT_CONTENT;

    if (sourceLocale === 'en' && autoTranslate) {
      try {
        const translatedTitle = await buildLocalizedText(nextLocalizedTitle.en);
        if (!localizedTitle?.hi) nextLocalizedTitle.hi = translatedTitle.hi || nextLocalizedTitle.hi;
        if (!localizedTitle?.bn) nextLocalizedTitle.bn = translatedTitle.bn || nextLocalizedTitle.bn;
      } catch (error) {
        console.warn(`[i18n] Cancellation title translation failed: ${error.message}`);
      }
      try {
        const translatedContent = await buildLocalizedText(nextLocalizedContent.en);
        if (!localizedContent?.hi) nextLocalizedContent.hi = translatedContent.hi || nextLocalizedContent.hi;
        if (!localizedContent?.bn) nextLocalizedContent.bn = translatedContent.bn || nextLocalizedContent.bn;
      } catch (error) {
        console.warn(`[i18n] Cancellation content translation failed: ${error.message}`);
      }
    }

    cancellation.title = nextLocalizedTitle.en;
    cancellation.content = nextLocalizedContent.en;
    cancellation.localizedTitle = nextLocalizedTitle;
    cancellation.localizedContent = nextLocalizedContent;
    cancellation.targetModule = targetModule;
    cancellation.updatedBy = req.admin._id;

    await cancellation.save();

    return successResponse(res, 200, 'Cancellation policy updated successfully', {
      ...cancellation.toObject(),
      title: cancellation.title,
      content: cancellation.content
    });
  } catch (error) {
    console.error('Error updating cancellation policy:', error);
    return errorResponse(res, 500, 'Failed to update cancellation policy');
  }
});
