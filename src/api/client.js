// src/api/client.js
import axios from 'axios';

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api` || "http://localhost:5000",
  withCredentials: true, // important for HTTP-only cookie
});

export default client;
