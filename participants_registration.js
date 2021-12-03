/* This script implements a registration system for the secret santa of my family.
 *
 * It basically hooks up in a whatsapp account and listen for messages on it.
 * When this program is started it listens for new messages and register new participants in the secret santa.
 * It checks for duplicated names and empty names also.
 * 
 * To keep track of the conversation, the script uses a local sqlite database to store user basic information
 * and state. We use a simple state machine that considers the following states:
 * 
 * - kStateNew => When we receive a message from a user that we don't have a previous record. In this case
 *                we ask the user for its name and transition to the state kStateRequestName.
 * - kStateRequestName => In this state we have requested the user for their name. So when a message arrives,
 *                we consider that it contains the user name. We do some basic checks for duplicates or empty
 *                values. If there is a problem, we ask the user for their name again. If everything is good
 *                we transition to the state kStateConfirmName.
 * - kStateConfirmName => In this state, we already received a name value from the user and asked him to confirm
 *                        if that is ok. If the user confirms the name. We store it and transition to the state
 *                        kStateRegistered.
 * - KStateRegistered => In this state, the user has already provided and confirmed their name. If a message is
 *                       received in this stage we present the user with the possibility of sending the keyword
 *                       'lista' to receive the list of users current registered.
 * 
 * This script just collects the users who are willing to participate in the secret santa.
 * When the registration phase is done. You should close finish this script and use the script
 * secret_solver to define the person who each participant is associated with in the secret santa. 
*/

import { Contact } from './database.js';
import { client } from './whatsapp_client.js';

// Define the possible user states.
const kStateNew = 0;
const kStateRequestName = 1;
const kStateConfirmName = 2;
const kStateRegistered = 3;

// Check the local database for the current user state.
async function checkContactState(contact_address) {
    // try to find the contact in the database
    const contact = await Contact.findByPk(contact_address);
    if (contact === null) {
        return kStateNew;
    } else {
        return contact.state;
    }
}

// This function is called when there is no record for the source of the message.
// In this case we need to explain what the bot is about and ask the user for its name.
// The user is registered in the local database to keep track of the conversation.
async function processStateNew(message) {
    const contact = {
        id: message.from,
        state: kStateRequestName,
        name: ''
    };
    try {
        await Contact.create(contact);
    } catch (error) {
        console.log(`Something went wrong while processing kStateNew: ${error}`);
        await client.sendText(message.from, `Alguma coisa deu errado. Pode me enviar a mensagem novamente, por favor?`);
        return;
    }
    try {
        await client.sendText(message.from,
            `Olá. Esse é o bot do amigo oculto da casa da vó Tuta. ` +
            `Verifiquei aqui e vi que você ainda não está participando do amigo oculto. ` +
            `Mas tudo bem. Só preciso do seu nome para adicionar você. Me envie agora seu nome por favor.`
        );
    } catch (error) {
        console.log(`Something went wrong while trying to send a message in the state new.`);
    }
}

async function processStateRequestName(message) {
    // converts the name to pascal case
    const receivedName = message.body.trim().replace(/(\w)(\w*)/g,
        function (_, g1, g2) { return g1.toUpperCase() + g2.toLowerCase(); });

    // Check if the name is empty
    try {
        if (receivedName.length === 0) {
            client.sendText(message.from, `Parece que recebi um nome em branco. Pode mandar seu nome novamente, por favor?`);
            return;
        }
    } catch (error) {
        console.log(`Error while checking for empty name in kStateRequestName.`);
        return;
    }

    // Check if there is someone with the same name
    try {
        const contacts = await Contact.findAll({ where: { name: receivedName } });
        if (contacts.length > 0) {
            client.sendText(message.from, `Parece que outra pessoa já usou esse nome. ` +
                `Por favor, envie um nome que diferencie você de alguma forma. Adicione algo ao nome ou use um apelido. Envie o novo nome:`);
            return;
        }
    } catch (error) {
        console.log('Error while trying to process kStateRequestName');
        return;
    }

    // Stores the name and ask for confirmation. 
    try {
        const contact = await Contact.findByPk(message.from);
        contact.state = kStateConfirmName;
        contact.name = receivedName;
        await contact.save();
    } catch (error) {
        console.log("Error while saving contact information in kStateRequestName");
        await client.sendText(message.from, `Alguma coisa deu errado. Pode me enviar a mensagem novamente, por favor?`);
        return;
    }
    try {
        await client.sendText(message.from,
            `Certo, adicionei você aqui. Você confirma que seu nome é *${receivedName}*? ` +
            `Envie *1* para confirmar, ou *2* para corrigir seu nome.`);
    } catch (error) {
        console.log(`Something went wrong while trying to send a message in the state new.`);
    }
}

async function processStateConfirmName(message) {
    const receivedOption = message.body.trim();
    if (receivedOption === "1") {
        try {
            const contact = await Contact.findByPk(message.from);
            contact.state = kStateRegistered;
            await contact.save();
        } catch (error) {
            console.log("Error while saving contact information in kStateConfirmName");
            await client.sendText(message.from, `Alguma coisa deu errado. Pode me enviar a mensagem novamente, por favor?`);
            return;
        }
        try {
            await client.sendText(message.from, `Parabéns. Agora você está participando do amigo oculto!!! \n\nQuando o sorteio do amigo oculto for feito você receberá uma mensagem aqui no whatsapp com o nome da pessoa com quem você saiu. \n\nSe quiser ver a lista de pessoas que está participando me envie a palavra *lista*. `);
        } catch (error) {
            console.log(`Something went wrong while trying to send a message in the state kStateConfirmName.`);
            return;
        }
    } else if (receivedOption === "2") {
        try {
            const contact = await Contact.findByPk(message.from);
            contact.state = kStateRequestName;
            contact.name = '';
            await contact.save();
        } catch (error) {
            console.log("Error while saving contact information in kStateConfirmName");
            await client.sendText(message.from, `Alguma coisa deu errado. Pode me enviar a mensagem novamente, por favor?`);
            return;
        }
        try {
            await client.sendText(message.from, `Certo. Me mande seu nome novamente, por favor, que eu já vou corrigir aqui.`);
        } catch (error) {
            console.log(`Something went wrong while trying to send a message in the state kStateConfirmName.`);
            return;
        }
    } else {
        try {
            const contact = await Contact.findByPk(message.from);
            await client.sendText(message.from, `Opção inválida. Por favor, mande *1* para confirmar que seu nome é *${contact.name}*. Ou mande *2* para corrigir seu nome.`);
        } catch (error) {
            console.log(`Something went wrong while trying to send a message in the state kStateConfirmName.`);
            return;
        }
    }
}

async function processStateRegistered(message) {
    const receivedOption = message.body.trim().toLowerCase();
    if (receivedOption === "lista") {
        const contacts = await Contact.findAll({
            where: { state: kStateRegistered },
            order: [["name", "ASC"]]
        });
        const messageText = [`A lista de pessoas participando do amigo oculto é:\n`];
        for (let contact of contacts) {
            messageText.push(contact.name);
        }
        await client.sendText(message.from, messageText.join("\n"));
    } else {
        await client.sendText(message.from, `Opção inválida. Envia *lista* se deseja ver a lista de pessoas participando.`);
    }
}

async function processMessage(message) {
    const contactState = await checkContactState(message.from);
    if (contactState === kStateNew) {
        await processStateNew(message);
    } else if (contactState == kStateRequestName) {
        await processStateRequestName(message);
    } else if (contactState == kStateConfirmName) {
        await processStateConfirmName(message);
    } else if (contactState == kStateRegistered) {
        await processStateRegistered(message);
    }
}

// Register the message processing pipeline.
client.onMessage(processMessage);
