const path = require('node:path'), { createRequire } = require('node:module');
const toolsRoot = process.env.MONOPOLY_PLAYTEST_TOOLS || path.join(process.env.TEMP, 'monopoly-playtest-tools');
const externalRequire = createRequire(path.join(toolsRoot, 'package.json'));
const projectId = 'demo-monopoly-playtest';
function emulatorDatabase() {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9199';
    const { initializeApp, deleteApp } = externalRequire('firebase-admin/app');
    const { getFirestore } = externalRequire('firebase-admin/firestore');
    const app = initializeApp({ projectId });
    return { db: getFirestore(app), close: () => deleteApp(app) };
}
module.exports = { externalRequire, toolsRoot, projectId, emulatorDatabase };
