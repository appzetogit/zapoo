import CodeOfConduct from "../models/CodeOfConduct.js";
import { successResponse, errorResponse } from "../../../shared/utils/response.js";
import asyncHandler from "../../../shared/middleware/asyncHandler.js";
import { resolveLocaleFromRequest } from "../../../shared/i18n/localeResolver.js";
import { buildLocalizedText } from "../../../shared/i18n/translationService.js";
import { normalizeLocale } from "../../../shared/i18n/localeConstants.js";
import { resolveLocalizedText, toLocalizedText } from "../../../shared/i18n/localizedText.js";
import { buildContentModuleQuery, parseContentModuleFromRequest } from "../utils/contentModule.js";

const DEFAULT_TITLE = "Code of Conduct";
const DEFAULT_CONTENT = "<p>No code of conduct available at the moment.</p>";
const CODE_OF_CONDUCT_MODULE = "restaurant";

function ensureRestaurantModule(targetModule, res) {
  if (targetModule !== CODE_OF_CONDUCT_MODULE) {
    errorResponse(
      res,
      400,
      "Code of conduct is only available for restaurant module",
    );
    return false;
  }
  return true;
}

function mergeLocalizedValue(existingValue, localizedOverride, fallback = "") {
  const merged = toLocalizedText(existingValue, fallback);
  if (localizedOverride && typeof localizedOverride === "object") {
    for (const locale of ["en", "hi", "bn"]) {
      if (typeof localizedOverride[locale] === "string") {
        merged[locale] = localizedOverride[locale];
      }
    }
  }
  return merged;
}

export const getCodeOfConductPublic = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureRestaurantModule(targetModule, res)) {
      return;
    }

    const locale = resolveLocaleFromRequest(req);
    const codeOfConduct = await CodeOfConduct.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule),
    })
      .select("-updatedBy -createdAt -updatedAt -__v")
      .lean();

    if (!codeOfConduct) {
      return successResponse(res, 200, "Code of conduct retrieved successfully", {
        title: DEFAULT_TITLE,
        content: DEFAULT_CONTENT,
      });
    }

    return successResponse(res, 200, "Code of conduct retrieved successfully", {
      ...codeOfConduct,
      title: resolveLocalizedText(
        codeOfConduct.localizedTitle,
        locale,
        codeOfConduct.title || DEFAULT_TITLE,
      ),
      content: resolveLocalizedText(
        codeOfConduct.localizedContent,
        locale,
        codeOfConduct.content || DEFAULT_CONTENT,
      ),
    });
  } catch (error) {
    console.error("Error fetching code of conduct:", error);
    return errorResponse(res, 500, "Failed to fetch code of conduct");
  }
});

export const getCodeOfConduct = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureRestaurantModule(targetModule, res)) {
      return;
    }

    let codeOfConduct = await CodeOfConduct.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule),
    }).lean();

    if (!codeOfConduct) {
      codeOfConduct = await CodeOfConduct.create({
        title: DEFAULT_TITLE,
        localizedTitle: toLocalizedText(DEFAULT_TITLE, DEFAULT_TITLE),
        content: DEFAULT_CONTENT,
        localizedContent: toLocalizedText(DEFAULT_CONTENT, ""),
        targetModule,
        updatedBy: req.admin._id,
      });
      codeOfConduct = codeOfConduct.toObject();
    }

    return successResponse(res, 200, "Code of conduct retrieved successfully", {
      ...codeOfConduct,
      title: resolveLocalizedText(
        codeOfConduct.localizedTitle,
        "en",
        codeOfConduct.title || DEFAULT_TITLE,
      ),
      content: resolveLocalizedText(
        codeOfConduct.localizedContent,
        "en",
        codeOfConduct.content || DEFAULT_CONTENT,
      ),
      localizedTitle: mergeLocalizedValue(
        codeOfConduct.localizedTitle,
        null,
        codeOfConduct.title || DEFAULT_TITLE,
      ),
      localizedContent: mergeLocalizedValue(
        codeOfConduct.localizedContent,
        null,
        codeOfConduct.content || DEFAULT_CONTENT,
      ),
    });
  } catch (error) {
    console.error("Error fetching code of conduct:", error);
    return errorResponse(res, 500, "Failed to fetch code of conduct");
  }
});

export const updateCodeOfConduct = asyncHandler(async (req, res) => {
  try {
    const { module: targetModule, error } = parseContentModuleFromRequest(req);
    if (error) {
      return errorResponse(res, 400, error);
    }
    if (!ensureRestaurantModule(targetModule, res)) {
      return;
    }

    const { title, content, localizedTitle, localizedContent, locale, autoTranslate = true } = req.body;
    const sourceLocale = normalizeLocale(locale || "en");

    if (!content) {
      return errorResponse(res, 400, "Content is required");
    }

    let codeOfConduct = await CodeOfConduct.findOne({
      isActive: true,
      ...buildContentModuleQuery(targetModule),
    });

    if (!codeOfConduct) {
      codeOfConduct = new CodeOfConduct({
        title: DEFAULT_TITLE,
        content,
        targetModule,
        updatedBy: req.admin._id,
      });
    }

    let nextLocalizedTitle = mergeLocalizedValue(
      codeOfConduct.localizedTitle,
      localizedTitle,
      codeOfConduct.title || DEFAULT_TITLE,
    );
    let nextLocalizedContent = mergeLocalizedValue(
      codeOfConduct.localizedContent,
      localizedContent,
      codeOfConduct.content || DEFAULT_CONTENT,
    );

    if (typeof title === "string") nextLocalizedTitle[sourceLocale] = title;
    if (typeof content === "string") nextLocalizedContent[sourceLocale] = content;

    if (!nextLocalizedTitle.en) nextLocalizedTitle.en = codeOfConduct.title || DEFAULT_TITLE;
    if (!nextLocalizedContent.en) {
      nextLocalizedContent.en = codeOfConduct.content || content || DEFAULT_CONTENT;
    }

    if (sourceLocale === "en" && autoTranslate) {
      try {
        const translatedTitle = await buildLocalizedText(nextLocalizedTitle.en);
        if (!localizedTitle?.hi) nextLocalizedTitle.hi = translatedTitle.hi || nextLocalizedTitle.hi;
        if (!localizedTitle?.bn) nextLocalizedTitle.bn = translatedTitle.bn || nextLocalizedTitle.bn;
      } catch (translateError) {
        console.warn(`[i18n] Code of conduct title translation failed: ${translateError.message}`);
      }

      try {
        const translatedContent = await buildLocalizedText(nextLocalizedContent.en);
        if (!localizedContent?.hi) nextLocalizedContent.hi = translatedContent.hi || nextLocalizedContent.hi;
        if (!localizedContent?.bn) nextLocalizedContent.bn = translatedContent.bn || nextLocalizedContent.bn;
      } catch (translateError) {
        console.warn(`[i18n] Code of conduct content translation failed: ${translateError.message}`);
      }
    }

    codeOfConduct.title = nextLocalizedTitle.en;
    codeOfConduct.content = nextLocalizedContent.en;
    codeOfConduct.localizedTitle = nextLocalizedTitle;
    codeOfConduct.localizedContent = nextLocalizedContent;
    codeOfConduct.targetModule = targetModule;
    codeOfConduct.updatedBy = req.admin._id;

    await codeOfConduct.save();

    return successResponse(res, 200, "Code of conduct updated successfully", {
      ...codeOfConduct.toObject(),
      title: codeOfConduct.title,
      content: codeOfConduct.content,
    });
  } catch (error) {
    console.error("Error updating code of conduct:", error);
    return errorResponse(res, 500, "Failed to update code of conduct");
  }
});
