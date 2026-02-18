require("dotenv").config();
const path = require("path");
const express = require("express");

const createCheckoutSession = require("./api/create-checkout-session");
const createPortalSession = require("./api/create-portal-session");
const stripeWebhook = require("./api/stripe-webhook");

const app = express();
const PORT = process.env.PORT || 3000;

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.use(express.json());

app.post("/api/create-checkout-session", createCheckoutSession);
app.post("/api/create-portal-session", createPortalSession);

app.use(express.static(path.join(__dirname)));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Bunker local running on http://localhost:${PORT}`);
});