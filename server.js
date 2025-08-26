import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();

const APP_ID = "2154611541573635802";
const APP_SECRET = "K01iCwiDSG6lRn33FIQT"; // vẫn cần cho server-side
const REDIRECT_URI = "https://zalo-login.onrender.com/auth/callback";

// tạm lưu code_verifier theo state
const pkceStore = {};

// Hàm sinh code_verifier 43 ký tự
function generateCodeVerifier(length = 43) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Hàm tạo code_challenge từ code_verifier
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Home page
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
      <title>Login Zalo Demo</title></head>
      <meta name="zalo-platform-site-verification" content="RV26S8lY87j0rODJnSGjNpBpzqRUXIGQCpSt" />
      <body style="font-family:sans-serif;text-align:center;margin-top:100px;">
        <h1>Trang Home</h1>
        <a href="/login"
           style="display:inline-block;padding:12px 20px;background:#0068ff;color:white;text-decoration:none;border-radius:8px;">
           Login với Zalo
        </a>
      </body>
    </html>
  `);
});

// Step 1: redirect sang Zalo
app.get("/login", (req, res) => {
  const state = crypto.randomBytes(8).toString("hex"); // random state
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // lưu lại code_verifier theo state
  pkceStore[state] = codeVerifier;

  const zaloLoginUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&state=${state}&code_challenge=${codeChallenge}`;

  res.redirect(zaloLoginUrl);
});

// Step 2: callback từ Zalo
app.get("/auth/callback", async (req, res) => {
  console.log("ssssssssssss")
  const { code, state } = req.query;
  if (!code) return res.send("Không có code từ Zalo!");
  if (!state || !pkceStore[state])
    return res.send("Không tìm thấy code_verifier cho state này!");

  const codeVerifier = pkceStore[state];
  delete pkceStore[state]; // xoá đi để tránh reuse

  try {
    // Đổi code lấy access_token (có kèm code_verifier)
    const tokenRes = await axios.post(
      "https://oauth.zaloapp.com/v4/access_token",
      null,
      {
        params: {
          app_id: APP_ID,
          app_secret: APP_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        },
      }
    );
    console.log('=========tokenres==', tokenRes)
    const accessToken = tokenRes.data.access_token;

    // Lấy thông tin user
    const userRes = await axios.get("https://graph.zalo.me/v2.0/me", {
      params: {
        access_token: accessToken,
        fields: "id,name,picture",
      },
    });
    console.log('====userRes=====', userRes)
    res.send(`
      <h2>Thông tin user</h2>
      <p><b>ID:</b> ${userRes.data.id}</p>
      <p><b>Name:</b> ${userRes.data.name}</p>
      <img src="${userRes.data.picture.data.url}" width="100"/>
      <br><br>
      <a href="/">Quay lại Home</a>
    `);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.listen(3000, () => console.log("Server chạy tại http://localhost:3000"));
