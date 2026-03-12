import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';

const storage = new AsyncLocalStorage();

/**
 * Middleware to track database query counts per request.
 * No-op in production to avoid overhead; set ENABLE_QUERY_COUNT=1 to enable.
 */
export const queryCounterMiddleware = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUERY_COUNT !== '1') {
        return next();
    }
    const context = { count: 0 };
    storage.run(context, () => {
        const originalEnd = res.end;
        res.end = function (...args) {
            const finalContext = storage.getStore();
            if (finalContext) {
                res.setHeader('X-Query-Count', finalContext.count);
            }
            originalEnd.apply(res, args);
        };
        next();
    });
};

/**
 * Hook into Mongoose to increment global counter if in request context
 */
const patchMongoose = () => {
    const methods = [
        'find', 'findOne', 'countDocuments', 'aggregate', 'save',
        'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
        'findOneAndUpdate', 'findOneAndDelete', 'insertMany'
    ];

    // We hook into mongoose.Query.prototype and mongoose.Aggregate.prototype
    const Query = mongoose.Query;
    const Aggregate = mongoose.Aggregate;
    const Model = mongoose.Model;

    methods.forEach(method => {
        if (Query.prototype[method]) {
            const original = Query.prototype[method];
            Query.prototype[method] = function (...args) {
                const store = storage.getStore();
                if (store) store.count++;
                return original.apply(this, args);
            };
        }
    });

    const originalAggregateExec = Aggregate.prototype.exec;
    Aggregate.prototype.exec = function (...args) {
        const store = storage.getStore();
        if (store) store.count++;
        return originalAggregateExec.apply(this, args);
    };

    const originalSave = Model.prototype.save;
    Model.prototype.save = function (...args) {
        const store = storage.getStore();
        if (store) store.count++;
        return originalSave.apply(this, args);
    };
};

// Initialize patching
patchMongoose();
