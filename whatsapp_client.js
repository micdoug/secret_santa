/* This file initializes a whatsapp client and exposes it.
 *
 * Client libraries can register in the client.onMessage event
 * to process incoming messages. There are other methods available
 * in the client. You can check the documentation at 
 * https://wppconnect-team.github.io/wppconnect/classes/Whatsapp.html .
*/

import { create } from '@wppconnect-team/wppconnect';


// If there is a previous stored connection credentials in a local
// './tokens' folder it will reuse it and just return the client.
// Otherwise, a QR code will be displayed in the terminal to link
// the client from an account from the phone app. You should use the
// whatsapp client in the phone and scan the qrcode.
export const client = await create();

