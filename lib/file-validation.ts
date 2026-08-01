/**
 * File Upload MIME type and extension validator
 */
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "zip",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "dwg",
  "csv",
  "txt",
];

export const DANGEROUS_EXTENSIONS = [
  "exe",
  "bat",
  "cmd",
  "sh",
  "php",
  "js",
  "vbs",
  "jar",
  "scr",
  "pif",
  "com",
  "htm",
  "html",
];

export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB

  if (file.size > MAX_SIZE) {
    return { valid: false, error: "File size exceeds 25MB maximum limit." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && DANGEROUS_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Executable or script extension .${ext} is strictly prohibited.` };
  }

  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `File type .${ext} is not allowed. Allowed types: PDF, Images, Office Docs, CAD, ZIP.` };
  }

  return { valid: true };
}
