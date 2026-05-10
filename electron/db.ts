import schemaSql from "./db/schema/schema.sql?raw";
import {CharactersEnnoDatabase} from "./db/characters";
import {LocationsEnnoDatabase} from "./db/locations";
import {QuestsEnnoDatabase} from "./db/quests";
import {ScenesEnnoDatabase} from "./db/scenes";
import {StorylineEnnoDatabase} from "./db/storyline";

import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import path from "node:path";
import fs from "node:fs";
import {app} from "electron";

class EnnoDatabase {
    private _projectFilePath: string | null = null;
    private _workDir: string | null = null;
    private _db: Database.Database | null = null;

    private _charactersDB: CharactersEnnoDatabase | null = null;
    private _locationsDB: LocationsEnnoDatabase | null = null;
    private _questsDB: QuestsEnnoDatabase | null = null;
    private _scenesDB: ScenesEnnoDatabase | null = null;
    private _storylineDB: StorylineEnnoDatabase | null = null;

    public get isOpen(): boolean {
        return this._db !== null;
    }

    public get projectFilePath(): string | null {
        return this._projectFilePath;
    }

    public get projectName(): string | null {
        return this._projectFilePath ? path.basename(this._projectFilePath) : null;
    }

    public get characters(): CharactersEnnoDatabase | null {
        this.checkDB();
        return this._charactersDB;
    }

    public get locations(): LocationsEnnoDatabase | null {
        this.checkDB();
        return this._locationsDB;
    }

    public get quests(): QuestsEnnoDatabase | null {
        this.checkDB();
        return this._questsDB;
    }

    public get scenes(): ScenesEnnoDatabase | null {
        this.checkDB();
        return this._scenesDB;
    }

    public get storyline(): StorylineEnnoDatabase | null {
        this.checkDB();
        return this._storylineDB;
    }

    public create(projectFilePath: string): void {
        this.close();

        this._workDir = this.createTempDir();
        this._projectFilePath = projectFilePath;

        this.syncMediaDirs(this._workDir);

        const dbPath = path.join(this._workDir, "project.db");
        this._db = new Database(dbPath);
        this._db.pragma("journal_mode = WAL");
        this._db.pragma("foreign_keys = ON");
        this.initSchema();

        const dbInfo = {
            db: this._db,
            dir: this._workDir
        };
        this._charactersDB = new CharactersEnnoDatabase(dbInfo);
        this._locationsDB = new LocationsEnnoDatabase(dbInfo);
        this._questsDB = new QuestsEnnoDatabase(dbInfo);
        this._scenesDB = new ScenesEnnoDatabase(dbInfo);
        this._storylineDB = new StorylineEnnoDatabase(dbInfo);

        this.save();
    }

    public open(projectFilePath: string): void {
        this.close();

        if (!fs.existsSync(projectFilePath)) {
            throw new Error(`File not found: ${projectFilePath}`);
        }

        this._workDir = this.createTempDir();
        this._projectFilePath = projectFilePath;

        const zip = new AdmZip(this._projectFilePath);
        zip.extractAllTo(this._workDir, true);

        this.syncMediaDirs(this._workDir);

        const dbPath = path.join(this._workDir, "project.db");
        if (!fs.existsSync(dbPath)) {
            throw new Error("Invalid .ennodb file: project.db not found");
        }
        this._db = new Database(dbPath);
        this._db.pragma("journal_mode = WAL");
        this._db.pragma("foreign_keys = ON");

        this.initSchema();

        const dbInfo = {
            db: this._db,
            dir: this._workDir
        };
        this._charactersDB = new CharactersEnnoDatabase(dbInfo);
        this._locationsDB = new LocationsEnnoDatabase(dbInfo);
        this._questsDB = new QuestsEnnoDatabase(dbInfo);
        this._scenesDB = new ScenesEnnoDatabase(dbInfo);
        this._storylineDB = new StorylineEnnoDatabase(dbInfo);
    }

    public save(): void {
        if (!this._db || !this._workDir || !this._projectFilePath) {
            throw new Error("No project open");
        }

        // Close WAL checkpoint to ensure all data is in main db file
        this._db.pragma("wal_checkpoint(TRUNCATE)");

        // Pack working dir into ZIP (no compression)
        const zip = new AdmZip();
        this.addDirToZip(zip, this._workDir, "");

        // Set all entries to STORE (no compression)
        zip.getEntries().forEach(entry => {
            if (!entry.isDirectory) {
                entry.header.method = 0;
            }
        });

        zip.writeZip(this._projectFilePath);
    }

    public saveAs(projectFilePath: string): void {
        this._projectFilePath = projectFilePath;
        this.save();
    }

    public close(): void {
        if (this._db) {
            try {
                this._db.close();
            } catch {
            }
            this._db = null;
        }
        if (this._workDir && fs.existsSync(this._workDir)) {
            try {
                fs.rmSync(this._workDir, {recursive: true, force: true});
            } catch {
            }
        }
        this._workDir = null;
        this._projectFilePath = null;
    }

    private checkDB(): void {
        if (!this._db) {
            throw new Error("No project open");
        }
    }

    private createTempDir(): string {
        const tmpBase = path.join(app.getPath("temp"), "enno-projects");
        fs.mkdirSync(tmpBase, {recursive: true});
        return fs.mkdtempSync(path.join(tmpBase, "proj-"));
    }

    private syncMediaDirs(workDir: string) {
        fs.mkdirSync(path.join(workDir, "media", "characters", "avatars"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "characters", "gallery"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "locations", "maps"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "scenes", "action_gallery"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "quests", "icons"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "quests", "gallery"), {recursive: true});
    }

    private initSchema(): void {
        if (!this._db) {
            return;
        }

        try {
            this._db.exec(schemaSql);
            console.log("Database schema initialized successfully");
        } catch (err) {
            console.error("Failed to initialize database schema:", err);
        }

        // Insert default link modes if table is empty
        const modesCount = this._db.prepare("SELECT COUNT(*) AS c FROM link_modes").get() as { c: number };
        if (modesCount.c === 0) {
            const insertMode = this._db.prepare("INSERT INTO link_modes (id, name, max_links_per_pair, data_type, settings, sort_order) VALUES (?, ?, ?, ?, ?, ?)");

            const attitudesSettings = JSON.stringify({
                lineType: "arrow",
                enumValues: [
                    {id: "neutral", label: "Neutral", color: "#9ca3af"},
                    {id: "hostile", label: "Hostile", color: "#ef4444"},
                    {id: "friendly", label: "Friendly", color: "#22c55e"}
                ]
            });
            insertMode.run("mode-attitudes", "Attitudes", 2, "enum", attitudesSettings, 0);

            const connectionsSettings = JSON.stringify({
                lineType: "line",
                lineColor: "#a5b4fc"
            });
            insertMode.run("mode-connections", "Connections", 1, "text", connectionsSettings, 1);
        }
    }

    private addDirToZip(zip: AdmZip, dirPath: string, zipPrefix: string): void {
        const entries = fs.readdirSync(dirPath, {withFileTypes: true});
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;

            // Skip WAL/SHM files — they're temp SQLite files
            if (entry.name.endsWith("-wal") || entry.name.endsWith("-shm")) continue;

            if (entry.isDirectory()) {
                this.addDirToZip(zip, fullPath, zipPath);
            } else {
                const content = fs.readFileSync(fullPath);
                // adm-zip addFile expects the directory path (without filename) as second-ish arg
                zip.addFile(zipPath, content);
            }
        }
    }
}

export function createDB(): EnnoDatabase {
    return new EnnoDatabase();
}
