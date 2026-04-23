import axios from 'axios';

const api = axios.create({ baseURL: '' });

export const interactionAPI = {
  create: (data) => api.post('/api/interactions/', data),
  list: () => api.get('/api/interactions/'),
  get: (id) => api.get(`/api/interactions/${id}`),
  update: (id, data) => api.put(`/api/interactions/${id}`, data),
  delete: (id) => api.delete(`/api/interactions/${id}`),
};

export const agentAPI = {
  chat: (message, sessionId, formData) =>
    api.post('/api/agent/chat', {
      message,
      session_id: sessionId,
      current_form_data: formData,
    }),
};