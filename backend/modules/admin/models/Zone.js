import mongoose from 'mongoose';
import Tier from './Tier.js';
import * as turf from '@turf/turf';
import { localizedTextSchema } from '../../../shared/i18n/localizedText.js';

const coordinateSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  }
}, { _id: false });

const zoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    localizedName: {
      type: localizedTextSchema,
      default: () => ({ en: '', hi: '', bn: '' })
    },
    serviceLocation: {
      type: String,
      required: false,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: 'India'
    },
    zoneName: {
      type: String,
      required: false,
      trim: true
    },
    localizedZoneName: {
      type: localizedTextSchema,
      default: () => ({ en: '', hi: '', bn: '' })
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: false
    },
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tier',
      required: false
    },
    deliveryPricing: {
      basePay: {
        type: Number,
        default: 0,
        min: 0
      },
      baseFee: {
        type: Number,
        default: 0,
        min: 0
      },
      freeDeliveryThreshold: {
        type: Number,
        default: 0,
        min: 0
      },
      isOverridden: {
        type: Boolean,
        default: false
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },
    area: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      enum: ['kilometer', 'miles'],
      default: 'kilometer'
    },
    // Zone coordinates (polygon points)
    coordinates: {
      type: [coordinateSchema],
      required: true,
      validate: {
        validator: function (coords) {
          return coords.length >= 3; // Minimum 3 points for a polygon
        },
        message: 'Zone must have at least 3 coordinates'
      }
    },
    // GeoJSON polygon for spatial queries
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon'
      },
      coordinates: {
        type: [[[Number]]],
        required: false // Will be created by pre-save hook
      }
    },
    // Status
    isActive: {
      type: Boolean,
      default: true
    },
    // Created by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
zoneSchema.index({ restaurantId: 1 });
zoneSchema.index({ isActive: 1 });
zoneSchema.index({ boundary: '2dsphere' }); // For spatial queries
zoneSchema.index({ serviceLocation: 'text', name: 'text' }); // For text search

/**
 * Rebuild GeoJSON boundary, recalculate area (sq km), and assign tier from active tiers.
 * Safe to call before save(); pre-save also runs this so persisted zones stay consistent.
 */
zoneSchema.methods.recalculateBoundaryAreaAndTier = async function recalculateBoundaryAreaAndTier() {
  if (!this.coordinates || this.coordinates.length < 3) {
    return;
  }

  const geoJsonCoords = this.coordinates.map(coord => [coord.longitude, coord.latitude]);

  if (geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
    geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1]) {
    geoJsonCoords.push(geoJsonCoords[0]);
  }

  this.boundary = {
    type: 'Polygon',
    coordinates: [geoJsonCoords]
  };

  const poly = turf.polygon([geoJsonCoords]);
  const areaInSqMeters = turf.area(poly);
  const areaInSqKm = areaInSqMeters / 1000000;
  this.area = parseFloat(areaInSqKm.toFixed(2));

  const tier = await Tier.findOne({
    isActive: true,
    minArea: { $lte: this.area },
    maxArea: { $gte: this.area }
  }).sort({ rank: 1 });

  if (tier) {
    this.tierId = tier._id;

    if (!this.deliveryPricing || !this.deliveryPricing.isOverridden) {
      if (tier.deliveryPricing) {
        this.deliveryPricing = {
          basePay: tier.deliveryPricing.basePay,
          baseFee: tier.deliveryPricing.baseFee,
          freeDeliveryThreshold: tier.deliveryPricing.freeDeliveryThreshold,
          isOverridden: false,
          lastUpdated: new Date()
        };
      }
    }
  } else {
    this.tierId = null;
  }
};

zoneSchema.pre('save', async function (next) {
  try {
    await this.recalculateBoundaryAreaAndTier();
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if a point is within the zone
zoneSchema.methods.containsPoint = function (latitude, longitude) {
  if (!this.boundary || !this.boundary.coordinates) {
    return false;
  }

  // GeoJSON coords are [longitude, latitude]
  // Ray casting: cast a horizontal ray from the point eastward
  // and count how many polygon edges it crosses.
  const coords = this.boundary.coordinates[0]; // [[lng, lat], ...]
  let inside = false;

  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const lngI = coords[i][0], latI = coords[i][1]; // edge vertex i
    const lngJ = coords[j][0], latJ = coords[j][1]; // edge vertex j

    // Check if the horizontal ray from (longitude, latitude) crosses this edge
    const latCrossed = (latI > latitude) !== (latJ > latitude);
    const lngAtCross = lngI + (lngJ - lngI) * (latitude - latI) / (latJ - latI);

    if (latCrossed && longitude < lngAtCross) {
      inside = !inside;
    }
  }

  return inside;
};


export default mongoose.model('Zone', zoneSchema);
