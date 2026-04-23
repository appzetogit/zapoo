import About from '../models/About.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText, toLocalizedText } from '../../../shared/i18n/localizedText.js';
import { buildContentModuleQuery, parseContentModuleFromRequest } from '../utils/contentModule.js';

const DEFAULT_ABOUT = {
  appName: 'Appzeto Food',
  version: '1.0.0',
  description:
    'Your trusted food delivery partner, bringing delicious meals right to your doorstep. Experience the convenience of ordering from your favorite restaurants with fast, reliable delivery.',
  logo: '',
  features: [
    {
      icon: 'Heart',
      title: 'Made with Love',
      description: "We're passionate about bringing you the best food experience possible.",
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-100 dark:bg-pink-900/30',
      order: 0
    },
    {
      icon: 'Users',
      title: 'Serving Millions',
      description: 'Join millions of satisfied customers enjoying great food every day.',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      order: 1
    },
    {
      icon: 'Shield',
      title: 'Quality Assured',
      description: 'We partner with the best restaurants to ensure quality and freshness.',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      order: 2
    },
    {
      icon: 'Clock',
      title: 'Fast Delivery',
      description: 'Get your favorite meals delivered quickly and safely to your doorstep.',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      order: 3
    }
  ],
  stats: [
    { label: 'Happy Customers', value: '1M+', icon: 'Users', order: 0 },
    { label: 'Restaurant Partners', value: '10K+', icon: 'Award', order: 1 },
    { label: 'Cities Served', value: '50+', icon: 'Star', order: 2 }
  ]
};

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

async function enrichLocalizedText(localized, sourceLocale, autoTranslate, explicitOverrides = null) {
  if (sourceLocale === 'en' && autoTranslate && localized.en) {
    try {
      const translated = await buildLocalizedText(localized.en);
      if (!explicitOverrides?.hi) localized.hi = translated.hi || localized.hi;
      if (!explicitOverrides?.bn) localized.bn = translated.bn || localized.bn;
    } catch (error) {
      console.warn(`[i18n] About translation failed: ${error.message}`);
    }
  }
  return localized;
}

function toPublicAbout(about, locale) {
  return {
    ...about,
    description: resolveLocalizedText(
      about.localizedDescription,
      locale,
      about.description || DEFAULT_ABOUT.description
    ),
    features: Array.isArray(about.features)
      ? about.features.map((feature) => ({
          ...feature,
          title: resolveLocalizedText(feature.localizedTitle, locale, feature.title || ''),
          description: resolveLocalizedText(
            feature.localizedDescription,
            locale,
            feature.description || ''
          )
        }))
      : [],
    stats: Array.isArray(about.stats)
      ? about.stats.map((stat) => ({
          ...stat,
          label: resolveLocalizedText(stat.localizedLabel, locale, stat.label || '')
        }))
      : []
  };
}

export const getAboutPublic = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }

    const locale = resolveLocaleFromRequest(req);
    const about = await About.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!about) {
      return successResponse(res, 200, 'About page data retrieved successfully', DEFAULT_ABOUT);
    }

    return successResponse(
      res,
      200,
      'About page data retrieved successfully',
      toPublicAbout(about, locale)
    );
  } catch (error) {
    console.error('Error fetching about page:', error);
    return errorResponse(res, 500, 'Failed to fetch about page data');
  }
});

export const getAbout = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }

    let about = await About.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    }).lean();

    if (!about) {
      const defaultDescription = toLocalizedText(DEFAULT_ABOUT.description, DEFAULT_ABOUT.description);
      const defaultFeatures = DEFAULT_ABOUT.features.map((feature) => ({
        ...feature,
        localizedTitle: toLocalizedText(feature.title, feature.title),
        localizedDescription: toLocalizedText(feature.description, feature.description)
      }));
      const defaultStats = DEFAULT_ABOUT.stats.map((stat) => ({
        ...stat,
        localizedLabel: toLocalizedText(stat.label, stat.label)
      }));

      about = await About.create({
        ...DEFAULT_ABOUT,
        localizedDescription: defaultDescription,
        features: defaultFeatures,
        stats: defaultStats,
        targetModule,
        updatedBy: req.admin._id
      });
      about = about.toObject();
    }

    return successResponse(res, 200, 'About page data retrieved successfully', {
      ...about,
      description: resolveLocalizedText(
        about.localizedDescription,
        'en',
        about.description || DEFAULT_ABOUT.description
      ),
      localizedDescription: mergeLocalizedValue(
        about.localizedDescription,
        null,
        about.description || DEFAULT_ABOUT.description
      )
    });
  } catch (error) {
    console.error('Error fetching about page:', error);
    return errorResponse(res, 500, 'Failed to fetch about page data');
  }
});

export const updateAbout = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }

    const {
      appName,
      version,
      description,
      logo,
      features,
      stats,
      localizedDescription,
      locale,
      autoTranslate = true
    } = req.body;

    if (!appName || !version || !description) {
      return errorResponse(res, 400, 'App name, version, and description are required');
    }

    const sourceLocale = normalizeLocale(locale || 'en');
    let about = await About.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule)
    });

    if (!about) {
      about = new About({
        ...DEFAULT_ABOUT,
        targetModule,
        updatedBy: req.admin._id
      });
    }

    let nextLocalizedDescription = mergeLocalizedValue(
      about.localizedDescription,
      localizedDescription,
      about.description || DEFAULT_ABOUT.description
    );
    nextLocalizedDescription[sourceLocale] = description;
    if (!nextLocalizedDescription.en) nextLocalizedDescription.en = description;
    nextLocalizedDescription = await enrichLocalizedText(
      nextLocalizedDescription,
      sourceLocale,
      autoTranslate,
      localizedDescription
    );

    let nextFeatures = about.features || [];
    if (Array.isArray(features)) {
      nextFeatures = [];
      for (let index = 0; index < features.length; index += 1) {
        const incoming = features[index] || {};
        const fallbackFeature = about.features?.[index] || {};
        let nextLocalizedTitle = mergeLocalizedValue(
          incoming.localizedTitle || fallbackFeature.localizedTitle,
          incoming.localizedTitle,
          incoming.title || fallbackFeature.title || ''
        );
        let nextLocalizedFeatureDescription = mergeLocalizedValue(
          incoming.localizedDescription || fallbackFeature.localizedDescription,
          incoming.localizedDescription,
          incoming.description || fallbackFeature.description || ''
        );

        if (typeof incoming.title === 'string') nextLocalizedTitle[sourceLocale] = incoming.title;
        if (typeof incoming.description === 'string') {
          nextLocalizedFeatureDescription[sourceLocale] = incoming.description;
        }
        if (!nextLocalizedTitle.en) nextLocalizedTitle.en = incoming.title || fallbackFeature.title || '';
        if (!nextLocalizedFeatureDescription.en) {
          nextLocalizedFeatureDescription.en =
            incoming.description || fallbackFeature.description || '';
        }

        nextLocalizedTitle = await enrichLocalizedText(
          nextLocalizedTitle,
          sourceLocale,
          autoTranslate,
          incoming.localizedTitle
        );
        nextLocalizedFeatureDescription = await enrichLocalizedText(
          nextLocalizedFeatureDescription,
          sourceLocale,
          autoTranslate,
          incoming.localizedDescription
        );

        nextFeatures.push({
          icon: incoming.icon || fallbackFeature.icon || 'Info',
          title: nextLocalizedTitle.en,
          localizedTitle: nextLocalizedTitle,
          description: nextLocalizedFeatureDescription.en,
          localizedDescription: nextLocalizedFeatureDescription,
          color: incoming.color || fallbackFeature.color || 'text-gray-600',
          bgColor: incoming.bgColor || fallbackFeature.bgColor || 'bg-gray-100',
          order: typeof incoming.order === 'number' ? incoming.order : index
        });
      }
    }

    let nextStats = about.stats || [];
    if (Array.isArray(stats)) {
      nextStats = [];
      for (let index = 0; index < stats.length; index += 1) {
        const incoming = stats[index] || {};
        const fallbackStat = about.stats?.[index] || {};
        let nextLocalizedLabel = mergeLocalizedValue(
          incoming.localizedLabel || fallbackStat.localizedLabel,
          incoming.localizedLabel,
          incoming.label || fallbackStat.label || ''
        );

        if (typeof incoming.label === 'string') nextLocalizedLabel[sourceLocale] = incoming.label;
        if (!nextLocalizedLabel.en) nextLocalizedLabel.en = incoming.label || fallbackStat.label || '';
        nextLocalizedLabel = await enrichLocalizedText(
          nextLocalizedLabel,
          sourceLocale,
          autoTranslate,
          incoming.localizedLabel
        );

        nextStats.push({
          label: nextLocalizedLabel.en,
          localizedLabel: nextLocalizedLabel,
          value: incoming.value || fallbackStat.value || '',
          icon: incoming.icon || fallbackStat.icon || 'Info',
          order: typeof incoming.order === 'number' ? incoming.order : index
        });
      }
    }

    about.appName = appName;
    about.version = version;
    about.description = nextLocalizedDescription.en;
    about.localizedDescription = nextLocalizedDescription;
    about.targetModule = targetModule;
    if (logo !== undefined) about.logo = logo;
    if (features !== undefined) about.features = nextFeatures;
    if (stats !== undefined) about.stats = nextStats;
    about.updatedBy = req.admin._id;

    await about.save();

    return successResponse(res, 200, 'About page updated successfully', {
      ...about.toObject(),
      description: about.description
    });
  } catch (error) {
    console.error('Error updating about page:', error);
    return errorResponse(res, 500, 'Failed to update about page');
  }
});
