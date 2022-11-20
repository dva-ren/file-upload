import axios from 'axios'

const requests = axios.create()

requests.defaults.baseURL = 'http://localhost:3000'
// requests.defaults.headers['Content-Type'] = 'multipart/form-data'

requests.interceptors.response.use((response) => {
  return response.data
})

export default requests
