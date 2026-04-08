class NoVirtualNumberFoundError extends Error {
  constructor(city) {
    super(`No virtual numbers configured for city: ${city}`);
    this.name = "NoVirtualNumberFoundError";
    this.code = "NO_VIRTUAL_NUMBER";
  }
}

const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/[\s\-+]/g, "").trim();
};

console.log("EXOTEL_VIRTUAL_NUMBERS:", process.env.EXOTEL_VIRTUAL_NUMBERS);

const normalizeConfiguredNumbers = () => {
  const rawNumbers = process.env.EXOTEL_VIRTUAL_NUMBERS || process.env.EXOTEL_VIRTUAL_NUMBER || "";
  return String(rawNumbers)
    .split(",")
    .map((number) => normalizePhone(number))
    .filter(Boolean)
    .map((number) => `+91${number.slice(-10)}`);
};

const configuredNumbers = () => {
  const numbers = normalizeConfiguredNumbers();
  if (!numbers.length) {
    throw new NoVirtualNumberFoundError("global");
  }
  return numbers;
};

export const selectVirtualNumberByCity = async ({ city } = {}) => {
  const numbers = configuredNumbers();
  const selectedNumber = numbers[0];
  return {
    number: selectedNumber,
    city: String(city || process.env.EXOTEL_VIRTUAL_CITY || "global").trim().toLowerCase(),
  };
};

export const getConfiguredVirtualNumbers = () => configuredNumbers();

export const selectVirtualNumberForOrder = (orderId) => {
  const numbers = configuredNumbers();
  if (!numbers.length) {
    throw new NoVirtualNumberFoundError("global");
  }

  const key = String(orderId || "").trim();
  if (!key) {
    return numbers[0];
  }

  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return numbers[hash % numbers.length];
};

export { NoVirtualNumberFoundError };

