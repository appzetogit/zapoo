import mongoose from 'mongoose';
import Tier from './Tier.js';
import * as turf from '@turf/turf';

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
    recommendedItemFee: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Fee for recommended items in this zone (if overridden)'
    },
    isRecommendedFeeOverridden: {
      type: Boolean,
      default: false,
      comment: 'If true, use the zone-level recommendedItemFee instead of tier-level'
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
    // Peak Zone Settings (like Zomato)
    peakZoneRideCount: {
      type: Number,
      default: 0,
      min: 0
    },
    peakZoneRadius: {
      type: Number,
      default: 0,
      min: 0
    },
    peakZoneSelectionDuration: {
      type: Number,
      default: 0, // in minutes
      min: 0
    },
    peakZoneDuration: {
      type: Number,
      default: 0, // in minutes
      min: 0
    },
    peakZoneSurgePercentage: {
      type: Number,
      default: 0, // percentage
      min: 0,
      max: 100
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

// Pre-save middleware to create GeoJSON boundary AND calculate Area/Tier
zoneSchema.pre('save', async function (next) {
  try {
    if (this.coordinates && this.coordinates.length >= 3) {
      // 1. Convert to GeoJSON format
      // GeoJSON requires [lng, lat]
      const geoJsonCoords = this.coordinates.map(coord => [coord.longitude, coord.latitude]);

      // Close the polygon by adding the first point at the end if not already closed
      if (geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
        geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1]) {
        geoJsonCoords.push(geoJsonCoords[0]);
      }

      this.boundary = {
        type: 'Polygon',
        coordinates: [geoJsonCoords]
      };

      // 2. Calculate Area (in sq km)
      // Turf calculates in square meters
      const poly = turf.polygon([geoJsonCoords]);
      const areaInSqMeters = turf.area(poly);
      const areaInSqKm = areaInSqMeters / 1000000;

      this.area = parseFloat(areaInSqKm.toFixed(2)); // Round to 2 decimals

      // 3. Assign Tier
      // Find a tier where minArea <= area <= maxArea
      // Sort by rank ascending to pick the lowest rank (e.g., if overlap, though shouldn't happen)
      // or to pick consistent one.
      const tier = await Tier.findOne({
        minArea: { $lte: this.area },
        maxArea: { $gte: this.area }
      }).sort({ rank: 1 });

      if (tier) {
        this.tierId = tier._id;

        // Inherit pricing from Tier if not overridden
        if (!this.deliveryPricing || !this.deliveryPricing.isOverridden) {
          if (tier.deliveryPricing) {
            this.deliveryPricing = {
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
    }
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
