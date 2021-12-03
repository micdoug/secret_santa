import { Contact, database } from "./database.js";
import { client } from "./whatsapp_client.js";

const kStateRegistered = 3;

function shuffleContacts(contacts) {
    while (true) {
        const contactsCopy = contacts.slice();
        for (let i = contactsCopy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = contactsCopy[i];
            contactsCopy[i] = contactsCopy[j];
            contactsCopy[j] = temp;
        }

        // Sanity check: A person cannot be associated with itself
        let has_conflict = false;
        for (let i = 0; i < contacts.length; i++) {
            if (contacts[i].id === contactsCopy[i].id) {
                console.log(`Conflict found with ${contacts[i].name}. Shuffling again`);
                has_conflict = true;
                break;
            }
        }

        // Sanity check: The two sets must contain all the elements
        for (let i = 0; i < contacts.length; i++) {
            console.log("Checking if all contacts are present.");
            const lset = new Set(contacts.map((contact) => contact.id));
            const rset = new Set(contactsCopy.map((contact) => contact.id));

            const diffset = new Set([...lset].filter((id) => !rset.has(id)));
            console.log(diffset);
            if (diffset.size !== 0) {
                console.log("Missing contacts during shuffling.");
                process.exit(1);
            }
        }
        if (!has_conflict) {
            return contactsCopy;
        }
    }
}


// Check for the list of people that are currently registered.
const contacts = await Contact.findAll({ where: { state: kStateRegistered } });

console.log(`Starting the suffle proccess for ${contacts.length} participants.`);

const shuffledContacts = shuffleContacts(contacts);

let transaction;
try {
    transaction = await database.transaction();
    for (let i = 0; i < contacts.length; i++) {
        const lcontact = contacts[i];
        const rcontact = shuffledContacts[i];
        lcontact.friend = rcontact.id;
        await lcontact.save({ transaction: transaction });
    }
    for (let i = 0; i < contacts.length; i++) {
        const lcontact = contacts[i];
        const rcontact = shuffledContacts[i];
        await client.sendText(lcontact.id, `Olá ${lcontact.name}. O sorteio do amigo oculto foi feito. Você saiu com *${rcontact.name}!!!*`);
    }
    await transaction.commit();
} catch (error) {
    console.log("Error when creating transaction.");
    console.log(error);
    // Rollback transaction only if the transaction object is defined
    if (transaction) await transaction.rollback();
}

await client.close();
process.exit(0);

