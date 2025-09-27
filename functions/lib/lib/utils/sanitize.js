"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizePlainText = sanitizePlainText;
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
const sanitizer = isomorphic_dompurify_1.default;
function sanitizePlainText(input) {
    const cleaned = sanitizer.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return typeof cleaned === "string" ? cleaned.trim() : "";
}
