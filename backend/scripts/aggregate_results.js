import fs from 'fs';

const batches = ['PublicAuth', 'User', 'Restaurant', 'Order', 'Delivery', 'Admin'];
const allResults = [];

batches.forEach(b => {
    const path = `benchmark_results_${b}.json`;
    if (fs.existsSync(path)) {
        const data = JSON.parse(fs.readFileSync(path, 'utf8'));
        allResults.push(...data);
    }
});

const successful = allResults.filter(r => r.status === 200);
const failed = allResults.filter(r => r.status !== 200);

const summary = {
    totalTested: allResults.length,
    success: successful.length,
    failed: failed.length,
    avgLatency: successful.reduce((acc, r) => acc + r.latency, 0) / successful.length,
    totalQueries: successful.reduce((acc, r) => acc + (typeof r.queries === 'number' ? r.queries : 0), 0),
    topBottlenecks: successful
        .sort((a, b) => b.latency - a.latency)
        .slice(0, 10)
        .map(r => ({ path: r.path, latency: r.latency, queries: r.queries })),
    dbHeavyRoutes: successful
        .sort((a, b) => b.queries - a.queries)
        .slice(0, 10)
        .map(r => ({ path: r.path, latency: r.latency, queries: r.queries }))
};

console.log('--- FINAL BENCHMARK SUMMARY ---');
console.log(`Total Routes Tested: ${summary.totalTested}`);
console.log(`Successful (200 OK): ${summary.success}`);
console.log(`Failed/Error: ${summary.failed}`);
console.log(`Average Latency: ${summary.avgLatency.toFixed(2)}ms`);
console.log(`Total DB Queries for success routes: ${summary.totalQueries}`);

console.log('\n--- TOP 10 LATENCY BOTTLENECKS ---');
summary.topBottlenecks.forEach(r => console.log(`${r.latency}ms | DB: ${r.queries} | ${r.path}`));

console.log('\n--- TOP 10 DB HEAVY ROUTES ---');
summary.dbHeavyRoutes.forEach(r => console.log(`DB: ${r.queries} | ${r.latency}ms | ${r.path}`));

fs.writeFileSync('final_benchmark_report.json', JSON.stringify(summary, null, 2));
