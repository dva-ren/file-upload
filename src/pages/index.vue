<script setup lang="ts">
import request from '../composables/requests'

import { md5 } from '../composables'

const file = ref<File>()
const result = ref<any>(null)
const CHUNK_SIZE = 10 * 1024 * 1024
const fileHash = ref('')
const uploadedList = ref<Blob[]>([])

const uploadChunks = async (chunk: Blob, index: number) => {
  const form = new FormData()
  const hash = await md5(chunk)
  form.append('chunk', chunk)
  form.append('hash', `${hash}_${index}`)
  form.append('filename', file.value!.name)
  form.append('fileHash', fileHash.value)
  try {
    const res = await request.post('/upload', form)
    result.value = res
    uploadedList.value.push(chunk)
  }
  catch (e) {
    result.value = '服务器错误'
  }
}
const handleFileChange = (e: any) => {
  file.value = e.target.files[0]
}

const createFileChunk = (file: File, chunkSize: number) => {
  const chunks = []
  for (let i = 0; i < file.size; i += chunkSize)
    chunks.push({ file: file.slice(i, i + chunkSize) })
  return chunks
}

const handleCLick = async () => {
  if (!file.value) {
    result.value = '未选择文件'
    return
  }
  fileHash.value = await md5(file.value)
  const chunks = createFileChunk(file.value, CHUNK_SIZE)
  for (let index = 0; index < chunks.length; index++)
    uploadChunks(chunks[index].file, index)
}
const handleMerge = async () => {
  try {
    const res = await request.post('/merge', {
      fileHash: fileHash.value,
      size: CHUNK_SIZE,
      filename: file.value!.name,
    })
    result.value = res
  }
  catch (e) {
    result.value = '服务器合并错误'
  }
}
</script>

<template>
  <div>
    <div>fileHash: {{ fileHash }}</div>
    <div>result: {{ result }}</div>
    <input type="file" @change="handleFileChange">
    <div flex gap-4>
      <button btn @click="handleCLick">
        发送
      </button>
      <button btn @click="handleMerge">
        合并
      </button>
    </div>
  </div>
</template>
