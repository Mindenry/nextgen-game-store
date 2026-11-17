import { Buffer } from "node:buffer";

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.CART_COOKIE_SECRET = "test-cart-secret";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
