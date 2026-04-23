import { CONTENT_MODULES } from "../constants/contentModules.js";

export function normalizeContentModule(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CONTENT_MODULES.includes(normalized) ? normalized : null;
}

export function parseContentModuleFromRequest(req) {
  const rawModule = req?.query?.module;

  if (typeof rawModule !== "string" || !rawModule.trim()) {
    return {
      module: null,
      error: "Module query parameter is required",
    };
  }

  const module = normalizeContentModule(rawModule);
  if (!module) {
    return {
      module: null,
      error: `Invalid module. Supported values: ${CONTENT_MODULES.join(", ")}`,
    };
  }

  return {
    module,
    error: null,
  };
}

export function buildContentModuleQuery(module) {
  if (module === "user") {
    return {
      $or: [
        { targetModule: "user" },
        { targetModule: { $exists: false } },
        { targetModule: null },
        { targetModule: "" },
      ],
    };
  }

  return { targetModule: module };
}
