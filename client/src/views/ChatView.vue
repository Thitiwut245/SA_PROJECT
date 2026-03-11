<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const authStore = useAuthStore()

const matchId = Number(route.params.matchId)
const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const matchData = ref<any>(null)

const showInfo = ref(false)

// ==========================================
// Report
// ==========================================
const showReportModal = ref(false)
const reportTopic = ref('')
const reportDesc = ref('')
const reportImages = ref<File[]>([])
const isSubmittingReport = ref(false)
const reportFileInput = ref<HTMLInputElement | null>(null)

const reportTopics = [
  'Inappropriate Behavior / Toxicity',
  'Harassment / Hate Speech',
  'Spam / Scam / Bot',
  'Fake Profile / Catfishing',
  'Other'
]

const openReportModal = () => {
  showInfo.value = false
  showReportModal.value = true
}

const closeReportModal = () => {
  showReportModal.value = false
  reportTopic.value = ''
  reportDesc.value = ''
  reportImages.value = []
}

const handleReportImageUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (!target.files) return

  const newFiles = Array.from(target.files)

  if (reportImages.value.length + newFiles.length > 3) {
    alert('You can only upload up to 3 images as evidence.')
    return
  }

  const currentTotalSize = reportImages.value.reduce((sum, file) => sum + file.size, 0)
  const newFilesSize = newFiles.reduce((sum, file) => sum + file.size, 0)
  
  if (currentTotalSize + newFilesSize > 20 * 1024 * 1024) {
    alert('Total image size cannot exceed 20MB. Please select smaller images.')
    return
  }

  reportImages.value.push(...newFiles)
  target.value = '' // ล้างค่า input ให้กดเลือกรูปเดิมซ้ำได้
}

const removeReportImage = (index: number) => {
  reportImages.value.splice(index, 1)
}

const submitReport = async () => {
  if (!reportTopic.value) return

  isSubmittingReport.value = true
  try {
    const uploadedUrls: string[] = []
    
    for (const file of reportImages.value) {
      const formData = new FormData()
      formData.append('image', file)
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      uploadedUrls.push(uploadRes.data.imageUrl)
    }

    await api.post('/profile/report', {
      reportedId: matchData.value?.target_id,
      reportType: reportTopic.value,
      description: reportDesc.value,
      images: uploadedUrls
    })

    alert('Your report has been submitted to the admin. Thank you for keeping the community safe.')
    closeReportModal()
    
    if(confirm('Would you like to unmatch with this user as well?')) {
      handleUnmatch()
    }
  } catch (err) {
    console.error('Failed to submit report', err)
    alert('Failed to submit report. Please try again.')
  } finally {
    isSubmittingReport.value = false
  }
}

// ==========================================
// Chat
// ==========================================
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(() => chatStore.messages.length, () => {
  scrollToBottom()
})

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  chatStore.hasUnread = false
  if (chatStore.matchesList.length === 0) {
    await chatStore.fetchMatches()
  }
  matchData.value = chatStore.matchesList.find(m => m.id === matchId)
  await chatStore.fetchHistory(matchId)
  chatStore.initSocketListeners()
  scrollToBottom()
})

onUnmounted(() => {
  chatStore.activeMatchId = null
})

const targetAge = computed(() => {
  if (!matchData.value?.target_birth_date) return ''
  const dob = new Date(matchData.value.target_birth_date)
  const ageDifMs = Date.now() - dob.getTime()
  const ageDate = new Date(ageDifMs)
  return Math.abs(ageDate.getUTCFullYear() - 1970)
})

const formatTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr)
    const hours = d.getHours().toString().padStart(2, '0')
    const mins = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${mins}`
  } catch {
    return ''
  }
}

const groupedMessages = computed(() => {
  const myId = Number(authStore.user?.id || (authStore.user as any)?.user_id)
  return chatStore.messages.map(msg => ({
    ...msg,
    isSelf: Number(msg.sender_id) === myId,
    time: formatTime(msg.sent_at)
  }))
})

const send = () => {
  if (!messageInput.value.trim()) return
  chatStore.sendMessage(matchId, messageInput.value.trim())
  messageInput.value = ''
  scrollToBottom()
}

const handleUnmatch = async () => {
  if (!confirm('Are you sure you want to unmatch? This action cannot be undone.')) return
  try {
    await api.put(`/swipe/unmatch/${matchId}`)
    router.push('/matches')
  } catch (err) {
    console.error('Failed to unmatch', err)
    alert('Could not unmatch. Please try again.')
  }
}

// Helper สร้าง URL สำหรับ Preview รูปก่อนอัปโหลด
const getObjectUrl = (file: File) => URL.createObjectURL(file)
</script>

<template>
  <div class="flex flex-col h-full absolute inset-0 bg-[var(--color-dark-bg)]">
    <div class="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/5 shrink-0 z-10">
      <div class="flex items-center gap-3">
        <button
          @click="router.push('/matches')"
          class="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full overflow-hidden border-2 border-purple-500/30 bg-[var(--color-input-bg)]">
            <img :src="matchData?.target_avatar || '/placeholder-avatar.png'" class="w-full h-full object-cover" />
          </div>
          <span class="font-semibold text-white text-[15px]">{{ matchData?.target_name || 'Match' }}</span>
        </div>
      </div>

      <button 
        @click="showInfo = true" 
        class="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
    </div>

    <div ref="messagesContainer" class="flex-grow overflow-y-auto px-4 py-4 flex flex-col gap-2">
      <div v-if="chatStore.messages.length === 0" class="flex-grow flex flex-col items-center justify-center text-center text-gray-500">
        <p class="text-sm">No messages yet. Say hi! 👋</p>
      </div>

      <template v-for="(msg, idx) in groupedMessages" :key="msg.id">
        <div class="flex w-full" :class="msg.isSelf ? 'justify-end' : 'justify-start'">
          <div class="flex flex-col max-w-[75%]" :class="msg.isSelf ? 'items-end' : 'items-start'">
            <div
              class="px-[18px] py-[14px] text-[15px] text-left leading-[1.5] shadow-[0_2px_6px_rgba(0,0,0,0.03)] whitespace-pre-wrap [word-break:break-word]"
              :class="[
                msg.isSelf
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-[18px] rounded-br-[4px]'
                  : 'bg-white/[0.08] text-gray-100 rounded-[18px] rounded-bl-[4px] border border-white/[0.05]'
              ]"
            >
              {{ msg.message_content }}
            </div>
            <span
              v-if="msg.time && (idx === groupedMessages.length - 1 || groupedMessages[idx + 1]?.isSelf !== msg.isSelf)"
              class="text-[10px] text-gray-600 mt-1 px-1"
            >
              {{ msg.time }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <div class="px-4 py-3 bg-white/[0.02] border-t border-white/5 shrink-0">
      <form @submit.prevent="send" class="flex gap-2 items-center max-w-lg mx-auto w-full">
        <input
          v-model="messageInput"
          type="text"
          placeholder="Message..."
          @keydown.enter.prevent="send"
          class="flex-grow px-4 py-3 bg-[var(--color-input-bg)] border border-white/5 rounded-2xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-white placeholder-gray-400 text-sm transition-all"
        />
        <button
          type="submit"
          :disabled="!messageInput.trim()"
          class="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white hover:bg-purple-500 transition-colors disabled:opacity-30 disabled:bg-white/10 disabled:text-gray-500 cursor-pointer shrink-0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19V5m-7 7l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>

    <div 
      v-if="showInfo" 
      class="fixed inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" 
      @click.self="showInfo = false"
    >
      <div class="w-full max-w-sm bg-[var(--color-dark-bg)] border border-white/10 rounded-3xl p-6 flex flex-col shadow-2xl relative">
        <button 
          @click="showInfo = false" 
          class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div class="w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-purple-500/30 mb-4 bg-[var(--color-input-bg)] shadow-[0_0_20px_rgba(124,58,237,0.15)]">
          <img :src="matchData?.target_avatar || '/placeholder-avatar.png'" class="w-full h-full object-cover" />
        </div>

        <h3 class="text-xl font-bold text-center text-white flex items-center justify-center gap-2">
          {{ matchData?.target_name || 'Match' }}
          <span v-if="targetAge" class="text-gray-400 font-normal text-lg">{{ targetAge }}</span>
        </h3>

        <div class="mt-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4 min-h-[60px] flex items-center justify-center">
          <p class="text-sm text-gray-300 leading-relaxed text-center">
            {{ matchData?.target_bio || 'No bio provided.' }}
          </p>
        </div>

        <div class="mt-5 mb-8">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Interested Games</p>
          <div class="flex flex-wrap gap-2">
            <span 
              v-for="game in (matchData?.target_games || [])" 
              :key="game.id" 
              class="px-3 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-lg text-xs font-semibold"
            >
              {{ game.name }}
            </span>
            <span v-if="!matchData?.target_games?.length" class="text-xs text-gray-500">No games selected.</span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <button 
            @click="handleUnmatch" 
            class="w-full py-3 bg-white/5 text-gray-400 font-bold rounded-xl border border-white/10 hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-sm"
          >
            Unmatch
          </button>
          <button 
            @click="openReportModal" 
            class="w-full py-3 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer text-sm"
          >
            Report User
          </button>
        </div>
      </div>
    </div>

    <div 
      v-if="showReportModal" 
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      @click.self="closeReportModal"
    >
      <div class="w-full max-w-sm bg-[var(--color-dark-bg)] border border-white/10 rounded-3xl p-6 flex flex-col shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button 
          @click="closeReportModal" 
          class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 class="text-xl font-bold text-white mb-1">Report User</h2>
        <p class="text-sm text-gray-400 mb-6">Tell us what happened with {{ matchData?.target_name }}.</p>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Topic <span class="text-red-400">*</span></label>
            <select 
              v-model="reportTopic"
              class="w-full px-4 py-3.5 bg-[var(--color-input-bg)] border border-white/5 rounded-2xl outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all text-white text-sm"
            >
              <option value="" disabled>Select a reason...</option>
              <option v-for="topic in reportTopics" :key="topic" :value="topic">{{ topic }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Evidence (Max 3)</label>
            <div class="flex flex-wrap gap-3">
              <div 
                v-for="(file, idx) in reportImages" 
                :key="idx" 
                class="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group bg-black"
              >
                <img :src="getObjectUrl(file)" class="w-full h-full object-cover opacity-80" />
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button @click="removeReportImage(idx)" class="w-6 h-6 bg-red-500 rounded-full text-white flex items-center justify-center cursor-pointer">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <button 
                v-if="reportImages.length < 3"
                @click="() => reportFileInput?.click()"
                class="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 hover:border-red-500/50 hover:bg-white/5 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-gray-500"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                <span class="text-[10px] font-medium">Add Image</span>
              </button>
              
              <input ref="reportFileInput" type="file" accept="image/*" multiple class="hidden" @change="handleReportImageUpload" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Additional Details</label>
            <textarea 
              v-model="reportDesc"
              rows="3"
              placeholder="Provide more context..."
              class="w-full px-4 py-3.5 bg-[var(--color-input-bg)] border border-white/5 rounded-2xl outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all text-white text-sm resize-none"
            ></textarea>
          </div>

          <button 
            @click="submitReport"
            :disabled="isSubmittingReport || !reportTopic"
            class="w-full py-4 mt-2 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {{ isSubmittingReport ? 'Uploading Evidence...' : 'Submit Report' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>