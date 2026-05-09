<script setup lang="ts">
import {ref, watch, onMounted, onUnmounted} from "vue";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

const props = defineProps<{
    images: string[]
    startIndex: number
    visible: boolean
}>();

const emit = defineEmits<{
    (e: "close"): void
}>();

const currentIndex = ref(props.startIndex);

watch(() => props.startIndex, (val) => {
    currentIndex.value = val;
});

watch(() => props.visible, (val) => {
    if (val) currentIndex.value = props.startIndex;
});

function prev() {
    if (currentIndex.value > 0) currentIndex.value--;
}

function next() {
    if (currentIndex.value < props.images.length - 1) currentIndex.value++;
}

function onKeyDown(e: KeyboardEvent) {
    if (!props.visible) return;
    if (e.key === "Escape") emit("close");
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
}

function onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("lightbox-overlay")) {
        emit("close");
    }
}

onMounted(() => {
    document.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
    document.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
    <Teleport to="body">
        <Transition name="lb">
            <div
                v-if="visible && images.length > 0"
                class="lightbox-overlay"
                @click="onOverlayClick"
            >
                <div class="lightbox-container">
                    <button class="lb-close" @click="emit('close')" :title="t('shared.close')">×</button>

                    <button
                        v-if="currentIndex > 0"
                        class="lb-nav lb-prev"
                        @click="prev"
                        title="Previous"
                    >‹
                    </button>

                    <div class="lb-image-wrap">
                        <img
                            :src="'enno://' + images[currentIndex]"
                            :alt="`Image ${currentIndex + 1}`"
                            class="lb-image"
                        />
                    </div>

                    <button
                        v-if="currentIndex < images.length - 1"
                        class="lb-nav lb-next"
                        @click="next"
                        title="Next"
                    >›
                    </button>

                    <div class="lb-counter">
                        {{ t("shared.imageOf", {current: currentIndex + 1, total: images.length}) }}
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.lightbox-container {
    position: relative;
    width: 92vw;
    height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.lb-close {
    position: absolute;
    top: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ccc;
    font-size: 28px;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    z-index: 2;
}

.lb-close:hover {
    background: rgba(255, 80, 80, 0.25);
    color: #fff;
}

.lb-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ccc;
    font-size: 36px;
    width: 48px;
    height: 72px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    z-index: 2;
}

.lb-nav:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}

.lb-prev {
    left: 0;
}

.lb-next {
    right: 0;
}

.lb-image-wrap {
    max-width: calc(100% - 120px);
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.lb-image {
    max-width: 100%;
    max-height: 88vh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 40px rgba(0, 0, 0, 0.6);
}

.lb-counter {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    color: #888;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.4);
    padding: 4px 16px;
    border-radius: 12px;
}

/* Transition */
.lb-enter-active {
    transition: opacity 0.2s ease;
}

.lb-leave-active {
    transition: opacity 0.15s ease;
}

.lb-enter-from,
.lb-leave-to {
    opacity: 0;
}
</style>
