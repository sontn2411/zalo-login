import express from "express";
import axios from "axios";

const app = express();

// 👉 Thay bằng App ID và Secret của bạn trên Zalo Developers
const APP_ID = "190841530267471833";
const APP_SECRET = "K01iCwiDSG6lRn33FIQT";
const REDIRECT_URI = "http://localhost:3000/auth/callback";

// Home page có nút login
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Login Zalo Demo</title>
        <meta name="zalo-platform-site-verification" content="RV26S8lY87j0rODJnSGjNpBpzqRUXIGQCpSt" />
        <style>
          body { font-family: sans-serif; text-align: center; margin-top: 100px; }
          a {
            display: inline-block;
            padding: 12px 20px;
            background: #0068ff;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-size: 16px;
          }
          a:hover { background: #004ecc; }
        </style>
      </head>
      <body>
        <h1>Trang Home</h1>
        <a href="/login">Login với Zalo</a>
      </body>
    </html>
  `);
});

// Bước 1: Nút login (redirect sang Zalo)
app.get("/login", (req, res) => {
  const state = "test123"; // random string để chống giả mạo
  const zaloLoginUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&state=${state}`;
  res.redirect(zaloLoginUrl);
});

// Bước 2: Callback khi user login thành công
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send("Không có code từ Zalo!");

  try {
    // Đổi code lấy access_token
    const tokenRes = await axios.post(
      "https://oauth.zaloapp.com/v4/access_token",
      null,
      {
        params: {
          app_id: APP_ID,
          app_secret: APP_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Lấy thông tin user
    const userRes = await axios.get("https://graph.zalo.me/v2.0/me", {
      params: {
        access_token: accessToken,
        fields: "id,name,picture",
      },
    });

    res.send(`
      <html>
        <head>
          <title>Kết quả login</title>
          <meta name="zalo-platform-site-verification" content="RV26S8lY87j0rODJnSGjNpBpzqRUXIGQCpSt" />
        </head>
        <body>
          <h2>Thông tin user</h2>
          <p><b>ID:</b> ${userRes.data.id}</p>
          <p><b>Name:</b> ${userRes.data.name}</p>
          <img src="${userRes.data.picture.data.url}" alt="avatar" width="100"/>
          <br><br>
          <a href="/">Quay lại Home</a>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.listen(3000, () =>
  console.log("Server chạy tại http://localhost:3000")
);
