CREATE TABLE IF NOT EXISTS meta
(
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_groups
(
    id         TEXT PRIMARY KEY,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS characters
(
    id          TEXT PRIMARY KEY,
    name        TEXT    NOT NULL DEFAULT 'New Character',
    description TEXT    NOT NULL DEFAULT '',
    avatar_path TEXT,
    group_id    TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (DATETIME('now')),
    updated_at  TEXT    NOT NULL DEFAULT (DATETIME('now')),
    FOREIGN KEY (group_id) REFERENCES character_groups (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS character_gallery
(
    id           TEXT PRIMARY KEY,
    character_id TEXT    NOT NULL,
    image_path   TEXT    NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS character_board_nodes
(
    character_id TEXT PRIMARY KEY,
    x            REAL NOT NULL,
    y            REAL NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS link_modes
(
    id                 TEXT PRIMARY KEY,
    name               TEXT    NOT NULL,
    max_links_per_pair INTEGER NOT NULL DEFAULT 1,
    data_type          TEXT    NOT NULL,
    settings           TEXT    NOT NULL,
    sort_order         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS character_links
(
    id        TEXT PRIMARY KEY,
    mode_id   TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    value     TEXT NOT NULL,
    FOREIGN KEY (mode_id) REFERENCES link_modes (id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES characters (id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES characters (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations
(
    id             TEXT PRIMARY KEY,
    parent_id      TEXT    NULL,
    name           TEXT    NOT NULL DEFAULT 'New Location',
    description    TEXT    NOT NULL DEFAULT '',
    map_image_path TEXT,
    map_x          REAL             DEFAULT NULL,
    map_y          REAL             DEFAULT NULL,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (DATETIME('now')),
    updated_at     TEXT    NOT NULL DEFAULT (DATETIME('now')),
    FOREIGN KEY (parent_id) REFERENCES locations (id) ON DELETE CASCADE
);

-- ═══ SCENES ═══

CREATE TABLE IF NOT EXISTS scene_groups
(
    id         TEXT PRIMARY KEY,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scenes
(
    id         TEXT PRIMARY KEY,
    name       TEXT    NOT NULL DEFAULT 'New Scene',
    group_id   TEXT,
    exit_pins  TEXT    NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT    NOT NULL DEFAULT (DATETIME('now')),
    FOREIGN KEY (group_id) REFERENCES scene_groups (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS scene_characters
(
    id           TEXT PRIMARY KEY,
    scene_id     TEXT NOT NULL,
    character_id TEXT NOT NULL,
    FOREIGN KEY (scene_id) REFERENCES scenes (id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE,
    UNIQUE (scene_id, character_id)
);

CREATE TABLE IF NOT EXISTS scene_actions
(
    id          TEXT PRIMARY KEY,
    scene_id    TEXT    NOT NULL,
    action_type TEXT    NOT NULL,
    data        TEXT    NOT NULL DEFAULT '{}',
    x           REAL    NOT NULL DEFAULT 0,
    y           REAL    NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (scene_id) REFERENCES scenes (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_action_gallery
(
    id              TEXT PRIMARY KEY,
    scene_action_id TEXT    NOT NULL,
    image_path      TEXT    NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (scene_action_id) REFERENCES scene_actions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_connections
(
    id               TEXT PRIMARY KEY,
    scene_id         TEXT NOT NULL,
    source_action_id TEXT NOT NULL,
    source_pin       TEXT NOT NULL DEFAULT 'out',
    target_action_id TEXT NOT NULL,
    target_pin       TEXT NOT NULL DEFAULT 'in',
    FOREIGN KEY (scene_id) REFERENCES scenes (id) ON DELETE CASCADE,
    FOREIGN KEY (source_action_id) REFERENCES scene_actions (id) ON DELETE CASCADE,
    FOREIGN KEY (target_action_id) REFERENCES scene_actions (id) ON DELETE CASCADE
);

-- ═══ QUESTS ═══

CREATE TABLE IF NOT EXISTS quest_groups
(
    id         TEXT PRIMARY KEY,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quests
(
    id          TEXT PRIMARY KEY,
    name        TEXT    NOT NULL DEFAULT 'New Quest',
    description TEXT    NOT NULL DEFAULT '',
    icon_path   TEXT,
    parent_id   TEXT,
    group_id    TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (DATETIME('now')),
    updated_at  TEXT    NOT NULL DEFAULT (DATETIME('now')),
    FOREIGN KEY (parent_id) REFERENCES quests (id) ON DELETE SET NULL,
    FOREIGN KEY (group_id) REFERENCES quest_groups (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quest_gallery
(
    id         TEXT PRIMARY KEY,
    quest_id   TEXT    NOT NULL,
    image_path TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (quest_id) REFERENCES quests (id) ON DELETE CASCADE
);

-- ═══ STORYLINE ═══

CREATE TABLE IF NOT EXISTS storyline_nodes
(
    id        TEXT PRIMARY KEY,
    node_type TEXT NOT NULL,
    ref_id    TEXT,
    data      TEXT NOT NULL DEFAULT '{}',
    group_id  TEXT,
    x         REAL NOT NULL DEFAULT 0,
    y         REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (group_id) REFERENCES scene_groups (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS storyline_connections
(
    id             TEXT PRIMARY KEY,
    source_node_id TEXT NOT NULL,
    source_pin     TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    target_pin     TEXT NOT NULL DEFAULT 'in',
    FOREIGN KEY (source_node_id) REFERENCES storyline_nodes (id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES storyline_nodes (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS storyline_group_positions
(
    group_id TEXT PRIMARY KEY,
    x        REAL NOT NULL DEFAULT 0,
    y        REAL NOT NULL DEFAULT 0,
    width    REAL NOT NULL DEFAULT 400,
    height   REAL NOT NULL DEFAULT 300,
    FOREIGN KEY (group_id) REFERENCES scene_groups (id) ON DELETE CASCADE
);

INSERT OR IGNORE
INTO meta (key, value)
VALUES ('schema_version', '1');
INSERT OR IGNORE
INTO meta (key, value)
VALUES ('app_version', '0.1.0');
