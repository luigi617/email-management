// src/utils/detailFormat.ts
import { formatDate, formatAddressList } from './emailFormat';
import type { EmailMessage } from '../types/email';

export function getDetailHeader(msg: EmailMessage | null) {
  const subj = msg?.subject || '(no subject)';
  const fromObj = msg?.from_email;
  const fromAddr = fromObj?.name || fromObj?.email || '(unknown sender)';

  const toList = msg?.to || [];
  const toAddr = formatAddressList(toList);

  const ccList = msg?.cc || [];
  const ccAddr = formatAddressList(ccList);

  const dateVal = msg?.received_at;
  const dateVerbose = formatDate(dateVal, true);

  return {
    account: msg?.ref.account || '',
    mailbox: msg?.ref.mailbox || '',
    uid: msg?.ref.uid || -1,
    subject: subj,
    fromLine: `From: ${fromAddr}`,
    toLine: toAddr ? `To: ${toAddr}` : '',
    ccLine: ccAddr ? `CC: ${ccAddr}` : '',
    dateLine: `Date: ${dateVerbose}`,
    attachments: msg?.attachments || [],
    html: msg?.html || '',
    text: msg?.text || '',
  };
}
