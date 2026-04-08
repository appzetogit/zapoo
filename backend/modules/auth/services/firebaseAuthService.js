import admin from "firebase-admin";
import winston from "winston";
import fs from "fs";
import path from "path";
import { getFirebaseCredentials } from "../../../shared/utils/envService.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

class FirebaseAuthService {
  constructor() {
    this.initialized = false;
    this.initializing = false;
  }

  async init() {
    if (this.initialized) return;

    // Safety check to prevent concurrent initialization
    if (this.initializing) {
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializing = true;
    try {
      // 1. Try to get credentials from Database (EnvironmentVariable model)
      // NOTE: This can hang if DB connection is not ready. 
      // We wrap it in a tray-catch to ensure we don't block the entire process.
      let projectId, clientEmail, privateKey;

      try {
        const dbCredentials = await getFirebaseCredentials();
        projectId = dbCredentials.projectId || process.env.FIREBASE_PROJECT_ID;
        clientEmail = dbCredentials.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
        privateKey = dbCredentials.privateKey || process.env.FIREBASE_PRIVATE_KEY;
      } catch (dbErr) {
        logger.warn(`Could not fetch Firebase credentials from DB: ${dbErr.message}`);
      }

      // 2. Fallback: read from FIREBASE_SERVICE_ACCOUNT env var (JSON string)
      if (!projectId || !clientEmail || !privateKey) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          try {
            let serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();

            // Some env setups wrap JSON in quotes: '{"..."}' or "{\"...\"}"
            if (
              (serviceAccountRaw.startsWith("'") && serviceAccountRaw.endsWith("'")) ||
              (serviceAccountRaw.startsWith('"') && serviceAccountRaw.endsWith('"'))
            ) {
              serviceAccountRaw = serviceAccountRaw.slice(1, -1);
            }

            if (serviceAccountRaw.includes('\\"')) {
              serviceAccountRaw = serviceAccountRaw.replace(/\\"/g, '"');
            }

            const sa = JSON.parse(serviceAccountRaw);
            projectId = sa.project_id;
            clientEmail = sa.client_email;
            privateKey = sa.private_key;
          } catch (e) {
            logger.warn(`Failed to parse FIREBASE_SERVICE_ACCOUNT env var: ${e.message}`);
          }
        }
      }

      // 3. Fallback: read from firebaseconfig.json files
      if (!projectId || !clientEmail || !privateKey) {
        try {
          const configFolderPath = path.resolve(process.cwd(), "config", "zomato-607fa-firebase-adminsdk-fbsvc-f5f782c2cc.json");
          const rootPath = path.resolve(process.cwd(), "firebaseconfig.json");
          let serviceAccountPath = null;
          if (fs.existsSync(configFolderPath)) {
            serviceAccountPath = configFolderPath;
          } else if (fs.existsSync(rootPath)) {
            serviceAccountPath = rootPath;
          }

          if (serviceAccountPath) {
            const raw = fs.readFileSync(serviceAccountPath, "utf-8");
            const json = JSON.parse(raw);
            projectId = projectId || json.project_id;
            clientEmail = clientEmail || json.client_email;
            privateKey = privateKey || json.private_key;
          }
        } catch (err) {
          logger.warn(`Failed to read firebaseconfig.json: ${err.message}`);
        }
      }

      // Final check
      if (!projectId || !clientEmail || !privateKey) {
        logger.warn("Firebase Admin (Default) not fully configured. Some auth features may fail.");
        return;
      }

      // Handle escaped newlines in private key
      if (privateKey && privateKey.includes("\\n")) {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      try {
        // Reuse default app if already exists
        if (admin.apps.length > 0 && admin.apps.find(a => a.name === '[DEFAULT]')) {
          this.initialized = true;
          return;
        }

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey
          })
        });
        this.initialized = true;
      } catch (error) {
        if (error?.code === "app/duplicate-app") {
          this.initialized = true;
        } else {
          logger.error(`Failed to initialize Firebase Admin: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error in Firebase init: ${error.message}`);
    } finally {
      this.initializing = false;
    }
  }

  isEnabled() {
    return this.initialized;
  }

  async verifyIdToken(idToken) {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.initialized) {
      throw new Error("Firebase Admin is not configured.");
    }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      return decoded;
    } catch (error) {
      logger.error(`Error verifying Firebase ID token: ${error.message}`);
      throw new Error("Invalid or expired Firebase ID token");
    }
  }
}

export default new FirebaseAuthService();
