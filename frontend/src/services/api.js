const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1";

async function request(path, options = {}) {
  const { token, ...fetchOptions } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`
          }
        : {})
    },
    ...fetchOptions
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export const api = {
  get(path, token) {
    return request(path, {
      method: "GET",
      token
    });
  },
  post(path, body, token) {
    return request(path, {
      body: JSON.stringify(body),
      method: "POST",
      token
    });
  },
  put(path, body, token) {
    return request(path, {
      body: JSON.stringify(body),
      method: "PUT",
      token
    });
  },
  delete(path, token) {
    return request(path, {
      method: "DELETE",
      token
    });
  }
};

export { API_BASE_URL };
