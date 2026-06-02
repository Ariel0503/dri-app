import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, get, onValue } from 'firebase/database'

const firebaseConfig = {
    apiKey: "AIzaSyBwQ63fUJbHWOHzc8hCH0h6QdH0IAjaJvQ",
    authDomain: "dri-app-4075c.firebaseapp.com",
    databaseURL: "https://dri-app-4075c-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "dri-app-4075c",
    storageBucket: "dri-app-4075c.firebasestorage.app",
    messagingSenderId: "834649634414",
    appId: "1:834649634414:web:679b4ce78c78b1ef8a587f"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export { ref, set, get, onValue }
window.storage = {
    async get(key) {
        const path = key.replace(/:/g, '/')
        const snapshot = await get(ref(db, path))
        if (!snapshot.exists()) throw new Error('Key not found')
        return { key, value: JSON.stringify(snapshot.val()) }
    },

    async set(key, value) {
        const path = key.replace(/:/g, '/')
        const data = JSON.parse(value)
        await set(ref(db, path), data)
        return { key, value }
    },

    async delete(key) {
        const path = key.replace(/:/g, '/')
        await set(ref(db, path), null)
        return { key, deleted: true }
    },

    async list(prefix = '') {
        const path = prefix.replace(/:/g, '/').replace(/\/$/, '')
        const snapshot = await get(ref(db, path))
        const keys = snapshot.exists()
            ? Object.keys(snapshot.val()).map(k => `${prefix}${k}`)
            : []
        return { keys }
    }
}
