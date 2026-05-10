import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";

export interface EnnoDatabaseInfo {
    db: Database.Database;
    dir: string;
}

export function uuid(): string {
    return crypto.randomUUID();
}

export function deleteFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {
    }
}
