import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5000'; // Target local dev server
const ROUTES = JSON.parse(fs.readFileSync('discovered_routes.json', 'utf8'));
const TOKENS = JSON.parse(fs.readFileSync('test_tokens.json', 'utf8'));
const SAMPLES = JSON.parse(fs.readFileSync('benchmark_samples.json', 'utf8'));

// Result storage
const results = [];

/**
 * Replace URL parameters with samples
 */
function hydratePath(path) {
    let hydrated = path;
    Object.keys(SAMPLES).forEach(key => {
        const placeholder = `:${key}`;
        if (hydrated.includes(placeholder)) {
            const sample = SAMPLES[key][0] || '1234567890abcdef12345678'; // Fallback to dummy ObjectId
            hydrated = hydrated.replace(placeholder, sample);
        }
    });

    // Handle generic :id if not already handled
    if (hydrated.includes(':id')) {
        const sample = SAMPLES.id[0] || '1234567890abcdef12345678';
        hydrated = hydrated.replace(':id', sample);
    }

    return hydrated;
}

/**
 * Pick correct token based on path
 */
function getAuthHeader(path) {
    if (path.includes('/admin')) return { Authorization: `Bearer ${TOKENS.admin}` };
    if (path.includes('/restaurant')) return { Authorization: `Bearer ${TOKENS.restaurant}` };
    if (path.includes('/delivery')) return { Authorization: `Bearer ${TOKENS.delivery}` };
    if (path.includes('/api/user')) return { Authorization: `Bearer ${TOKENS.user}` };
    if (path.includes('/api/order')) return { Authorization: `Bearer ${TOKENS.user}` };

    // Generic /api/auth/me
    if (path === '/api/auth/me') return { Authorization: `Bearer ${TOKENS.user}` };

    return {}; // Public
}

async function runBenchmark(batchName, filterFn) {
    console.log(`\n🚀 Starting Batch: ${batchName}`);
    const batchRoutes = ROUTES.filter(filterFn);
    console.log(`Found ${batchRoutes.length} routes in this batch.`);

    for (const route of batchRoutes) {
        // Only support GET for now to avoid side-effects (can add POST with dummy bodies later)
        if (route.method !== 'GET') {
            console.log(`⏩ Skipping ${route.method} ${route.path} (Non-GET)`);
            continue;
        }

        const hydratedPath = hydratePath(route.path);
        const headers = getAuthHeader(route.path);
        const url = `${API_BASE}${hydratedPath}`;

        process.stdout.write(`Testing [GET] ${hydratedPath} ... `);

        const start = Date.now();
        try {
            const response = await axios.get(url, { headers, timeout: 5000 });
            const duration = Date.now() - start;
            const queryCount = response.headers['x-query-count'] || 0;
            const size = JSON.stringify(response.data).length / 1024; // KB

            results.push({
                batch: batchName,
                method: 'GET',
                path: route.path,
                hydrated: hydratedPath,
                status: response.status,
                latency: duration,
                queries: parseInt(queryCount),
                sizeKb: parseFloat(size.toFixed(2))
            });

            console.log(`✅ ${duration}ms | DB: ${queryCount} | ${size.toFixed(2)}kb`);
        } catch (err) {
            const duration = Date.now() - start;
            const status = err.response?.status || 'ERR';
            console.log(`❌ Status: ${status} | ${duration}ms`);

            results.push({
                batch: batchName,
                method: 'GET',
                path: route.path,
                hydrated: hydratedPath,
                status: status,
                latency: duration,
                queries: 'N/A',
                sizeKb: 'N/A',
                error: err.message
            });
        }
    }

    // Save partial results
    fs.writeFileSync(`benchmark_results_${batchName}.json`, JSON.stringify(results.filter(r => r.batch === batchName), null, 2));
}

async function main() {
    const mode = process.argv[2] || 'all';

    if (mode === 'public' || mode === 'all') {
        await runBenchmark('PublicAuth', r => !r.path.includes('/api/') || r.path.includes('/auth/'));
    }
    if (mode === 'user' || mode === 'all') {
        await runBenchmark('User', r => r.path.startsWith('/api/user'));
    }
    if (mode === 'restaurant' || mode === 'all') {
        await runBenchmark('Restaurant', r => r.path.startsWith('/api/restaurant'));
    }
    if (mode === 'order' || mode === 'all') {
        await runBenchmark('Order', r => r.path.startsWith('/api/order'));
    }
    if (mode === 'delivery' || mode === 'all') {
        await runBenchmark('Delivery', r => r.path.startsWith('/api/delivery'));
    }
    if (mode === 'admin' || mode === 'all') {
        await runBenchmark('Admin', r => r.path.startsWith('/api/admin'));
    }

    console.log('\n🏁 Benchmarking Complete.');
    process.exit(0);
}

main();
