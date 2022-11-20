const path = require('path')
const server = require('express')
const fs = require('fs-extra')
const multiparty = require('multiparty')

const app = server()

const UPLOAD_DIR = path.resolve(__dirname, 'target')

app.all('*', (req, res, next) => {
  // 设置允许跨域的域名，*代表允许任意域名跨域
  res.header('Access-Control-Allow-Origin', '*')
  // 允许的header类型
  res.header('Access-Control-Allow-Headers', 'content-type')
  // 跨域允许的请求方式
  res.header('Access-Control-Allow-Methods', 'DELETE,PUT,POST,GET,OPTIONS')
  if (req.method == 'OPTIONS')
    res.sendStatus(200) // 让options尝试请求快速结束
  else
    next()
})

const pipeStream = (path, writeStream) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(path)
    readStream.on('end', () => {
      fs.unlinkSync(path)
      resolve()
    })
    readStream.pipe(writeStream)
  })
}

// 处理切片
const handleFormData = async (req, res) => {
  const form = new multiparty.Form({
    uploadDir: UPLOAD_DIR,
  })
  if (!fs.existsSync(UPLOAD_DIR))
    fs.mkdirsSync(UPLOAD_DIR)
  form.parse(req, async (err, data, files) => {
    if (err) {
      console.error(err)
      res.status = 500
      res.send('process file chunk failed')
      return
    }
    const [chunk] = files.chunk
    const [hash] = data.hash
    const [filename] = data.filename
    const [fileHash] = data.fileHash

    const filePath = path.resolve(UPLOAD_DIR, fileHash)
    const chunkPath = path.resolve(filePath, `chunk_${hash}`)
    if (!fs.existsSync(filePath))
      fs.mkdirsSync(filePath)
    if (fs.existsSync(chunkPath)) {
      res.send({ code: 400, msg: '切片已存在' })
      fs.unlinkSync(chunk.path)
      return
    }
    await fs.move(chunk.path, chunkPath)
    res.send({ code: 200, msg: '切片上传完成' })
  })
}

// 合并chunk
const merageChunks = (filePath, filename) => {
  return new Promise((resolve) => {
    const chunks = fs.readdirSync(filePath)
    const chunkPaths = chunks.map(chunk => path.resolve(filePath, chunk))
    chunkPaths.sort((a, b) => a.split('_')[2] - b.split('_')[2])
    // 采用Stream方式合并
    const targetStream = fs.createWriteStream(path.resolve(UPLOAD_DIR, filename))

    const readStream = function (chunkArray, cb) {
      const path = chunkArray.shift()
      const originStream = fs.createReadStream(path)
      originStream.pipe(targetStream, { end: false })
      originStream.on('end', () => {
      // 删除文件
        fs.unlinkSync(path)
        if (chunkArray.length > 0)
          readStream(chunkArray, resolve)
        else
          cb && cb()
      })
    }
    readStream(chunkPaths, resolve)
  })
}

// file-hash
app.post('/upload', (req, res) => {
  handleFormData(req, res)
})

const resolvePost = req =>
  new Promise((resolve) => {
    let chunk = ''
    req.on('data', (data) => {
      chunk += data
    })
    req.on('end', () => {
      resolve(JSON.parse(chunk))
    })
  })

app.post('/merge', async (req, res) => {
  const { fileHash, filename } = await resolvePost(req)
  const filePath = path.resolve(UPLOAD_DIR, fileHash)
  if (!fs.existsSync(filePath)) {
    res.send({ code: 400, msg: '文件不存在' })
    return
  }
  await merageChunks(filePath, filename)
  fs.rmdirSync(filePath)
  res.send({ code: 200, msg: '合并成功' })
})

app.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('服务器运行在http://localhost:3000')
})
