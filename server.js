import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();

// ⚡ Thay bằng APP_ID và APP_SECRET thật của bạn trong Zalo Developers
const APP_ID = "2154611541573635802";
const APP_SECRET = "K01iCwiDSG6lRn33FIQT";
const REDIRECT_URI = "https://zalo-login.onrender.com/auth/callback";
// hoặc "https://xxx.ngrok-free.app/auth/callback" khi test local

// ===== Helpers =====

// Tạo code_verifier (43 ký tự random)
function generateCodeVerifier(length = 43) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Tạo code_challenge từ code_verifier
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Tạo appsecret_proof (dùng khi call API user info)
function generateAppSecretProof(accessToken, appSecret) {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

// ===== Routes =====

// Trang Home với nút login
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
       <meta name="zalo-platform-site-verification" content="RV26S8lY87j0rODJnSGjNpBpzqRUXIGQCpSt" />
        <title>Login Zalo Demo</title>
      </head>
      <body style="font-family:sans-serif;text-align:center;margin-top:100px;">
        <h1>Trang Home</h1>
        <a href="/login"
           style="display:inline-block;padding:12px 20px;background:#0068ff;color:white;text-decoration:none;border-radius:8px;">
           Đăng nhập với Zalo
        </a>
      </body>
    </html>
  `);
});

// Step 1: Redirect sang Zalo
app.get("/login", (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Đóng gói state (gồm code_verifier + nonce chống CSRF)
  const stateObj = {
    verifier: codeVerifier,
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");

  const zaloLoginUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&state=${state}&code_challenge=${codeChallenge}`;

  res.redirect(zaloLoginUrl);
});

// Step 2: Callback từ Zalo
app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.send("❌ Không có code từ Zalo!");
  if (!state) return res.send("❌ Không có state!");

  // Giải mã state để lấy code_verifier
  let codeVerifier;
  try {
    const stateObj = JSON.parse(Buffer.from(state, "base64url").toString());
    codeVerifier = stateObj.verifier;
  } catch (e) {
    return res.send("❌ State không hợp lệ!");
  }

  try {
    // Đổi code -> access_token
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
          grant_type: "authorization_code",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return res.send("❌ Không lấy được access_token: " + JSON.stringify(tokenRes.data));
    }

    // Tạo appsecret_proof
    const appSecretProof = generateAppSecretProof(accessToken, APP_SECRET);

    // Gọi API lấy user info
    const userRes = await axios.get("https://graph.zalo.me/v2.0/me", {
      params: {
        access_token: accessToken,
        fields: "id,name,picture",
      },
      headers: {
        appsecret_proof: appSecretProof,
      },
    });

    // Hiển thị thông tin user
    res.send(`
      <h2>Thông tin user</h2>
      <p><b>ID:</b> ${userRes.data.id}</p>
      <p><b>Name:</b> ${userRes.data.name}</p>
      <img src="${userRes.data.picture.data.url}" width="100"/>
      <br><br>
      <a href="/">⬅️ Quay lại Home</a>
    `);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// Start server
app.listen(3000, () => {
  console.log("🚀 Server chạy tại http://localhost:3000");
});
