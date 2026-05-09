// Compatibility bridge:
// Keep legacy `@/module/deliveryV2` import path working, but source everything
// from canonical `@/modules/DeliveryV2` tree to avoid drift.
export { default } from '@/modules/DeliveryV2';
