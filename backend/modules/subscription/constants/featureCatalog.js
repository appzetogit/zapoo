export const FEATURE_CATALOG = [
  {
    key: "order_management",
    label: "Order Management",
    description: "View and manage incoming orders.",
    category: "Operations",
    isActive: true,
  },
  {
    key: "menu_control",
    label: "Menu Control",
    description: "Create and manage menu sections, items, and add-ons.",
    category: "Operations",
    isActive: true,
  },
  {
    key: "basic_reports",
    label: "Basic Reports",
    description: "Access finance, wallet, and core business reports.",
    category: "Analytics",
    isActive: true,
  },
  {
    key: "marketing_tools",
    label: "Marketing Tools",
    description: "Create offers and customer promotions.",
    category: "Growth",
    isActive: true,
  },
  {
    key: "advanced_analytics",
    label: "Advanced Analytics",
    description: "Access advanced analytics dashboards.",
    category: "Analytics",
    isActive: true,
  },
  {
    key: "advanced_marketing_tools",
    label: "Advanced Marketing Tools",
    description: "Access advanced campaign and marketing capabilities.",
    category: "Growth",
    isActive: true,
  },
  {
    key: "relationship_manager",
    label: "Relationship Manager",
    description: "Request and access relationship manager support.",
    category: "Support",
    isActive: true,
  },
];

export const FEATURE_KEY_SET = new Set(FEATURE_CATALOG.map((item) => item.key));

export const normalizeFeatureKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export const normalizeFeatureKeys = (keys) => {
  if (!Array.isArray(keys)) return [];
  const normalized = keys
    .map((value) => normalizeFeatureKey(value))
    .filter(Boolean);
  return [...new Set(normalized)];
};

export const splitFeatureKeysByValidity = (keys) => {
  const normalized = normalizeFeatureKeys(keys);
  const valid = [];
  const invalid = [];

  for (const key of normalized) {
    if (FEATURE_KEY_SET.has(key)) valid.push(key);
    else invalid.push(key);
  }

  return { valid, invalid };
};
