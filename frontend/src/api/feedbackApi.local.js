// Local mode stub — rec feedback ships cloud-first. The UI hides the feedback
// buttons in local mode; these keep imports safe until the backend routes land
// (GET/POST/DELETE /api/rec-feedback).
export const api = {
  async list() {
    return { feedback: [] };
  },

  async record() {
    throw new Error('Recommendation feedback is not yet available in local mode.');
  },

  async remove() {
    throw new Error('Recommendation feedback is not yet available in local mode.');
  },
};
