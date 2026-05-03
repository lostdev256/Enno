<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import ContextMenu from './ContextMenu.vue'
import ImageLightbox from './ImageLightbox.vue'
import type { ContextMenuItem } from './ContextMenu.vue'
import defaultAvatar from '../assets/default-avatar.svg'

interface CharacterFull {
  id: string
  name: string
  description: string
  avatarUrl: string | null
  gallery: string[]
}

const props = defineProps<{ character: CharacterFull | null }>()

const emit = defineEmits<{
  (e: 'update', id: string, field: string, value: string): void
  (e: 'upload-avatar', id: string): void
  (e: 'add-gallery', id: string): void
  (e: 'remove-gallery', id: string, index: number): void
}>()

// --- Name editing ---
const editingName = ref(false)
const nameInput = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function startEditName() {
  if (!props.character) return
  nameInput.value = props.character.name
  editingName.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function saveName() {
  if (!props.character) return
  editingName.value = false
  if (nameInput.value.trim() && nameInput.value !== props.character.name) {
    emit('update', props.character.id, 'name', nameInput.value.trim())
  }
}

// --- Rich Text Editor (Tiptap) ---
const editingDesc = ref(false)

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    Link.configure({ openOnClick: false, autolink: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: 'Write character description...' }),
  ],
  content: '',
  editable: false,
  editorProps: {
    attributes: { class: 'tiptap-content' },
  },
})

function startEditDesc() {
  if (!props.character || !editor.value) return
  editor.value.commands.setContent(props.character.description || '')
  editor.value.setEditable(true)
  editingDesc.value = true
  nextTick(() => editor.value?.commands.focus('end'))
}

function stopEditDesc() {
  if (!props.character || !editor.value) return
  const html = editor.value.getHTML()
  const isEmpty = editor.value.isEmpty
  const newValue = isEmpty ? '' : html
  if (newValue !== props.character.description) {
    emit('update', props.character.id, 'description', newValue)
  }
  editor.value.setEditable(false)
  editingDesc.value = false
}

// Sync editor content when character changes
watch(() => props.character?.id, () => {
  editingName.value = false
  editingDesc.value = false
  lightboxVisible.value = false
  if (editor.value) {
    editor.value.setEditable(false)
    if (props.character) {
      editor.value.commands.setContent(props.character.description || '')
    }
  }
})

watch(() => props.character?.description, (newDesc) => {
  if (!editor.value || editingDesc.value) return
  const current = editor.value.getHTML()
  if (newDesc !== current) {
    editor.value.commands.setContent(newDesc || '')
  }
})

onBeforeUnmount(() => { editor.value?.destroy() })

// --- Toolbar helpers ---
function isActive(name: string, attrs?: Record<string, any>) {
  return editor.value?.isActive(name, attrs) ?? false
}

function addLink() {
  if (!editor.value) return
  const prev = editor.value.getAttributes('link').href
  const url = window.prompt?.('URL:', prev || 'https://') // fallback
  if (url === null) return
  if (url === '') { editor.value.chain().focus().extendMarkRange('link').unsetLink().run(); return }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

// --- Avatar ---
function getAvatarSrc(url: string | null): string {
  if (!url) return defaultAvatar
  return url.startsWith('file://') ? url : `file://${url}`
}

// --- Gallery ---
const lightboxVisible = ref(false)
const lightboxStartIndex = ref(0)
function openLightbox(i: number) { lightboxStartIndex.value = i; lightboxVisible.value = true }

// --- Gallery context menu ---
const galleryCtxVisible = ref(false)
const galleryCtxX = ref(0)
const galleryCtxY = ref(0)
const galleryCtxIndex = ref(-1)
const galleryCtxItems: ContextMenuItem[] = [{ label: 'Remove Image', action: 'remove', icon: '🗑' }]

function onGalleryContextMenu(e: MouseEvent, i: number) {
  e.preventDefault()
  galleryCtxX.value = e.clientX; galleryCtxY.value = e.clientY
  galleryCtxIndex.value = i; galleryCtxVisible.value = true
}

function onGalleryCtxAction(action: string) {
  if (action === 'remove' && props.character && galleryCtxIndex.value >= 0)
    emit('remove-gallery', props.character.id, galleryCtxIndex.value)
}
</script>

<template>
  <div class="detail" v-if="character">
    <!-- Header: Avatar + Name -->
    <div class="detail-header">
      <div class="avatar-wrap" @click="emit('upload-avatar', character.id)">
        <img :src="getAvatarSrc(character.avatarUrl)" class="avatar-img" alt="Avatar" />
        <div class="avatar-overlay">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 16V8m0 0l-3 3m3-3l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Upload</span>
        </div>
      </div>
      <div class="name-section">
        <div v-if="!editingName" class="name-display" @dblclick="startEditName">
          <h1 class="char-name">{{ character.name }}</h1>
          <button class="edit-btn" @click="startEditName" title="Edit name">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3V9l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div v-else class="name-edit">
          <input ref="nameInputRef" v-model="nameInput" class="name-input" @blur="saveName" @keydown.enter="saveName" @keydown.escape="editingName = false" />
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="detail-section">
      <div class="section-header">
        <span class="section-title">Description</span>
        <button v-if="!editingDesc" class="edit-btn" @click="startEditDesc" title="Edit description">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3V9l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button v-else class="edit-btn save-btn" @click="stopEditDesc" title="Save & close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <!-- View mode: rendered HTML -->
      <div v-if="!editingDesc" class="desc-view" @dblclick="startEditDesc">
        <div v-if="character.description" class="desc-rendered" v-html="character.description"></div>
        <p v-else class="desc-placeholder">No description yet. Click edit to add one.</p>
      </div>

      <!-- Edit mode: Tiptap toolbar + editor -->
      <template v-else>
        <div class="editor-toolbar" v-if="editor">
          <button class="tb" :class="{ on: isActive('bold') }" @click="editor!.chain().focus().toggleBold().run()" title="Bold"><b>B</b></button>
          <button class="tb" :class="{ on: isActive('italic') }" @click="editor!.chain().focus().toggleItalic().run()" title="Italic"><i>I</i></button>
          <button class="tb" :class="{ on: isActive('underline') }" @click="editor!.chain().focus().toggleUnderline().run()" title="Underline"><u>U</u></button>
          <button class="tb" :class="{ on: isActive('strike') }" @click="editor!.chain().focus().toggleStrike().run()" title="Strikethrough"><s>S</s></button>
          <button class="tb" :class="{ on: isActive('highlight') }" @click="editor!.chain().focus().toggleHighlight().run()" title="Highlight">H</button>
          <div class="tb-sep"></div>
          <button class="tb" :class="{ on: isActive('heading', { level: 1 }) }" @click="editor!.chain().focus().toggleHeading({ level: 1 }).run()" title="Heading 1">H1</button>
          <button class="tb" :class="{ on: isActive('heading', { level: 2 }) }" @click="editor!.chain().focus().toggleHeading({ level: 2 }).run()" title="Heading 2">H2</button>
          <button class="tb" :class="{ on: isActive('heading', { level: 3 }) }" @click="editor!.chain().focus().toggleHeading({ level: 3 }).run()" title="Heading 3">H3</button>
          <div class="tb-sep"></div>
          <button class="tb" :class="{ on: isActive('bulletList') }" @click="editor!.chain().focus().toggleBulletList().run()" title="Bullet list">•≡</button>
          <button class="tb" :class="{ on: isActive('orderedList') }" @click="editor!.chain().focus().toggleOrderedList().run()" title="Ordered list">1.</button>
          <button class="tb" :class="{ on: isActive('blockquote') }" @click="editor!.chain().focus().toggleBlockquote().run()" title="Quote">❝</button>
          <button class="tb" :class="{ on: isActive('codeBlock') }" @click="editor!.chain().focus().toggleCodeBlock().run()" title="Code block">&lt;/&gt;</button>
          <div class="tb-sep"></div>
          <button class="tb" :class="{ on: isActive('link') }" @click="addLink" title="Link">🔗</button>
          <div class="tb-sep"></div>
          <button class="tb" @click="editor!.chain().focus().setTextAlign('left').run()" :class="{ on: isActive({ textAlign: 'left' }) }" title="Align left">⫷</button>
          <button class="tb" @click="editor!.chain().focus().setTextAlign('center').run()" :class="{ on: isActive({ textAlign: 'center' }) }" title="Align center">☰</button>
          <button class="tb" @click="editor!.chain().focus().setTextAlign('right').run()" :class="{ on: isActive({ textAlign: 'right' }) }" title="Align right">⫸</button>
          <div class="tb-spacer"></div>
          <button class="tb" @click="editor!.chain().focus().undo().run()" :disabled="!editor!.can().undo()" title="Undo">↩</button>
          <button class="tb" @click="editor!.chain().focus().redo().run()" :disabled="!editor!.can().redo()" title="Redo">↪</button>
        </div>
        <div class="editor-wrap editing">
          <EditorContent :editor="editor" />
        </div>
      </template>
    </div>

    <!-- Gallery -->
    <div class="detail-section">
      <div class="section-header">
        <span class="section-title">Gallery</span>
        <button class="edit-btn" @click="emit('add-gallery', character.id)" title="Add images">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="gallery-strip" v-if="character.gallery.length > 0">
        <div v-for="(img, i) in character.gallery" :key="i" class="gallery-thumb" @click="openLightbox(i)" @contextmenu="onGalleryContextMenu($event, i)">
          <img :src="'file://' + img" :alt="`Gallery ${i + 1}`" />
        </div>
        <button class="gallery-add-btn" @click="emit('add-gallery', character.id)" title="Add more">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div v-else class="gallery-empty">
        <button class="gallery-empty-btn" @click="emit('add-gallery', character.id)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M6 18l4-5 3 3 2-2 3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Add images to gallery</span>
        </button>
      </div>
    </div>

    <ContextMenu :items="galleryCtxItems" :x="galleryCtxX" :y="galleryCtxY" :visible="galleryCtxVisible" @action="onGalleryCtxAction" @close="galleryCtxVisible = false" />
    <ImageLightbox :images="character.gallery" :start-index="lightboxStartIndex" :visible="lightboxVisible" @close="lightboxVisible = false" />
  </div>

  <!-- Empty state -->
  <div v-else class="detail-empty">
    <div class="empty-icon">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="20" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M14 38c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="1.5"/></svg>
    </div>
    <p class="empty-text">Select a character to view details</p>
  </div>
</template>

<style scoped>
.detail { flex:1; overflow-y:auto; padding:28px 36px; background: radial-gradient(ellipse at 20% 30%,rgba(100,108,255,.03) 0%,transparent 60%),#1a1a1f; }
.detail::-webkit-scrollbar { width:6px; }
.detail::-webkit-scrollbar-track { background:transparent; }
.detail::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:4px; }

.detail-header { display:flex; gap:24px; align-items:flex-start; margin-bottom:28px; }

/* Avatar */
.avatar-wrap { position:relative; width:150px; height:150px; border-radius:12px; overflow:hidden; cursor:pointer; flex-shrink:0; border:2px solid rgba(255,255,255,.06); transition:border-color .2s; }
.avatar-wrap:hover { border-color:rgba(100,108,255,.3); }
.avatar-img { width:100%; height:100%; object-fit:cover; display:block; }
.avatar-overlay { position:absolute; inset:0; background:rgba(0,0,0,.6); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; opacity:0; transition:opacity .2s; color:#ccc; font-size:12px; }
.avatar-wrap:hover .avatar-overlay { opacity:1; }

/* Name */
.name-section { flex:1; padding-top:8px; }
.name-display { display:flex; align-items:center; gap:12px; }
.char-name { font-size:28px; font-weight:700; color:#e0e0f0; margin:0; line-height:1.2; }
.edit-btn { background:none; border:1px solid transparent; color:#555; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
.edit-btn:hover { background:rgba(255,255,255,.06); color:#aaa; border-color:rgba(255,255,255,.08); }
.name-input { font-size:28px; font-weight:700; color:#e0e0f0; background:rgba(255,255,255,.04); border:1px solid rgba(100,108,255,.3); border-radius:8px; padding:4px 12px; width:100%; font-family:inherit; outline:none; }
.name-input:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(100,108,255,.1); }

/* Sections */
.detail-section { margin-bottom:24px; }
.section-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.section-title { font-size:11.5px; font-weight:600; color:#6b6b80; text-transform:uppercase; letter-spacing:.8px; }

/* Save button accent */
.save-btn { color:#4ade80 !important; }
.save-btn:hover { background:rgba(74,222,128,.1) !important; color:#86efac !important; border-color:rgba(74,222,128,.2) !important; }

/* Description view mode */
.desc-view { cursor:pointer; padding:8px 0; min-height:40px; transition:background .15s; border-radius:8px; }
.desc-view:hover { background:rgba(255,255,255,.02); }
.desc-rendered { color:#b0b0c8; font-size:14px; line-height:1.7; }
.desc-rendered :deep(h1) { font-size:1.6em; font-weight:700; color:#e0e0f0; margin:0 0 .4em; }
.desc-rendered :deep(h2) { font-size:1.3em; font-weight:600; color:#d0d0e8; margin:0 0 .4em; }
.desc-rendered :deep(h3) { font-size:1.1em; font-weight:600; color:#c0c0d8; margin:0 0 .4em; }
.desc-rendered :deep(p) { margin:0 0 .5em; }
.desc-rendered :deep(ul), .desc-rendered :deep(ol) { padding-left:1.4em; margin:0 0 .5em; }
.desc-rendered :deep(li) { margin-bottom:.2em; }
.desc-rendered :deep(blockquote) { border-left:3px solid rgba(100,108,255,.3); padding-left:14px; margin:0 0 .5em; color:#999; font-style:italic; }
.desc-rendered :deep(code) { background:rgba(255,255,255,.06); padding:2px 6px; border-radius:4px; font-size:.9em; color:#a5b4fc; }
.desc-rendered :deep(pre) { background:rgba(0,0,0,.3); border-radius:6px; padding:12px; margin:0 0 .5em; overflow-x:auto; }
.desc-rendered :deep(pre code) { background:none; padding:0; color:#c0c0d8; }
.desc-rendered :deep(a) { color:#818cf8; text-decoration:underline; }
.desc-rendered :deep(mark) { background:rgba(255,220,50,.25); color:inherit; border-radius:2px; padding:1px 2px; }
.desc-placeholder { color:#555; font-style:italic; font-size:14px; margin:0; }

/* Editor Toolbar */
.editor-toolbar { display:flex; align-items:center; gap:2px; padding:6px 8px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-bottom:none; border-radius:8px 8px 0 0; flex-wrap:wrap; }
.tb { background:none; border:1px solid transparent; color:#777; width:28px; height:26px; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; font-family:inherit; transition:all .12s; padding:0; }
.tb:hover:not(:disabled) { background:rgba(255,255,255,.06); color:#bbb; }
.tb.on { background:rgba(100,108,255,.15); color:#a5b4fc; border-color:rgba(100,108,255,.2); }
.tb:disabled { opacity:.3; cursor:default; }
.tb-sep { width:1px; height:18px; background:rgba(255,255,255,.06); margin:0 4px; }
.tb-spacer { flex:1; }

/* Editor Content */
.editor-wrap { border:1px solid rgba(255,255,255,.06); border-radius:0 0 8px 8px; min-height:150px; }
.editor-wrap.editing { border-color:rgba(100,108,255,.25); }
.editor-wrap :deep(.tiptap-content) { padding:16px; color:#c0c0d8; font-size:14px; line-height:1.7; outline:none; min-height:120px; }
.editor-wrap :deep(.tiptap-content) p { margin:0 0 .5em; }
.editor-wrap :deep(.tiptap-content) h1 { font-size:1.6em; font-weight:700; color:#e0e0f0; margin:0 0 .4em; }
.editor-wrap :deep(.tiptap-content) h2 { font-size:1.3em; font-weight:600; color:#d0d0e8; margin:0 0 .4em; }
.editor-wrap :deep(.tiptap-content) h3 { font-size:1.1em; font-weight:600; color:#c0c0d8; margin:0 0 .4em; }
.editor-wrap :deep(.tiptap-content) ul, .editor-wrap :deep(.tiptap-content) ol { padding-left:1.4em; margin:0 0 .5em; }
.editor-wrap :deep(.tiptap-content) li { margin-bottom:.2em; }
.editor-wrap :deep(.tiptap-content) blockquote { border-left:3px solid rgba(100,108,255,.3); padding-left:14px; margin:0 0 .5em; color:#999; font-style:italic; }
.editor-wrap :deep(.tiptap-content) code { background:rgba(255,255,255,.06); padding:2px 6px; border-radius:4px; font-size:.9em; color:#a5b4fc; }
.editor-wrap :deep(.tiptap-content) pre { background:rgba(0,0,0,.3); border-radius:6px; padding:12px; margin:0 0 .5em; overflow-x:auto; }
.editor-wrap :deep(.tiptap-content) pre code { background:none; padding:0; color:#c0c0d8; }
.editor-wrap :deep(.tiptap-content) a { color:#818cf8; text-decoration:underline; cursor:pointer; }
.editor-wrap :deep(.tiptap-content) mark { background:rgba(255,220,50,.25); color:inherit; border-radius:2px; padding:1px 2px; }
.editor-wrap :deep(.tiptap-content) p.is-editor-empty:first-child::before { content:attr(data-placeholder); float:left; color:#555; pointer-events:none; height:0; }
.editor-wrap :deep(.tiptap-content):focus { box-shadow:inset 0 0 0 1px rgba(100,108,255,.2); border-radius:0 0 7px 7px; }

/* Gallery */
.gallery-strip { display:flex; gap:10px; overflow-x:auto; padding:4px 0 8px; }
.gallery-strip::-webkit-scrollbar { height:5px; }
.gallery-strip::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:4px; }
.gallery-thumb { width:100px; height:100px; border-radius:8px; overflow:hidden; cursor:pointer; flex-shrink:0; border:1px solid rgba(255,255,255,.06); transition:border-color .15s,transform .15s; }
.gallery-thumb:hover { border-color:rgba(100,108,255,.3); transform:scale(1.04); }
.gallery-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.gallery-add-btn { width:100px; height:100px; border-radius:8px; border:1px dashed rgba(255,255,255,.1); background:rgba(255,255,255,.02); color:#555; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s; }
.gallery-add-btn:hover { border-color:rgba(100,108,255,.3); color:#818cf8; background:rgba(100,108,255,.05); }
.gallery-empty { padding:16px 0; }
.gallery-empty-btn { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,.02); border:1px dashed rgba(255,255,255,.08); border-radius:10px; padding:20px 24px; color:#555; font-size:13px; font-family:inherit; cursor:pointer; transition:all .15s; width:100%; }
.gallery-empty-btn:hover { border-color:rgba(100,108,255,.25); color:#818cf8; background:rgba(100,108,255,.04); }

/* Empty state */
.detail-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; color:#444; background:#1a1a1f; }
.empty-icon { opacity:.3; }
.empty-text { font-size:14px; color:#555; }
</style>
