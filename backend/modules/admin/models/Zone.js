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

  // Simple point-in-polygon check using ray casting algorithm
  const coords = this.boundary.coordinates[0];
  let inside = false;

  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];

    const intersect = ((yi > longitude) !== (yj > longitude)) &&
      (longitude < (xj - xi) * (longitude - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
};

export default mongoose.model('Zone', zoneSchema);
