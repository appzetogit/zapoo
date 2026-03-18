import VirtualNumber from "../models/VirtualNumber.js";

class NoFreeVirtualNumberError extends Error {
  constructor(city) {
    super(`No free virtual numbers available for city: ${city}`);
    this.name = "NoFreeVirtualNumberError";
    this.code = "NO_FREE_VIRTUAL_NUMBER";
  }
}

const normalizeCity = (city) => {
  if (!city) return "";
  return String(city).trim().toLowerCase();
};

export const allocateNumberForOrder = async ({ orderId, city }) => {
  const normalizedCity = normalizeCity(city);

  const allocated = await VirtualNumber.findOneAndUpdate(
    {
      city: normalizedCity,
      status: "free",
    },
    {
      $set: {
        status: "allocated",
        allocated_order_id: orderId,
        allocated_at: new Date(),
      },
    },
    {
      new: true,
      sort: { allocated_at: 1, createdAt: 1 },
    }
  );

  if (!allocated) {
    throw new NoFreeVirtualNumberError(normalizedCity);
  }

  return allocated;
};

export const releaseNumberForOrder = async (orderId) => {
  if (!orderId) return;

  await VirtualNumber.findOneAndUpdate(
    {
      allocated_order_id: orderId,
      status: "allocated",
    },
    {
      $set: {
        status: "free",
        allocated_order_id: null,
        allocated_at: null,
      },
    }
  );
};

export const getAllocatedNumberForOrder = async (orderId) => {
  if (!orderId) return null;

  return VirtualNumber.findOne({
    allocated_order_id: orderId,
    status: "allocated",
  });
};

export { NoFreeVirtualNumberError };

