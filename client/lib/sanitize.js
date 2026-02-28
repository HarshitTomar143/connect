import DOMPurify from "dompurify";

export const sanitizeContent = (content) => {
  if (!content) return "";
  // Only allow basic text content, no HTML tags
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [] });
};

export const stripHtml = (html) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};
