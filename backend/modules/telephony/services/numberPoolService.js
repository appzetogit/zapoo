import VirtualNumber from "../models/VirtualNumber.js";

class NoVirtualNumberFoundError extends Error {
  constructor(city) {
    super(`No virtual numbers available for city: ${city}`);
    this.name = "NoVirtualNumberFoundError";
    this.code = "NO_VIRTUAL_NUMBER";
  }
}

const normalizeCity = (city) => {
  if (!city) return "";
  return String(city).trim().toLowerCase();
};

export const selectVirtualNumberByCity = async ({ city }) => {
  const normalizedCity = normalizeCity(city);
  if (!normalizedCity) {
    throw new NoVirtualNumberFoundError(city);
  }

  const number = await VirtualNumber.findOne({ city: normalizedCity }).sort({ createdAt: 1 });
  if (!number) {
    throw new NoVirtualNumberFoundError(normalizedCity);
  }

  return number;
};

export { NoVirtualNumberFoundError };

