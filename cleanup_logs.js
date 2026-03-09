const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const IGNORED_FILES = [
    'server.js',
    'index.js',
    'db.js',
    'socket.js',
    'firebaseConfig.js',
    'cloudinary.js',
    'sync_zones.js'
];

function processFile(filePath) {
    const filename = path.basename(filePath);
    if (IGNORED_FILES.includes(filename) || filePath.includes('node_modules')) {
        return;
    }

    if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) {
        return;
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    if (!code.includes('console.log') && !code.includes('logger.info') && !code.includes('logger.debug')) {
        return;
    }

    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });

        let modified = false;

        traverse(ast, {
            CallExpression(path) {
                const callee = path.node.callee;
                if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
                    const objName = callee.object.name;
                    const propName = callee.property.name;

                    if (
                        (objName === 'console' && propName === 'log') ||
                        (objName === 'logger' && (propName === 'info' || propName === 'debug'))
                    ) {
                        path.remove();
                        modified = true;
                    }
                }
            }
        });

        if (modified) {
            const output = generate(ast, {
                retainLines: false,
                compact: false,
                comments: true,
            }, code);
            fs.writeFileSync(filePath, output.code, 'utf-8');
            console.log(`Cleaned: ${filePath}`);
        }
    } catch (error) {
        console.error(`Skipping ${filePath} due to parse error:`, error.message);
    }
}

function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const defaultPath = path.join(directory, file);
        if (fs.lstatSync(defaultPath).isDirectory()) {
            processDirectory(defaultPath);
        } else {
            processFile(defaultPath);
        }
    });
}

const targetDirs = [
    path.join(__dirname, 'backend'),
    path.join(__dirname, 'frontend/src')
];

targetDirs.forEach(dir => processDirectory(dir));
console.log('Cleanup processing complete.');
