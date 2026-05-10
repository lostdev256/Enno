import {commonApi} from "./api/common";
import {projectApi} from "./api/project";
import {charactersApi} from "./api/characters";
import {locationsApi} from "./api/locations";
import {questsApi} from "./api/quests";
import {scenesApi} from "./api/scenes";
import {storylineApi} from "./api/storyline";

import {contextBridge} from "electron";

const ennoAPI = {
    ...commonApi,
    ...projectApi,
    ...charactersApi,
    ...locationsApi,
    ...questsApi,
    ...scenesApi,
    ...storylineApi
};

contextBridge.exposeInMainWorld("ennoAPI", ennoAPI);

export type EnnoAPI = typeof ennoAPI
