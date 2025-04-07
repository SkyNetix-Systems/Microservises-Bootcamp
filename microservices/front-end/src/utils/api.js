import axios from "axios";

const makeAPICall = async ({ verb = "GET", route, data = null }) => {
  const request_object = {
    method: verb,
    url: window.location.origin + route, // ✅ use lowercase 'url'
  };

  if (data) {
    request_object.data = data;
  }
  try {
    const response = await axios.request(request_object);
    return response;
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
};

export { makeAPICall };
