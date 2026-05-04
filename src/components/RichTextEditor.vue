<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'

const props = defineProps<{
  modelValue: string
  title?: string
  placeholder?: string
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isEditing = ref(false)

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    Link.configure({ openOnClick: false, autolink: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: props.placeholder || 'Start typing...' }),
  ],
  content: props.modelValue,
  editable: false,
  editorProps: {
    attributes: { class: 'tiptap-content' },
  },
})

function startEdit() {
  if (!editor.value) return
  editor.value.commands.setContent(props.modelValue || '')
  editor.value.setEditable(true)
  isEditing.value = true
  nextTick(() => editor.value?.commands.focus('end'))
}

function stopEdit() {
  if (!editor.value) return
  const html = editor.value.getHTML()
  const isEmpty = editor.value.isEmpty
  const newValue = isEmpty ? '' : html
  if (newValue !== props.modelValue) {
    emit('update:modelValue', newValue)
  }
  editor.value.setEditable(false)
  isEditing.value = false
}

// Sync editor content when external modelValue changes
watch(() => props.modelValue, (newVal) => {
  if (!editor.value || isEditing.value) return
  const current = editor.value.getHTML()
  if (newVal !== current) {
    editor.value.commands.setContent(newVal || '')
  }
})

onBeforeUnmount(() => { editor.value?.destroy() })

// --- Toolbar helpers ---
function isActive(nameOrAttrs: string | Record<string, any>, attrs?: Record<string, any>) {
  if (typeof nameOrAttrs === 'string') {
    return editor.value?.isActive(nameOrAttrs, attrs) ?? false
  }
  return editor.value?.isActive(nameOrAttrs) ?? false
}

function addLink() {
  if (!editor.value) return
  const prev = editor.value.getAttributes('link').href
  const url = window.prompt?.('URL:', prev || 'https://') // fallback
  if (url === null) return
  if (url === '') { editor.value.chain().focus().extendMarkRange('link').unsetLink().run(); return }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}
</script>

<template>
  <div class="rich-text-editor">
    <div class="section-header" v-if="title">
      <span class="section-title">{{ title }}</span>
      <button v-if="!isEditing" class="edit-btn" @click="startEdit" :title="`Edit ${title}`">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3V9l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button v-else class="edit-btn save-btn" @click="stopEdit" title="Save & close">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>

    <!-- View mode: rendered HTML -->
    <div v-if="!isEditing" class="desc-view" @dblclick="startEdit">
      <div v-if="modelValue" class="desc-rendered" v-html="modelValue"></div>
      <p v-else class="desc-placeholder">{{ emptyText || 'No content yet. Click edit to add.' }}</p>
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
</template>

<style scoped>
/* These styles are shared with CharacterDetail.vue and now live here */
.rich-text-editor {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}

.edit-btn {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.edit-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #eee;
}
.save-btn {
  color: #a5b4fc;
}
.save-btn:hover {
  background: rgba(100, 108, 255, 0.15);
  color: #c7d2fe;
}

/* View Mode */
.desc-view {
  font-size: 14px;
  line-height: 1.6;
  color: #d0d0e0;
  padding: 12px;
  border-radius: 8px;
  transition: background 0.2s;
  min-height: 100px;
}
.desc-view:hover {
  background: rgba(255, 255, 255, 0.02);
}
.desc-placeholder {
  color: #666;
  font-style: italic;
}
.desc-rendered {
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* Edit Mode */
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  background: #23232b;
  border: 1px solid rgba(255,255,255,0.06);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  align-items: center;
}
.tb {
  background: transparent;
  border: 1px solid transparent;
  color: #aaa;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: monospace;
}
.tb:hover {
  background: rgba(255,255,255,0.08);
  color: #eee;
}
.tb.on {
  background: rgba(100, 108, 255, 0.2);
  color: #a5b4fc;
  border-color: rgba(100, 108, 255, 0.3);
}
.tb:disabled {
  opacity: 0.3;
  cursor: default;
}
.tb-sep {
  width: 1px;
  height: 16px;
  background: rgba(255,255,255,0.1);
  margin: 0 4px;
}
.tb-spacer {
  flex: 1;
}

.editor-wrap {
  padding: 16px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 0 0 8px 8px;
  background: #1a1a20;
  min-height: 200px;
  cursor: text;
}
.editor-wrap:focus-within {
  border-color: rgba(100, 108, 255, 0.4);
  box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.1);
}

/* Global Tiptap styles within .tiptap-content are defined in index.css */
</style>
