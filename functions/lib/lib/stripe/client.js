"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStripeConfigured = isStripeConfigured;
exports.getStripeClient = getStripeClient;
const stripe_1 = __importDefault(require("stripe"));
const DEFAULT_API_VERSION = "2024-06-20";
const STRIPE_APP_NAME = "Sei no Monshou III";
const globalStripe = globalThis;
function resolveApiVersion() {
    const configured = process.env.STRIPE_API_VERSION;
    if (configured && configured.trim().length > 0) {
        return configured.trim();
    }
    return DEFAULT_API_VERSION;
}
function createStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || secretKey.trim().length === 0) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    return new stripe_1.default(secretKey, {
        apiVersion: resolveApiVersion(),
        appInfo: {
            name: STRIPE_APP_NAME,
            version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
            url: process.env.NEXT_PUBLIC_APP_URL,
        },
        maxNetworkRetries: 2,
        timeout: 20000,
    });
}
function isStripeConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length > 0);
}
function getStripeClient() {
    if (!globalStripe.__STRIPE_CLIENT__) {
        globalStripe.__STRIPE_CLIENT__ = createStripeClient();
    }
    return globalStripe.__STRIPE_CLIENT__;
}
