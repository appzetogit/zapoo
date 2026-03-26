import mongoose from 'mongoose';
import Order from '../models/Order.js';

export function buildOrderIdentifierQuery(orderIdentifier) {
  const normalizedOrderIdentifier = orderIdentifier?.toString?.() || orderIdentifier;

  if (
    mongoose.Types.ObjectId.isValid(normalizedOrderIdentifier) &&
    normalizedOrderIdentifier.length === 24
  ) {
    return { _id: normalizedOrderIdentifier };
  }

  return { orderId: normalizedOrderIdentifier };
}

export async function findOrderByIdentifier(orderIdentifier, queryOptions = {}) {
  const query = buildOrderIdentifierQuery(orderIdentifier);
  let mongooseQuery = Order.findOne(query);

  if (queryOptions.select) {
    mongooseQuery = mongooseQuery.select(queryOptions.select);
  }

  if (Array.isArray(queryOptions.populate)) {
    queryOptions.populate.forEach(populateOption => {
      mongooseQuery = mongooseQuery.populate(populateOption);
    });
  } else if (queryOptions.populate) {
    mongooseQuery = mongooseQuery.populate(queryOptions.populate);
  }

  if (queryOptions.lean !== false) {
    mongooseQuery = mongooseQuery.lean();
  }

  return mongooseQuery;
}
