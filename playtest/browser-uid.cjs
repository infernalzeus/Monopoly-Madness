// Read the app's persisted anonymous identity without importing/re-executing its sign-in module.
module.exports = async (p) => { for (let attempt = 0; attempt < 100; attempt++) {
    const uid = await p.evaluate(() => new Promise(resolve => { const request = indexedDB.open('firebaseLocalStorageDb'); request.onerror = () => resolve(null); request.onsuccess = () => { const db = request.result; if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
        db.close();
        resolve(null);
        return;
    } const q = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll(); q.onerror = () => { db.close(); resolve(null); }; q.onsuccess = () => { const uid = q.result.map(x => x.value?.uid).find(Boolean); db.close(); resolve(uid || null); }; }; }));
    if (uid)
        return uid;
    await p.waitForTimeout(50);
} throw Error('Anonymous identity not persisted'); };
