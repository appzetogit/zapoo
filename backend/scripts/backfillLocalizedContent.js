import dotenv from 'dotenv';
import mongoose from 'mongoose';
import TermsAndCondition from '../modules/admin/models/TermsAndCondition.js';
import PrivacyPolicy from '../modules/admin/models/PrivacyPolicy.js';
import RefundPolicy from '../modules/admin/models/RefundPolicy.js';
import ShippingPolicy from '../modules/admin/models/ShippingPolicy.js';
import CancellationPolicy from '../modules/admin/models/CancellationPolicy.js';
import About from '../modules/admin/models/About.js';
import Zone from '../modules/admin/models/Zone.js';
import AdminCoupon from '../modules/admin/models/AdminCoupon.js';
import AdminCategoryManagement from '../modules/admin/models/AdminCategoryManagement.js';
import { toLocalizedText } from '../shared/i18n/localizedText.js';
import { buildLocalizedText } from '../shared/i18n/translationService.js';

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;

if (!uri) {
  console.error('Missing MongoDB URI. Set MONGODB_URI in backend/.env');
  process.exit(1);
}

async function localizedWithTranslation(baseText, existingLocalized) {
  const merged = toLocalizedText(existingLocalized, baseText || '');
  if (baseText && !merged.en) {
    merged.en = baseText;
  }

  if (merged.en && (!merged.hi || !merged.bn)) {
    try {
      const translated = await buildLocalizedText(merged.en);
      if (!merged.hi) merged.hi = translated.hi || '';
      if (!merged.bn) merged.bn = translated.bn || '';
    } catch (error) {
      console.warn(`[i18n] backfill translation failed: ${error.message}`);
    }
  }
  return merged;
}

async function backfillPolicy(Model, name, fallbackTitle) {
  const docs = await Model.find({});
  for (const doc of docs) {
    const titleBase = doc.title || fallbackTitle;
    const contentBase = doc.content || '';
    doc.localizedTitle = await localizedWithTranslation(titleBase, doc.localizedTitle);
    doc.localizedContent = await localizedWithTranslation(contentBase, doc.localizedContent);
    doc.title = doc.localizedTitle.en || titleBase;
    doc.content = doc.localizedContent.en || contentBase;
    await doc.save();
  }
  console.log(`[backfill] ${name}: ${docs.length} document(s) updated`);
}

async function backfillAbout() {
  const docs = await About.find({});
  for (const doc of docs) {
    doc.localizedDescription = await localizedWithTranslation(
      doc.description || '',
      doc.localizedDescription
    );
    doc.description = doc.localizedDescription.en || doc.description || '';

    doc.features = await Promise.all(
      (doc.features || []).map(async (feature) => {
        const localizedTitle = await localizedWithTranslation(
          feature.title || '',
          feature.localizedTitle
        );
        const localizedDescription = await localizedWithTranslation(
          feature.description || '',
          feature.localizedDescription
        );
        return {
          ...feature.toObject(),
          title: localizedTitle.en || feature.title || '',
          localizedTitle,
          description: localizedDescription.en || feature.description || '',
          localizedDescription
        };
      })
    );

    doc.stats = await Promise.all(
      (doc.stats || []).map(async (stat) => {
        const localizedLabel = await localizedWithTranslation(
          stat.label || '',
          stat.localizedLabel
        );
        return {
          ...stat.toObject(),
          label: localizedLabel.en || stat.label || '',
          localizedLabel
        };
      })
    );

    await doc.save();
  }
  console.log(`[backfill] About: ${docs.length} document(s) updated`);
}

async function backfillZones() {
  const docs = await Zone.find({});
  for (const doc of docs) {
    const nameBase = doc.name || doc.zoneName || '';
    const zoneNameBase = doc.zoneName || doc.name || '';
    doc.localizedName = await localizedWithTranslation(nameBase, doc.localizedName);
    doc.localizedZoneName = await localizedWithTranslation(zoneNameBase, doc.localizedZoneName);
    doc.name = doc.localizedName.en || nameBase;
    doc.zoneName = doc.localizedZoneName.en || zoneNameBase;
    await doc.save();
  }
  console.log(`[backfill] Zone: ${docs.length} document(s) updated`);
}

async function backfillCoupons() {
  const docs = await AdminCoupon.find({});
  for (const doc of docs) {
    const titleBase = doc.title || '';
    const descriptionBase = doc.description || '';
    doc.localizedTitle = await localizedWithTranslation(titleBase, doc.localizedTitle);
    doc.localizedDescription = await localizedWithTranslation(
      descriptionBase,
      doc.localizedDescription
    );
    doc.title = doc.localizedTitle.en || titleBase;
    doc.description = doc.localizedDescription.en || descriptionBase;
    await doc.save();
  }
  console.log(`[backfill] AdminCoupon: ${docs.length} document(s) updated`);
}

async function backfillAdminCategories() {
  const docs = await AdminCategoryManagement.find({});
  for (const doc of docs) {
    const nameBase = doc.name || '';
    const descriptionBase = doc.description || '';
    doc.localizedName = await localizedWithTranslation(nameBase, doc.localizedName);
    doc.localizedDescription = await localizedWithTranslation(
      descriptionBase,
      doc.localizedDescription
    );
    doc.name = doc.localizedName.en || nameBase;
    doc.description = doc.localizedDescription.en || descriptionBase;
    await doc.save();
  }
  console.log(`[backfill] AdminCategoryManagement: ${docs.length} document(s) updated`);
}

async function run() {
  await mongoose.connect(uri);
  console.log('[backfill] connected to MongoDB');

  await backfillPolicy(TermsAndCondition, 'TermsAndCondition', 'Terms and Conditions');
  await backfillPolicy(PrivacyPolicy, 'PrivacyPolicy', 'Privacy Policy');
  await backfillPolicy(RefundPolicy, 'RefundPolicy', 'Refund Policy');
  await backfillPolicy(ShippingPolicy, 'ShippingPolicy', 'Shipping Policy');
  await backfillPolicy(CancellationPolicy, 'CancellationPolicy', 'Cancellation Policy');
  await backfillAbout();
  await backfillZones();
  await backfillCoupons();
  await backfillAdminCategories();

  await mongoose.disconnect();
  console.log('[backfill] done');
}

run().catch(async (error) => {
  console.error('[backfill] failed:', error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
