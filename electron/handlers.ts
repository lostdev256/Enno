import {registerCommonIpcHandlers} from "./handlers/common";
import {registerProjectIpcHandlers} from "./handlers/project";
import {registerCharactersIpcHandlers} from "./handlers/characters";
import {registerLocationsIpcHandlers} from "./handlers/locations";
import {registerQuestsIpcHandlers} from "./handlers/quests";
import {registerScenesIpcHandlers} from "./handlers/scenes";
import {registerStorylineIpcHandlers} from "./handlers/storyline";

export function registerIpcHandlers() {
    registerCommonIpcHandlers();
    registerProjectIpcHandlers();
    registerCharactersIpcHandlers();
    registerLocationsIpcHandlers();
    registerQuestsIpcHandlers();
    registerScenesIpcHandlers();
    registerStorylineIpcHandlers();
}
