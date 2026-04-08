import TermsAndCondition from '../models/TermsAndCondition.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText, toLocalizedText } from '../../../shared/i18n/localizedText.js';

const DEFAULT_TITLE = 'Terms and Conditions';
const DEFAULT_CONTENT = '<p>No terms and conditions available at the moment.</p>';

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
 * Get Terms and Condition (Public)
 * GET /api/terms/public
 */
export const getTermsPublic = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const terms = await TermsAndCondition.findOne({ isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!terms) {
      return successResponse(res, 200, 'Terms and conditions retrieved successfully', {
        title: DEFAULT_TITLE,
        content: DEFAULT_CONTENT
      });
    }

    return successResponse(res, 200, 'Terms and conditions retrieved successfully', {
      ...terms,
      title: resolveLocalizedText(terms.localizedTitle, locale, terms.title || DEFAULT_TITLE),
      content: resolveLocalizedText(terms.localizedContent, locale, terms.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching terms and conditions:', error);
    return errorResponse(res, 500, 'Failed to fetch terms and conditions');
  }
});

/**
 * Get Terms and Condition (Admin)
 * GET /api/admin/terms
 */
export const getTerms = asyncHandler(async (req, res) => {
  try {
    let terms = await TermsAndCondition.findOne({ isActive: true }).lean();

    if (!terms) {
      terms = await TermsAndCondition.create({
        title: DEFAULT_TITLE,
        localizedTitle: toLocalizedText(DEFAULT_TITLE, DEFAULT_TITLE),
        content: '<p>This is a test Terms & Conditions</p><p><strong>Terms of Use</strong></p><p>This Terms of Use ("Terms") applies to your access to and use of the website and the mobile application (collectively, the "Platform"). Please read these Terms carefully.</p>',
        localizedContent: toLocalizedText(
          '<p>This is a test Terms & Conditions</p><p><strong>Terms of Use</strong></p><p>This Terms of Use ("Terms") applies to your access to and use of the website and the mobile application (collectively, the "Platform"). Please read these Terms carefully.</p>',
          ''
        ),
        updatedBy: req.admin._id
      });
      terms = terms.toObject();
    }

    return successResponse(res, 200, 'Terms and conditions retrieved successfully', {
      ...terms,
      title: resolveLocalizedText(terms.localizedTitle, 'en', terms.title || DEFAULT_TITLE),
      content: resolveLocalizedText(terms.localizedContent, 'en', terms.content || DEFAULT_CONTENT),
      localizedTitle: mergeLocalizedValue(terms.localizedTitle, null, terms.title || DEFAULT_TITLE),
      localizedContent: mergeLocalizedValue(terms.localizedContent, null, terms.content || DEFAULT_CONTENT)
    });
  } catch (error) {
    console.error('Error fetching terms and conditions:', error);
    return errorResponse(res, 500, 'Failed to fetch terms and conditions');
  }
});

/**
 * Update Terms and Condition
 * PUT /api/admin/terms
 */
export const updateTerms = asyncHandler(async (req, res) => {
  try {
    const { title, content, localizedTitle, localizedContent, locale, autoTranslate = true } = req.body;
    const sourceLocale = normalizeLocale(locale || 'en');

    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    let terms = await TermsAndCondition.findOne({ isActive: true });

    if (!terms) {
      terms = new TermsAndCondition({
        title: DEFAULT_TITLE,
        content,
        updatedBy: req.admin._id
      });
    }

    let nextLocalizedTitle = mergeLocalizedValue(terms.localizedTitle, localizedTitle, terms.title || DEFAULT_TITLE);
    let nextLocalizedContent = mergeLocalizedValue(terms.localizedContent, localizedContent, terms.content || DEFAULT_CONTENT);

    if (typeof title === 'string') {
      nextLocalizedTitle[sourceLocale] = title;
    }
    if (typeof content === 'string') {
      nextLocalizedContent[sourceLocale] = content;
    }

    if (!nextLocalizedTitle.en) {
      nextLocalizedTitle.en = terms.title || DEFAULT_TITLE;
    }
    if (!nextLocalizedContent.en) {
      nextLocalizedContent.en = terms.content || content || DEFAULT_CONTENT;
    }

    if (sourceLocale === 'en' && autoTranslate) {
      try {
        const translatedTitle = await buildLocalizedText(nextLocalizedTitle.en);
        if (!localizedTitle?.hi) nextLocalizedTitle.hi = translatedTitle.hi || nextLocalizedTitle.hi;
        if (!localizedTitle?.bn) nextLocalizedTitle.bn = translatedTitle.bn || nextLocalizedTitle.bn;
      } catch (error) {
        console.warn(`[i18n] Terms title translation failed: ${error.message}`);
      }
      try {
        const translatedContent = await buildLocalizedText(nextLocalizedContent.en);
        if (!localizedContent?.hi) nextLocalizedContent.hi = translatedContent.hi || nextLocalizedContent.hi;
        if (!localizedContent?.bn) nextLocalizedContent.bn = translatedContent.bn || nextLocalizedContent.bn;
      } catch (error) {
        console.warn(`[i18n] Terms content translation failed: ${error.message}`);
      }
    }

    terms.title = nextLocalizedTitle.en;
    terms.content = nextLocalizedContent.en;
    terms.localizedTitle = nextLocalizedTitle;
    terms.localizedContent = nextLocalizedContent;
    terms.updatedBy = req.admin._id;

    await terms.save();

    return successResponse(res, 200, 'Terms and conditions updated successfully', {
      ...terms.toObject(),
      title: terms.title,
      content: terms.content
    });
  } catch (error) {
    console.error('Error updating terms and conditions:', error);
    return errorResponse(res, 500, 'Failed to update terms and conditions');
  }
});
