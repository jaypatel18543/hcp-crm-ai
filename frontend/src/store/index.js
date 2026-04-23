import { configureStore, createSlice } from '@reduxjs/toolkit';

const interactionSlice = createSlice({
  name: 'interaction',
  initialState: {
    form: {
      hcp_name: '',
      interaction_type: 'Meeting',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      attendees: '',
      topics_discussed: '',
      materials_shared: '',
      samples_distributed: '',
      sentiment: 'neutral',
      outcomes: '',
      follow_up_actions: '',
    },
    interactions: [],
    loading: false,
    error: null,
    lastSaved: null,
  },
  reducers: {
    updateField: (state, action) => {
      state.form[action.payload.field] = action.payload.value;
    },
    setForm: (state, action) => {
      state.form = { ...state.form, ...action.payload };
    },
    resetForm: (state) => {
      state.form = {
        hcp_name: '',
        interaction_type: 'Meeting',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        attendees: '',
        topics_discussed: '',
        materials_shared: '',
        samples_distributed: '',
        sentiment: 'neutral',
        outcomes: '',
        follow_up_actions: '',
      };
      state.lastSaved = null;
    },
    setLoading: (state, action) => { state.loading = action.payload; },
    setError: (state, action) => { state.error = action.payload; },
    setInteractions: (state, action) => { state.interactions = action.payload; },
    addInteraction: (state, action) => { state.interactions.unshift(action.payload); },
    setLastSaved: (state, action) => { state.lastSaved = action.payload; },
  },
});

export const {
  updateField, setForm, resetForm,
  setLoading, setError, setInteractions,
  addInteraction, setLastSaved,
} = interactionSlice.actions;

export const store = configureStore({
  reducer: { interaction: interactionSlice.reducer },
});
