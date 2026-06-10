<template>
  <div class="comment-item">
    <div class="comment-avatar">{{ avatarLetter }}</div>
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-username">{{ username }}</span>
        <span class="comment-time">{{ relativeTime }}</span>
      </div>
      <div class="comment-content" v-html="content"></div>
      <div v-if="isOwner" class="comment-actions">
        <button @click="handleEdit" class="btn-link">编辑</button>
        <button @click="handleDelete" class="btn-link btn-danger">删除</button>
      </div>
      <div v-if="editing" class="edit-form">
        <div class="editor-wrapper">
          <QuillEditor
            v-model:content="editContent"
            contentType="html"
            theme="snow"
            toolbar="minimal"
          />
        </div>
        <div class="edit-actions">
          <button @click="cancelEdit" class="btn-secondary">取消</button>
          <button @click="saveEdit" class="btn-primary">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { formatRelative } from '@/plugins/dayjs'

const props = defineProps({
  comment: {
    type: Object,
    required: true
    // { id, user, content, created_at, is_owner }
  }
})

const emit = defineEmits(['edit', 'delete'])

const editing = ref(false)
const editContent = ref('')

const username = computed(() => props.comment.user || '未知用户')
const avatarLetter = computed(() => (username.value[0] || '?').toUpperCase())
const relativeTime = computed(() => formatRelative(props.comment.created_at))
const isOwner = computed(() => props.comment.is_owner)
const content = computed(() => props.comment.content)

function handleEdit() {
  editContent.value = content.value
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editContent.value = ''
}

function saveEdit() {
  emit('edit', { commentId: props.comment.id, content: editContent.value })
  editing.value = false
}

function handleDelete() {
  emit('delete', props.comment.id)
}
</script>

<style scoped>
.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: box-shadow 0.2s;
}

.comment-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent, #0071e3);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-username {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-primary);
}

.comment-time {
  font-size: 12px;
  color: var(--color-secondary);
}

.comment-content {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-primary);
  word-break: break-word;
}

.comment-content :deep(a) {
  color: var(--color-accent);
}

.comment-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.comment-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.comment-item:hover .comment-actions {
  opacity: 1;
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-link.btn-danger {
  color: var(--color-error);
}

.edit-form {
  margin-top: 12px;
}

.edit-form .editor-wrapper {
  margin-bottom: 8px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-secondary {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.btn-primary {
  padding: 6px 12px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
</style>