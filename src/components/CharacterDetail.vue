<script setup lang="ts">
import {ref, watch, nextTick} from "vue";
import ContextMenu from "./ContextMenu.vue";
import ImageLightbox from "./ImageLightbox.vue";
import type {ContextMenuItem} from "./ContextMenu.vue";
import defaultAvatar from "../assets/default-avatar.svg";
import RichTextEditor from "./RichTextEditor.vue";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

interface CharacterFull {
    id: string;
    name: string;
    description: string;
    avatarUrl: string | null;
    gallery: { id: string; path: string }[];
}

const props = defineProps<{ character: CharacterFull | null }>();

const emit = defineEmits<{
    (e: "update", id: string, field: string, value: string): void
    (e: "upload-avatar", id: string): void
    (e: "add-gallery", id: string): void
    (e: "remove-gallery", characterId: string, imageId: string): void
}>();

// --- Name editing ---
const editingName = ref(false);
const nameInput = ref("");
const nameInputRef = ref<HTMLInputElement | null>(null);

function startEditName() {
    if (!props.character) return;
    nameInput.value = props.character.name;
    editingName.value = true;
    nextTick(() => nameInputRef.value?.focus());
}

function saveName() {
    if (!props.character) return;
    editingName.value = false;
    if (nameInput.value.trim() && nameInput.value !== props.character.name) {
        emit("update", props.character.id, "name", nameInput.value.trim());
    }
}

// --- Rich Text Editor Sync ---
function updateDescription(newDesc: string) {
    if (props.character && newDesc !== props.character.description) {
        emit("update", props.character.id, "description", newDesc);
    }
}

// Reset states when character changes
watch(() => props.character?.id, () => {
    editingName.value = false;
    lightboxVisible.value = false;
});

// --- Avatar ---
function getAvatarSrc(url: string | null): string {
    if (!url) return defaultAvatar;
    return `enno://${url}`;
}

// --- Gallery ---
const lightboxVisible = ref(false);
const lightboxStartIndex = ref(0);

function openLightbox(i: number) {
    lightboxStartIndex.value = i;
    lightboxVisible.value = true;
}

// --- Gallery context menu ---
const galleryCtxVisible = ref(false);
const galleryCtxX = ref(0);
const galleryCtxY = ref(0);
const galleryCtxImageId = ref<string | null>(null);
import {computed} from "vue";

const galleryCtxItems = computed<ContextMenuItem[]>(() => [{
    label: t("characters.removeImage"),
    action: "remove",
    icon: "🗑"
}]);

function onGalleryContextMenu(e: MouseEvent, imageId: string) {
    e.preventDefault();
    galleryCtxX.value = e.clientX;
    galleryCtxY.value = e.clientY;
    galleryCtxImageId.value = imageId;
    galleryCtxVisible.value = true;
}

function onGalleryCtxAction(action: string) {
    if (action === "remove" && props.character && galleryCtxImageId.value)
        emit("remove-gallery", props.character.id, galleryCtxImageId.value);
}
</script>

<template>
    <div class="detail" v-if="character">
        <!-- Header: Avatar + Name -->
        <div class="detail-header">
            <div class="avatar-wrap" @click="emit('upload-avatar', character.id)">
                <img :src="getAvatarSrc(character.avatarUrl)" class="avatar-img" alt="Avatar"/>
                <div class="avatar-overlay">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 16V8m0 0l-3 3m3-3l3 3" stroke="currentColor" stroke-width="1.8"
                              stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" stroke="currentColor" stroke-width="1.8"
                              stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>{{ t("characters.upload") }}</span>
                </div>
            </div>
            <div class="name-section">
                <div v-if="!editingName" class="name-display" @dblclick="startEditName">
                    <h1 class="char-name">{{ character.name }}</h1>
                    <button class="edit-btn" @click="startEditName" :title="t('characters.editName')">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M10 2l2 2-7 7H3V9l7-7z" stroke="currentColor" stroke-width="1.3"
                                  stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
                <div v-else class="name-edit">
                    <input ref="nameInputRef" v-model="nameInput" class="name-input" @blur="saveName"
                           @keydown.enter="saveName" @keydown.escape="editingName = false"/>
                </div>
            </div>
        </div>

        <!-- Description -->
        <div class="detail-section">
            <RichTextEditor
                :modelValue="character.description || ''"
                @update:modelValue="updateDescription"
                :title="t('common.description')"
                :placeholder="t('characters.writeDescription')"
                :emptyText="t('characters.noDescriptionYet')"
            />
        </div>

        <!-- Gallery -->
        <div class="detail-section">
            <div class="section-header">
                <span class="section-title">{{ t("characters.gallery") }}</span>
                <button class="edit-btn" @click="emit('add-gallery', character.id)" :title="t('characters.addImages')">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="gallery-strip" v-if="character.gallery.length > 0">
                <div v-for="(img, i) in character.gallery" :key="img.id" class="gallery-thumb" @click="openLightbox(i)"
                     @contextmenu="onGalleryContextMenu($event, img.id)">
                    <img :src="'enno://' + img.path" :alt="`Gallery ${i + 1}`"/>
                </div>
                <button class="gallery-add-btn" @click="emit('add-gallery', character.id)"
                        :title="t('characters.addMore')">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div v-else class="gallery-empty">
                <button class="gallery-empty-btn" @click="emit('add-gallery', character.id)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/>
                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                        <path d="M6 18l4-5 3 3 2-2 3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                              stroke-linejoin="round"/>
                    </svg>
                    <span>{{ t("characters.addImagesToGallery") }}</span>
                </button>
            </div>
        </div>

        <ContextMenu :items="galleryCtxItems" :x="galleryCtxX" :y="galleryCtxY" :visible="galleryCtxVisible"
                     @action="onGalleryCtxAction" @close="galleryCtxVisible = false"/>
        <ImageLightbox :images="character.gallery.map(g => g.path)" :start-index="lightboxStartIndex"
                       :visible="lightboxVisible" @close="lightboxVisible = false"/>
    </div>

    <!-- Empty state -->
    <div v-else class="detail-empty">
        <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" stroke-width="2"/>
                <circle cx="24" cy="20" r="6" stroke="currentColor" stroke-width="1.5"/>
                <path d="M14 38c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="1.5"/>
            </svg>
        </div>
        <p class="empty-text">{{ t("characters.selectCharacterToView") }}</p>
    </div>
</template>

<style scoped>
.detail {
    flex: 1;
    overflow-y: auto;
    padding: 28px 36px;
    background: radial-gradient(ellipse at 20% 30%, rgba(100, 108, 255, .03) 0%, transparent 60%), #1a1a1f;
}

.detail::-webkit-scrollbar {
    width: 6px;
}

.detail::-webkit-scrollbar-track {
    background: transparent;
}

.detail::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, .06);
    border-radius: 4px;
}

.detail-header {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    margin-bottom: 28px;
}

/* Avatar */
.avatar-wrap {
    position: relative;
    width: 150px;
    height: 150px;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, .06);
    transition: border-color .2s;
}

.avatar-wrap:hover {
    border-color: rgba(100, 108, 255, .3);
}

.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.avatar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, .6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0;
    transition: opacity .2s;
    color: #ccc;
    font-size: 12px;
}

.avatar-wrap:hover .avatar-overlay {
    opacity: 1;
}

/* Name */
.name-section {
    flex: 1;
    padding-top: 8px;
}

.name-display {
    display: flex;
    align-items: center;
    gap: 12px;
}

.char-name {
    font-size: 28px;
    font-weight: 700;
    color: #e0e0f0;
    margin: 0;
    line-height: 1.2;
}

.edit-btn {
    background: none;
    border: 1px solid transparent;
    color: #555;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s;
    flex-shrink: 0;
}

.edit-btn:hover {
    background: rgba(255, 255, 255, .06);
    color: #aaa;
    border-color: rgba(255, 255, 255, .08);
}

.name-input {
    font-size: 28px;
    font-weight: 700;
    color: #e0e0f0;
    background: rgba(255, 255, 255, .04);
    border: 1px solid rgba(100, 108, 255, .3);
    border-radius: 8px;
    padding: 4px 12px;
    width: 100%;
    font-family: inherit;
    outline: none;
}

.name-input:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(100, 108, 255, .1);
}

/* Sections */
.detail-section {
    margin-bottom: 24px;
}

.section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.section-title {
    font-size: 11.5px;
    font-weight: 600;
    color: #6b6b80;
    text-transform: uppercase;
    letter-spacing: .8px;
}

/* Save button accent */
.save-btn {
    color: #4ade80 !important;
}

.save-btn:hover {
    background: rgba(74, 222, 128, .1) !important;
    color: #86efac !important;
    border-color: rgba(74, 222, 128, .2) !important;
}


/* Gallery */
.gallery-strip {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 4px 0 8px;
}

.gallery-strip::-webkit-scrollbar {
    height: 5px;
}

.gallery-strip::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, .08);
    border-radius: 4px;
}

.gallery-thumb {
    width: 100px;
    height: 100px;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, .06);
    transition: border-color .15s, transform .15s;
}

.gallery-thumb:hover {
    border-color: rgba(100, 108, 255, .3);
    transform: scale(1.04);
}

.gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.gallery-add-btn {
    width: 100px;
    height: 100px;
    border-radius: 8px;
    border: 1px dashed rgba(255, 255, 255, .1);
    background: rgba(255, 255, 255, .02);
    color: #555;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all .15s;
}

.gallery-add-btn:hover {
    border-color: rgba(100, 108, 255, .3);
    color: #818cf8;
    background: rgba(100, 108, 255, .05);
}

.gallery-empty {
    padding: 16px 0;
}

.gallery-empty-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, .02);
    border: 1px dashed rgba(255, 255, 255, .08);
    border-radius: 10px;
    padding: 20px 24px;
    color: #555;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: all .15s;
    width: 100%;
}

.gallery-empty-btn:hover {
    border-color: rgba(100, 108, 255, .25);
    color: #818cf8;
    background: rgba(100, 108, 255, .04);
}

/* Empty state */
.detail-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #444;
    background: #1a1a1f;
}

.empty-icon {
    opacity: .3;
}

.empty-text {
    font-size: 14px;
    color: #555;
}
</style>
