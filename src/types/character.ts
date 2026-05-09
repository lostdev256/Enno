// --------- Character Types ---------

export interface Character {
    id: string;
    name: string;
    description: string;
    avatarUrl: string | null;
    gallery: string[];
}

export interface CharacterGroup {
    id: string;
    name: string;
    expanded: boolean;
    characters: Character[];
}

export interface SidebarData {
    groups: CharacterGroup[];
    ungrouped: Character[];
}
