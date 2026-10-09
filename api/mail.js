import { handleMail } from "../lib/mailbox.mjs";

export default function handler(req, res) {
  return handleMail(req, res);
}
