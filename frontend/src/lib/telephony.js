export const EXOTEL_VIRTUAL_NUMBER = import.meta.env.VITE_EXOTEL_VIRTUAL_NUMBER || "03348052382";

export const getExotelTelLink = () => {
  if (!EXOTEL_VIRTUAL_NUMBER) {
    return null;
  }
  return `tel:${EXOTEL_VIRTUAL_NUMBER}`;
};

export const getExotelVirtualNumber = () => EXOTEL_VIRTUAL_NUMBER;
